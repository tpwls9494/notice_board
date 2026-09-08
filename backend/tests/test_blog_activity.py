import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.api.deps import get_current_user, get_current_user_optional, get_current_verified_user
from app.api.v1.blog_activity import comment_limiter
from app.models.user import User
from app.models.blog_post import BlogPost, BlogLike, BlogComment


@pytest.fixture()
def blog_client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as db:
        db.add_all([User(id=i, email=f"blog{i}@example.test", username=f"reader{i}", hashed_password="unused", email_verified=True) for i in (1, 2)])
        db.flush()
        db.add_all([BlogPost(id=i, title=f"Post {i}", slug=f"post-{i}", content="Body", user_id=1, is_published=i != 3, views=7) for i in (1, 2, 3)])
        db.commit()
    state = {"user_id": 1}
    def database():
        with factory() as db:
            yield db
    def user():
        with factory() as db:
            return db.get(User, state["user_id"])
    previous = dict(app.dependency_overrides)
    app.dependency_overrides.update({get_db: database, get_current_user: user, get_current_verified_user: user, get_current_user_optional: user})
    comment_limiter.clear()
    try:
        with TestClient(app) as client:
            yield client, state, factory
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()
        comment_limiter.clear()


def test_like_is_idempotent_private_and_scoped(blog_client):
    client, state, _ = blog_client
    for _ in range(2):
        result = client.put("/api/v1/blog/1/like")
        assert result.status_code == 200
        assert result.json()["like_count"] == 1
        assert result.json()["liked"] is True
    state["user_id"] = 2
    result = client.get("/api/v1/blog/activity?ids=1,2,3,999")
    assert result.status_code == 200
    assert result.headers["cache-control"] == "no-store"
    stats = {item["post_id"]: item for item in result.json()}
    assert set(stats) == {1, 2}
    assert stats[1]["like_count"] == 1 and not stats[1]["liked"]
    assert stats[2]["like_count"] == 0
    client.delete("/api/v1/blog/1/like")
    assert client.get("/api/v1/blog/activity?ids=1").json()[0]["like_count"] == 1
    state["user_id"] = 1
    assert client.delete("/api/v1/blog/1/like").json()["like_count"] == 0
    assert client.put("/api/v1/blog/3/like").status_code == 404
    for invalid in ("1,,2", "-1", "hello", "2147483648", ",".join(["1"] * 51)):
        assert client.get("/api/v1/blog/activity", params={"ids": invalid}).status_code == 422


def test_comment_validation_ownership_pagination_and_cascade(blog_client):
    client, state, factory = blog_client
    assert client.post("/api/v1/blog/1/comments", json={"content": "   "}).status_code == 400
    assert client.post("/api/v1/blog/1/comments", json={"content": "x" * 2001}).status_code == 400
    assert client.post("/api/v1/blog/3/comments", json={"content": "Draft"}).status_code == 404
    result = client.post("/api/v1/blog/1/comments", json={"content": "  Useful explanation!  "})
    assert result.status_code == 201
    comment = result.json()
    assert comment["content"] == "Useful explanation!"
    assert set(comment["author"]) == {"id", "username"}
    client.post("/api/v1/blog/1/comments", json={"content": "Another thought"})
    page = client.get("/api/v1/blog/1/comments?page_size=1&page=2").json()
    assert page["total"] == 2 and page["items"][0]["id"] == comment["id"]
    state["user_id"] = 2
    assert client.delete(f"/api/v1/blog/1/comments/{comment['id']}").status_code == 403
    assert client.delete(f"/api/v1/blog/2/comments/{comment['id']}").status_code == 404
    state["user_id"] = 1
    assert client.delete(f"/api/v1/blog/1/comments/{comment['id']}").status_code == 204
    assert client.get("/api/v1/blog/activity?ids=1").json()[0]["comment_count"] == 1
    client.put("/api/v1/blog/1/like")
    with factory() as db:
        db.delete(db.get(BlogPost, 1))
        db.commit()
        assert db.query(BlogLike).count() == 0
        assert db.query(BlogComment).count() == 0


