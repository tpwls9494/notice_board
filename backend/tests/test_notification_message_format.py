from app.api.v1.comments import _build_comment_preview
from app.api.v1.notifications import _localize_notification_content


def test_localize_like_notification_from_english():
    content = "alice liked your post."
    localized = _localize_notification_content("like", content)
    assert localized == "alice님이 회원님의 게시글을 좋아합니다."


def test_localize_comment_notification_from_english():
    content = "bob commented on your post."
    localized = _localize_notification_content("comment", content)
    assert localized == "bob님이 회원님의 게시글에 댓글을 남겼습니다."


def test_localize_notification_keeps_korean_message():
    content = "홍길동님이 댓글을 남겼습니다: 확인 부탁드립니다."
    localized = _localize_notification_content("comment", content)
    assert localized == content


def test_comment_preview_normalizes_whitespace():
    preview = _build_comment_preview("  첫 줄\n\n둘째 줄\t  셋째  ")
    assert preview == "첫 줄 둘째 줄 셋째"


def test_comment_preview_truncates_with_ellipsis():
    preview = _build_comment_preview("가나다라마바사아자차카타파하1234567890", limit=10)
    assert preview == "가나다라마바사아자..."
