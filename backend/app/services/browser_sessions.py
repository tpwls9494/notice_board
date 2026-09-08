"""Host-only browser sessions shared through the main site's auth origin.

Browsers never receive a bearer token. Redis stores only a hash of the random
cookie. Legacy bearer clients remain supported by the existing API routes.
"""
import hashlib
import secrets
from functools import lru_cache
from urllib.parse import urlsplit

from fastapi import HTTPException, Request, Response
from redis import Redis
from redis.exceptions import RedisError
from app.core.config import settings


class SessionStoreUnavailable(HTTPException):
    """Only session-store outages may degrade optional public reads to anonymous."""

    def __init__(self):
        super().__init__(503, '로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.')


def cookie_name():
    return '__Host-jion_session' if settings.AUTH_SESSION_SECURE else 'jion_session_dev'


def oauth_cookie_name():
    return '__Host-jion_oauth' if settings.AUTH_SESSION_SECURE else 'jion_oauth_dev'


@lru_cache(maxsize=4)
def _client(url):
    return Redis.from_url(url, socket_connect_timeout=3, socket_timeout=3, decode_responses=True)


def store():
    return _client(settings.REDIS_URL)


def key(value, prefix='session'):
    return 'jion:browser:' + prefix + ':' + hashlib.sha256(value.encode()).hexdigest()


def auth_origin():
    return settings.AUTH_SESSION_ORIGIN.rstrip('/')


def request_origin(request):
    scheme=request.headers.get('x-forwarded-proto', request.url.scheme).split(',')[0].strip()
    return f'{scheme}://{request.url.netloc}'.lower()


def require_auth_host(request):
    if not settings.AUTH_SESSION_ENABLED:
        raise HTTPException(503, '통합 로그인이 아직 설정되지 않았습니다.')
    if request_origin(request) != auth_origin():
        raise HTTPException(403, '지정된 로그인 서버에서 요청해 주세요.')


def csrf_error(request):
    if request.method in ('GET','HEAD','OPTIONS') or not settings.AUTH_SESSION_ENABLED:
        return None
    session_endpoint=request.url.path.startswith('/api/v1/auth/session/')
    cookie_auth=bool(request.cookies.get(cookie_name())) and not request.headers.get('authorization')
    if not (session_endpoint or cookie_auth):
        return None
    allowed={value.strip().rstrip('/') for value in settings.AUTH_SESSION_ALLOWED_ORIGINS.split(',') if value.strip()}
    # Do not normalize an attacker-controlled Origin into a trusted value.
    if request.headers.get('origin') not in allowed or request.headers.get('x-jion-csrf')!='1':
        return '요청 출처를 확인할 수 없습니다. 페이지를 새로고침해 주세요.'
    return None


def _set_cookie(response, name, value, seconds):
    response.set_cookie(name,value,max_age=seconds,secure=settings.AUTH_SESSION_SECURE,
                        httponly=True,samesite='lax',path='/')
    response.headers['Cache-Control']='no-store'


def delete_cookie(response, name):
    response.delete_cookie(name,path='/',secure=settings.AUTH_SESSION_SECURE,httponly=True,samesite='lax')
    response.headers['Cache-Control']='no-store'


def session_user_id(request):
    if not settings.AUTH_SESSION_ENABLED or request_origin(request)!=auth_origin():
        return None
    value=request.cookies.get(cookie_name())
    if not value or not 30<=len(value)<=100:
        return None
    try:
        raw=store().get(key(value))
    except RedisError:
        raise SessionStoreUnavailable()
    try:return int(raw) if raw else None
    except (ValueError,TypeError):return None


def create_session(request, response, user_id):
    require_auth_host(request)
    value=secrets.token_urlsafe(32)
    seconds=max(60,settings.ACCESS_TOKEN_EXPIRE_MINUTES*60)
    try:
        store().setex(key(value),seconds,str(user_id))
        old=request.cookies.get(cookie_name())
        if old:store().delete(key(old))
    except RedisError:
        raise HTTPException(503,'로그인 세션을 저장하지 못했습니다.')
    _set_cookie(response,cookie_name(),value,seconds)


def end_session(request,response):
    require_auth_host(request)
    value=request.cookies.get(cookie_name())
    try:
        if value:store().delete(key(value))
    except RedisError:
        raise HTTPException(503,'로그아웃을 완료하지 못했습니다. 다시 시도해 주세요.')
    delete_cookie(response,cookie_name())


def new_oauth_nonce(request):
    require_auth_host(request)
    nonce=secrets.token_urlsafe(32)
    try:store().setex(key(nonce,'oauth'),600,'1')
    except RedisError:raise HTTPException(503,'소셜 로그인을 준비하지 못했습니다.')
    return nonce


def bind_oauth_cookie(response, nonce):
    _set_cookie(response,oauth_cookie_name(),nonce,600)


def consume_oauth_nonce(request, nonce):
    require_auth_host(request)
    expected=request.cookies.get(oauth_cookie_name(),'')
    if not isinstance(nonce,str) or not expected or not secrets.compare_digest(expected,nonce):
        return False
    try:return bool(store().getdel(key(nonce,'oauth')))
    except RedisError:raise HTTPException(503,'소셜 로그인 상태를 확인하지 못했습니다.')
