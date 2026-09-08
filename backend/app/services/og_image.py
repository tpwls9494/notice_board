"""Generate Open Graph PNG images using Pillow.

Produces 1200x630 PNG cards that work on every platform
(Kakao, Slack, Facebook, Twitter, etc.) unlike SVG which
many crawlers/unfurlers ignore.
"""

from __future__ import annotations

import textwrap
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630

# ── Colours (same palette as the old SVG) ──────────────────────
BG_TOP = (15, 23, 42)       # #0f172a
BG_BOTTOM = (31, 41, 55)    # #1f2937
ACCENT = (14, 165, 233)     # #0ea5e9
ACCENT2 = (34, 211, 238)    # #22d3ee
TEXT_PRIMARY = (248, 250, 252)   # #f8fafc
TEXT_SECONDARY = (203, 213, 225)  # #cbd5e1
TEXT_MUTED = (148, 163, 184)     # #94a3b8
BADGE_BG = (17, 24, 39)         # #111827
BADGE_BORDER = (51, 65, 85)     # #334155
CIRCLE_BG = (30, 41, 59)        # #1e293b


# ── Font helpers ───────────────────────────────────────────────
_font_cache: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}

_FONT_SEARCH_PATHS = [
    # Docker (fonts-noto-cjk)
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
    # macOS
    "/System/Library/Fonts/AppleSDGothicNeo.ttc",
    # Windows
    "C:/Windows/Fonts/malgunbd.ttf",
    "C:/Windows/Fonts/malgun.ttf",
]


def _find_system_font() -> str | None:
    for p in _FONT_SEARCH_PATHS:
        if Path(p).is_file():
            return p
    return None


def _get_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    key = (str(bold), size)
    if key in _font_cache:
        return _font_cache[key]

    path = _find_system_font()
    if path:
        # For .ttc files, index 0 is usually Regular, index can vary
        try:
            font = ImageFont.truetype(path, size)
            _font_cache[key] = font
            return font
        except Exception:
            pass

    return ImageFont.load_default(size)


# ── Drawing helpers ────────────────────────────────────────────
def _draw_gradient_bg(img: Image.Image) -> None:
    """Simple vertical gradient from BG_TOP to BG_BOTTOM."""
    pixels = img.load()
    for y in range(H):
        ratio = y / H
        r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * ratio)
        g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * ratio)
        b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * ratio)
        for x in range(W):
            pixels[x, y] = (r, g, b)


def _draw_gradient_bg_fast(draw: ImageDraw.ImageDraw) -> None:
    """Band-based vertical gradient (much faster than per-pixel)."""
    bands = 64
    band_h = H // bands + 1
    for i in range(bands):
        ratio = i / bands
        r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * ratio)
        g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * ratio)
        b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * ratio)
        y0 = i * band_h
        y1 = min(y0 + band_h, H)
        draw.rectangle([0, y0, W, y1], fill=(r, g, b))


def _draw_decorative_circles(draw: ImageDraw.ImageDraw) -> None:
    """Background circles (top-right) matching the old SVG look."""
    cx, cy, r = 1030, 130, 190
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=CIRCLE_BG)
    cx2, cy2, r2 = 1080, 170, 120
    # Semi-transparent circle approximation
    overlay_color = (
        int(BG_TOP[0] * 0.82 + ACCENT[0] * 0.18),
        int(BG_TOP[1] * 0.82 + ACCENT[1] * 0.18),
        int(BG_TOP[2] * 0.82 + ACCENT[2] * 0.18),
    )
    draw.ellipse([cx2 - r2, cy2 - r2, cx2 + r2, cy2 + r2], fill=overlay_color)


def _wrap_text(text: str, font: ImageFont.FreeTypeFont | ImageFont.ImageFont, max_width: int) -> list[str]:
    """Word-wrap text to fit within max_width pixels."""
    # For CJK text, wrap per-character; for Latin, wrap per-word.
    words = list(text)
    lines: list[str] = []
    current = ""
    for ch in words:
        test = current + ch
        bbox = font.getbbox(test)
        tw = bbox[2] - bbox[0]
        if tw > max_width and current:
            lines.append(current)
            current = ch
        else:
            current = test
    if current:
        lines.append(current)
    return lines


