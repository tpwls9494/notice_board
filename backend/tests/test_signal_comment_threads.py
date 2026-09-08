import importlib.util
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from app.api.v1.signals import comment_limiter
from app.api.v1.social import comment_write_limiter, post_write_limiter
from app.core.security import create_access_token
from app.db.base import Base, engine
from app.db.session import SessionLocal
from app.models.signal import Signal, SignalComment
from app.models.user import User


@pytest.fixture()
def thread_context(client):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    comment_limiter.clear()
    comment_write_limiter.clear()
    post_write_limiter.clear()
    headers = {}
    with SessionLocal() as db:
        for name in ('admin', 'author', 'reader', 'unverified'):
            user = User(email=name+'@threads.test', username='thread-'+name, hashed_password='unused-test-hash', is_admin=name=='admin', email_verified=name!='unverified', has_local_password=True)
            db.add(user)
            db.flush()
            headers[name] = {'Authorization': 'Bearer '+create_access_token({'sub': str(user.id)})}
        for kind in ('release', 'workflow', 'research'):
            db.add(Signal(slug='thread-'+kind, title='Thread test '+kind, summary='A local test fixture for comment threads.', content_kind=kind, status='published', verification_level='official', source_kind='test', source_name='Test fixture', source_url='https://example.test/'+kind, source_hash=kind, tags=[], evidence=[]))
        db.commit()
    return headers


def add(client, headers, slug, content, parent_id=None):
    response = client.post(f'/api/v1/signals/{slug}/comments', headers=headers, json={'content': content, 'parent_id': parent_id})
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.parametrize('kind', ['release', 'workflow', 'research'])
def test_signal_comment_reply_edit_delete_preserves_thread(client, thread_context, kind):
    h = thread_context
    slug = 'thread-'+kind
    root = add(client, h['author'], slug, '원래 댓글')
    assert root['parent_id'] is None and root['is_deleted'] is False
    reply = add(client, h['reader'], slug, '대댓글', root['id'])
    nested = add(client, h['author'], slug, '답글에 대한 답변', reply['id'])
    assert reply['parent_id'] == nested['parent_id'] == root['id']
    updated = client.patch(f'/api/v1/signals/comments/{root["id"]}', headers=h['author'], json={'content': '  수정한 댓글  '})
    assert updated.status_code == 200
    assert updated.json()['content'] == '수정한 댓글' and updated.json()['updated_at']
    assert client.patch(f'/api/v1/signals/comments/{root["id"]}', headers=h['reader'], json={'content':'도용 수정'}).status_code == 403
    assert client.patch(f'/api/v1/signals/comments/{root["id"]}', headers=h['admin'], json={'content':'대신 수정'}).status_code == 403
    assert client.delete(f'/api/v1/signals/comments/{root["id"]}', headers=h['reader']).status_code == 403
    assert client.delete(f'/api/v1/signals/comments/{root["id"]}', headers=h['author']).status_code == 204
    comments = client.get(f'/api/v1/signals/{slug}/comments').json()
    assert len(comments) == 3
    placeholder = next(row for row in comments if row['id'] == root['id'])
    assert placeholder['is_deleted'] and placeholder['content'] == '삭제된 댓글입니다.'
    assert next(row for row in comments if row['id'] == reply['id'])['content'] == '대댓글'
    assert client.get(f'/api/v1/signals/{slug}').json()['comment_count'] == 2
    listed = client.get('/api/v1/signals/').json()['items']
    assert next(row for row in listed if row['slug'] == slug)['comment_count'] == 2
    assert client.patch(f'/api/v1/signals/comments/{root["id"]}', headers=h['author'], json={'content':'되살리기'}).status_code == 404
    assert client.post(f'/api/v1/signals/{slug}/comments', headers=h['reader'], json={'content':'삭제한 부모에 답글', 'parent_id':reply['id']}).status_code == 404
    for row, owner in ((reply, 'reader'), (nested, 'author')):
        assert client.delete(f'/api/v1/signals/comments/{row["id"]}', headers=h[owner]).status_code == 204
    assert client.get(f'/api/v1/signals/{slug}/comments').json() == []
    assert client.get(f'/api/v1/signals/{slug}').json()['comment_count'] == 0


def test_comment_moderation_redacts_parent_without_losing_replies(client, thread_context):
    h = thread_context
    root = add(client, h['author'], 'thread-research', '숨겨야 할 본문')
    reply = add(client, h['reader'], 'thread-research', '보존할 답글', root['id'])
    endpoint = f'/api/v1/signals/comments/{root["id"]}/moderation'
    assert client.patch(endpoint, headers=h['reader'], json={'hidden': True}).status_code == 403
    assert client.patch(endpoint, headers=h['admin'], json={'hidden': True}).status_code == 204
    comments = client.get('/api/v1/signals/thread-research/comments').json()
    placeholder = next(row for row in comments if row['id'] == root['id'])
    assert placeholder['is_hidden'] and placeholder['user_id'] is None
    assert placeholder['content'] == '숨김 처리된 댓글입니다.' and placeholder['author_username'] == '관리자 숨김'
    assert next(row for row in comments if row['id'] == reply['id'])['parent_id'] == root['id']
    assert client.get('/api/v1/signals/thread-research').json()['comment_count'] == 1
    assert client.post('/api/v1/signals/thread-research/comments', headers=h['reader'], json={'content':'새 답글','parent_id':reply['id']}).status_code == 404
    assert client.patch(endpoint, headers=h['admin'], json={'hidden': False}).status_code == 204
    assert client.get('/api/v1/signals/thread-research/comments').json()[0]['content'] == '숨겨야 할 본문'