def test_anonymous_writes_and_rate_limit(blog_client):
    client, _, _ = blog_client
    for _ in range(6):
        assert client.post("/api/v1/blog/1/comments", json={"content": "Thought"}).status_code == 201
    assert client.post("/api/v1/blog/1/comments", json={"content": "Thought"}).status_code == 429
    app.dependency_overrides.pop(get_current_verified_user)
    app.dependency_overrides.pop(get_current_user)
    assert client.put("/api/v1/blog/1/like").status_code in (401, 403)
    assert client.post("/api/v1/blog/1/comments", json={"content": "Anonymous"}).status_code in (401, 403)


def test_reading_does_not_change_editor_revision(blog_client):
    from datetime import datetime
    from app.crud.blog_post import increment_views
    _, _, factory = blog_client
    with factory() as db:
        post = db.get(BlogPost, 1)
        post.updated_at = datetime(2020, 1, 1)
        db.commit()
        increment_views(db, 1)
        db.refresh(post)
        assert post.views == 8
        assert post.updated_at == datetime(2020, 1, 1)


def test_blog_replies_edit_and_parent_deletion_preserve_thread(blog_client):
    client, state, factory = blog_client
    root = client.post('/api/v1/blog/1/comments', json={'content':'원래 댓글'}).json()
    state['user_id'] = 2
    reply = client.post('/api/v1/blog/1/comments', json={'content':'대댓글', 'parent_id':root['id']}).json()
    assert reply['parent_id'] == root['id']
    assert client.patch(f'/api/v1/blog/1/comments/{root["id"]}', json={'content':'남의 댓글 수정'}).status_code == 403
    edited = client.patch(f'/api/v1/blog/1/comments/{reply["id"]}', json={'content':'  수정한 답글  '})
    assert edited.status_code == 200 and edited.json()['content'] == '수정한 답글'
    assert edited.json()['updated_at']
    state['user_id'] = 1
    nested = client.post('/api/v1/blog/1/comments', json={'content':'답글에 다시 답변', 'parent_id':reply['id']}).json()
    assert nested['parent_id'] == root['id']
    assert client.delete(f'/api/v1/blog/1/comments/{root["id"]}').status_code == 204
    page = client.get('/api/v1/blog/1/comments').json()
    assert page['total'] == 2 and page['thread_total'] == 1
    assert [row['id'] for row in page['items']] == [root['id'],reply['id'],nested['id']]
    assert page['items'][0]['is_deleted'] and page['items'][0]['content'] == '삭제된 댓글입니다.'
    assert page['items'][1]['content'] == '수정한 답글'
    assert client.get('/api/v1/blog/activity?ids=1').json()[0]['comment_count'] == 2
    assert client.patch(f'/api/v1/blog/1/comments/{root["id"]}', json={'content':'되살리기'}).status_code == 404
    assert client.post('/api/v1/blog/1/comments', json={'content':'삭제한 부모에 답글', 'parent_id':reply['id']}).status_code == 404
    assert client.delete(f'/api/v1/blog/1/comments/{nested["id"]}').status_code == 204
    state['user_id'] = 2
    assert client.delete(f'/api/v1/blog/1/comments/{reply["id"]}').status_code == 204
    assert client.get('/api/v1/blog/1/comments').json()['items'] == []
    assert client.get('/api/v1/blog/activity?ids=1').json()[0]['comment_count'] == 0
    with factory() as db:
        assert db.get(BlogComment, root['id']).content == ''


