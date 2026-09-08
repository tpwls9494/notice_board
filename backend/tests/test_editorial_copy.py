import importlib.util
from pathlib import Path

import pytest
from test_blog_activity import blog_client  # noqa: F401
from app.models.signal import Signal

spec = importlib.util.spec_from_file_location('edit_signal_copy', Path(__file__).resolve().parents[2] / 'scripts/edit_signal_copy.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def seed_copy_fixture(db):
    for identifier in (7, 8):
        db.add(Signal(id=identifier, slug=f'keep-{identifier}', title='An existing long title',
            summary='Existing context with caveats', content_kind='research', status='published',
            source_kind='paper', source_name='arXiv', source_url=f'https://example.test/{identifier}',
            source_hash=str(identifier), why_it_matters='Do not lose the conditions', try_this='A proposed exercise, not a verified result'))
    db.commit()
    return [{'id': identifier, 'source_url': f'https://example.test/{identifier}',
        'before_title': 'An existing long title', 'before_summary': 'Existing context with caveats',
        'title': 'A shorter headline', 'summary': 'One concise and truthful sentence.'} for identifier in (7, 8)]


def test_copy_revision_preserves_context_and_does_not_commit(blog_client):
    _, _, factory = blog_client
    with factory() as db:
        plan = seed_copy_fixture(db)
        result = module.revise_titles_and_summaries(db, plan)
        assert len(result) == 2
        row = db.get(Signal, 7)
        assert row.slug == 'keep-7' and row.why_it_matters == 'Do not lose the conditions'
        assert row.try_this == 'A proposed exercise, not a verified result'
        db.rollback()
        assert db.get(Signal, 7).title == plan[0]['before_title']


@pytest.mark.parametrize('failure', ['stale', 'private', 'source', 'long'])
def test_copy_revision_rejects_entire_stale_or_unsafe_batch(blog_client, failure):
    _, _, factory = blog_client
    with factory() as db:
        plan = seed_copy_fixture(db)
        if failure == 'stale': plan[1]['before_title'] = 'Different title'
        if failure == 'private': db.get(Signal, 8).status = 'review'; db.commit()
        if failure == 'source': plan[1]['source_url'] = 'https://wrong.test/'
        if failure == 'long': plan[1]['summary'] = 'x' * 101
        with pytest.raises(ValueError): module.revise_titles_and_summaries(db, plan)
        assert db.get(Signal, 7).title == plan[0]['before_title']
        db.rollback()
