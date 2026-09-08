"""Explicit editorial revision helper; never schedules, publishes, or commits.

Caller must retain the expected title/summary before committing a revision.
Only already-published editorial signals may be changed. Slugs and all content
outside title/summary (including sources, conditions, dates and scores) stay put.
"""
from copy import deepcopy


def revise_titles_and_summaries(db, revisions):
    from app.models.signal import Signal

    ids = [row['id'] for row in revisions]
    if not ids or len(ids) != len(set(ids)):
        raise ValueError('Revision IDs must be nonempty and unique')
    signals = db.query(Signal).filter(Signal.id.in_(ids)).order_by(Signal.id).with_for_update().all()
    if len(signals) != len(ids):
        raise ValueError('A target signal no longer exists')
    by_id = {row['id']: row for row in revisions}
    before = {signal.id: {column.name: deepcopy(getattr(signal, column.name)) for column in Signal.__table__.columns} for signal in signals}
    for signal in signals:
        change = by_id[signal.id]
        if signal.status != 'published' or signal.content_kind not in {'workflow', 'research'}:
            raise ValueError('Only published editorial signals may be revised')
        if signal.source_url != change['source_url']:
            raise ValueError('Source identity changed')
        if signal.title != change['before_title'] or signal.summary != change['before_summary']:
            raise ValueError('Copy changed concurrently; review again')
        if not 4 <= len(change['title']) <= 40 or not 10 <= len(change['summary']) <= 100:
            raise ValueError('Copy exceeds the explicit revision budget')
        if any('\n' in change[field] or change[field] != change[field].strip() for field in ('title', 'summary')):
            raise ValueError('Card copy must be a single trimmed paragraph')
    for signal in signals:
        signal.title = by_id[signal.id]['title']
        signal.summary = by_id[signal.id]['summary']
    db.flush()
    for signal in signals:
        db.refresh(signal)
        for field, value in before[signal.id].items():
            if field not in {'title', 'summary', 'updated_at'} and getattr(signal, field) != value:
                raise RuntimeError('A protected field changed: ' + field)
    return [{'id': signal.id, 'title': signal.title, 'summary': signal.summary,
             'title_chars': len(signal.title), 'summary_chars': len(signal.summary)} for signal in signals]
