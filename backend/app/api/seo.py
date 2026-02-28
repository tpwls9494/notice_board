from __future__ import annotations

import html
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from sqlalchemy import desc
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.category import Category
from app.models.post import Post

public_router = APIRouter(tags=["seo"])
api_router = APIRouter(tags=["seo"])

POST_SITEMAP_LIMIT = 5000
SITE_NAME = "jion community"
WHITESPACE_PATTERN = re.compile(r"\s+")


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


def _squash_text(value: str | None) -> str:
    if not value:
        return ""
    return WHITESPACE_PATTERN.sub(" ", value).strip()


def _excerpt(value: str | None, limit: int = 170) -> str:
    text = _squash_text(value)
    if len(text) <= limit:
        return text
    return text[: limit - 3].rstrip() + "..."


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
        (_join_url(origin, "/community"), None),
        (_join_url(origin, "/community/posts"), None),
        (_join_url(origin, "/marketplace"), None),
    ]

    try:
        categories = (
            db.query(Category.slug)
            .filter(Category.is_active == True)  # noqa: E712
            .order_by(Category.order.asc(), Category.id.asc())
            .all()
        )
        for category in categories:
            url_rows.append((_join_url(origin, f"/community/{category.slug}"), None))

        posts = (
            db.query(Post.id, Post.updated_at)
            .order_by(desc(Post.updated_at), desc(Post.id))
            .limit(POST_SITEMAP_LIMIT)
            .all()
        )
        for post_id, updated_at in posts:
            url_rows.append(
                (
                    _join_url(origin, f"/posts/{post_id}"),
                    _format_lastmod(updated_at),
                )
            )
    except SQLAlchemyError:
        # Keep sitemap available even when DB is temporarily unavailable.
        pass

    xml = _render_urlset_xml(url_rows)
    return Response(content=xml, media_type="application/xml")


@public_router.get("/robots.txt", include_in_schema=False)
def robots_txt(request: Request) -> Response:
    origin = _build_public_origin(request)
    body = "\n".join(
        [
            "User-agent: *",
            "Allow: /",
            "Disallow: /api/",
            "Disallow: /docs",
            f"Sitemap: {_join_url(origin, '/sitemap.xml')}",
            "",
        ]
    )
    return Response(content=body, media_type="text/plain")


@api_router.get("/og/posts/{post_id}.svg", include_in_schema=False)
def post_og_image(post_id: int, db: Session = Depends(get_db)) -> Response:
    row = (
        db.query(Post.title, Category.name)
        .outerjoin(Category, Category.id == Post.category_id)
        .filter(Post.id == post_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    title = html.escape(_excerpt(row.title, limit=80), quote=False)
    category_name = html.escape(_excerpt(row.name or "Community", limit=24), quote=False)

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="{title}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1f2937" />
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0ea5e9" />
      <stop offset="100%" stop-color="#22d3ee" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <rect x="74" y="74" width="220" height="56" rx="16" fill="#111827" stroke="#334155" />
  <text x="184" y="111" fill="#cbd5e1" text-anchor="middle" font-family="Pretendard, Noto Sans KR, sans-serif" font-size="28" font-weight="700">{category_name}</text>
  <text x="74" y="224" fill="#f8fafc" font-family="Pretendard, Noto Sans KR, sans-serif" font-size="64" font-weight="800">{title}</text>
  <rect x="74" y="518" width="308" height="10" rx="5" fill="url(#accent)" />
  <text x="74" y="570" fill="#94a3b8" font-family="Pretendard, Noto Sans KR, sans-serif" font-size="30" font-weight="600">jion community</text>
</svg>"""

    headers = {
        "Cache-Control": "public, max-age=1800",
    }
    return Response(content=svg, media_type="image/svg+xml", headers=headers)


@public_router.get("/share/posts/{post_id}", include_in_schema=False)
def post_share_landing(post_id: int, request: Request, db: Session = Depends(get_db)) -> Response:
    row = (
        db.query(Post.id, Post.title, Post.content, Category.name)
        .outerjoin(Category, Category.id == Post.category_id)
        .filter(Post.id == post_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    origin = _build_public_origin(request)
    canonical_url = _join_url(origin, f"/posts/{row.id}")
    share_url = _join_url(origin, f"/share/posts/{row.id}")
    og_image_url = _join_url(origin, f"/api/v1/seo/og/posts/{row.id}.svg")

    title = _excerpt(row.title, limit=90) or "Community Post"
    description = _excerpt(row.content, limit=170) or "Community post details"
    escaped_title = html.escape(title, quote=True)
    escaped_description = html.escape(description, quote=True)

    doc = f"""<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="refresh" content="0;url={html.escape(canonical_url, quote=True)}" />
    <title>{escaped_title}</title>
    <link rel="canonical" href="{html.escape(canonical_url, quote=True)}" />
    <meta name="description" content="{escaped_description}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="{SITE_NAME}" />
    <meta property="og:title" content="{escaped_title}" />
    <meta property="og:description" content="{escaped_description}" />
    <meta property="og:url" content="{html.escape(share_url, quote=True)}" />
    <meta property="og:image" content="{html.escape(og_image_url, quote=True)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{escaped_title}" />
    <meta name="twitter:description" content="{escaped_description}" />
    <meta name="twitter:image" content="{html.escape(og_image_url, quote=True)}" />
  </head>
  <body>
    <p>Redirecting to post...</p>
    <a href="{html.escape(canonical_url, quote=True)}">Open post</a>
  </body>
</html>
"""
    return Response(content=doc, media_type="text/html")