def test_blog_comment_scope_validation_and_admin_permissions(blog_client):
    client, state, factory = blog_client
    root = client.post('/api/v1/blog/1/comments', json={'content':'범위 확인'}).json()
    assert client.post('/api/v1/blog/2/comments', json={'content':'다른 글', 'parent_id':root['id']}).status_code == 404
    assert client.post('/api/v1/blog/1/comments', json={'content':'없는 부모', 'parent_id':999999}).status_code == 404
    assert client.post('/api/v1/blog/3/comments', json={'content':'비공개 글', 'parent_id':root['id']}).status_code == 404
    assert client.patch(f'/api/v1/blog/2/comments/{root["id"]}', json={'content':'다른 글'}).status_code == 404
    assert client.patch(f'/api/v1/blog/3/comments/{root["id"]}', json={'content':'비공개 글'}).status_code == 404
    for content in ('   ', 'x'*2001):
        assert client.patch(f'/api/v1/blog/1/comments/{root["id"]}', json={'content':content}).status_code == 400
    with factory() as db:
        db.get(User, 2).is_admin = True
        db.commit()
    state['user_id'] = 2
    assert client.patch(f'/api/v1/blog/1/comments/{root["id"]}', json={'content':'관리자 대필'}).status_code == 403
    assert client.delete(f'/api/v1/blog/1/comments/{root["id"]}').status_code == 204
    assert client.get('/api/v1/blog/1/comments').json()['total'] == 0


def test_blog_pagination_keeps_replies_with_old_parent(blog_client):
    client, _, factory = blog_client
    with factory() as db:
        db.add_all([BlogComment(id=i, post_id=1, user_id=1, content=f'root {i}') for i in range(1,22)])
        db.flush()
        db.add_all([BlogComment(id=i, post_id=1, user_id=2, parent_id=1, content=f'reply {i}') for i in (22,23)])
        db.commit()
    first = client.get('/api/v1/blog/1/comments?page_size=20&page=1').json()
    second = client.get('/api/v1/blog/1/comments?page_size=20&page=2').json()
    assert first['total'] == second['total'] == 23
    assert first['thread_total'] == second['thread_total'] == 21
    assert len(first['items']) == 20 and all(row['parent_id'] is None for row in first['items'])
    assert [row['id'] for row in second['items']] == [1,22,23]
    assert client.delete('/api/v1/blog/1/comments/1').status_code == 204
    second = client.get('/api/v1/blog/1/comments?page_size=20&page=2').json()
    assert second['thread_total'] == 21 and second['total'] == 22 and second['items'][0]['is_deleted']
    with factory() as db:
        for i in (22,23):
            db.get(BlogComment, i).is_deleted = True
        db.commit()
    second = client.get('/api/v1/blog/1/comments?page_size=20&page=2').json()
    assert second['thread_total'] == 20 and second['total'] == 20 and second['items'] == []


def test_blog_update_requires_verified_login(blog_client):
    client, _, factory = blog_client
    root = client.post('/api/v1/blog/1/comments', json={'content':'권한 확인'}).json()
    app.dependency_overrides.pop(get_current_verified_user)
    with factory() as db:
        db.get(User, 1).email_verified = False
        db.commit()
    assert client.patch(f'/api/v1/blog/1/comments/{root["id"]}', json={'content':'인증 안 됨'}).status_code == 403
    app.dependency_overrides.pop(get_current_user)
    assert client.patch(f'/api/v1/blog/1/comments/{root["id"]}', json={'content':'로그인 안 함'}).status_code in (401,403)


