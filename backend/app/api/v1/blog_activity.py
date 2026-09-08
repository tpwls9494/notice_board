from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, aliased

from app.api.deps import get_current_user, get_current_user_optional, get_current_verified_user
from app.db.session import get_db
from app.models.blog_post import BlogPost, BlogLike, BlogComment
from app.models.user import User
from app.schemas.blog_activity import BlogActivity, BlogCommentCreate, BlogCommentUpdate, BlogCommentResponse, BlogCommentsResponse
from app.services.rate_limit import SlidingWindowRateLimiter

router = APIRouter()
comment_limiter = SlidingWindowRateLimiter(window_seconds=60, max_requests=6)


def published_post(db: Session, post_id: int) -> BlogPost:
    post = db.query(BlogPost).filter(BlogPost.id == post_id, BlogPost.is_published.is_(True)).first()
    if not post:
        raise HTTPException(404, "글을 찾을 수 없습니다.")
    return post


def activity_for(db: Session, ids: list[int], user: User | None) -> list[BlogActivity]:
    posts = db.query(BlogPost.id, BlogPost.views).filter(BlogPost.id.in_(ids), BlogPost.is_published.is_(True)).all()
    public_ids = [p.id for p in posts]
    if not public_ids:
        return []
    likes = dict(db.query(BlogLike.post_id, func.count(BlogLike.id)).filter(BlogLike.post_id.in_(public_ids)).group_by(BlogLike.post_id).all())
    comments = dict(db.query(BlogComment.post_id, func.count(BlogComment.id)).filter(BlogComment.post_id.in_(public_ids), BlogComment.is_deleted.is_(False)).group_by(BlogComment.post_id).all())
    liked = set()
    if user:
        liked = {row[0] for row in db.query(BlogLike.post_id).filter(BlogLike.post_id.in_(public_ids), BlogLike.user_id == user.id).all()}
    return [BlogActivity(post_id=p.id, views=p.views, like_count=likes.get(p.id, 0), comment_count=comments.get(p.id, 0), liked=p.id in liked) for p in posts]


@router.get("/activity", response_model=list[BlogActivity])
def get_activity(response: Response, ids: str = Query(..., max_length=600), db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional)):
    parts = ids.split(",")
    if len(parts) > 50 or any(not p.isascii() or not p.isdigit() or not 0 < int(p) <= 2147483647 for p in parts):
        raise HTTPException(422, "글 ID를 1~50개 입력해 주세요.")
    response.headers["Cache-Control"] = "no-store"
    return activity_for(db, list({int(p) for p in parts}), user)


@router.put("/{post_id}/like", response_model=BlogActivity)
def like_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_verified_user)):
    published_post(db, post_id)
    if not db.query(BlogLike.id).filter_by(post_id=post_id, user_id=user.id).first():
        db.add(BlogLike(post_id=post_id, user_id=user.id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            if not db.query(BlogLike.id).filter_by(post_id=post_id, user_id=user.id).first():
                raise
    return activity_for(db, [post_id], user)[0]


@router.delete("/{post_id}/like", response_model=BlogActivity)
def unlike_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    published_post(db, post_id)
    db.query(BlogLike).filter_by(post_id=post_id, user_id=user.id).delete()
    db.commit()
    return activity_for(db, [post_id], user)[0]


@router.get("/{post_id}/comments", response_model=BlogCommentsResponse)
def get_comments(post_id: int, response: Response, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=50), db: Session = Depends(get_db)):
    published_post(db, post_id)
    query = db.query(BlogComment).filter_by(post_id=post_id)
    total = query.filter(BlogComment.is_deleted.is_(False)).count()
    child = aliased(BlogComment)
    has_replies = db.query(child.id).filter(child.parent_id == BlogComment.id, child.post_id == post_id, child.is_deleted.is_(False)).exists()
    roots_query = query.filter(BlogComment.parent_id.is_(None), or_(BlogComment.is_deleted.is_(False), has_replies))
    thread_total = roots_query.count()
    roots = roots_query.options(joinedload(BlogComment.author)).order_by(BlogComment.created_at.desc(), BlogComment.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    # Page top-level threads, then return every visible reply of those roots.
    # A reply must never become an orphan on a different page.
    root_ids = [root.id for root in roots]
    replies = query.filter(BlogComment.parent_id.in_(root_ids), BlogComment.is_deleted.is_(False)).options(joinedload(BlogComment.author)).order_by(BlogComment.created_at, BlogComment.id).all() if root_ids else []
    by_parent = {}
    for reply in replies:
        by_parent.setdefault(reply.parent_id, []).append(reply)
    items = []
    for root in roots:
        items.append(comment_response(root))
        items.extend(comment_response(reply) for reply in by_parent.get(root.id, []))
    response.headers["Cache-Control"] = "no-store"
    return BlogCommentsResponse(items=items, total=total, thread_total=thread_total, page=page, page_size=page_size)


def comment_response(comment: BlogComment) -> BlogCommentResponse:
    response = BlogCommentResponse.model_validate(comment)
    if comment.is_deleted:
        response.content = "삭제된 댓글입니다."
    return response


@router.post("/{post_id}/comments", response_model=BlogCommentResponse, status_code=201)
def create_comment(post_id: int, body: BlogCommentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_verified_user)):
    published_post(db, post_id)
    if not comment_limiter.allow(str(user.id)):
        raise HTTPException(429, "잠시 후 다시 댓글을 남겨 주세요.")
    parent_id = body.parent_id
    if parent_id is not None:
        parent = db.query(BlogComment).filter(BlogComment.id == parent_id, BlogComment.post_id == post_id, BlogComment.is_deleted.is_(False)).with_for_update().first()
        if not parent:
            raise HTTPException(404, "답글을 남길 댓글을 찾을 수 없습니다.")
        parent_id = parent.parent_id or parent.id
        root = db.query(BlogComment).filter(BlogComment.id == parent_id, BlogComment.post_id == post_id, BlogComment.is_deleted.is_(False)).with_for_update().first()
        if not root:
            raise HTTPException(404, "답글을 남길 댓글을 찾을 수 없습니다.")
    comment = BlogComment(post_id=post_id, user_id=user.id, content=body.content, parent_id=parent_id)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment_response(comment)


@router.patch("/{post_id}/comments/{comment_id}", response_model=BlogCommentResponse)
def update_comment(post_id: int, comment_id: int, body: BlogCommentUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_verified_user)):
    published_post(db, post_id)
    comment = db.query(BlogComment).filter_by(id=comment_id, post_id=post_id, is_deleted=False).first()
    if not comment:
        raise HTTPException(404, "댓글을 찾을 수 없습니다.")
    if comment.user_id != user.id:
        raise HTTPException(403, "본인의 댓글만 수정할 수 있습니다.")
    comment.content = body.content
    comment.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(comment)
    return comment_response(comment)


@router.delete("/{post_id}/comments/{comment_id}", status_code=204)
def delete_comment(post_id: int, comment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    published_post(db, post_id)
    comment = db.query(BlogComment).filter_by(id=comment_id, post_id=post_id).first()
    if not comment:
        raise HTTPException(404, "댓글을 찾을 수 없습니다.")
    if comment.user_id != user.id and not user.is_admin:
        raise HTTPException(403, "본인의 댓글만 삭제할 수 있습니다.")
    comment.is_deleted = True
    comment.content = ""
    db.commit()
