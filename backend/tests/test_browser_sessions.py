from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from redis.exceptions import RedisError

from test_blog_activity import blog_client  # noqa: F401
from app.main import app
from app.api.deps import get_current_user, get_current_user_optional, get_current_verified_user
from app.api.v1 import auth
from app.core.config import settings, Settings
from app.core.security import get_password_hash
from app.models.user import User
from app.services import browser_sessions as sessions

ORIGIN = 'https://jionc.com'
BLOG = 'https://blog.jionc.com'
HEADERS = {'Origin': BLOG, 'X-Jion-CSRF': '1'}
PASSWORD = 'session-test-only-password'


class MemoryRedis:
    def __init__(self):
        self.values = {}
        self.ttls = {}

    def setex(self, key, ttl, value):
        self.values[key] = value
        self.ttls[key] = ttl
        return True

    def get(self, key):
        return self.values.get(key)

    def delete(self, key):
        return self.values.pop(key, None) is not None

    def getdel(self, key):
        return self.values.pop(key, None)


@pytest.fixture
def browser(blog_client, monkeypatch):
    _, _, factory = blog_client
    monkeypatch.setattr(settings, 'AUTH_SESSION_ENABLED', True)
    monkeypatch.setattr(settings, 'AUTH_SESSION_ORIGIN', ORIGIN)
    monkeypatch.setattr(settings, 'AUTH_SESSION_ALLOWED_ORIGINS', f'{ORIGIN},{BLOG}')
    monkeypatch.setattr(settings, 'AUTH_SESSION_SECURE', True)
    monkeypatch.setattr(settings, 'BLOG_OWNER_USER_ID', 1)
    monkeypatch.setattr(settings, 'OAUTH_FRONTEND_DEFAULT_REDIRECT', ORIGIN + '/oauth/callback')
    monkeypatch.setattr(settings, 'BLOG_PUBLIC_ORIGIN', BLOG)
    memory = MemoryRedis()
    monkeypatch.setattr(sessions, 'store', lambda: memory)
    for dependency in (get_current_user, get_current_user_optional, get_current_verified_user):
        app.dependency_overrides.pop(dependency)
    with factory() as db:
        for user_id in (1, 2):
            user = db.get(User, user_id)
            user.has_local_password = True
            user.hashed_password = get_password_hash(PASSWORD)
            user.is_admin = True  # Even another admin cannot write to the owner's blog.
        db.commit()
    with TestClient(app, base_url=ORIGIN) as client:
        yield client, memory, factory


def login(client, user_id=1, headers=None):
    return client.post('/api/v1/auth/session/login', headers=HEADERS if headers is None else headers,
                       json={'email': f'blog{user_id}@example.test', 'password': PASSWORD})


def test_cookie_flags_hydration_and_owner_scope(browser):
    client, memory, factory = browser
    assert client.get('/api/v1/auth/session').json() == {'user': None}
    response = login(client)
    assert response.status_code == 200
    assert 'access_token' not in response.json()
    cookie = response.headers['set-cookie']
    assert all(flag in cookie for flag in ['__Host-jion_session=', 'HttpOnly', 'Secure', 'SameSite=lax', 'Path=/'])
    assert 'domain=' not in cookie.lower()
    assert response.headers['cache-control'] == 'no-store'
    raw = client.cookies.get(sessions.cookie_name())
    assert raw not in repr(memory.values)
    assert memory.ttls[sessions.key(raw)] == settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    assert client.get('/api/v1/auth/session', headers={'Origin': BLOG}).json()['user']['can_write_blog'] is True
    assert client.get('/api/v1/blog/manage/posts').status_code == 200
    # Authorization is resolved from the live user, not a cached admin claim.
    with factory() as db:
        db.get(User, 1).is_admin = False
        db.commit()
    assert client.get('/api/v1/blog/manage/posts').status_code == 403
    assert login(client, 2).json()['can_write_blog'] is False
    assert client.get('/api/v1/blog/manage/posts').status_code == 403


@pytest.mark.parametrize('headers', [{}, {'Origin': BLOG}, {'X-Jion-CSRF': '1'},
    {'Origin': 'https://evil.jionc.com', 'X-Jion-CSRF': '1'},
    {'Origin': 'null', 'X-Jion-CSRF': '1'},
    {'Origin': BLOG + '.evil.test', 'X-Jion-CSRF': '1'}])
def test_login_and_cookie_writes_reject_csrf(browser, headers):
    client, _, _ = browser
    assert login(client, headers=headers).status_code == 403
    assert login(client).status_code == 200
    assert client.put('/api/v1/blog/1/like', headers=headers).status_code == 403
    assert client.post('/api/v1/auth/session/logout', headers=headers).status_code == 403
    assert client.get('/api/v1/auth/session').json()['user']['id'] == 1


def test_rotation_logout_expiry_and_bearer_compatibility(browser):
    client, memory, _ = browser
    login(client)
    old = client.cookies.get(sessions.cookie_name())
    login(client)
    current = client.cookies.get(sessions.cookie_name())
    assert old != current and sessions.key(old) not in memory.values
    assert client.put('/api/v1/blog/1/like', headers=HEADERS).status_code == 200
    result = client.post('/api/v1/auth/session/logout', headers=HEADERS)
    assert result.status_code == 200 and 'Max-Age=0' in result.headers['set-cookie']
    assert sessions.key(current) not in memory.values
    replay = {'Cookie': f'{sessions.cookie_name()}={current}', **HEADERS}
    assert client.get('/api/v1/auth/session', headers=replay).json()['user'] is None
    assert client.put('/api/v1/blog/1/like', headers=replay).status_code == 401
    login(client)
    memory.values.clear()  # Equivalent to Redis TTL expiry / restart.
    assert client.get('/api/v1/auth/session').json()['user'] is None
    token = client.post('/api/v1/auth/login', headers=HEADERS,
        json={'email': 'blog1@example.test', 'password': PASSWORD}).json()['access_token']
    assert client.put('/api/v1/blog/1/like', headers={'Authorization': 'Bearer ' + token}).status_code == 200
    login(client)
    assert client.get('/api/v1/auth/me', headers={'Authorization': 'Basic invalid'}).status_code == 401


def test_wrong_host_and_redis_failure_are_closed(browser, monkeypatch):
    client, memory, _ = browser
    assert login(client, headers={**HEADERS, 'Host': 'blog.jionc.com'}).status_code == 403
    login(client)
    def fail(*_):
        raise RedisError('simulated unavailable session store')
    monkeypatch.setattr(memory, 'get', fail)
    assert client.get('/api/v1/auth/session').status_code == 503
    monkeypatch.setattr(memory, 'delete', fail)
    assert client.post('/api/v1/auth/session/logout', headers=HEADERS).status_code == 503
    monkeypatch.setattr(memory, 'setex', fail)
    assert login(client).status_code == 503


@pytest.mark.parametrize('provider', ['google', 'github'])
@pytest.mark.parametrize('site,origin', [('main', ORIGIN), ('blog', BLOG)])
def test_oauth_bound_single_use_cookie_without_url_token(browser, monkeypatch, provider, site, origin):
    client, _, _ = browser
    monkeypatch.setattr(settings, provider.upper() + '_OAUTH_CLIENT_ID', 'test-client')
    monkeypatch.setattr(settings, provider.upper() + '_OAUTH_CLIENT_SECRET', 'test-secret')
    async def profile(*_):
        return 'blog1@example.test', 'reader1', True
    monkeypatch.setattr(auth, '_fetch_' + provider + '_profile', profile)
    start = client.get(f'/api/v1/auth/oauth/{provider}/start', params={'site': site, 'next': '/write'}, follow_redirects=False)
    state = parse_qs(urlparse(start.headers['location']).query)['state'][0]
    assert 'HttpOnly' in start.headers['set-cookie'] and 'Domain=' not in start.headers['set-cookie']
    callback = f'/api/v1/auth/oauth/{provider}/callback'
    params = {'code': 'test-code', 'state': state}
    wrong = client.get(callback, params=params, headers={'Cookie': sessions.oauth_cookie_name() + '=wrong'}, follow_redirects=False)
    assert 'oauth_invalid_state' in wrong.headers['location']
    response = client.get(callback, params=params, follow_redirects=False)
    target = urlparse(response.headers['location'])
    assert target.scheme + '://' + target.netloc == origin
    assert target.path == '/oauth/callback' and not target.fragment
    assert parse_qs(target.query) == {'session': ['1'], 'next': ['/write'], 'provider': [provider]}
    assert 'token' not in response.headers['location']
    assert client.get('/api/v1/auth/session').json()['user']['id'] == 1
    replay = client.get(callback, params=params, follow_redirects=False)
    assert 'oauth_invalid_state' in replay.headers['location']


@pytest.mark.parametrize('origin,secure', [('http://jionc.com', True), (ORIGIN, False),
    ('https://jionc.com/other', True), ('https://user@jionc.com', True), ('*', True)])
def test_production_settings_reject_unsafe_origins(origin, secure):
    with pytest.raises(ValueError):
        Settings(_env_file=None, AUTH_SESSION_ENABLED=True, AUTH_SESSION_ORIGIN=origin,
                 AUTH_SESSION_ALLOWED_ORIGINS=origin, AUTH_SESSION_SECURE=secure,
                 OAUTH_FRONTEND_DEFAULT_REDIRECT=ORIGIN+'/oauth/callback')


def test_redis_outage_preserves_public_reads_not_private_or_writes(browser, monkeypatch):
    from app.models.social import SocialPost
    from app.models.signal import Signal
    client, memory, factory = browser
    with factory() as db:
        db.add_all([SocialPost(id=101, user_id=1, title='Public', content='Public body'),
                    SocialPost(id=102, user_id=1, title='Hidden', content='Hidden body', is_hidden=True)])
        for slug, state in [('public-signal', 'published'), ('private-signal', 'review')]:
            db.add(Signal(slug=slug, title=slug, summary='Summary', content_kind='release',
                          status=state, source_kind='official', source_name='Fixture',
                          source_url='https://example.test/'+slug, source_hash=slug))
        db.commit()
    login(client)
    assert client.get('/api/v1/blog/post-3').status_code == 200
    def fail(*_):
        raise RedisError('simulated session store outage')
    monkeypatch.setattr(memory, 'get', fail)
    public = ['/api/v1/blog/post-1', '/api/v1/blog/activity?ids=1', '/api/v1/signals/',
              '/api/v1/signals/public-signal', '/api/v1/community/posts', '/api/v1/community/posts/101']
    for path in public:
        response = client.get(path)
        assert response.status_code == 200, (path, response.text)
        assert response.headers['cache-control'] == 'no-store'
    for path in ['/api/v1/blog/post-3', '/api/v1/signals/private-signal', '/api/v1/community/posts/102']:
        assert client.get(path).status_code == 404, path
    assert client.get('/api/v1/community/posts?sort=following').status_code == 401
    for path in ['/api/v1/auth/session', '/api/v1/auth/me', '/api/v1/blog/manage/posts']:
        assert client.get(path).status_code == 503
    assert client.put('/api/v1/blog/1/like', headers=HEADERS).status_code == 503
    # Optional-auth POST endpoints also stay closed, before any service call.
    assert client.post('/api/ai/route', headers=HEADERS, json={'message':'test'}).status_code == 503


@pytest.mark.parametrize('redirect', ['http://localhost:5173/oauth/callback',
    'https://evil.example/oauth/callback', 'https://blog.jionc.com/oauth/callback',
    'https://www.jionc.com/oauth/callback', 'https://jionc.com/wrong',
    'https://jionc.com/oauth/callback?next=x', '//evil.example/oauth/callback'])
def test_invalid_production_oauth_return_is_rejected(redirect):
    with pytest.raises(ValueError):
        Settings(_env_file=None, AUTH_SESSION_ENABLED=True, OAUTH_FRONTEND_DEFAULT_REDIRECT=redirect)


@pytest.mark.parametrize('redirect', ['', '/oauth/callback', ORIGIN+'/oauth/callback'])
def test_canonical_and_empty_oauth_returns_are_allowed(redirect):
    config = Settings(_env_file=None, AUTH_SESSION_ENABLED=True, OAUTH_FRONTEND_DEFAULT_REDIRECT=redirect)
    assert config.AUTH_SESSION_ENABLED


def test_local_frontend_callback_remains_supported():
    config = Settings(_env_file=None, AUTH_SESSION_ENABLED=True, AUTH_SESSION_SECURE=False,
        AUTH_SESSION_ORIGIN='http://localhost:8000',
        AUTH_SESSION_ALLOWED_ORIGINS='http://localhost:8000,http://localhost:5173',
        OAUTH_FRONTEND_DEFAULT_REDIRECT='http://localhost:5173/oauth/callback')
    assert config.AUTH_SESSION_ENABLED