# ── Public generators ──────────────────────────────────────────
def generate_blog_og() -> bytes:
    img = Image.new("RGB", (W, H), "#fdfdfa")
    draw = ImageDraw.Draw(img)
    draw.text((80, 65), "jion.log", fill="#3458d4", font=_get_font(40, True))
    draw.line((80, 140, 1120, 140), fill="#e1e5dd", width=2)
    draw.text((80, 220), "배우고, 만들고,", fill="#242823", font=_get_font(70, True))
    draw.text((80, 315), "기록합니다.", fill="#242823", font=_get_font(70, True))
    draw.text((80, 525), "AI와 개발, 그 사이의 생각을 차곡차곡.", fill="#7c8574", font=_get_font(28))
    output = BytesIO()
    img.save(output, format="PNG")
    return output.getvalue()


def generate_post_og(title: str, category_name: str, site_name: str = "jion") -> bytes:
    """Generate a 1200x630 PNG OG image for a single post."""
    img = Image.new("RGB", (W, H), BG_TOP)
    draw = ImageDraw.ImageDraw(img)

    _draw_gradient_bg_fast(draw)
    _draw_decorative_circles(draw)

    # ── Category badge ──
    cat_font = _get_font(26)
    cat_text = category_name[:24]
    cat_bbox = cat_font.getbbox(cat_text)
    cat_tw = cat_bbox[2] - cat_bbox[0]
    badge_w = cat_tw + 40
    badge_x, badge_y = 74, 74
    draw.rounded_rectangle(
        [badge_x, badge_y, badge_x + badge_w, badge_y + 52],
        radius=14,
        fill=BADGE_BG,
        outline=BADGE_BORDER,
        width=1,
    )
    draw.text(
        (badge_x + 20, badge_y + 12),
        cat_text,
        fill=TEXT_SECONDARY,
        font=cat_font,
    )

    # ── Title (multi-line) ──
    title_font = _get_font(56)
    title_text = title[:120]
    title_lines = _wrap_text(title_text, title_font, W - 160)
    title_lines = title_lines[:3]  # max 3 lines
    title_y = 180
    line_height = 72
    for line in title_lines:
        draw.text((74, title_y), line, fill=TEXT_PRIMARY, font=title_font)
        title_y += line_height

    # ── Accent bar ──
    bar_y = H - 112
    draw.rounded_rectangle([74, bar_y, 382, bar_y + 10], radius=5, fill=ACCENT2)

    # ── Site name ──
    site_font = _get_font(28)
    draw.text((74, H - 70), site_name, fill=TEXT_MUTED, font=site_font)

    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def generate_default_og(site_name: str = "jion") -> bytes:
    """Generate the default OG image (no specific post)."""
    cream = (245, 245, 242)
    ink = (23, 25, 34)
    accent_blue = (98, 102, 209)
    muted = (75, 78, 91)
    img = Image.new("RGB", (W, H), cream)
    draw = ImageDraw.ImageDraw(img)
    draw.rectangle([6, 6, W - 7, H - 7], outline=ink, width=6)
    draw.line([72, 168, W - 72, 168], fill=ink, width=3)
    draw.rectangle([744, 70, 1100, 438], fill=accent_blue)
    draw.polygon([(694, 190), (1002, 112), (1080, 420), (770, 500)], outline=ink, width=24)

    brand_font = _get_font(70, bold=True)
    draw.text((72, 64), site_name, fill=ink, font=brand_font)
    title_font = _get_font(64, bold=True)
    draw.text((72, 258), "오늘 놓치면 안 될 AI", fill=ink, font=title_font)
    body_font = _get_font(30)
    draw.text((72, 362), "새로운 정보와 사람들의 이야기를 한곳에서.", fill=muted, font=body_font)
    label_font = _get_font(22, bold=True)
    draw.text((72, 526), "TODAY / COMMUNITY / RESEARCH", fill=(75, 78, 176), font=label_font)

    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
