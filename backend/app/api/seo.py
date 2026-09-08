from __future__ import annotations

import html
from datetime import datetime
from urllib.parse import quote

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy import desc
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.blog_post import BlogPost
from app.models.signal import Signal
from app.models.social import SocialPost

public_router = APIRouter(tags=["seo"])
api_router = APIRouter(tags=["seo"])

SIGNAL_SITEMAP_LIMIT = 5000


def _build_public_origin(request: Request) -> str:
    forwarded_proto = request.headers.get("x-forwarded-proto", "").split(",")[0].strip()
    forwarded_host = request.headers.get("x-forwarded-host", "").split(",")[0].strip()
    host = forwarded_host or request.headers.get("host", "").strip()
    scheme = forwarded_proto or request.url.scheme
    if host:
        return f"{scheme}://{host}"
    return str(request.base_url).rstrip("/")


def _join_url(origin: str, path: str) -> str:
    if path.startswith("/"):
        return f"{origin}{path}"
    return f"{origin}/{path}"


def _format_lastmod(dt: datetime | None) -> str | None:
    if not dt:
        return None
    return dt.date().isoformat()


def _render_urlset_xml(url_rows: list[tuple[str, str | None]]) -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for loc, lastmod in url_rows:
        lines.append("  <url>")
        lines.append(f"    <loc>{html.escape(loc, quote=True)}</loc>")
        if lastmod:
            lines.append(f"    <lastmod>{lastmod}</lastmod>")
        lines.append("  </url>")
    lines.append("</urlset>")
    return "\n".join(lines)


@public_router.get("/sitemap.xml", include_in_schema=False)
def sitemap(request: Request, db: Session = Depends(get_db)) -> Response:
    origin = _build_public_origin(request)
    url_rows: list[tuple[str, str | None]] = [
        (_join_url(origin, "/"), None),
    ]

    try:
        signals = (
            db.query(Signal.slug, Signal.updated_at)
            .filter(Signal.status == "published")
            .order_by(desc(Signal.updated_at), desc(Signal.id))
            .limit(SIGNAL_SITEMAP_LIMIT)
            .all()
        )
        for slug, updated_at in signals:
            url_rows.append(
                (
                    _join_url(origin, f"/signals/{slug}"),
                    _format_lastmod(updated_at),
                )
            )
        social_posts = (
            db.query(SocialPost.id, SocialPost.updated_at)
            .filter(SocialPost.is_hidden == False)  # noqa: E712
            .order_by(desc(SocialPost.updated_at), desc(SocialPost.id))
            .limit(SIGNAL_SITEMAP_LIMIT)
            .all()
        )
        for post_id, updated_at in social_posts:
            url_rows.append(
                (_join_url(origin, f"/community/{post_id}"), _format_lastmod(updated_at))
            )
    except SQLAlchemyError:
        # Keep sitemap available even when DB is temporarily unavailable.
        pass

    xml = _render_urlset_xml(url_rows)
    return Response(content=xml, media_type="application/xml")


@public_router.get("/blog-sitemap.xml", include_in_schema=False)
def blog_sitemap(request: Request, db: Session = Depends(get_db)) -> Response:
    origin = settings.BLOG_PUBLIC_ORIGIN.rstrip("/")
    url_rows: list[tuple[str, str | None]] = [(_join_url(origin, "/"), None)]
    try:
        posts = (
            db.query(BlogPost.slug, BlogPost.updated_at)
            .filter(BlogPost.is_published == True)  # noqa: E712
            .order_by(desc(BlogPost.updated_at), desc(BlogPost.id))
            .limit(SIGNAL_SITEMAP_LIMIT)
            .all()
        )
        for slug, updated_at in posts:
            url_rows.append((_join_url(origin, f"/{quote(slug, safe='')}"), _format_lastmod(updated_at)))
    except SQLAlchemyError:
        pass
    return Response(content=_render_urlset_xml(url_rows), media_type="application/xml")


@public_router.get("/robots.txt", include_in_schema=False)
def robots_txt(request: Request) -> Response:
    origin = _build_public_origin(request)
    body = "\n".join(
        [
            "User-agent: *",
            "Allow: /",
            "Disallow: /api/",
            "Disallow: /docs",
            "Disallow: /review",
            "Disallow: /submit",
            "Disallow: /mypage",
            "Disallow: /login",
            "Disallow: /register",
            "Disallow: /verify-email",
            "Disallow: /oauth/",
            f"Sitemap: {_join_url(origin, '/sitemap.xml')}",
            "",
        ]
    )
    return Response(content=body, media_type="text/plain")


@public_router.get("/verification-meta", include_in_schema=False)
def verification_meta() -> Response:
    """Return search console verification codes as JSON.

    Frontend can fetch this at build-time or runtime to inject meta tags,
    or the codes can be added directly to index.html.
    """
    data: dict[str, str] = {}
    if settings.GOOGLE_SITE_VERIFICATION:
        data["google-site-verification"] = settings.GOOGLE_SITE_VERIFICATION
    if settings.NAVER_SITE_VERIFICATION:
        data["naver-site-verification"] = settings.NAVER_SITE_VERIFICATION
    import json

    return Response(content=json.dumps(data), media_type="application/json")


@api_router.get("/og/default.png", include_in_schema=False)
def default_og_image() -> Response:
    from app.services.og_image import generate_default_og

    png_bytes = generate_default_og()
    headers = {
        "Cache-Control": "public, max-age=86400",
    }
    return Response(content=png_bytes, media_type="image/png", headers=headers)


__all__ = ["public_router", "api_router"]
