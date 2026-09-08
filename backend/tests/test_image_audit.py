from datetime import datetime, timedelta, timezone
import os

from scripts.audit_community_images import audit_images


def test_image_audit_preserves_referenced_files_and_only_reports_old_orphans(tmp_path):
    now = datetime(2026, 9, 6, tzinfo=timezone.utc)
    used, old, young, missing = [str(number) * 32 + '.webp' for number in [1, 2, 3, 4]]
    for name, days in [(used, 90), (old, 31), (young, 2)]:
        file = tmp_path / name
        file.write_bytes(b'test image bytes')
        stamp = (now - timedelta(days=days)).timestamp()
        os.utime(file, (stamp, stamp))
    (tmp_path / 'unknown.txt').write_text('Keep unknown files', encoding='utf-8')
    result = audit_images(tmp_path, ['https://jionc.com/api/v1/community/images/' + used,
                                    'http://localhost:8000/api/v1/community/images/' + missing], now=now)
    assert result['mode'] == 'report_only'
    assert result['referenced_files'] == 1
    assert result['review_candidates'] == 1
    assert result['missing_referenced_files'] == [missing]
    assert [item['filename'] for item in result['unreferenced'] if item['review_eligible']] == [old]
    assert set(file.name for file in tmp_path.iterdir()) == {used, old, young, 'unknown.txt'}


def test_absent_upload_directory_is_a_valid_empty_inventory(tmp_path):
    result = audit_images(tmp_path / 'not-created-yet', [])
    assert result['files'] == result['review_candidates'] == 0
    assert result['missing_referenced_files'] == []
