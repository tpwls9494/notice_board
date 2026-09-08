from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1 import social
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.signal import Signal
from app.models.social import SocialPost
from app.models.user import User
from app.services.site_activity import get_site_activity


UTC = timezone.utc
NOW = datetime(2026, 9, 5, 3, tzinfo=UTC)


@pytest.fixture
def activity_db():
    # A separate in-memory database; never reset a preview or shared database.
    engine = create_engine('sqlite://', poolclass=StaticPool, connect_args={'check_same_thread': False})
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(User(id=1, email='activity@example.test', username='activity-test', hashed_password='unused'))
        db.commit()
        yield db
    engine.dispose()


def signal(slug, published_at, **changes):
    values = dict(slug=slug, title=slug, summary='An example signal summary', content_kind='release',
                  status='published', verification_level='official', source_kind='github',
                  source_name='Example', source_url=f'https://example.test/{slug}', source_hash=slug,
                  published_at=published_at, source_published_at=NOW - timedelta(days=30))
    values.update(changes)
    return Signal(**values)


def experience(title, created_at, **changes):
    values = dict(user_id=1, title=title, content='A personal experience', space='community',
                  topic='experience', is_hidden=False, created_at=created_at)
    values.update(changes)
    return SocialPost(**values)


def test_counts_use_korean_day_and_week_and_only_public_content(activity_db):
    day_start = datetime(2026, 9, 4, 15, tzinfo=UTC)
    week_start = datetime(2026, 8, 30, 15, tzinfo=UTC)
    activity_db.add_all([
        signal('at-korean-midnight', day_start),
        signal('at-now', NOW),
        signal('yesterday', day_start - timedelta(microseconds=1)),
        signal('future', NOW + timedelta(seconds=1)),
        signal('missing-publication-time', None),
        *[signal(f'not-public-{status}', NOW, status=status) for status in ['candidate', 'review', 'archived', 'rejected']],
        experience('at-week-start', week_start),
        experience('at-now', NOW),
        experience('last-week', week_start - timedelta(microseconds=1)),
        experience('future', NOW + timedelta(seconds=1)),
        experience('hidden', NOW, is_hidden=True),
        experience('lounge', NOW, space='lounge'),
        experience('question', NOW, topic='question'),
    ])
    activity_db.commit()

    result = get_site_activity(activity_db, now=NOW)
    assert result.date.isoformat() == '2026-09-05'
    assert result.week_start.isoformat() == '2026-08-31'
    assert result.today_signals == 2
    assert result.week_experiences == 2


def test_counts_reset_at_korean_monday_midnight(activity_db):
    monday = datetime(2026, 9, 6, 15, tzinfo=UTC)
    sunday = monday - timedelta(microseconds=1)
    activity_db.add_all([signal('sunday', sunday), experience('sunday', sunday)])
    activity_db.commit()
    before = get_site_activity(activity_db, now=sunday)
    after = get_site_activity(activity_db, now=monday)
    assert before.today_signals == before.week_experiences == 1
    assert after.today_signals == after.week_experiences == 0
    assert after.date.isoformat() == after.week_start.isoformat() == '2026-09-07'


def test_public_stats_endpoint_returns_real_zero_without_login(client, activity_db, monkeypatch):
    def override_db():
        yield activity_db

    previous = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_db
    monkeypatch.setattr(social, 'get_site_activity', lambda db: get_site_activity(db, now=NOW))
    try:
        response = client.get('/api/v1/community/stats')
        assert response.status_code == 200
        assert response.json()['today_signals'] == 0
        assert response.json()['week_experiences'] == 0
        assert response.json()['date'] == '2026-09-05'
        assert set(response.json()) == {'date', 'week_start', 'today_signals', 'week_experiences', 'updated_at'}
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous
