"""Extract source-specific notes without generating benefits or instructions.

Excerpts retain their source language. A Korean introduction identifies them as
source claims rather than independently verified user outcomes.
"""
import html
import re


BENEFIT = re.compile(r"\b(improv\w*|reduc\w*|faster|slower|latency|memory|performance|supports?|enables?|allows?|capabilit\w*|accuracy|benchmark\w*)\b|개선|줄였|줄일|단축|향상|지원|메모리|비용|성능|활용", re.I)
START = re.compile(r"\b(install\w*|quickstart|getting started|download\w*|requires?|pip install|npm (?:install|i)|npx|uv (?:tool|add|pip)|docker run|git clone|API key|Python [0-9]|CUDA [0-9])\b|\b(?:Python|CUDA|Node(?:\.js)?)\b.{0,60}\b\d+\.\d+|설치|실행|시작 방법|준비사항|필요한 환경|요구 사항|다운로드", re.I)
NOISE = re.compile(r"^(?:thanks? (?:to|for)|thank you\b|contributors?\b|full changelog\b|subscribe\b|follow us\b|copyright\b|all contributors\b|we will attend\b|join us (?:at|for)\b|farewell to \d{4})", re.I)
QUALIFIER = re.compile(r"^(?:however\b|but\b|only\b|except\b|note\b|limitations?\b|in (?:our|this|these)\b|under\b|on (?:an?|the)\b|not\b|does not\b|requires?\b|단,?|다만|단점|제한|주의|조건|환경)", re.I)
COMMAND = re.compile(r'\b(?:pip install|npm (?:install|i)|npx|uv (?:tool|add|pip)|docker run|git clone)\b', re.I)
MAINTENANCE = re.compile(r'^(?:ci:|tests?:|build:)|\b(?:daily CI|CI Docker|test suite|workflow file|pyproject\.toml)\b', re.I)


def setup_instruction(block: str) -> bool:
    if MAINTENANCE.search(block):
        return False
    return bool(COMMAND.search(block)
                or re.search(r'\b(?:install|download)\s+\S|\b(?:Python|CUDA|Node(?:\.js)?)\b.{0,60}\d+\.\d+|\b(?:requires?|requirements?)\b.{0,60}\b(?:Linux|Windows|macOS|GPU|API key)\b|설치|실행|시작 방법|필요한 환경|요구 사항|다운로드', block, re.I)
                or (re.search(r'\b(?:quickstart|getting started|installation guide|setup guide)\b', block, re.I) and 'http' in block))


def source_blocks(value: str) -> list[str]:
    text = html.unescape(value or '')
    text = re.sub(r'<(?:script|style)\b[^>]*>.*?</(?:script|style)>', '', text, flags=re.I | re.S)
    text = re.sub(r'</?(?:p|div|li|ul|ol|h[1-6]|pre|blockquote)\b[^>]*>|<br\b[^>]*>', '\n', text, flags=re.I)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'!\[[^\]]*\]\([^)]*\)', '', text)
    text = re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)', r'\1 (\2)', text)
    result = []
    in_code = False
    for line in text.splitlines():
        clean = re.sub(r'\s+', ' ', line).strip()
        if re.match(r'^```', clean):
            in_code = not in_code
            continue
        if not clean:
            continue
        clean = re.sub(r'^\s*(?:#{1,6}\s+|[-*+]\s+)', '', clean).strip()
        if not in_code and not COMMAND.search(clean):
            clean = re.sub(r'\*\*(.+?)\*\*', r'\1', clean)
        if clean and not NOISE.search(clean):
            result.append(clean)
    return result


def source_summary(source_text: str, fallback: str) -> str:
    blocks = source_blocks(source_text)
    for index, block in enumerate(blocks):
        if len(block) < 30 or len(block) > 1000 or START.search(block) or re.fullmatch(r'https?://\S+', block):
            continue
        lead = [block]
        for following in blocks[index + 1:index + 3]:
            if not QUALIFIER.search(following):
                break
            lead.append(following)
        if len('\n'.join(lead)) <= 1200:
            return '\n'.join(lead)
    return fallback[:3000]


def extract_source_notes(source_text: str, summary: str = '') -> tuple[str | None, str | None]:
    blocks = source_blocks(source_text)
    used = set()
    used_text = set()
    summary_key = re.sub(r'\s+', ' ', summary).strip().casefold()

    def excerpts(pattern, count):
        selected = []
        for index, block in enumerate(blocks):
            key = block.casefold()
            if index in used or key in used_text or key in summary_key or not pattern.search(block):
                continue
            if pattern is START and not setup_instruction(block):
                continue
            # Headings alone do not establish a benefit or an actionable step.
            if len(block) < 18 and not re.search(r'\b(?:pip|npm|npx|uv|docker|git)\s', block, re.I):
                continue
            group = [block]
            indexes = [index]
            for next_index in range(index + 1, min(index + 3, len(blocks))):
                if not QUALIFIER.search(blocks[next_index]):
                    break
                group.append(blocks[next_index])
                indexes.append(next_index)
            quote = '\n'.join(group)
            # Never shorten a claim by cutting away its conditions or limits.
            if len(quote) > 1200 or sum(map(len, selected)) + len(quote) > 2400:
                continue
            selected.append(quote)
            used.update(indexes)
            used_text.update(blocks[item].casefold() for item in indexes)
            if len(selected) >= count:
                break
        return '\n\n'.join(selected)

    # Keep actual setup commands and requirements together before picking benefits.
    steps = excerpts(START, 3)
    benefits = excerpts(BENEFIT, 2)
    return (
        '원문에 소개된 변화·활용:\n' + benefits if benefits else None,
        '원문에 안내된 방법·조건:\n' + steps if steps else None,
    )