def test_blog_thread_migration_preserves_existing_comments(tmp_path):
    import importlib.util
    from pathlib import Path
    import sqlalchemy as sa
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    engine = sa.create_engine('sqlite:///'+str(tmp_path/'blog-comments.db'))
    metadata = sa.MetaData()
    users = sa.Table('users', metadata, sa.Column('id', sa.Integer, primary_key=True))
    posts = sa.Table('blog_posts', metadata, sa.Column('id', sa.Integer, primary_key=True))
    comments = sa.Table('blog_comments', metadata, sa.Column('id', sa.Integer, primary_key=True), sa.Column('post_id', sa.Integer, sa.ForeignKey('blog_posts.id'), nullable=False), sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False), sa.Column('content', sa.Text, nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    sa.Index('ix_blog_comments_post_id', comments.c.post_id)
    spec = importlib.util.spec_from_file_location('blog_threads_migration', Path(__file__).resolve().parents[1]/'alembic/versions/202609060002_add_blog_comment_threads.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with engine.begin() as connection:
        connection.exec_driver_sql('PRAGMA foreign_keys=ON')
        metadata.create_all(connection)
        connection.execute(users.insert(), {'id':1})
        connection.execute(posts.insert(), {'id':1})
        connection.execute(comments.insert(), [{'id':1,'post_id':1,'user_id':1,'content':'기존 블로그 댓글'}, {'id':2,'post_id':1,'user_id':1,'content':'두 번째 댓글'}])
        before = connection.execute(sa.text('SELECT id,post_id,user_id,content,created_at FROM blog_comments ORDER BY id')).all()
        with Operations.context(MigrationContext.configure(connection)):
            module.upgrade()
        assert connection.execute(sa.text('SELECT id,post_id,user_id,content,created_at FROM blog_comments ORDER BY id')).all() == before
        assert connection.execute(sa.text('SELECT parent_id,is_deleted,updated_at FROM blog_comments')).all() == [(None,0,None),(None,0,None)]
        assert any(fk['referred_table']=='blog_comments' for fk in sa.inspect(connection).get_foreign_keys('blog_comments'))
        assert 'ix_blog_comments_parent_id' in {i['name'] for i in sa.inspect(connection).get_indexes('blog_comments')}
    engine.dispose()


def test_blog_avatar_upload_replace_reset_and_permissions(blog_client, tmp_path, monkeypatch):
    from io import BytesIO
    from PIL import Image
    from app.api.v1 import blog
    client, state, factory = blog_client
    monkeypatch.setattr(blog, "BLOG_UPLOAD_DIR", str(tmp_path))
    data = BytesIO()
    Image.new("RGB", (16, 16), "#667ba8").save(data, format="PNG")
    image = data.getvalue()
    assert client.get("/api/v1/blog/profile").json() == {"image_url": None}
    assert client.post("/api/v1/blog/profile/avatar", files={"file": ("avatar.png", image, "image/png")}).status_code == 403
    assert client.delete("/api/v1/blog/profile/avatar").status_code == 403
    with factory() as db:
        db.get(User, 1).is_admin = True
        db.commit()
    first = client.post("/api/v1/blog/profile/avatar", files={"file": ("avatar.png", image, "image/png")})
    assert first.status_code == 200
    first_url = first.json()["image_url"]
    first_file = tmp_path / first_url.rsplit("/", 1)[1]
    assert first_file.exists()
    assert client.get(first_url).content == image
    state["user_id"] = 2
    public = client.get("/api/v1/blog/profile")
    assert public.json()["image_url"] == first_url
    assert public.headers["cache-control"] == "no-store"
    assert client.delete("/api/v1/blog/profile/avatar").status_code == 403
    state["user_id"] = 1
    second = client.post("/api/v1/blog/profile/avatar", files={"file": ("new.png", image, "image/png")}).json()["image_url"]
    assert second != first_url and not first_file.exists()
    assert (tmp_path / second.rsplit("/", 1)[1]).exists()
    assert client.delete("/api/v1/blog/profile/avatar").json() == {"image_url": None}
    assert not (tmp_path / second.rsplit("/", 1)[1]).exists()
    assert client.get("/api/v1/blog/profile").json() == {"image_url": None}


def test_blog_avatar_rejects_invalid_images_without_changing_profile(blog_client, tmp_path, monkeypatch):
    from app.api.v1 import blog
    client, _, factory = blog_client
    monkeypatch.setattr(blog, "BLOG_UPLOAD_DIR", str(tmp_path))
    with factory() as db:
        db.get(User, 1).is_admin = True
        db.commit()
    for image, content_type in [(b"not a png", "image/png"), (b"<svg/>", "image/svg+xml"), (b"x" * (5 * 1024 * 1024 + 1), "image/png")]:
        result = client.post("/api/v1/blog/profile/avatar", files={"file": ("avatar.png", image, content_type)})
        assert result.status_code == 400
    assert client.get("/api/v1/blog/profile").json() == {"image_url": None}
    assert list(tmp_path.iterdir()) == []


def test_blog_management_crud_and_public_visibility(blog_client):
    client, state, factory = blog_client
    assert client.get("/api/v1/blog/manage/posts").status_code == 403
    with factory() as db:
        db.get(User, 1).is_admin = True
        db.commit()
    created = client.post("/api/v1/blog/", json={"title": "관리 기능 점검", "content": "본문 유지", "summary": "검색 가능한 설명", "is_published": False})
    assert created.status_code == 201
    post = created.json()
    managed = client.get("/api/v1/blog/manage/posts").json()
    assert managed["counts"] == {"total": 4, "published": 2, "draft": 2}
    assert client.get("/api/v1/blog/manage/posts?status=published").json()["total"] == 2
    assert client.get("/api/v1/blog/manage/posts?status=draft").json()["total"] == 2
    searched = client.get("/api/v1/blog/manage/posts", params={"search": "검색 가능한", "page_size": 1}).json()
    assert searched["total"] == 1 and searched["items"][0]["id"] == post["id"]
    assert len(client.get("/api/v1/blog/manage/posts?page_size=2&page=2").json()["items"]) == 2
    state["user_id"] = 2
    assert client.get(f"/api/v1/blog/{post['slug']}").status_code == 404
    assert client.put(f"/api/v1/blog/{post['id']}", json={"title": "Unauthorized"}).status_code == 403
    assert client.delete(f"/api/v1/blog/{post['id']}").status_code == 403
    state["user_id"] = 1
    changed = client.put(f"/api/v1/blog/{post['id']}", json={"title": "수정한 관리 기록", "is_published": True}).json()
    assert changed["content"] == "본문 유지" and changed["is_published"]
    state["user_id"] = 2
    assert client.get(f"/api/v1/blog/{changed['slug']}").status_code == 200
    client.put(f"/api/v1/blog/{post['id']}/like")
    client.post(f"/api/v1/blog/{post['id']}/comments", json={"content": "반응"})
    state["user_id"] = 1
    hidden = client.put(f"/api/v1/blog/{post['id']}", json={"is_published": False})
    assert hidden.status_code == 200 and hidden.json()["content"] == "본문 유지"
    state["user_id"] = 2
    assert client.get(f"/api/v1/blog/{changed['slug']}").status_code == 404
    state["user_id"] = 1
    assert client.delete(f"/api/v1/blog/{post['id']}").status_code == 204
    assert client.get("/api/v1/blog/manage/posts").json()["counts"]["total"] == 3
    assert client.delete(f"/api/v1/blog/{post['id']}").status_code == 404
    with factory() as db:
        assert db.query(BlogLike).filter_by(post_id=post["id"]).count() == 0
        assert db.query(BlogComment).filter_by(post_id=post["id"]).count() == 0


def test_blog_required_fields_cannot_be_cleared(blog_client):
    client, _, factory = blog_client
    with factory() as db:
        db.get(User, 1).is_admin = True
        db.commit()
    assert client.post("/api/v1/blog/", json={"title": "   ", "content": "본문"}).status_code == 400
    for body in ({"title": None}, {"content": "  "}, {"content": None}, {"is_published": None}):
        assert client.put("/api/v1/blog/1", json=body).status_code == 400
    assert client.get("/api/v1/blog/post-1").json()["title"] == "Post 1"
