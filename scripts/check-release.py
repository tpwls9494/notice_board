"""Read-only Nginx smoke checks; run inside the backend container.

TLS verifies real hostnames even when connecting to a private container name.
RELEASE_CA_FILE is only needed for an isolated rehearsal's certificate.
"""
import argparse
import hashlib
from html.parser import HTMLParser
import http.client
import json
import os
from pathlib import Path
import socket
import ssl
import sys
import uuid
from urllib.parse import urlsplit, quote
import xml.etree.ElementTree as ET
from urllib.request import urlopen

sys.path.insert(0, "/app")


class AssetParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = set()

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        value = attributes.get("src") if tag == "script" else attributes.get("href") if tag == "link" else None
        if value and value.startswith("/assets/"):
            self.assets.add(value)


def asset_content_type(path):
    # Links include icons/fonts as well as CSS. Unknown types get a status check.
    return {".js": "javascript", ".mjs": "javascript", ".css": "text/css",
            ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
            ".woff": "font/woff", ".woff2": "font/woff2"}.get(Path(urlsplit(path).path).suffix.lower())


def check(target):
    from alembic.config import Config
    from alembic.script import ScriptDirectory
    from sqlalchemy import text
    from app.db.session import SessionLocal
    from app.core.config import settings
    from redis import Redis

    Redis.from_url(settings.REDIS_URL, socket_connect_timeout=3, socket_timeout=3).ping()
    with urlopen("http://127.0.0.1:8000/health/detailed", timeout=5) as response:
        if json.load(response).get("status") != "healthy":
            raise RuntimeError("Backend detailed health is degraded")
    expected = ScriptDirectory.from_config(Config("/app/alembic.ini")).get_current_head()
    with SessionLocal() as db:
        actual = db.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    if actual != expected:
        raise RuntimeError(f"Database revision mismatch: {actual} != {expected}")
    template = Path(settings.BLOG_HTML_TEMPLATE).read_bytes()
    if b"<!-- BLOG_METADATA_START -->" not in template or b"<!-- BLOG_METADATA_END -->" not in template:
        raise RuntimeError("Blog template metadata markers missing")
    context = ssl.create_default_context(cafile=os.environ.get("RELEASE_CA_FILE"))
    results = []

    def request(host, path, expected_status=200, content_type=None):
        connection = http.client.HTTPSConnection(host, timeout=10, context=context)
        connection.sock = context.wrap_socket(socket.create_connection((target, 443), timeout=10), server_hostname=host)
        try:
            connection.request("GET", quote(path, safe="/%?=&"), headers={"Host": host})
            response = connection.getresponse()
            body = response.read()
            if response.status != expected_status:
                raise RuntimeError(f"{host}{path}: expected {expected_status}, got {response.status}")
            if content_type and content_type not in response.getheader("Content-Type", ""):
                raise RuntimeError(f"{host}{path}: unexpected content type")
            results.append({"host": host, "path": path, "status": response.status})
            return body, dict((key.lower(), value) for key, value in response.getheaders())
        finally:
            connection.close()

    canonical_path = '/community?sort=latest&next=%2Fpapers'
    _, redirect_headers = request('www.jionc.com', canonical_path, expected_status=301)
    if redirect_headers.get('location') != 'https://jionc.com' + canonical_path:
        raise RuntimeError('HTTPS www canonical redirect lost path/query')
    for host in ('www.jionc.com', 'jionc.com'):
        connection = http.client.HTTPConnection(target, 80, timeout=10)
        try:
            connection.request('GET', canonical_path, headers={'Host': host})
            response = connection.getresponse()
            response.read()
            if response.status != 301 or response.getheader('Location') != 'https://jionc.com' + canonical_path:
                raise RuntimeError('HTTP canonical redirect lost path/query')
            results.append({'host': host, 'scheme': 'http', 'path': canonical_path, 'status': 301})
        finally:
            connection.close()

    for host in ("jionc.com", "blog.jionc.com"):
        theme_script, _ = request(host, '/theme-init.js', content_type='javascript')
        if b'JionTheme' not in theme_script:
            raise RuntimeError('Missing early theme bootstrap: ' + host)
        body, _ = request(host, "/", content_type="text/html")
        if b'id="root"' not in body:
            raise RuntimeError(f"Missing application root: {host}")
        parser = AssetParser()
        parser.feed(body.decode("utf-8"))
        if not parser.assets:
            raise RuntimeError(f"Missing frontend assets: {host}")
        for asset in sorted(parser.assets):
            request(host, asset, content_type=asset_content_type(asset))
        robots, _ = request(host, "/robots.txt", content_type="text/plain")
        if f"https://{host}/sitemap.xml".encode() not in robots:
            raise RuntimeError(f"Robots sitemap origin mismatch: {host}")
        sitemap, _ = request(host, "/sitemap.xml", content_type="xml")
        root = ET.fromstring(sitemap)
        locations = [node.text for node in root.iter() if node.tag.endswith("}loc") and node.text]
        if not locations:
            raise RuntimeError(f"Empty sitemap: {host}")
        for location in locations:
            url = urlsplit(location)
            if url.scheme != "https" or url.netloc != host:
                raise RuntimeError(f"Unexpected sitemap origin: {host}")
    body, _ = request("jionc.com", "/api/v1/signals/?page_size=1", content_type="application/json")
    json.loads(body)
    request("jionc.com", "/api/v1/community/posts?page_size=1", content_type="application/json")
    request("blog.jionc.com", "/api/v1/blog/profile", content_type="application/json")
    _, headers = request("blog.jionc.com", "/login", content_type="text/html")
    if "noindex" not in headers.get("x-robots-tag", ""):
        raise RuntimeError("Blog login must be noindex")
    _, headers = request("blog.jionc.com", "/__release_missing_" + uuid.uuid4().hex, expected_status=404, content_type="text/html")
    if "noindex" not in headers.get("x-robots-tag", ""):
        raise RuntimeError("Missing blog pages must be noindex")
    robots, _ = request("blog.jionc.com", "/robots.txt", content_type="text/plain")
    if b"https://blog.jionc.com/sitemap.xml" not in robots:
        raise RuntimeError("Blog robots sitemap origin mismatch")
    sitemap, _ = request("blog.jionc.com", "/sitemap.xml", content_type="xml")
    root = ET.fromstring(sitemap)
    locations = [node.text for node in root.iter() if node.tag.endswith("}loc") and node.text]
    for location in locations:
        url = urlsplit(location)
        if url.scheme != "https" or url.netloc != "blog.jionc.com":
            raise RuntimeError("Unexpected blog sitemap origin")
    post_paths = [urlsplit(location).path for location in locations if urlsplit(location).path != "/"]
    if post_paths:
        body, _ = request("blog.jionc.com", post_paths[0], content_type="text/html")
        if b'"BlogPosting"' not in body or b'rel="canonical"' not in body:
            raise RuntimeError("Published post metadata missing")
    png, _ = request("blog.jionc.com", "/api/v1/blog/og/default.png", content_type="image/png")
    if not png.startswith(b"\x89PNG\r\n\x1a\n"):
        raise RuntimeError("Invalid blog OG PNG")
    return {"database_revision": actual, "template_sha256": hashlib.sha256(template).hexdigest(), "tls_verified": True, "checks": results}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--connect-host", required=True)
    args = parser.parse_args()
    print(json.dumps(check(args.connect_host), indent=2))
