#!/usr/bin/env python3
"""Scrape RSS/Atom feeds and publish IT news posts to the community board."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Iterable
from urllib import error, parse, request
import xml.etree.ElementTree as ET


DEFAULT_API_BASE = "http://localhost:8000"
DEFAULT_CATEGORY_SLUG = "dev-news"
DEFAULT_DEDUPE_WINDOW = 100
DEFAULT_TIMEOUT = 20
HTTP_UA = "it-news-scrap-publisher/1.0"

SKILL_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = SKILL_DIR.parents[2]
DEFAULT_FEEDS_FILE = SKILL_DIR / "references" / "default_feeds.json"
DEFAULT_ENV_FILE = REPO_ROOT / ".env"
DEFAULT_ENV_PRODUCTION_FILE = REPO_ROOT / ".env.production"
URL_PATTERN = re.compile(r"https?://[^\s)>\]]+")
HANGUL_PATTERN = re.compile(r"[가-힣]")
TAG_PATTERN = re.compile(r"<[^>]+>")
ARTICLE_BLOCK_PATTERN = re.compile(r"(?is)<article[^>]*>(.*?)</article>")
PARAGRAPH_PATTERN = re.compile(r"(?is)<p[^>]*>(.*?)</p>")
TITLE_PATTERN = re.compile(r"(?is)<title[^>]*>(.*?)</title>")
SCRIPT_STYLE_PATTERN = re.compile(r"(?is)<(script|style|noscript|svg|iframe)[^>]*>.*?</\1>")
CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
GOOGLE_NEWS_HOSTS = (
    "news.google.com",
    "news.url.google.com",
)
KOREAN_DOMAIN_HINTS = (
    ".kr",
    "naver.com",
    "daum.net",
    "kakao.com",
    "etnews.com",
    "chosun.com",
    "boannews.com",
    "bloter.net",
    "hankyung.com",
    "mk.co.kr",
    "zdnet.co.kr",
)
DEFAULT_ARTICLE_MAX_CHARS = 7000
DEFAULT_MIN_CONTENT_CHARS = 160
DEFAULT_TITLE_SIMILARITY_THRESHOLD = 0.9
MAX_TITLE_TOKENS = 32
BLOCKED_TITLE_KEYWORDS = (
    "연예",
    "스포츠",
    "부동산",
    "운세",
    "복권",
    "광고",
    "프로모션",
    "성인",
    "도박",
)
JS_DUMP_HINTS = (
    "window.wiz_global_data",
    "window[\"_f_toggles",
    "google.com/setprefs",
    "boq_dotssplashserver",
    "news.url.google.com",
    "var _0x",
)


@dataclass
class FeedSource:
    name: str
    url: str


@dataclass
class NewsItem:
    source: str
    title: str
    link: str
    published: str
    summary: str


def local_name(tag: str) -> str:
    return tag.split("}", 1)[-1].lower()


def clean_text(text: str) -> str:
    stripped = TAG_PATTERN.sub(" ", text or "")
    stripped = unescape(stripped)
    stripped = CONTROL_CHAR_PATTERN.sub("", stripped)
    return re.sub(r"\s+", " ", stripped).strip()


def trim_title(title: str, limit: int = 255) -> str:
    if len(title) <= limit:
        return title
    return title[: limit - 3].rstrip() + "..."


def normalize_url_for_dedupe(raw_url: str) -> str:
    if not raw_url:
        return ""

    parsed = parse.urlparse(raw_url.strip())
    if not parsed.scheme or not parsed.netloc:
        return raw_url.strip().rstrip("/")

    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]

    query_pairs = parse.parse_qsl(parsed.query, keep_blank_values=False)
    filtered_query = []
    for key, value in query_pairs:
        lowered_key = key.lower()
        if lowered_key.startswith("utm_"):
            continue
        if lowered_key in {"gclid", "fbclid", "mc_cid", "mc_eid", "ref", "spm"}:
            continue
        filtered_query.append((key, value))
    filtered_query.sort()

    normalized_path = re.sub(r"/{2,}", "/", parsed.path or "/")
    normalized_path = normalized_path.rstrip("/") or "/"
    normalized_query = parse.urlencode(filtered_query, doseq=True)

    return parse.urlunparse(
        (
            parsed.scheme.lower(),
            host,
            normalized_path,
            "",
            normalized_query,
            "",
        )
    )


def tokenize_title_for_similarity(title: str) -> set[str]:
    text = unicodedata.normalize("NFKC", title or "").lower()
    text = re.sub(r"[\[\](){}<>:;,.!?/\\|@#$%^&*_+=~\"'`-]+", " ", text)
    tokens = [token for token in text.split() if len(token) >= 2]
    return set(tokens[:MAX_TITLE_TOKENS])


def title_similarity(a: str, b: str) -> float:
    a_tokens = tokenize_title_for_similarity(a)
    b_tokens = tokenize_title_for_similarity(b)
    if not a_tokens or not b_tokens:
        return 0.0
    union = a_tokens | b_tokens
    if not union:
        return 0.0
    return len(a_tokens & b_tokens) / len(union)


def is_blocked_title(title: str) -> bool:
    lowered = (title or "").strip().lower()
    if not lowered:
        return True
    return any(keyword in lowered for keyword in BLOCKED_TITLE_KEYWORDS)


def parse_feed_argument(raw: str) -> FeedSource:
    if "|" in raw:
        name, url = raw.split("|", 1)
        return FeedSource(name=name.strip(), url=url.strip())

    path = Path(raw)
    if path.exists():
        return FeedSource(name=path.stem, url=str(path.resolve()))

    parsed = parse.urlparse(raw)
    if parsed.netloc:
        name = parsed.netloc
    else:
        name = raw
    return FeedSource(name=name, url=raw.strip())


def read_env_key(file_path: Path, key: str) -> str | None:
    if not file_path.exists():
        return None

    for raw_line in file_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        if "=" not in line:
            continue
        current_key, value = line.split("=", 1)
        if current_key.strip() != key:
            continue
        return value.strip().strip('"').strip("'")

    return None


def infer_default_api_base() -> str:
    # 1) explicit env wins
    explicit = os.getenv("IT_NEWS_API_BASE", "").strip()
    if explicit:
        return explicit

    # 2) use project deployment env if available
    for env_path in (DEFAULT_ENV_FILE, DEFAULT_ENV_PRODUCTION_FILE):
        api_url = read_env_key(env_path, "VITE_API_URL")
        if api_url:
            return api_url

    # 3) local development fallback
    return DEFAULT_API_BASE


def load_feed_whitelist(feeds_file: Path) -> set[str]:
    if not feeds_file.exists():
        return set()

    raw = json.loads(feeds_file.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError(f"Invalid feeds file format: {feeds_file}")

    hosts: set[str] = set()
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        url = str(entry.get("url", "")).strip()
        if not url:
            continue
        parsed = parse.urlparse(url)
        if parsed.netloc:
            host = parsed.netloc.lower()
            if host.startswith("www."):
                host = host[4:]
            hosts.add(host)
    return hosts


def normalize_host(raw_host: str) -> str:
    host = (raw_host or "").lower().strip()
    if host.startswith("www."):
        return host[4:]
    return host


def load_feeds(feeds_file: Path, feed_args: list[str], allow_custom_feeds: bool = False) -> list[FeedSource]:
    feeds: list[FeedSource] = []
    whitelisted_hosts = load_feed_whitelist(feeds_file)

    if feed_args:
        for raw in feed_args:
            parsed_feed = parse_feed_argument(raw)
            if parsed_feed.name and parsed_feed.url:
                if not allow_custom_feeds:
                    parsed = parse.urlparse(parsed_feed.url)
                    if parsed.netloc:
                        host = normalize_host(parsed.netloc)
                        if whitelisted_hosts and host not in whitelisted_hosts:
                            print(
                                f"[WARN] Skipping non-whitelisted feed host: {parsed_feed.url}",
                                file=sys.stderr,
                            )
                            continue
                feeds.append(parsed_feed)
    elif feeds_file.exists():
        raw = json.loads(feeds_file.read_text(encoding="utf-8"))
        if not isinstance(raw, list):
            raise ValueError(f"Invalid feeds file format: {feeds_file}")
        for entry in raw:
            if not isinstance(entry, dict):
                continue
            name = str(entry.get("name", "")).strip()
            url = str(entry.get("url", "")).strip()
            if name and url:
                feeds.append(FeedSource(name=name, url=url))

    deduped: list[FeedSource] = []
    seen = set()
    for feed in feeds:
        key = (feed.name.lower(), feed.url.lower())
        if key in seen:
            continue
        seen.add(key)
        deduped.append(feed)

    return deduped


def fetch_url_text(url_or_path: str, timeout: int = DEFAULT_TIMEOUT) -> str:
    path = Path(url_or_path)
    if path.exists():
        return path.read_text(encoding="utf-8")

    parsed = parse.urlparse(url_or_path)
    if parsed.scheme == "file":
        return Path(parsed.path).read_text(encoding="utf-8")

    req = request.Request(
        url_or_path,
        headers={
            "User-Agent": HTTP_UA,
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml",
        },
    )
    with request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def fetch_article_html(url: str, timeout: int = DEFAULT_TIMEOUT) -> str:
    req = request.Request(
        url,
        headers={
            "User-Agent": HTTP_UA,
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    with request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def sanitize_plain_text(text: str) -> str:
    return clean_text(text)


def sanitize_post_text(text: str) -> str:
    if not text:
        return ""
    normalized = unescape(text)
    normalized = CONTROL_CHAR_PATTERN.sub("", normalized)
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"[ \t]+", " ", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def normalize_article_text(text: str, max_chars: int) -> str:
    normalized = sanitize_post_text(text)
    normalized = normalized.strip()
    if len(normalized) > max_chars:
        normalized = normalized[: max_chars - 8].rstrip() + "\n\n(중략)"
    return normalized


def choose_best_paragraphs(paragraphs: list[str], max_chars: int) -> str:
    kept: list[str] = []
    total = 0
    seen = set()

    for paragraph in paragraphs:
        line = sanitize_plain_text(paragraph)
        if len(line) < 30:
            continue
        dedupe_key = line.lower()
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        if total + len(line) > max_chars and kept:
            break
        kept.append(line)
        total += len(line) + 2

    if kept:
        return normalize_article_text("\n\n".join(kept), max_chars=max_chars)
    return ""


def extract_article_text(html: str, max_chars: int) -> str:
    if not html:
        return ""

    cleaned_html = SCRIPT_STYLE_PATTERN.sub(" ", html)
    article_blocks = ARTICLE_BLOCK_PATTERN.findall(cleaned_html)

    # 1) Prefer explicit <article> blocks
    for block in article_blocks:
        paragraphs = PARAGRAPH_PATTERN.findall(block)
        article_text = choose_best_paragraphs(paragraphs, max_chars=max_chars)
        if article_text:
            return article_text

    # 2) Fallback to paragraph scan on full document
    paragraphs = PARAGRAPH_PATTERN.findall(cleaned_html)
    article_text = choose_best_paragraphs(paragraphs, max_chars=max_chars)
    if article_text:
        return article_text

    # 3) Last fallback: title + whole document text (heavily trimmed)
    title_match = TITLE_PATTERN.search(cleaned_html)
    title = sanitize_plain_text(title_match.group(1)) if title_match else ""
    body_text = sanitize_plain_text(cleaned_html)
    merged = f"{title}\n\n{body_text}" if title else body_text
    return normalize_article_text(merged, max_chars=max_chars)


def looks_like_javascript_dump(text: str) -> bool:
    lowered = (text or "").lower()
    if not lowered:
        return False

    if any(hint in lowered for hint in JS_DUMP_HINTS):
        return True

    brace_count = lowered.count("{") + lowered.count("}")
    semicolon_count = lowered.count(";")
    if len(lowered) > 1200 and brace_count > 80 and semicolon_count > 40:
        return True

    return False


def child_text(element: ET.Element, names: Iterable[str]) -> str:
    name_set = {name.lower() for name in names}
    for child in element:
        if local_name(child.tag) in name_set and child.text:
            text = child.text.strip()
            if text:
                return text
    return ""


def atom_link(entry: ET.Element) -> str:
    fallback = ""
    for child in entry:
        if local_name(child.tag) != "link":
            continue
        href = (child.attrib.get("href") or "").strip()
        rel = (child.attrib.get("rel") or "alternate").strip().lower()
        if not href:
            continue
        if rel == "alternate":
            return href
        if not fallback:
            fallback = href
    return fallback


def parse_feed_items(feed_source: FeedSource, raw_xml: str, per_feed_limit: int) -> list[NewsItem]:
    root = ET.fromstring(raw_xml)
    items: list[NewsItem] = []

    if local_name(root.tag) == "feed":
        entries = [child for child in root if local_name(child.tag) == "entry"]
        for entry in entries:
            title = clean_text(child_text(entry, ("title",)))
            link = (atom_link(entry) or "").strip()
            published = clean_text(child_text(entry, ("published", "updated")))
            summary = clean_text(child_text(entry, ("summary", "content")))
            if not title or not link:
                continue
            items.append(
                NewsItem(
                    source=feed_source.name,
                    title=title,
                    link=link,
                    published=published,
                    summary=summary,
                )
            )
    else:
        channels = [child for child in root if local_name(child.tag) == "channel"]
        if channels:
            channel = channels[0]
            raw_items = [child for child in channel if local_name(child.tag) == "item"]
        else:
            raw_items = [child for child in root if local_name(child.tag) == "item"]

        for item in raw_items:
            title = clean_text(child_text(item, ("title",)))
            link = clean_text(child_text(item, ("link", "guid")))
            published = clean_text(child_text(item, ("pubdate", "published", "updated", "dc:date")))
            summary = clean_text(child_text(item, ("description", "summary", "content:encoded", "content")))
            if not title or not link:
                continue
            items.append(
                NewsItem(
                    source=feed_source.name,
                    title=title,
                    link=link,
                    published=published,
                    summary=summary,
                )
            )

    return items[:per_feed_limit]


def make_url(base: str, path: str, query: dict[str, str] | None = None) -> str:
    clean_base = base.rstrip("/")
    clean_path = path if path.startswith("/") else f"/{path}"
    url = f"{clean_base}{clean_path}"
    if query:
        url += "?" + parse.urlencode(query)
    return url


def api_json(
    method: str,
    url: str,
    token: str | None = None,
    payload: dict | None = None,
    timeout: int = DEFAULT_TIMEOUT,
):
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {
        "Accept": "application/json",
        "User-Agent": HTTP_UA,
    }
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = request.Request(url=url, data=body, headers=headers, method=method.upper())

    try:
        with request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            if not raw.strip():
                return None
            return json.loads(raw)
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore").strip()
        raise RuntimeError(f"{method.upper()} {url} failed ({exc.code}): {detail}") from exc
    except error.URLError as exc:
        raise RuntimeError(f"{method.upper()} {url} failed: {exc.reason}") from exc


def get_token(api_base: str, token: str | None, email: str | None, password: str | None) -> str | None:
    if token:
        return token
    if not email or not password:
        return None

    login_url = make_url(api_base, "/api/v1/auth/login")
    result = api_json("POST", login_url, payload={"email": email, "password": password})
    access_token = (result or {}).get("access_token")
    if not access_token:
        raise RuntimeError("Login succeeded but access_token was missing")
    return str(access_token)


def find_category_id(api_base: str, category_slug: str) -> int:
    categories_url = make_url(api_base, "/api/v1/categories/")
    categories = api_json("GET", categories_url)
    if not isinstance(categories, list):
        raise RuntimeError("Invalid categories response")
    for category in categories:
        if isinstance(category, dict) and category.get("slug") == category_slug:
            return int(category["id"])
    raise RuntimeError(f"Category slug not found: {category_slug}")


def fetch_existing_dedupe_state(
    api_base: str,
    category_id: int,
    page_size: int,
) -> tuple[set[str], list[str]]:
    posts_url = make_url(
        api_base,
        "/api/v1/posts/",
        query={
            "page": "1",
            "page_size": str(page_size),
            "category_id": str(category_id),
            "sort": "latest",
        },
    )
    payload = api_json("GET", posts_url) or {}
    posts = payload.get("posts", [])
    links: set[str] = set()
    normalized_links: set[str] = set()
    titles: list[str] = []
    for post in posts:
        post_title = sanitize_plain_text(str(post.get("title", "")))
        if post_title:
            titles.append(post_title)
        content = str(post.get("content", ""))
        for link in URL_PATTERN.findall(content):
            cleaned = link.rstrip(".,)")
            links.add(cleaned)
            normalized_links.add(normalize_url_for_dedupe(cleaned))
    # Keep raw links for backward compatibility and canonicalized links for robust dedupe.
    return links | normalized_links, titles


def build_post_content(news: NewsItem, article_max_chars: int, fetch_article: bool = True) -> str:
    article_text = ""
    if fetch_article:
        try:
            html = fetch_article_html(news.link)
            article_text = extract_article_text(html, max_chars=article_max_chars)
        except Exception as exc:  # noqa: BLE001
            print(f"[WARN] Failed to fetch article body ({news.link}): {exc}", file=sys.stderr)

    if not article_text:
        article_text = sanitize_plain_text(news.summary or "")

    if looks_like_javascript_dump(article_text):
        article_text = sanitize_plain_text(news.summary or "")

    if not article_text:
        article_text = "기사 본문을 추출하지 못했습니다. 원문 링크를 확인해주세요."

    # Keep 원문 링크 for attribution while making article text the primary content.
    return "\n\n".join(
        [
            article_text,
            f"원문 링크: {news.link}",
        ]
    )


def format_post(news: NewsItem, article_max_chars: int, fetch_article: bool = True) -> tuple[str, str]:
    title = trim_title(sanitize_plain_text(f"[IT 뉴스] {news.title}"))
    content = sanitize_post_text(
        build_post_content(news, article_max_chars=article_max_chars, fetch_article=fetch_article)
    )
    if not content:
        content = f"원문 링크: {news.link}"
    return title, content


def build_candidate_items(
    items: list[NewsItem],
    max_items: int,
    existing_links: set[str],
    existing_titles: list[str],
    title_similarity_threshold: float,
    min_content_chars: int,
    article_max_chars: int,
    fetch_article: bool,
) -> tuple[list[tuple[NewsItem, str, str]], int]:
    selected: list[tuple[NewsItem, str, str]] = []
    seen_normalized_links = set(existing_links)
    seen_titles: list[str] = [title for title in existing_titles if title]
    skipped = 0

    for item in items:
        if len(selected) >= max_items:
            break

        normalized_link = normalize_url_for_dedupe(item.link)
        if normalized_link in seen_normalized_links or item.link in seen_normalized_links:
            skipped += 1
            continue

        if is_blocked_title(item.title):
            skipped += 1
            continue

        title, content = format_post(
            item,
            article_max_chars=article_max_chars,
            fetch_article=fetch_article,
        )
        plain_content = sanitize_plain_text(content)
        if len(plain_content) < min_content_chars:
            skipped += 1
            continue

        if any(title_similarity(title, existing) >= title_similarity_threshold for existing in seen_titles):
            skipped += 1
            continue

        selected.append((item, title, content))
        seen_titles.append(title)
        seen_normalized_links.add(item.link)
        seen_normalized_links.add(normalized_link)

    return selected, skipped


def is_google_news_url(url: str) -> bool:
    host = parse.urlparse(url).netloc.lower()
    return any(host.endswith(domain) for domain in GOOGLE_NEWS_HOSTS)


def is_probably_korean_item(item: NewsItem) -> bool:
    if HANGUL_PATTERN.search(item.title) or HANGUL_PATTERN.search(item.summary):
        return True

    host = parse.urlparse(item.link).netloc.lower()
    if not host:
        return False

    return any(host.endswith(hint) for hint in KOREAN_DOMAIN_HINTS)


def collect_items(feeds: list[FeedSource], per_feed_limit: int) -> list[NewsItem]:
    collected: list[NewsItem] = []
    for feed in feeds:
        try:
            raw_xml = fetch_url_text(feed.url)
            items = parse_feed_items(feed, raw_xml, per_feed_limit)
            collected.extend(items)
            print(f"[INFO] {feed.name}: fetched {len(items)} item(s)")
        except Exception as exc:  # noqa: BLE001
            print(f"[WARN] Failed to read {feed.name} ({feed.url}): {exc}", file=sys.stderr)

    deduped: list[NewsItem] = []
    seen = set()
    for item in collected:
        key = (normalize_url_for_dedupe(item.link), item.title.strip().lower())
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape IT news feeds and publish community posts.")
    parser.add_argument(
        "--api-base",
        default=infer_default_api_base(),
        help="Base URL of deployed service (auto: IT_NEWS_API_BASE > .env VITE_API_URL > localhost).",
    )
    parser.add_argument("--category-slug", default=os.getenv("IT_NEWS_CATEGORY_SLUG", DEFAULT_CATEGORY_SLUG))
    parser.add_argument("--max-items", type=int, default=5, help="Maximum posts to create in one run")
    parser.add_argument("--per-feed-limit", type=int, default=4, help="Maximum items to parse from each feed")
    parser.add_argument(
        "--article-max-chars",
        type=int,
        default=DEFAULT_ARTICLE_MAX_CHARS,
        help="Maximum number of characters for extracted article body.",
    )
    parser.add_argument(
        "--min-content-chars",
        type=int,
        default=DEFAULT_MIN_CONTENT_CHARS,
        help="Minimum cleaned content length required to publish.",
    )
    parser.add_argument(
        "--title-similarity-threshold",
        type=float,
        default=DEFAULT_TITLE_SIMILARITY_THRESHOLD,
        help="Skip candidates whose title similarity is above this threshold (0.0-1.0).",
    )
    parser.add_argument("--dedupe-window", type=int, default=DEFAULT_DEDUPE_WINDOW, help="Recent posts to inspect for duplicate links")
    parser.add_argument("--feeds-file", default=str(DEFAULT_FEEDS_FILE), help="JSON file with default feeds")
    parser.add_argument("--feed", action="append", default=[], help="Feed override. Use URL or name|URL. Repeatable.")
    parser.add_argument(
        "--allow-custom-feeds",
        action="store_true",
        help="Allow non-whitelisted --feed URLs. By default, only hosts in --feeds-file are accepted.",
    )
    parser.add_argument(
        "--allow-global",
        action="store_true",
        help="Include non-Korean articles as well (default filters to Korean articles only).",
    )
    parser.add_argument(
        "--allow-google-news",
        action="store_true",
        help="Include Google News wrapper URLs (default skips them to avoid JS-only pages).",
    )
    parser.add_argument(
        "--no-article-fetch",
        action="store_true",
        help="Do not fetch article pages; use feed summary fallback only.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print posts without creating them")
    parser.add_argument("--no-api", action="store_true", help="Skip API calls (for parser smoke tests)")
    parser.add_argument("--token", default=os.getenv("IT_NEWS_BOT_TOKEN"))
    parser.add_argument("--email", default=os.getenv("IT_NEWS_BOT_EMAIL"))
    parser.add_argument("--password", default=os.getenv("IT_NEWS_BOT_PASSWORD"))
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if args.max_items < 1:
        print("[ERROR] --max-items must be at least 1", file=sys.stderr)
        return 1
    if args.per_feed_limit < 1:
        print("[ERROR] --per-feed-limit must be at least 1", file=sys.stderr)
        return 1
    if args.article_max_chars < 300:
        print("[ERROR] --article-max-chars must be at least 300", file=sys.stderr)
        return 1
    if args.min_content_chars < 80:
        print("[ERROR] --min-content-chars must be at least 80", file=sys.stderr)
        return 1
    if not (0.5 <= args.title_similarity_threshold <= 1.0):
        print("[ERROR] --title-similarity-threshold must be between 0.5 and 1.0", file=sys.stderr)
        return 1
    if args.category_slug != DEFAULT_CATEGORY_SLUG:
        print(
            f"[ERROR] Only '{DEFAULT_CATEGORY_SLUG}' category is allowed for automation "
            f"(received: {args.category_slug})",
            file=sys.stderr,
        )
        return 1

    feeds = load_feeds(
        Path(args.feeds_file),
        args.feed,
        allow_custom_feeds=args.allow_custom_feeds,
    )
    if not feeds:
        print("[ERROR] No feeds configured. Provide --feed or a valid --feeds-file.", file=sys.stderr)
        return 1

    items = collect_items(feeds, args.per_feed_limit)
    if not items:
        print("[WARN] No news items collected.")
        return 0

    if not args.allow_global:
        korean_items = [item for item in items if is_probably_korean_item(item)]
        filtered_out = len(items) - len(korean_items)
        items = korean_items
        if filtered_out > 0:
            print(f"[INFO] Filtered out {filtered_out} non-Korean item(s).")

    if not args.allow_google_news:
        non_google_items = [item for item in items if not is_google_news_url(item.link)]
        filtered_out = len(items) - len(non_google_items)
        items = non_google_items
        if filtered_out > 0:
            print(f"[INFO] Skipped {filtered_out} Google News wrapper item(s).")

    if not items:
        print("[WARN] No news items left after filtering.")
        return 0

    if args.no_api:
        print("[INFO] API calls disabled (--no-api).")
        candidates, skipped_by_guard = build_candidate_items(
            items=items,
            max_items=args.max_items,
            existing_links=set(),
            existing_titles=[],
            title_similarity_threshold=args.title_similarity_threshold,
            min_content_chars=1,
            article_max_chars=args.article_max_chars,
            fetch_article=False,
        )
        for idx, (_item, title, content) in enumerate(candidates, start=1):
            print(f"\n[{idx}] {title}\n{content}\n")
        print(f"[SUMMARY] candidates={len(candidates)} skipped_by_guard={skipped_by_guard}")
        return 0

    try:
        category_id = find_category_id(args.api_base, args.category_slug)
    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] Failed to resolve category: {exc}", file=sys.stderr)
        return 1

    try:
        existing_links, existing_titles = fetch_existing_dedupe_state(
            args.api_base,
            category_id,
            args.dedupe_window,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] Failed to inspect existing posts: {exc}", file=sys.stderr)
        return 1

    candidates, skipped_by_guard = build_candidate_items(
        items=items,
        max_items=args.max_items,
        existing_links=existing_links,
        existing_titles=existing_titles,
        title_similarity_threshold=args.title_similarity_threshold,
        min_content_chars=args.min_content_chars,
        article_max_chars=args.article_max_chars,
        fetch_article=not args.no_article_fetch,
    )
    if not candidates:
        print("[INFO] No publishable items after duplicate/quality filtering.")
        return 0

    auth_token = None
    if not args.dry_run:
        try:
            auth_token = get_token(args.api_base, args.token, args.email, args.password)
        except Exception as exc:  # noqa: BLE001
            print(f"[ERROR] Authentication failed: {exc}", file=sys.stderr)
            return 1
        if not auth_token:
            print(
                "[ERROR] Missing credentials. Set --token or (--email and --password) for live posting.",
                file=sys.stderr,
            )
            return 1

    created = 0
    failed = 0
    skipped = len(items) - len(candidates)
    create_url = make_url(args.api_base, "/api/v1/posts/")

    for item, title, content in candidates:
        payload = {"title": title, "content": content, "category_id": category_id}

        if args.dry_run:
            print("\n[DRY-RUN] Candidate post")
            print(json.dumps(payload, ensure_ascii=False, indent=2))
            continue

        try:
            api_json("POST", create_url, token=auth_token, payload=payload)
            created += 1
            print(f"[OK] Posted: {title}")
        except Exception as exc:  # noqa: BLE001
            # Retry once with a shorter safe fallback body.
            fallback_content = "\n\n".join(
                [
                    sanitize_plain_text(item.summary or "") or "기사 요약을 가져오지 못했습니다.",
                    f"원문 링크: {item.link}",
                ]
            )
            retry_payload = {
                "title": trim_title(sanitize_plain_text(title)),
                "content": normalize_article_text(fallback_content, max_chars=1500),
                "category_id": category_id,
            }
            try:
                api_json("POST", create_url, token=auth_token, payload=retry_payload)
                created += 1
                print(f"[OK] Posted after retry: {title}")
            except Exception as retry_exc:  # noqa: BLE001
                failed += 1
                print(
                    f"[ERROR] Failed to post '{title}' "
                    f"(title_len={len(retry_payload['title'])}, content_len={len(retry_payload['content'])}): "
                    f"{retry_exc} | first_error={exc}",
                    file=sys.stderr,
                )

    print(
        f"\n[SUMMARY] collected={len(items)} candidates={len(candidates)} "
        f"created={created} skipped={skipped} failed={failed} skipped_by_guard={skipped_by_guard}"
    )
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
