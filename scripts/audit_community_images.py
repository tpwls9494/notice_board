"""Read-only inventory of main-site community images. This script never deletes files."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
from urllib.parse import urlsplit

from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parents[1]
FILENAME = re.compile(r'[0-9a-f]{32}\.webp')
IMAGE_PATH = re.compile(r'^/api/v1/community/images/([0-9a-f]{32}\.webp)$')


def audit_images(directory: Path, references: list[str], *, now: datetime | None = None, retention_days: int = 30) -> dict:
    if retention_days < 1:
        raise ValueError('retention_days must be positive')
    current = now or datetime.now(timezone.utc)
    referenced = set()
    for url in references:
        match = IMAGE_PATH.fullmatch(urlsplit(url).path)
        if match:
            referenced.add(match.group(1))
    found = set()
    unused = []
    ignored = []
    for file in sorted(directory.iterdir()) if directory.is_dir() else []:
        if file.is_symlink() or not file.is_file() or not FILENAME.fullmatch(file.name):
            ignored.append(file.name)
            continue
        found.add(file.name)
        if file.name in referenced:
            continue
        stat = file.stat()
        age = max(0, int((current.timestamp() - stat.st_mtime) // 86400))
        unused.append({'filename':file.name,'bytes':stat.st_size,'age_days':age,'review_eligible':age >= retention_days})
    return {
        'generated_at':current.isoformat(), 'mode':'report_only', 'retention_days':retention_days,
        'files':len(found), 'referenced_files':len(found & referenced),
        'unreferenced_files':len(unused), 'review_candidates':sum(item['review_eligible'] for item in unused),
        'missing_referenced_files':sorted(referenced - found), 'unreferenced':unused, 'ignored':ignored,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database-url', default=os.getenv('DATABASE_URL'))
    parser.add_argument('--directory', type=Path, default=Path(os.getenv('JION_COMMUNITY_IMAGE_DIR', str(ROOT/'backend/uploads/community'))))
    parser.add_argument('--retention-days', type=int, default=30)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    if not args.database_url:
        parser.error('Set DATABASE_URL or --database-url')
    if args.retention_days < 1:
        parser.error('--retention-days must be positive')
    engine = create_engine(args.database_url)
    try:
        with engine.connect() as connection:
            # Include hidden posts: their attachments must not be discarded.
            urls = list(connection.execute(text('SELECT image_url FROM social_posts WHERE image_url IS NOT NULL')).scalars())
        result = audit_images(args.directory, urls, retention_days=args.retention_days)
    finally:
        engine.dispose()
    serialized = json.dumps(result, ensure_ascii=False, indent=2)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(serialized, encoding='utf-8')
    print(serialized)
    return 1 if result['missing_referenced_files'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
