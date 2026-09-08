from datetime import datetime, timezone
from pathlib import Path
import importlib.util

from alembic.migration import MigrationContext
from alembic.operations import Operations
import pytest
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.social import post_write_limiter
from app.core.security import get_password_hash
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.signal import Signal
from app.models.social import SocialPost, SocialPostSignal
from app.models.user import User
from app.models.user_block import UserBlock


@pytest.fixture
def linked_data(client):
    engine = create_engine('sqlite://', poolclass=StaticPool, connect_args={'check_same_thread': False})
    Base.metadata.create_all(engine)
    post_write_limiter.clear()
    with Session(engine) as db:
        password = get_password_hash('password123')
        db.add_all([User(id=i, email=f'user{i}@related.test', username=f'related-user-{i}', hashed_password=password, email_verified=True) for i in [1, 2]])
        db.add_all([Signal(id=i, slug=f'signal-{i}', title=f'Example signal {i}', summary='Example summary for a new tool',
                           status='published' if i < 3 else 'review', verification_level='official', content_kind='release',
                           source_kind='github', source_name='Example source', source_hash=f'related-{i}',
                           source_url=f'https://example.test/{i}', published_at=datetime.now(timezone.utc)) for i in [1, 2, 3]])
        db.commit()
        def override_db():
            yield db
        previous = app.dependency_overrides.get(get_db)
        app.dependency_overrides[get_db] = override_db
        try:
            headers = []
            for i in [1, 2]:
                response = client.post('/api/v1/auth/login', json={'email': f'user{i}@related.test', 'password': 'password123'})
                assert response.status_code == 200
                headers.append({'Authorization': 'Bearer ' + response.json()['access_token']})
            yield client, db, headers[0], headers[1]
        finally:
            if previous is None:
                app.dependency_overrides.pop(get_db, None)
            else:
                app.dependency_overrides[get_db] = previous
    engine.dispose()


def create_post(client, headers, **changes):
    payload = dict(title='Tool experience', content='I tried the tool and learned its limits.', topic='experience', related_signal_id=1)
    payload.update(changes)
    return client.post('/api/v1/community/posts', headers=headers, json=payload)


def test_link_filter_relink_unlink_and_delete(linked_data):
    client, db, author, reader = linked_data
    created = create_post(client, author)
    assert created.status_code == 201
    post = created.json()
    assert post['related_signal'] == {'id': 1, 'slug': 'signal-1', 'title': 'Example signal 1'}
    create_post(client, author, related_signal_id=None)
    create_post(client, author, topic='question')
    filtered = client.get('/api/v1/community/posts?signal_id=1&topic=experience').json()
    assert filtered['total'] == 1
    assert filtered['items'][0]['id'] == post['id']
    path = f"/api/v1/community/posts/{post['id']}"
    assert client.patch(path, headers=reader, json={'related_signal_id': 2}).status_code == 403
    assert client.patch(path, headers=author, json={'title': 'Updated experience'}).json()['related_signal']['id'] == 1
    assert client.patch(path, headers=author, json={'related_signal_id': 2}).json()['related_signal']['id'] == 2
    assert client.get('/api/v1/community/posts?signal_id=2&topic=experience').json()['total'] == 1
    assert client.patch(path, headers=author, json={'related_signal_id': None}).json()['related_signal'] is None
    assert db.get(SocialPostSignal, post['id']) is None
    client.patch(path, headers=author, json={'related_signal_id': 1})
    assert client.delete(path, headers=author).status_code == 204
    assert db.get(SocialPostSignal, post['id']) is None
    assert db.get(Signal, 1) is not None


def test_private_missing_hidden_and_blocked_content_is_not_exposed(linked_data):
    client, db, author, reader = linked_data
    assert create_post(client, author, related_signal_id=3).status_code == 404
    assert create_post(client, author, related_signal_id=999).status_code == 404
    assert create_post(client, author, related_signal_id=-1).status_code == 400
    post = create_post(client, author).json()
    db.add(UserBlock(blocker_id=2, blocked_id=1))
    db.commit()
    assert client.get('/api/v1/community/posts?signal_id=1', headers=reader).json()['total'] == 0
    db.get(SocialPost, post['id']).is_hidden = True
    db.commit()
    assert client.get('/api/v1/community/posts?signal_id=1').json()['total'] == 0
    db.get(SocialPost, post['id']).is_hidden = False
    db.get(Signal, 1).status = 'archived'
    db.commit()
    response = client.get(f"/api/v1/community/posts/{post['id']}")
    assert response.status_code == 200
    assert response.json()['related_signal'] is None
    assert client.get('/api/v1/community/posts?signal_id=1').status_code == 404


def test_lounge_does_not_keep_a_signal_link(linked_data):
    client, db, author, _ = linked_data
    assert create_post(client, author, space='lounge').status_code == 422
    post = create_post(client, author).json()
    changed = client.patch(f"/api/v1/community/posts/{post['id']}", headers=author, json={'space': 'lounge'})
    assert changed.status_code == 200
    assert changed.json()['related_signal'] is None
    assert db.get(SocialPostSignal, post['id']) is None


def test_link_migration_preserves_existing_posts(linked_data):
    client, db, author, _ = linked_data
    post = create_post(client, author, related_signal_id=None).json()
    path = Path(__file__).resolve().parents[1] / 'alembic/versions/202609050002_link_social_posts_to_signals.py'
    spec = importlib.util.spec_from_file_location('related_signal_migration', path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    # Only this fixture's disposable database is changed.
    with db.get_bind().begin() as connection:
        migration.op = Operations(MigrationContext.configure(connection))
        migration.downgrade()
        assert 'social_post_signals' not in inspect(connection).get_table_names()
        migration.upgrade()
        assert 'social_post_signals' in inspect(connection).get_table_names()
        assert connection.execute(select(SocialPost.id).where(SocialPost.id == post['id'])).scalar_one() == post['id']
