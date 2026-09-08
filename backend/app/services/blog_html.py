"""Render public blog metadata without counting a page view."""
import html
import json
import re
from pathlib import Path
from urllib.parse import quote, urljoin, urlparse
from app.core.config import settings

BLOG_TITLE = "jion.log — 배우고, 만들고, 기록합니다."
BLOG_DESCRIPTION = "직접 부딪히며 이해한 것들. AI와 개발, 그 사이의 생각을 차곡차곡 남깁니다."


def plain_description(value):
    value = re.sub(r"```[\s\S]*?```|~~~[\s\S]*?~~~", " ", value)
    value = re.sub(r"!\[[^]]*\]\([^)]*\)", "", value)
    value = re.sub(r"\[([^]]*)\]\([^)]*\)", r"\1", value)
    value = re.sub(r"<[^>]*>|[#*_`~>|]", "", value)
    return " ".join(value.split())[:180]


def metadata(post=None, *, private=False):
    origin = settings.BLOG_PUBLIC_ORIGIN.rstrip("/")
    canonical = origin + "/" + (quote(post.slug, safe="") if post else "")
    title = f"{post.title} · jion.log" if post else BLOG_TITLE
    description = plain_description(post.summary or post.content) if post else BLOG_DESCRIPTION
    image = urljoin(origin + "/", post.thumbnail_url) if post and post.thumbnail_url else origin + "/api/v1/blog/og/default.png"
    if urlparse(image).scheme not in ("http", "https"):
        image = origin + "/api/v1/blog/og/default.png"
    structured = {"@context": "https://schema.org", "@type": "BlogPosting" if post else "WebSite", "name": title, "url": canonical}
    if post:
        structured.update({"headline": post.title, "description": description, "image": image, "author": {"@type": "Person", "name": post.author.username}})
        for key, value in (("datePublished", post.published_at), ("dateModified", post.updated_at or post.created_at)):
            if value:
                structured[key] = value.isoformat()
    return {"title": title, "description": description, "image": image, "canonical": canonical, "type": "article" if post else "website", "robots": "noindex, nofollow" if private else "index, follow", "structured": structured}


def render_metadata(data):
    escape = lambda value: html.escape(str(value), quote=True)
    rows = [f'<title>{escape(data["title"])}</title>', f'<meta name="description" content="{escape(data["description"])}">', f'<meta name="robots" content="{data["robots"]}">', f'<link rel="canonical" href="{escape(data["canonical"])}">']
    for key, value in {"og:type": data["type"], "og:site_name": "jion.log", "og:title": data["title"], "og:description": data["description"], "og:url": data["canonical"], "og:image": data["image"], "og:locale": "ko_KR"}.items():
        rows.append(f'<meta property="{key}" content="{escape(value)}">')
    for key, value in {"twitter:card": "summary_large_image", "twitter:title": data["title"], "twitter:description": data["description"], "twitter:image": data["image"]}.items():
        rows.append(f'<meta name="{key}" content="{escape(value)}">')
    if not data["robots"].startswith("noindex"):
        structured = json.dumps(data["structured"], ensure_ascii=False).replace("<", "\\u003c")
        rows.append(f'<script id="blog-structured-data" type="application/ld+json">{structured}</script>')
    return "\n".join(rows)


def render_blog_html(data):
    template = Path(settings.BLOG_HTML_TEMPLATE).read_text(encoding="utf-8")
    start, end = "<!-- BLOG_METADATA_START -->", "<!-- BLOG_METADATA_END -->"
    if start not in template or end not in template:
        raise ValueError("Blog HTML metadata markers missing")
    before, rest = template.split(start, 1)
    _, after = rest.split(end, 1)
    return before + start + "\n" + render_metadata(data) + "\n" + end + after
