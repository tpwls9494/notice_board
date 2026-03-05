import hashlib
import json
import logging
import re
import threading
import time
from collections import OrderedDict, defaultdict, deque
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from app.core.config import settings
from app.services.ai_prompts import (
    DEV_QNA_PROMPT,
    EDITOR_HELP_PROMPT,
    INTENT_ROUTER_PROMPT,
    SITE_HELP_PROMPT,
)

logger = logging.getLogger(__name__)

INTENT_DEV_QNA = "DEV_QNA"
INTENT_SITE_HELP = "SITE_HELP"
INTENT_EDITOR_HELP = "EDITOR_HELP"
INTENT_OUT_OF_SCOPE = "OUT_OF_SCOPE"


@dataclass
class ModelCallResult:
    text: str
    model: Optional[str]
    status: str
    error_message: Optional[str]
    latency_ms: float
    prompt_tokens: Optional[int]
    completion_tokens: Optional[int]
    total_tokens: Optional[int]
    cost_usd: Optional[float]


class TTLCache:
    def __init__(self, ttl_seconds: int, max_items: int):
        self.ttl_seconds = ttl_seconds
        self.max_items = max_items
        self._items: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> Any | None:
        now = time.time()
        with self._lock:
            item = self._items.get(key)
            if not item:
                return None
            expires_at, value = item
            if expires_at <= now:
                self._items.pop(key, None)
                return None
            # Keep hot keys at the end.
            self._items.move_to_end(key)
            return value

    def set(self, key: str, value: Any) -> None:
        now = time.time()
        expires_at = now + self.ttl_seconds
        with self._lock:
            self._items[key] = (expires_at, value)
            self._items.move_to_end(key)
            self._evict_if_needed(now)

    def _evict_if_needed(self, now: float) -> None:
        expired_keys = [k for k, (exp, _v) in self._items.items() if exp <= now]
        for key in expired_keys:
            self._items.pop(key, None)
        while len(self._items) > self.max_items:
            self._items.popitem(last=False)


class SlidingWindowRateLimiter:
    def __init__(self, window_seconds: int, max_requests: int):
        self.window_seconds = window_seconds
        self.max_requests = max_requests
        self._buckets: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.time()
        start = now - self.window_seconds
        with self._lock:
            bucket = self._buckets[key]
            while bucket and bucket[0] < start:
                bucket.popleft()
            if len(bucket) >= self.max_requests:
                return False
            bucket.append(now)
            return True


