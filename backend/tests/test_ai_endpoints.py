import pytest

from app.schemas.ai import AiEditorRequest
from app.services.ai_service import (
    INTENT_DEV_QNA,
    INTENT_EDITOR_HELP,
    INTENT_OUT_OF_SCOPE,
    ai_service,
)


def test_intent_router_classifies_dev_qna():
    decision = ai_service.classify_intent(
        message="FastAPI API 에러 디버깅 순서를 알려줘",
        source="sidebar_chat",
        allowed_intents={INTENT_DEV_QNA, "SITE_HELP", INTENT_OUT_OF_SCOPE},
        allow_model=False,
    )
    assert decision["intent"] == INTENT_DEV_QNA


def test_chat_reply_out_of_scope_shape():
    reply, meta = ai_service.chat_reply(intent=INTENT_OUT_OF_SCOPE, message="로또 번호 알려줘")
    assert isinstance(reply["answer"], str) and reply["answer"].strip()
    assert isinstance(reply["suggested_question"], str) and reply["suggested_question"].strip()
    assert meta.status == "success"


def test_editor_tags_response_is_json_shape():
    payload, meta = ai_service.editor_reply(
        action="tags",
        text="nginx, docker compose, fastapi 배포 이슈를 정리했습니다.",
        title="FastAPI 배포 삽질기",
        category_slug="qna",
    )
    assert isinstance(payload["tags"], list)
    assert len(payload["tags"]) >= 1
    assert meta.status in {"success", "disabled", "failed", "timeout", "invalid_json", "invalid_schema"}


def test_editor_request_rejects_empty_text_and_title():
    with pytest.raises(ValueError):
        AiEditorRequest(
            source="editor_action",
            action="proofread",
            text="",
            title="",
        )


def test_intent_router_returns_editor_help_for_editor_source():
    decision = ai_service.classify_intent(
        message="제목을 추천해줘",
        source="editor_action",
        action="title",
        allow_model=False,
    )
    assert decision["intent"] == INTENT_EDITOR_HELP


def test_fallback_title_candidates_are_not_generic():
    titles = ai_service._build_fallback_title_candidates(
        text="케이뱅크 상장 첫날 주가 흐름과 공모가 대비 상승 폭을 정리한다.",
        title="",
    )
    assert len(titles) >= 1
    assert all("경험 공유" not in title for title in titles)
    assert any("케이뱅크" in title for title in titles)