def test_parent_scope_auth_and_validation(client, thread_context):
    h = thread_context
    root = add(client, h['author'], 'thread-release', '부모 댓글')
    assert client.post('/api/v1/signals/thread-workflow/comments', headers=h['reader'], json={'content':'다른 글의 댓글','parent_id':root['id']}).status_code == 404
    assert client.post('/api/v1/signals/thread-release/comments', headers=h['reader'], json={'content':'없는 부모','parent_id':99999}).status_code == 404
    # Existing HTTPBearer rejects missing credentials with 403.
    assert client.post('/api/v1/signals/thread-release/comments', json={'content':'로그인 안 함'}).status_code == 403
    assert client.post('/api/v1/signals/thread-release/comments', headers=h['unverified'], json={'content':'인증 안 함'}).status_code == 403
    for content in ('   ', 'x'*5001):
        assert client.post('/api/v1/signals/thread-release/comments', headers=h['author'], json={'content':content}).status_code == 400
        assert client.patch(f'/api/v1/signals/comments/{root["id"]}', headers=h['author'], json={'content':content}).status_code == 400
    with SessionLocal() as db:
        signal = db.query(Signal).filter_by(slug='thread-release').one()
        signal.status = 'review'
        db.commit()
    assert client.get('/api/v1/signals/thread-release/comments').status_code == 404
    assert client.post('/api/v1/signals/thread-release/comments', headers=h['author'], json={'content':'비공개 글에 쓰기'}).status_code == 404
    assert client.patch(f'/api/v1/signals/comments/{root["id"]}', headers=h['author'], json={'content':'비공개 글 수정'}).status_code == 404


def test_legacy_kind_is_preserved_but_not_required(client, thread_context):
    response = client.post('/api/v1/signals/thread-workflow/comments', headers=thread_context['author'], json={'content':'기존 분류를 가진 댓글', 'kind':'tip'})
    assert response.status_code == 201
    comment = response.json()
    response = client.patch(f'/api/v1/signals/comments/{comment["id"]}', headers=thread_context['author'], json={'content':'본문만 수정'})
    assert response.status_code == 200 and response.json()['kind'] == 'tip'
    with SessionLocal() as db:
        assert db.get(SignalComment, comment['id']).kind == 'tip'


def test_community_also_keeps_only_needed_deleted_parents(client, thread_context):
    h = thread_context['author']
    post = client.post('/api/v1/community/posts', headers=h, json={'title':'삭제 표시 확인', 'content':'로컬 테스트', 'topic':'story'}).json()
    endpoint = f'/api/v1/community/posts/{post["id"]}/comments'
    root = client.post(endpoint, headers=h, json={'content':'부모'}).json()
    reply = client.post(endpoint, headers=h, json={'content':'답글', 'parent_id':root['id']}).json()
    assert client.delete(f'/api/v1/community/comments/{root["id"]}', headers=h).status_code == 204
    assert {row['id'] for row in client.get(endpoint).json()} == {root['id'], reply['id']}
    assert client.delete(f'/api/v1/community/comments/{reply["id"]}', headers=h).status_code == 204
    assert client.get(endpoint).json() == []


def test_thread_migration_preserves_existing_comments(tmp_path):
    database = sa.create_engine('sqlite:///'+str(tmp_path/'comments-migration.db'))
    metadata = sa.MetaData()
    users = sa.Table('users', metadata, sa.Column('id', sa.Integer, primary_key=True))
    signals = sa.Table('signals', metadata, sa.Column('id', sa.Integer, primary_key=True))
    comments = sa.Table('signal_comments', metadata, sa.Column('id', sa.Integer, primary_key=True), sa.Column('signal_id', sa.Integer, sa.ForeignKey('signals.id'), nullable=False), sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False), sa.Column('kind', sa.String(30), nullable=False, server_default='question'), sa.Column('content', sa.Text, nullable=False), sa.Column('is_hidden', sa.Boolean, nullable=False, server_default=sa.false()), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    sa.Index('ix_signal_comments_signal_visible_created', comments.c.signal_id, comments.c.is_hidden, comments.c.created_at)
    migration = Path(__file__).resolve().parents[1]/'alembic/versions/202609060001_add_signal_comment_threads.py'
    spec = importlib.util.spec_from_file_location('thread_migration', migration)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with database.begin() as connection:
        metadata.create_all(connection)
        connection.execute(users.insert(), {'id':1})
        connection.execute(signals.insert(), {'id':1})
        connection.execute(comments.insert(), [{'id':1,'signal_id':1,'user_id':1,'kind':'tip','content':'보존할 기존 댓글','is_hidden':False}, {'id':2,'signal_id':1,'user_id':1,'kind':'question','content':'기존 숨김 댓글','is_hidden':True}])
        before = connection.execute(sa.text('SELECT id,signal_id,user_id,kind,content,is_hidden,created_at FROM signal_comments ORDER BY id')).all()
        with Operations.context(MigrationContext.configure(connection)):
            module.upgrade()
        after = connection.execute(sa.text('SELECT id,signal_id,user_id,kind,content,is_hidden,created_at FROM signal_comments ORDER BY id')).all()
        assert before == after
        assert connection.execute(sa.text('SELECT parent_id,is_deleted,updated_at FROM signal_comments')).all() == [(None,0,None),(None,0,None)]
        assert any(fk['referred_table']=='signal_comments' for fk in sa.inspect(connection).get_foreign_keys('signal_comments'))
        assert 'ix_signal_comments_parent_id' in {index['name'] for index in sa.inspect(connection).get_indexes('signal_comments')}
    database.dispose()