class AiService:
    def __init__(self):
        self._cache = TTLCache(
            ttl_seconds=max(10, int(settings.AI_CACHE_TTL_SECONDS)),
            max_items=max(100, int(settings.AI_CACHE_MAX_ITEMS)),
        )
        self._rate_limiter = SlidingWindowRateLimiter(
            window_seconds=max(1, int(settings.AI_RATE_LIMIT_WINDOW_SECONDS)),
            max_requests=max(1, int(settings.AI_RATE_LIMIT_MAX_REQUESTS)),
        )

    @property
    def is_model_enabled(self) -> bool:
        return bool((settings.AI_API_KEY or "").strip())

    def allow_request(self, endpoint: str, identity: str) -> bool:
        return self._rate_limiter.allow(f"{endpoint}:{identity}")

    def build_input_hash(self, payload: dict[str, Any]) -> str:
        normalized = json.dumps(payload, ensure_ascii=False, sort_keys=True)
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def get_cached(self, key: str) -> Any | None:
        return self._cache.get(key)

    def set_cached(self, key: str, value: Any) -> None:
        self._cache.set(key, value)

    def classify_intent(
        self,
        *,
        message: str,
        source: str,
        action: str | None = None,
        allowed_intents: set[str] | None = None,
        allow_model: bool = True,
    ) -> dict[str, Any]:
        normalized = (message or "").strip().lower()
        if source == "editor_action" or action in {"proofread", "title", "template", "tags", "mask"}:
            return {
                "intent": INTENT_EDITOR_HELP,
                "confidence": 0.99,
                "reason": "editor source/action implies editor intent",
                "method": "rule",
                "_meta": self._meta_from_model_result(None, "success", 0.0, None),
            }

        dev_keywords = {
            "코드",
            "에러",
            "오류",
            "버그",
            "디버그",
            "디버깅",
            "python",
            "fastapi",
            "react",
            "sql",
            "api",
            "테스트",
            "배포",
            "리팩토링",
            "함수",
            "클래스",
            "알고리즘",
            "개발",
            "백엔드",
            "프론트엔드",
            "frontend",
            "backend",
        }
        site_keywords = {
            "회원가입",
            "로그인",
            "로그아웃",
            "비밀번호",
            "마이페이지",
            "알림",
            "글쓰기",
            "게시글",
            "댓글",
            "좋아요",
            "북마크",
            "차단",
            "팔로우",
            "커뮤니티",
            "카테고리",
            "공지",
            "약관",
            "개인정보",
            "문의",
            "서비스",
            "site",
        }
        editor_keywords = {
            "교정",
            "맞춤법",
            "제목 추천",
            "제목",
            "템플릿",
            "태그",
            "마스킹",
            "문장 다듬",
            "proofread",
            "template",
        }
        out_scope_keywords = {
            "주식",
            "코인",
            "로또",
            "도박",
            "불법",
            "해킹",
            "악성코드",
            "의학 진단",
            "법률 자문",
            "정치 선동",
            "성인",
            "adult",
            "gambling",
        }

        scores = {
            INTENT_DEV_QNA: self._keyword_score(normalized, dev_keywords),
            INTENT_SITE_HELP: self._keyword_score(normalized, site_keywords),
            INTENT_EDITOR_HELP: self._keyword_score(normalized, editor_keywords),
            INTENT_OUT_OF_SCOPE: self._keyword_score(normalized, out_scope_keywords),
        }

        ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
        top_intent, top_score = ranked[0]
        second_score = ranked[1][1]
        ambiguous = top_score == 0 or top_score == second_score or (top_score - second_score <= 1 and top_score < 3)

        if top_intent == INTENT_OUT_OF_SCOPE and top_score >= 1:
            decision = {
                "intent": INTENT_OUT_OF_SCOPE,
                "confidence": min(0.95, 0.65 + (0.08 * top_score)),
                "reason": "matched out-of-scope keywords",
                "method": "rule",
                "_meta": self._meta_from_model_result(None, "success", 0.0, None),
            }
            return self._coerce_allowed_intent(decision, allowed_intents, source)

        if not ambiguous:
            decision = {
                "intent": top_intent,
                "confidence": min(0.95, 0.58 + (0.08 * top_score)),
                "reason": "rule keyword score",
                "method": "rule",
                "_meta": self._meta_from_model_result(None, "success", 0.0, None),
            }
            return self._coerce_allowed_intent(decision, allowed_intents, source)

        if allow_model and self.is_model_enabled:
            model_decision = self._classify_with_model(
                message=message,
                source=source,
                action=action,
                allowed_intents=allowed_intents,
            )
            if model_decision:
                return model_decision

        fallback_intent = INTENT_OUT_OF_SCOPE
        if source == "sidebar_chat":
            fallback_intent = INTENT_SITE_HELP
        if allowed_intents and fallback_intent not in allowed_intents:
            fallback_intent = next(iter(allowed_intents))

        return {
            "intent": fallback_intent,
            "confidence": 0.4,
            "reason": "ambiguous input; fallback intent",
            "method": "fallback",
            "_meta": self._meta_from_model_result(None, "failed", 0.0, "ambiguous_intent"),
        }

    def chat_reply(self, *, intent: str, message: str) -> tuple[dict[str, Any], ModelCallResult]:
        if intent == INTENT_OUT_OF_SCOPE:
            return (
                {
                    "answer": self.out_of_scope_refusal(),
                    "suggested_question": self.out_of_scope_pivot_question(),
                },
                ModelCallResult(
                    text="",
                    model=None,
                    status="success",
                    error_message=None,
                    latency_ms=0.0,
                    prompt_tokens=0,
                    completion_tokens=0,
                    total_tokens=0,
                    cost_usd=0.0,
                ),
            )

        if intent == INTENT_DEV_QNA:
            prompt = DEV_QNA_PROMPT
            fallback_answer = self._fallback_dev_qna_answer(message)
        else:
            prompt = SITE_HELP_PROMPT
            fallback_answer = self._fallback_site_help_answer(message)

        model_result = self._call_chat_completion(
            model=settings.AI_CHAT_MODEL,
            system_prompt=prompt,
            user_prompt=message,
            max_tokens=settings.AI_CHAT_MAX_TOKENS,
        )
        if model_result.status == "success" and model_result.text.strip():
            return (
                {
                    "answer": model_result.text.strip(),
                    "suggested_question": None,
                },
                model_result,
            )

        return (
            {
                "answer": fallback_answer,
                "suggested_question": None,
            },
            model_result,
        )

    def editor_reply(self, *, action: str, text: str, title: str | None, category_slug: str | None) -> tuple[dict[str, Any], ModelCallResult]:
        fallback = self._build_editor_fallback(
            action=action,
            text=text,
            title=title,
            category_slug=category_slug,
        )

        model_result = self._call_chat_completion(
            model=settings.AI_EDITOR_MODEL,
            system_prompt=EDITOR_HELP_PROMPT,
            user_prompt=self._editor_user_prompt(
                action=action,
                text=text,
                title=title,
                category_slug=category_slug,
            ),
            max_tokens=settings.AI_EDITOR_MAX_TOKENS,
            temperature=0.0,
        )
        if model_result.status != "success" or not model_result.text.strip():
            return fallback, model_result

        parsed = self._try_parse_json(model_result.text)
        if not isinstance(parsed, dict):
            model_result.status = "invalid_json"
            model_result.error_message = "editor model output is not valid JSON"
            return fallback, model_result

        normalized = self._normalize_editor_json(
            action=action,
            payload=parsed,
            source_text=text,
            source_title=title,
        )
        if not normalized:
            model_result.status = "invalid_schema"
            model_result.error_message = "editor model output does not match expected schema"
            return fallback, model_result
        return normalized, model_result

    def out_of_scope_refusal(self) -> str:
        return "요청하신 주제는 이 도우미의 지원 범위를 벗어나서 답변할 수 없습니다."

    def out_of_scope_pivot_question(self) -> str:
        return "대신 개발 Q&A, 사이트 이용법, 글쓰기 보조 중 어떤 도움을 원하시나요?"

    def _classify_with_model(
        self,
        *,
        message: str,
        source: str,
        action: str | None,
        allowed_intents: set[str] | None,
    ) -> dict[str, Any] | None:
        user_prompt = (
            f"source={source}\n"
            f"action={action or ''}\n"
            f"message={message}\n"
            "Return JSON only."
        )
        model_result = self._call_chat_completion(
            model=settings.AI_ROUTE_MODEL,
            system_prompt=INTENT_ROUTER_PROMPT,
            user_prompt=user_prompt,
            max_tokens=settings.AI_ROUTE_MAX_TOKENS,
            temperature=0.0,
        )
        if model_result.status != "success" or not model_result.text.strip():
            return None

        parsed = self._try_parse_json(model_result.text)
        if not isinstance(parsed, dict):
            return None

        intent = str(parsed.get("intent", "")).strip().upper()
        if intent not in {INTENT_DEV_QNA, INTENT_SITE_HELP, INTENT_EDITOR_HELP, INTENT_OUT_OF_SCOPE}:
            return None
        confidence_raw = parsed.get("confidence", 0.5)
        try:
            confidence = float(confidence_raw)
        except (TypeError, ValueError):
            confidence = 0.5
        confidence = min(1.0, max(0.0, confidence))
        decision = {
            "intent": intent,
            "confidence": confidence,
            "reason": str(parsed.get("reason", "")).strip() or "model classification",
            "method": "model",
            "_meta": self._meta_from_model_result(
                model_result.model,
                model_result.status,
                model_result.latency_ms,
                model_result.error_message,
                prompt_tokens=model_result.prompt_tokens,
                completion_tokens=model_result.completion_tokens,
                total_tokens=model_result.total_tokens,
                cost_usd=model_result.cost_usd,
            ),
        }
        return self._coerce_allowed_intent(decision, allowed_intents, source)

    def _call_chat_completion(
        self,
        *,
        model: str,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int,
        temperature: float = 0.2,
    ) -> ModelCallResult:
        if not self.is_model_enabled:
            return ModelCallResult(
                text="",
                model=None,
                status="disabled",
                error_message="AI_API_KEY is not configured",
                latency_ms=0.0,
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
                cost_usd=0.0,
            )

        api_key = (settings.AI_API_KEY or "").strip()
        base_url = settings.AI_BASE_URL.rstrip("/")
        url = f"{base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }

        # GPT-5 family rejects some legacy Chat Completions parameters.
        token_limit = max(1, int(max_tokens))
        if self._use_max_completion_tokens(model):
            payload["max_completion_tokens"] = token_limit
        else:
            payload["max_tokens"] = token_limit

        if self._supports_temperature(model):
            payload["temperature"] = temperature

        start = time.perf_counter()
        try:
            with httpx.Client(timeout=max(1, int(settings.AI_TIMEOUT_SECONDS))) as client:
                response = client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                body = response.json()
        except httpx.HTTPStatusError as exc:
            latency_ms = (time.perf_counter() - start) * 1000
            response_body = ""
            try:
                response_body = (exc.response.text or "").strip()
            except Exception:
                response_body = ""
            if len(response_body) > 1200:
                response_body = response_body[:1200] + "..."
            detail = str(exc)
            if response_body:
                detail = f"{detail} | body={response_body}"
            logger.warning("AI call failed: %s", detail)
            return ModelCallResult(
                text="",
                model=model,
                status="failed",
                error_message=detail,
                latency_ms=round(latency_ms, 2),
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
                cost_usd=0.0,
            )
        except httpx.TimeoutException:
            latency_ms = (time.perf_counter() - start) * 1000
            return ModelCallResult(
                text="",
                model=model,
                status="timeout",
                error_message="AI request timed out",
                latency_ms=round(latency_ms, 2),
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
                cost_usd=0.0,
            )
        except Exception as exc:
            latency_ms = (time.perf_counter() - start) * 1000
            logger.warning("AI call failed: %s", exc)
            return ModelCallResult(
                text="",
                model=model,
                status="failed",
                error_message=str(exc),
                latency_ms=round(latency_ms, 2),
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
                cost_usd=0.0,
            )

        latency_ms = (time.perf_counter() - start) * 1000
        usage = body.get("usage") or {}
        prompt_tokens = self._safe_int(usage.get("prompt_tokens"))
        completion_tokens = self._safe_int(usage.get("completion_tokens"))
        total_tokens = self._safe_int(usage.get("total_tokens"))
        cost_usd = self._estimate_cost(prompt_tokens, completion_tokens)

        content = ""
        try:
            content = str(body["choices"][0]["message"]["content"] or "")
        except Exception:
            content = ""

        return ModelCallResult(
            text=content,
            model=model,
            status="success",
            error_message=None,
            latency_ms=round(latency_ms, 2),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            cost_usd=cost_usd,
        )

    @staticmethod
    def _is_gpt5_family(model: str) -> bool:
        normalized = str(model or "").strip().lower()
        return normalized.startswith("gpt-5")

    def _use_max_completion_tokens(self, model: str) -> bool:
        normalized = str(model or "").strip().lower()
        return self._is_gpt5_family(normalized) or normalized.startswith("o")

    def _supports_temperature(self, model: str) -> bool:
        # GPT-5 family often rejects temperature unless very specific settings are used.
        # To keep requests stable, omit temperature for GPT-5 models.
        return not self._is_gpt5_family(model)

    def _coerce_allowed_intent(
        self,
        decision: dict[str, Any],
        allowed_intents: set[str] | None,
        source: str,
    ) -> dict[str, Any]:
        if not allowed_intents:
            return decision
        if decision["intent"] in allowed_intents:
            return decision
        # Sidebar chat supports DEV_QNA/SITE_HELP/OUT_OF_SCOPE only.
        if source == "sidebar_chat" and INTENT_SITE_HELP in allowed_intents:
            decision["intent"] = INTENT_SITE_HELP
            decision["reason"] = "intent remapped to SITE_HELP for sidebar_chat"
            decision["confidence"] = min(float(decision.get("confidence", 0.5)), 0.6)
            return decision
        # Generic final fallback.
        decision["intent"] = next(iter(allowed_intents))
        decision["reason"] = "intent remapped to allowed set"
        decision["confidence"] = min(float(decision.get("confidence", 0.5)), 0.5)
        return decision

    @staticmethod
    def _meta_from_model_result(
        model: str | None,
        status: str,
        latency_ms: float,
        error_message: str | None,
        *,
        prompt_tokens: int | None = 0,
        completion_tokens: int | None = 0,
        total_tokens: int | None = 0,
        cost_usd: float | None = 0.0,
    ) -> dict[str, Any]:
        return {
            "model": model,
            "status": status,
            "latency_ms": latency_ms,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "cost_usd": cost_usd,
            "error_message": error_message,
        }

    @staticmethod
    def _keyword_score(text: str, keywords: set[str]) -> int:
        return sum(1 for keyword in keywords if keyword in text)

    @staticmethod
    def _try_parse_json(raw_text: str) -> Any:
        text = raw_text.strip()
        if not text:
            return None

        # Prefer full payload when it is pure JSON.
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Handle fenced JSON blocks.
        fenced_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, flags=re.DOTALL)
        if fenced_match:
            try:
                return json.loads(fenced_match.group(1))
            except json.JSONDecodeError:
                return None

        # Handle prefix/suffix noise.
        first = text.find("{")
        last = text.rfind("}")
        if first >= 0 and last > first:
            chunk = text[first : last + 1]
            try:
                return json.loads(chunk)
            except json.JSONDecodeError:
                return None
        return None

    @staticmethod
    def _safe_int(value: Any) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return 0

    @staticmethod
    def _normalize_spaces(text: str) -> str:
        collapsed = re.sub(r"[ \t]+", " ", text or "")
        collapsed = re.sub(r"\n{3,}", "\n\n", collapsed)
        return collapsed.strip()

    def _estimate_cost(self, prompt_tokens: int, completion_tokens: int) -> float:
        input_rate = float(settings.AI_INPUT_COST_PER_1K_USD or 0.0)
        output_rate = float(settings.AI_OUTPUT_COST_PER_1K_USD or 0.0)
        cost = (prompt_tokens / 1000.0) * input_rate + (completion_tokens / 1000.0) * output_rate
        return round(cost, 8)

    def _fallback_dev_qna_answer(self, message: str) -> str:
        return (
            "현재 모델 응답을 가져오지 못했습니다. 문제 재현 단계, 에러 로그, 기대 결과를 함께 적어주시면 "
            "원인 후보와 점검 순서를 바로 정리해드릴게요."
        )

    def _fallback_site_help_answer(self, message: str) -> str:
        lower = message.lower()
        if "로그인" in lower or "회원가입" in lower:
            return "로그인/회원가입은 상단 메뉴에서 진행할 수 있습니다. 인증 문제가 있으면 /contact에서 문의해 주세요."
        if "게시글" in lower or "글쓰기" in lower:
            return "글쓰기는 로그인 후 상단의 글쓰기 버튼에서 시작할 수 있습니다. 카테고리를 고른 뒤 제목/내용을 저장하세요."
        return "사이트 이용 문의는 커뮤니티, 마이페이지, 알림 메뉴에서 대부분 해결할 수 있습니다. 상세 이슈는 /contact를 이용해 주세요."

    def _editor_user_prompt(
        self,
        *,
        action: str,
        text: str,
        title: str | None,
        category_slug: str | None,
    ) -> str:
        schema = self._editor_schema_hint(action)
        action_guideline = self._editor_action_guideline(action)
        return (
            f"action={action}\n"
            f"category_slug={category_slug or ''}\n"
            f"title={title or ''}\n"
            f"text={text}\n\n"
            f"Action guideline:\n{action_guideline}\n\n"
            f"Return JSON only with schema:\n{schema}"
        )

    @staticmethod
    def _editor_action_guideline(action: str) -> str:
        if action == "proofread":
            return (
                "- Correct grammar/spelling with minimal edits.\n"
                "- Preserve line breaks and paragraph boundaries.\n"
                "- Do not remove indentation unless clearly erroneous."
            )
        if action == "title":
            return (
                "- Generate specific Korean titles reflecting key topics from the input text.\n"
                "- Summarize the actual content rather than using generic templates.\n"
                "- Avoid vague patterns and ban clich\u00e9 endings.\n"
                "- Return 3-5 distinct options."
            )
        if action == "template":
            return (
                "- Build a practical structure adapted to the given text/topic.\n"
                "- Include concrete section headings and checklist items.\n"
                "- Avoid abstract placeholder-only output."
            )
        if action == "tags":
            return (
                "- Return 5-8 concise tags without #.\n"
                "- Prefer technical keywords and remove duplicates."
            )
        return (
            "- Mask only sensitive values (email/phone/url/identifier).\n"
            "- Preserve non-sensitive wording and line breaks."
        )

    def _editor_schema_hint(self, action: str) -> str:
        if action == "proofread":
            return '{"revised_text":"string","changes":["string"],"note":"string"}'
        if action == "title":
            return '{"titles":["string"],"rationale":"string"}'
        if action == "template":
            return '{"template":"string","checklist":["string"]}'
        if action == "tags":
            return '{"tags":["string"]}'
        return '{"masked_text":"string","redactions":["string"]}'

    def _build_editor_fallback(
        self,
        *,
        action: str,
        text: str,
        title: str | None,
        category_slug: str | None,
    ) -> dict[str, Any]:
        if action == "proofread":
            revised = text or ""
            return {
                "revised_text": revised,
                "changes": ["모델 응답을 받지 못해 원문을 유지했습니다."],
                "note": "잠시 후 다시 시도해 주세요.",
            }
        if action == "title":
            titles = self._build_fallback_title_candidates(text=text, title=title)
            return {
                "titles": titles[:5],
                "rationale": "본문 핵심 문장과 키워드를 요약해 제목 후보를 구성했습니다.",
            }
        if action == "template":
            template = (
                "## 배경\n"
                "- 왜 이 글을 쓰는지\n\n"
                "## 핵심 내용\n"
                "- 문제/해결/결과를 순서대로 정리\n\n"
                "## 다음 단계\n"
                "- 앞으로 할 일, 필요한 피드백\n"
            )
            return {
                "template": template,
                "checklist": [
                    "문제와 맥락이 명확한지",
                    "재현/실행 방법이 있는지",
                    "질문 또는 요청이 분명한지",
                ],
            }
        if action == "tags":
            tags = self._extract_keywords(text=(title or "") + " " + text, limit=6)
            return {
                "tags": tags[:6],
            }
        # mask
        return self._mask_sensitive_text(text=text)

    def _normalize_editor_json(
        self,
        *,
        action: str,
        payload: dict[str, Any],
        source_text: str = "",
        source_title: str | None = None,
    ) -> dict[str, Any] | None:
        if action == "proofread":
            revised_text = str(payload.get("revised_text", "")).strip()
            if not revised_text:
                return None
            changes_raw = payload.get("changes", [])
            changes = [str(item).strip() for item in changes_raw if str(item).strip()][:8]
            note = str(payload.get("note", "")).strip() or None
            return {"revised_text": revised_text, "changes": changes, "note": note}
        if action == "title":
            titles_raw = payload.get("titles", [])
            forbidden_phrases = {"경험 공유", "시작 가이드", "진행기와 배운 점"}
            titles: list[str] = []
            for item in titles_raw:
                normalized = str(item).strip()
                if not normalized:
                    continue
                if any(phrase in normalized for phrase in forbidden_phrases):
                    continue
                if re.fullmatch(r"[0-9\W_]+", normalized):
                    continue
                titles.append(normalized)
            titles = self._rank_title_candidates(
                titles=titles,
                source_text=source_text,
                source_title=source_title,
            )[:5]
            if not titles:
                return None
            rationale = str(payload.get("rationale", "")).strip() or None
            return {"titles": titles, "rationale": rationale}
        if action == "template":
            template = str(payload.get("template", "")).strip()
            if not template:
                return None
            checklist_raw = payload.get("checklist", [])
            checklist = [str(item).strip() for item in checklist_raw if str(item).strip()][:10]
            return {"template": template, "checklist": checklist}
        if action == "tags":
            tags_raw = payload.get("tags", [])
            tags = [self._normalize_tag(str(item)) for item in tags_raw]
            tags = [tag for tag in tags if tag][:8]
            if not tags:
                return None
            return {"tags": tags}
        if action == "mask":
            masked_text = str(payload.get("masked_text", "")).strip()
            if not masked_text:
                return None
            redactions_raw = payload.get("redactions", [])
            redactions = [str(item).strip() for item in redactions_raw if str(item).strip()][:20]
            return {"masked_text": masked_text, "redactions": redactions}
        return None

    def _extract_keywords(self, *, text: str, limit: int) -> list[str]:
        tokens = re.findall(r"[A-Za-z0-9가-힣#\-_]{2,25}", (text or "").lower())
        stopwords = {
            "그리고",
            "에서",
            "으로",
            "합니다",
            "하는",
            "대한",
            "with",
            "this",
            "that",
            "there",
            "have",
            "from",
            "using",
            "about",
            "하고",
            "하는법",
            "게시글",
            "커뮤니티",
        }
        counts: dict[str, int] = {}
        for token in tokens:
            normalized = self._normalize_tag(token)
            if not normalized or normalized.isdigit() or normalized in stopwords:
                continue
            counts[normalized] = counts.get(normalized, 0) + 1
        sorted_items = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
        return [item[0] for item in sorted_items[:limit]]

    def _build_fallback_title_candidates(self, *, text: str, title: str | None) -> list[str]:
        source_text = self._normalize_spaces((text or "").replace("\r", "\n"))
        normalized_title = self._normalize_spaces(title or "")
        lines = [line.strip(" -#*[]") for line in source_text.split("\n") if line.strip()]
        first_meaningful_line = next((line for line in lines if len(line) >= 8), "")

        sentence_parts = re.split(r"[.!?\n。]+", source_text)
        first_sentence = next((part.strip() for part in sentence_parts if len(part.strip()) >= 8), "")

        keywords = self._extract_keywords(text=f"{normalized_title} {source_text}", limit=6)
        keyword_pair = " / ".join(keywords[:2]) if len(keywords) >= 2 else (keywords[0] if keywords else "")
        topic_seed = normalized_title or first_sentence or first_meaningful_line or keyword_pair or "이슈"

        base = re.sub(r"\s+", " ", topic_seed).strip().strip(".,:;")
        if len(base) > 42:
            base = f"{base[:42].rstrip()}..."

        candidates = [
            base,
            f"{base} 원인과 해결 정리",
            f"{base} 핵심 포인트 요약",
        ]
        if keyword_pair:
            candidates.append(f"{keyword_pair} 적용 이슈 정리")

        return self._rank_title_candidates(
            titles=[item for item in candidates if item and len(item) >= 6],
            source_text=source_text,
            source_title=normalized_title,
        )

    def _rank_title_candidates(
        self,
        *,
        titles: list[str],
        source_text: str,
        source_title: str | None,
    ) -> list[str]:
        if not titles:
            return []

        source_keywords = self._extract_keywords(
            text=f"{source_title or ''} {source_text or ''}",
            limit=8,
        )

        deduplicated: list[tuple[int, str]] = []
        seen = set()
        for index, raw_title in enumerate(titles):
            normalized = re.sub(r"\s+", " ", str(raw_title or "").strip())
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            deduplicated.append((index, normalized))

        def score_item(item: tuple[int, str]) -> tuple[float, int]:
            original_index, candidate = item
            lower_candidate = candidate.lower()
            score = 0.0
            if 12 <= len(candidate) <= 46:
                score += 1.0
            for keyword in source_keywords[:5]:
                if keyword and keyword in lower_candidate:
                    score += 1.8
            if (source_title or "").strip() and (source_title or "").strip().lower() in lower_candidate:
                score += 2.0
            if re.search(r"(경험 공유|시작 가이드|진행기와 배운 점)", candidate):
                score -= 5.0
            return (score, -original_index)

        ranked = sorted(deduplicated, key=score_item, reverse=True)
        return [title for _, title in ranked]

    @staticmethod
    def _normalize_tag(raw: str) -> str:
        cleaned = re.sub(r"[^A-Za-z0-9가-힣#\-_]", "", raw or "").strip().lower()
        return cleaned[:30]

    def _mask_sensitive_text(self, *, text: str) -> dict[str, Any]:
        redactions: list[str] = []
        masked = text or ""

        patterns = [
            (r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", "[EMAIL]"),
            (r"\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b", "[PHONE]"),
            (r"\b\d{2,6}[-\s]?\d{2,6}[-\s]?\d{2,6}\b", "[NUMBER]"),
            (r"https?://[^\s)]+", "[URL]"),
        ]

        for pattern, replacement in patterns:
            found = re.findall(pattern, masked)
            if found:
                redactions.extend(found[:10])
                masked = re.sub(pattern, replacement, masked)

        redactions = list(dict.fromkeys(redactions))[:20]
        return {
            "masked_text": masked,
            "redactions": redactions,
        }


ai_service = AiService()
