import json
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from test_blog_activity import blog_client  # noqa: F401
from app.main import app
from app.api.deps import get_current_user, get_current_user_optional, get_current_verified_user
from app.api.v1 import auth
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.blog_post import BlogPost
from app.models.user import User


def test_real_password_login_and_author_permissions(blog_client):
    client, _, factory = blog_client
    with factory() as db:
        for user_id in (1, 2):
            user = db.get(User, user_id)
            user.hashed_password = get_password_hash("local-release-test-password")
            user.has_local_password = True
            user.is_admin = user_id == 1
        db.commit()
    for dependency in (get_current_user, get_current_user_optional, get_current_verified_user):
        app.dependency_overrides.pop(dependency)
    assert client.post("/api/v1/auth/login", json={"email": "blog1@example.test", "password": "wrong"}).status_code == 401
    for user_id in (1, 2):
        login = client.post("/api/v1/auth/login", json={"email": f"blog{user_id}@example.test", "password": "local-release-test-password"})
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        assert client.get("/api/v1/auth/me", headers=headers).json()["is_admin"] == (user_id == 1)
        assert client.get("/api/v1/blog/manage/posts", headers=headers).status_code == (200 if user_id == 1 else 403)
    assert client.get("/api/v1/auth/me", headers={"Authorization": "Bearer expired-token"}).status_code == 401


def test_blog_oauth_returns_to_blog_and_main_still_works(blog_client, monkeypatch):
    client, _, _ = blog_client
    monkeypatch.setattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "test-client")
    monkeypatch.setattr(settings, "GOOGLE_OAUTH_CLIENT_SECRET", "test-secret")
    monkeypatch.setattr(settings, "OAUTH_FRONTEND_DEFAULT_REDIRECT", "https://jionc.com/oauth/callback")
    async def profile(*_):
        return "blog1@example.test", "reader1", True
    monkeypatch.setattr(auth, "_fetch_google_profile", profile)
    for site, host in (("blog", "blog.jionc.com"), ("main", "jionc.com")):
        start = client.get("/api/v1/auth/oauth/google/start", params={"site": site, "next": "/admin/posts"}, follow_redirects=False)
        params = parse_qs(urlparse(start.headers["location"]).query)
        state = params["state"][0]
        assert auth._decode_oauth_state(state)["site"] == site
        callback = client.get("/api/v1/auth/oauth/google/callback", params={"code": "test-code", "state": state}, follow_redirects=False)
        target = urlparse(callback.headers["location"])
        assert target.netloc == host and target.path == "/oauth/callback"
        assert "token=" not in target.query
        assert parse_qs(target.fragment)["next"] == ["/admin/posts"]
    refused = client.get("/api/v1/auth/oauth/google/callback", params={"error": "access_denied", "state": auth._encode_oauth_state("google", "/", "blog")}, follow_redirects=False)
    assert urlparse(refused.headers["location"]).netloc == "blog.jionc.com"
    assert auth._sanitize_next_path("/\\evil.example") == "/community"


def test_public_html_metadata_and_private_pages(blog_client, monkeypatch):
    client, _, factory = blog_client
    template = Path(__file__).resolve().parents[2] / "frontend-blog/index.html"
    monkeypatch.setattr(settings, "BLOG_HTML_TEMPLATE", str(template))
    with factory() as db:
        post = db.get(BlogPost, 1)
        post.title = '메타 "검증" <script>bad</script>'
        post.summary = '설명 "값"'
        post.thumbnail_url = "/api/v1/blog/images/cover.png"
        original_views = post.views
        db.commit()
    response = client.get("/api/v1/blog/render/post-1")
    assert response.status_code == 200
    assert response.text.count('<meta property="og:title"') == 1
    assert '<script>bad</script>' not in response.text
    assert 'https://blog.jionc.com/api/v1/blog/images/cover.png' in response.text
    assert '<link rel="canonical" href="https://blog.jionc.com/post-1">' in response.text
    assert '"@type": "BlogPosting"' in response.text
    assert response.headers["x-robots-tag"] == "index, follow"
    with factory() as db:
        assert db.get(BlogPost, 1).views == original_views
    for path in ("post-3", "does-not-exist"):
        hidden = client.get("/api/v1/blog/render/" + path)
        assert hidden.status_code == 404 and 'content="noindex, nofollow"' in hidden.text
        assert 'Post 3' not in hidden.text and '"BlogPosting"' not in hidden.text
    for path in ("login", "admin/posts", "write", "edit/post-1", "oauth/callback"):
        private = client.get("/api/v1/blog/render/" + path)
        assert private.status_code == 200 and private.headers["x-robots-tag"].startswith("noindex")


def test_blog_crawler_endpoints(blog_client):
    from PIL import Image
    from io import BytesIO
    client, _, _ = blog_client
    sitemap = client.get("/blog-sitemap.xml")
    assert "https://blog.jionc.com/post-1" in sitemap.text
    assert "post-3" not in sitemap.text
    robots = client.get("/api/v1/blog/robots.txt")
    assert "Allow: /api/v1/blog/images/" in robots.text
    image = client.get("/api/v1/blog/og/default.png")
    assert image.status_code == 200
    assert Image.open(BytesIO(image.content)).size == (1200, 630)
