#!/usr/bin/env python3
"""Collect high-signal AI candidates and send them to jion's review queue.

Candidates request review. The backend applies its existing publication policy;
missing source evidence is left empty instead of filling publication fields.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib import error, parse, request
from xml.etree import ElementTree

try:
    from scripts.signal_source_notes import extract_source_notes, source_summary
except ModuleNotFoundError:
    from signal_source_notes import extract_source_notes, source_summary


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCES = ROOT / "config" / "signal_sources.json"
USER_AGENT = "jion-signal-collector/1.0 (+https://jionc.com)"
AI_STRONG_PATTERNS = tuple(
    re.compile(pattern, re.I)
    for pattern in (
        r"\bai\b", r"\bllms?\b", r"\bslms?\b", r"\bgpt(?:-?\d[\w.-]*)?\b",
        r"\bclaude\b", r"\bgemini\b", r"\bllama\b", r"\btransformers?\b",
        r"\blanguage models?\b", r"\bmultimodal\b", r"\brag\b",
        r"fine[- ]?tun", r"quantiz", r"embedding", r"인공지능", r"언어 모델",
        r"에이전트", r"파인튜닝", r"추론", r"프롬프트",
    )
)
AI_CONTEXT_PATTERNS = tuple(
    re.compile(pattern, re.I)
    for pattern in (
        r"\bagents?\b", r"\binference\b", r"\bprompts?\b",
        r"\bbenchmarks?\b", r"\bmodels?\b", r"\btokens?\b",
    )
)
TRACKING_QUERY_KEYS = {"fbclid", "gclid", "igshid", "mc_cid", "mc_eid", "ref", "source"}


@dataclass
class Candidate:
    title: str
    summary: str
    source_name: str
    source_url: str
    source_kind: str
    content_kind: str
    source_published_at: str | None = None
    verification_level: str = "official"
    tags: list[str] | None = None
    score: float = 0.0
    original_title: str | None = None
    image_url: str | None = None
    external_reactions: int = 0
    source_text: str | None = None

    def payload(self) -> dict[str, Any]:
        source = self.source_text or self.summary
        summary = source_summary(source, self.summary)
        why_it_matters, try_this = extract_source_notes(source, summary)
        return {
            "title": self.title[:255],
            "summary": summary,
            "original_title": self.original_title,
            "image_url": self.image_url,
            "why_it_matters": why_it_matters,
            "try_this": try_this,
            "content_kind": self.content_kind,
            "source_kind": self.source_kind,
            "source_name": self.source_name[:120],
            "source_url": self.source_url,
            "source_published_at": self.source_published_at,
            "verification_level": self.verification_level,
            "status": "review",
            "tags": self.tags or [],
            "novelty_score": min(1.0, self.score),
            "usefulness_score": min(1.0, self.score * 0.9),
            "importance_score": min(1.0, self.score),
            "external_reactions": max(0, self.external_reactions),
        }


def fetch(url: str, token: str | None = None) -> bytes:
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json, application/atom+xml, application/rss+xml, text/xml, */*"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    with request.urlopen(request.Request(url, headers=headers), timeout=20) as response:
        return response.read()


def clean_text(value: str | None) -> str:
    raw = html.unescape(value or "")
    raw = re.sub(r"<script\b[^>]*>.*?</script>", " ", raw, flags=re.I | re.S)
    raw = re.sub(r"<style\b[^>]*>.*?</style>", " ", raw, flags=re.I | re.S)
    raw = re.sub(r"<[^>]+>", " ", raw)
    return re.sub(r"\s+", " ", raw).strip()


def canonical_source_key(url: str) -> str:
    parsed = parse.urlsplit(url.strip())
    host = (parsed.hostname or "").casefold()
    if host.startswith("www."):
        host = host[4:]
    if ":" in host and not host.startswith("["):
        host = f"[{host}]"
    port = parsed.port
    if port and not (
        (parsed.scheme.casefold() == "http" and port == 80)
        or (parsed.scheme.casefold() == "https" and port == 443)
    ):
        host = f"{host}:{port}"
    path = parsed.path.rstrip("/") or "/"
    query = parse.urlencode(
        sorted(
            (key, value)
            for key, value in parse.parse_qsl(parsed.query, keep_blank_values=True)
            if not key.casefold().startswith("utm_")
            and key.casefold() not in TRACKING_QUERY_KEYS
        ),
        doseq=True,
    )
    return parse.urlunsplit(("", host, path, query, ""))


def iso_date(value: str | None) -> str | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        try:
            parsed = parsedate_to_datetime(value)
        except (TypeError, ValueError):
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat()


def first_text(node: ElementTree.Element, names: tuple[str, ...]) -> str:
    for child in node.iter():
        if child.tag.split("}")[-1].lower() in names and child.text:
            return child.text.strip()
    return ""


def entry_link(node: ElementTree.Element) -> str:
    for child in node.iter():
        if child.tag.split("}")[-1].lower() != "link":
            continue
        href = child.attrib.get("href")
        if href and child.attrib.get("rel", "alternate") in {"alternate", ""}:
            return href
        if child.text and child.text.strip().startswith("http"):
            return child.text.strip()
    return first_text(node, ("guid",))


def entry_image(node: ElementTree.Element, raw_content: str = "") -> str | None:
    for child in node.iter():
        name = child.tag.split("}")[-1].lower()
        url = child.attrib.get("url") or child.attrib.get("href")
        media_type = child.attrib.get("type", "")
        if url and (
            name == "thumbnail"
            or (name in {"content", "enclosure"} and (not media_type or media_type.startswith("image/")))
        ) and url.startswith(("http://", "https://")):
            return url
    match = re.search(r"<img\b[^>]*\bsrc=[\"'](https?://[^\"']+)", raw_content, re.I)
    return html.unescape(match.group(1)) if match else None


def parse_feed(source: dict[str, Any]) -> list[Candidate]:
    root = ElementTree.fromstring(fetch(source["url"]))
    entries = [node for node in root.iter() if node.tag.split("}")[-1].lower() in {"item", "entry"}]
    results = []
    for node in entries[:12]:
        title = clean_text(first_text(node, ("title",)))
        raw_summary = first_text(node, ("encoded", "content")) or first_text(node, ("summary", "description"))
        summary = clean_text(raw_summary)
        link = entry_link(node)
        published = first_text(node, ("published", "updated", "pubdate"))
        if not title or not link or len(summary) < 10 or not relevant(title, summary):
            continue
        results.append(Candidate(
            title=title,
            summary=summary[:1200],
            source_text=raw_summary,
            source_name=source["name"],
            source_url=link,
            source_kind="official_blog" if source.get("official") else "rss",
            content_kind=classify_kind(title, summary, source.get("kind")),
            source_published_at=iso_date(published),
            verification_level="official" if source.get("official") else "unverified",
            tags=extract_tags(title, summary),
            score=score(title, summary, published),
            image_url=entry_image(node, raw_summary),
        ))
    return results


def collect_github(source: dict[str, Any], github_token: str | None) -> list[Candidate]:
    repo = source["repository"]
    url = f"https://api.github.com/repos/{repo}/releases?per_page=5"
    releases = json.loads(fetch(url, github_token).decode("utf-8"))
    results = []
    for release in releases:
        title = clean_text(release.get("name") or release.get("tag_name"))
        raw_body = release.get("body") or ""
        body = clean_text(raw_body)
        link = release.get("html_url")
        if not title or not link or len(body) < 10 or release.get("draft"):
            continue
        results.append(Candidate(
            title=f"{source['name']} {title}",
            summary=body[:1200],
            source_text=raw_body,
            source_name=source["name"],
            source_url=link,
            source_kind="github",
            content_kind=classify_kind(title, body, source.get("kind")),
            source_published_at=iso_date(release.get("published_at")),
            verification_level="official",
            tags=extract_tags(title, body, [source["name"]]),
            score=score(title, body, release.get("published_at")) + 0.1,
            image_url=f"https://opengraph.githubassets.com/jion/{repo}",
        ))
    return results


def collect_arxiv(source: dict[str, Any]) -> list[Candidate]:
    query = parse.urlencode({"search_query": source["query"], "start": 0, "max_results": 8, "sortBy": "submittedDate", "sortOrder": "descending"})
    url = f"https://export.arxiv.org/api/query?{query}"
    root = ElementTree.fromstring(fetch(url))
    entries = [node for node in root if node.tag.split("}")[-1] == "entry"]
    results = []
    for node in entries:
        title = clean_text(first_text(node, ("title",)))
        summary = clean_text(first_text(node, ("summary",)))
        link = entry_link(node)
        published = first_text(node, ("published",))
        if not title or not link or len(summary) < 10:
            continue
        results.append(Candidate(
            title=title,
            summary=summary[:1600],
            source_text=first_text(node, ("summary",)),
            source_name=source["name"],
            source_url=link,
            source_kind="paper",
            content_kind="research",
            source_published_at=iso_date(published),
            verification_level="official",
            tags=extract_tags(title, summary, ["논문", "SLM"]),
            score=score(title, summary, published),
        ))
    return results


def relevant(title: str, summary: str) -> bool:
    haystack = f"{title} {summary}"
    if any(pattern.search(haystack) for pattern in AI_STRONG_PATTERNS):
        return True
    return sum(1 for pattern in AI_CONTEXT_PATTERNS if pattern.search(haystack)) >= 2


def classify_kind(title: str, summary: str, fallback: str | None) -> str:
    text = f"{title} {summary}".casefold()
    if any(term in text for term in ("paper", "research", "benchmark", "dataset", "train", "fine-tun", "논문", "학습")):
        return "research"
    if any(term in text for term in ("release", "launch", "announce", "update", "new model", "출시", "공개", "업데이트")):
        return "release"
    return fallback if fallback in {"release", "workflow", "research"} else "workflow"


def extract_tags(title: str, summary: str, seeds: list[str] | None = None) -> list[str]:
    text = f"{title} {summary}".casefold()
    mapping = {"SLM": ("small language model", "slm"), "LLM": ("large language model", "llm"), "에이전트": ("agent", "에이전트"), "파인튜닝": ("fine-tun", "파인튜닝"), "추론": ("inference", "추론"), "프롬프트": ("prompt", "프롬프트"), "멀티모달": ("multimodal", "멀티모달")}
    tags = list(seeds or [])
    tags.extend(label for label, terms in mapping.items() if any(term in text for term in terms))
    return list(dict.fromkeys(tag[:40] for tag in tags if tag))[:8]


def score(title: str, summary: str, published: str | None, *, now: datetime | None = None) -> float:
    text = f"{title} {summary}"
    matches = sum(
        1
        for pattern in (*AI_STRONG_PATTERNS, *AI_CONTEXT_PATTERNS)
        if pattern.search(text)
    )
    freshness = 0.0
    normalized = iso_date(published)
    if normalized:
        age_days = ((now or datetime.now(timezone.utc)) - datetime.fromisoformat(normalized)).total_seconds() / 86400
        if -1 <= age_days <= 2:
            freshness = 0.30
        elif 2 < age_days <= 7:
            freshness = 0.20
        elif 7 < age_days <= 30:
            freshness = 0.10
        elif 30 < age_days <= 90:
            freshness = 0.03
    return min(1.0, 0.35 + min(matches, 4) * 0.1 + freshness)


def recent_source(published: str | None, *, max_age_days: int = 7, now: datetime | None = None) -> bool:
    normalized = iso_date(published)
    if not normalized:
        return False
    age = ((now or datetime.now(timezone.utc)) - datetime.fromisoformat(normalized)).total_seconds()
    return 0 <= age <= max_age_days * 86400


def post_candidate(api_base: str, token: str, candidate: Candidate) -> str:
    url = f"{api_base.rstrip('/')}/api/v1/signals/ingest"
    body = json.dumps(candidate.payload(), ensure_ascii=False).encode("utf-8")
    req = request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "X-Signal-Bot-Token": token,
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with request.urlopen(req, timeout=20) as response:
            response.read()
        return "created"
    except error.HTTPError as exc:
        if exc.code == 409:
            return "duplicate"
        raise


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Collect AI information for jion's review queue")
    parser.add_argument("--sources", default=str(DEFAULT_SOURCES))
    parser.add_argument("--api-base", default=os.getenv("JION_API_BASE", "http://localhost:8000"))
    parser.add_argument("--token", default=os.getenv("JION_SIGNAL_BOT_TOKEN"))
    parser.add_argument("--max-items", type=int, default=12)
    parser.add_argument("--max-age-days", type=int, default=7, help="Only dated sources from this many days; default 7")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--report", type=Path, help="Write a token-free JSON run report")
    args = parser.parse_args()
    if not 1 <= args.max_items <= 30:
        parser.error("--max-items must be between 1 and 30")
    if not 1 <= args.max_age_days <= 7:
        parser.error("--max-age-days must be between 1 and 7")
    if not args.dry_run and not args.token:
        parser.error("JION_SIGNAL_BOT_TOKEN is required for live collection")

    config = json.loads(Path(args.sources).read_text(encoding="utf-8"))
    candidates: list[Candidate] = []
    github_token = os.getenv("GITHUB_TOKEN")
    collectors = [
        *((item["name"], lambda value=item: collect_github(value, github_token)) for item in config.get("github_repositories", [])),
        *((item["name"], lambda value=item: parse_feed(value)) for item in config.get("feeds", [])),
        *((item["name"], lambda value=item: collect_arxiv(value)) for item in config.get("arxiv_queries", [])),
    ]
    source_errors = []
    empty_sources = []
    def safe_error(exc):
        message = str(exc)
        for secret in (args.token, github_token):
            if secret:
                message = message.replace(secret, '[redacted]')
        return message[:500]
    for name, collect in collectors:
        try:
            items = collect()
            candidates.extend(items)
            if not items:
                empty_sources.append(name)
        except Exception as exc:  # noqa: BLE001
            source_errors.append({'source':name, 'error':safe_error(exc)})
            print(f"[WARN] {name}: {safe_error(exc)}", file=sys.stderr)
        time.sleep(0.4)

    deduped: dict[str, Candidate] = {}
    selection_now = datetime.now(timezone.utc)
    eligible = [item for item in candidates if recent_source(item.source_published_at, max_age_days=args.max_age_days, now=selection_now)]
    for candidate in sorted(eligible, key=lambda item: (item.score, item.source_published_at or ''), reverse=True):
        key = canonical_source_key(candidate.source_url)
        deduped.setdefault(key, candidate)
    selected = list(deduped.values())[: max(1, args.max_items)]
    created = duplicate = failed = 0
    if args.dry_run:
        print(json.dumps([item.payload() for item in selected], ensure_ascii=False, indent=2))
    else:
        for candidate in selected:
            try:
                result = post_candidate(args.api_base, args.token, candidate)
                if result == "created":
                    created += 1
                else:
                    duplicate += 1
            except Exception as exc:  # noqa: BLE001
                failed += 1
                print(f"[ERROR] {candidate.title}: {safe_error(exc)}", file=sys.stderr)
    has_failure = bool(failed or source_errors or not collectors)
    report = {
        'finished_at':datetime.now(timezone.utc).isoformat(), 'dry_run':args.dry_run,
        'status':'failed' if not collectors or len(source_errors) == len(collectors) else 'partial_failure' if has_failure else 'ok',
        'attempted_sources':len(collectors), 'successful_sources':len(collectors)-len(source_errors),
        'collected':len(candidates), 'selected':len(selected), 'created':created,
        'max_age_days':args.max_age_days, 'excluded_by_date':len(candidates)-len(eligible),
        'duplicate':duplicate, 'submit_failures':failed, 'source_failures':source_errors, 'empty_sources':empty_sources,
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"[SUMMARY] status={report['status']} collected={len(candidates)} selected={len(selected)} created={created} duplicate={duplicate} submit_failures={failed} source_failures={len(source_errors)} dry_run={args.dry_run}")
    return 1 if has_failure else 0


if __name__ == "__main__":
    raise SystemExit(main())
