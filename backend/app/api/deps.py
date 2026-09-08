from typing import Generator, Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import decode_access_token
from app.crud import user as crud_user
from app.models.user import User

security = HTTPBearer(auto_error=False)
optional_security = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        from app.services.browser_sessions import session_user_id
        user_id = None if request.headers.get('authorization') else session_user_id(request)
        user = crud_user.get_user_by_id(db, user_id) if user_id else None
        if user:
            return user
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED if request.cookies or request.headers.get('authorization') else status.HTTP_403_FORBIDDEN, detail='Not authenticated')
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    user = crud_user.get_user_by_id(db, int(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Get current user if authenticated, otherwise return None"""
    if not credentials:
        from app.services.browser_sessions import session_user_id, SessionStoreUnavailable
        try:
            user_id = None if request.headers.get('authorization') else session_user_id(request)
        except SessionStoreUnavailable:
            if request.method not in {'GET', 'HEAD'}:
                raise
            # No identity or privileges are retained. Private resources must still
            # pass their ordinary anonymous-access checks in the route.
            request.state.auth_degraded = True
            return None
        return crud_user.get_user_by_id(db, user_id) if user_id else None

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    user = crud_user.get_user_by_id(db, int(user_id))
    return user


def get_current_active_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    return current_user


def get_current_verified_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이메일 인증 후 글/댓글/첨부를 작성할 수 있습니다.",
        )
    return current_user


def get_current_blog_author(current_user: User = Depends(get_current_verified_user)) -> User:
    if not current_user.can_write_blog:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="블로그 작성자 계정만 사용할 수 있습니다.")
    return current_user
