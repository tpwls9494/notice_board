from datetime import datetime, timedelta, timezone

import pytest

from app.crud import signal as crud
from app.db.session import SessionLocal
from app.models.signal import Signal, SignalComment, SignalRecommendation
from app.models.user import User
from test_signals import _reset_db

NOW = datetime(2026, 9, 9, 6, tzinfo=timezone.utc)


@pytest.fixture
def ranking_db(monkeypatch):
    _reset_db()
    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return NOW if tz else NOW.replace(tzinfo=None)
    monkeypatch.setattr(crud, "datetime", Clock)
    with SessionLocal() as db:
        for number in range(1, 5):
            db.add(User(id=number, email=f"rank{number}@jion.test", username=f"rank{number}", hashed_password="unused", email_verified=True))
        db.commit()
        yield db


def story(db, number, **extra):
    values = dict(id=number, slug=f"ranking-{number}", title=f"Ranking example {number}",
                  summary="An example for local ranking tests", content_kind="release", status="published",
                  source_kind="web", source_name="Example", source_url=f"https://example.com/{number}",
                  source_hash=str(number), submitted_by_id=1, published_at=NOW - timedelta(days=number))
    db.add(Signal(**{**values, **extra})); db.commit()


def recommend(db, signal, user, age=0):
    db.add(SignalRecommendation(signal_id=signal, user_id=user, created_at=NOW-timedelta(hours=age)))


def comment(db, signal, user, age=0, **extra):
    db.add(SignalComment(signal_id=signal, user_id=user, content="Local ranking test",
                         created_at=NOW-timedelta(hours=age), **extra))


def ranked(db, sort="trending", **extra):
    db.commit()
    return crud.get_signals(db, page=1, page_size=20, sort=sort, **extra)


def test_popular_and_trending_use_different_reaction_windows(ranking_db):
    db = ranking_db
    story(db, 1); story(db, 2); story(db, 3, external_reactions=1000000, views=1000000)
    recommend(db, 1, 2, 48); recommend(db, 1, 3, 48)
    recommend(db, 2, 2, 1); comment(db, 2, 3, 1)
    popular, total = ranked(db, "popular")
    assert [s.id for s in popular] == [1, 2] and total == 2
    trending, total = ranked(db)
    assert [s.id for s in trending] == [2] and total == 1
    assert trending[0].ranking_score == 3
    assert trending[0].ranking_recommendations == 1
    assert trending[0].ranking_commenters == 1
    assert trending[0].ranking_participants == 2


def test_unique_people_self_hidden_deleted_future_and_exact_cutoff(ranking_db):
    db = ranking_db
    story(db, 1)
    recommend(db, 1, 1); comment(db, 1, 1)
    recommend(db, 1, 2)
    for _ in range(20): comment(db, 1, 2)
    comment(db, 1, 3, is_deleted=True)
    comment(db, 1, 3, is_hidden=True)
    comment(db, 1, 3, age=-1)
    assert ranked(db)[1] == 0  # One person recommending AND commenting is still one participant.
    comment(db, 1, 3, age=6)
    results, total = ranked(db)
    assert total == 1
    assert results[0].ranking_score == 4  # One recommendation + two distinct commenters.
    assert results[0].ranking_participants == 2


def test_cancellation_and_old_comment_edits_do_not_create_trends(ranking_db):
    db = ranking_db
    story(db, 1)
    recommend(db, 1, 2)
    comment(db, 1, 3, age=7, updated_at=NOW)
    assert ranked(db)[1] == 0
    assert ranked(db, "popular")[1] == 1
    db.query(SignalRecommendation).filter_by(signal_id=1, user_id=2).delete()
    assert ranked(db, "popular")[1] == 0


def test_visibility_exclusion_search_kind_and_stable_pagination(ranking_db):
    db = ranking_db
    for i in range(1, 5):
        story(db, i, status="review" if i == 4 else "published", published_at=NOW,
              content_kind="research" if i == 3 else "release")
        recommend(db, i, 2); recommend(db, i, 3)
    results, total = ranked(db)
    assert [s.id for s in results] == [3, 2, 1] and total == 3
    assert [s.id for s in ranked(db, exclude_id=3)[0]] == [2, 1]
    assert ranked(db, content_kind="research")[1] == 1
    assert ranked(db, search="example 2")[1] == 1
    page, total = crud.get_signals(db, page=2, page_size=1, sort="trending")
    assert page[0].id == 2 and total == 3


def test_latest_is_publication_order_not_featured_or_source_date(ranking_db):
    db = ranking_db
    story(db, 1, is_featured=True)
    story(db, 2, published_at=NOW, source_published_at=NOW-timedelta(days=100))
    assert [s.id for s in ranked(db, "latest")[0]] == [2, 1]


def test_ranked_api_returns_window_metrics_and_validates_sort(ranking_db, client):
    db = ranking_db
    story(db, 1)
    recommend(db, 1, 2); comment(db, 1, 3); db.commit()
    response = client.get("/api/v1/signals/?sort=trending")
    assert response.status_code == 200
    assert response.json()["items"][0]["ranking_participants"] == 2
    assert response.json()["items"][0]["ranking_score"] == 3
    assert client.get("/api/v1/signals/?sort=trending&exclude_id=1").json()["total"] == 0
    assert client.get("/api/v1/signals/?sort=unknown").status_code == 400
