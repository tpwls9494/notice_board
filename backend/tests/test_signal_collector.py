from urllib import error
import json
import sys
from datetime import datetime, timezone

import pytest

import scripts.collect_ai_signals as collector
from scripts.collect_ai_signals import Candidate, canonical_source_key, parse_feed, relevant
from scripts.signal_source_notes import extract_source_notes, source_summary


def test_relevance_uses_word_boundaries_and_context():
    assert relevant("Weather", "It will rain today") is False
    assert relevant("Maintenance", "The service window is tomorrow") is False
    assert relevant("New AI model", "A small model is available") is True
    assert relevant("Agent benchmark", "Token usage fell in the new workflow") is True


def test_collector_url_key_removes_tracking_variants():
    first = canonical_source_key("https://www.example.com/news/?utm_source=linkedin#details")
    second = canonical_source_key("http://example.com/news")
    assert first == second


def test_collector_payload_can_never_publish():
    candidate = Candidate(
        title="A useful AI release",
        summary="A primary source summary with enough detail for review.",
        source_name="Example",
        source_url="https://example.com/ai-release",
        source_kind="official_blog",
        content_kind="release",
    )
    assert candidate.payload()["status"] == "review"


def test_feed_parser_uses_guid_when_link_is_missing(monkeypatch):
    feed = b"""<?xml version="1.0"?>
    <rss><channel><item>
      <title>New AI model release</title>
      <description>A language model update with inference improvements.</description>
      <guid>https://example.com/releases/model</guid>
      <enclosure url="https://example.com/images/model.jpg" type="image/jpeg" />
      <pubDate>Fri, 04 Sep 2026 01:00:00 GMT</pubDate>
    </item></channel></rss>"""
    monkeypatch.setattr(collector, "fetch", lambda _url: feed)

    items = parse_feed({"name": "Example Lab", "url": "https://example.com/feed", "official": True})
    assert len(items) == 1
    assert items[0].source_url == "https://example.com/releases/model"
    assert items[0].verification_level == "official"
    assert items[0].source_published_at.startswith("2026-09-04")
    assert items[0].image_url == "https://example.com/images/model.jpg"


def test_invalid_feed_is_rejected_for_main_loop_to_isolate(monkeypatch):
    monkeypatch.setattr(collector, "fetch", lambda _url: b"<rss><broken>")
    with pytest.raises(collector.ElementTree.ParseError):
        parse_feed({"name": "Broken", "url": "https://example.com/feed"})


def test_post_candidate_treats_conflict_as_duplicate(monkeypatch):
    def conflict(_request, timeout):
        raise error.HTTPError("https://jionc.com", 409, "Conflict", None, None)

    monkeypatch.setattr(collector.request, "urlopen", conflict)
    candidate = Candidate(
        title="A useful AI release",
        summary="A primary source summary with enough detail for review.",
        source_name="Example",
        source_url="https://example.com/ai-release",
        source_kind="official_blog",
        content_kind="release",
    )
    assert collector.post_candidate("https://jionc.com", "service-token", candidate) == "duplicate"


def test_source_notes_keep_claims_conditions_and_real_commands():
    source = '''A new AI agent connects local repository tasks with a review workflow.

Reduces peak memory by 30% in the published benchmark.
Only on the tested 7B model with a 4-bit configuration.

Install the package with the following command.
pip install example-agent==1.2.3
Requires Python 3.11 and CUDA 12.4.
'''
    candidate = Candidate(title='Example AI agent', summary=collector.clean_text(source),
                          source_text=source, source_name='Example', source_url='https://example.com/agent',
                          source_kind='github', content_kind='release')
    payload = candidate.payload()
    assert payload['summary'] == source.splitlines()[0]
    assert '30%' in payload['why_it_matters']
    assert 'Only on the tested 7B model with a 4-bit configuration.' in payload['why_it_matters']
    assert 'pip install example-agent==1.2.3' in payload['try_this']
    assert 'Python 3.11 and CUDA 12.4' in payload['try_this']
    assert '30%' not in payload['try_this']
    assert '작업 방식이나 사용할 수 있는 AI의 범위' not in str(payload)
    assert payload['status'] == 'review'


def test_missing_source_details_stay_empty_instead_of_inventing_benefits():
    source = 'A new language model was announced by the research group.'
    assert extract_source_notes(source, source) == (None, None)
    assert extract_source_notes('Installation\nPerformance\nSubscribe to our newsletter') == (None, None)


def test_negative_results_and_constraints_are_not_rewritten_as_benefits():
    benefits, steps = extract_source_notes('The model does not improve accuracy on the long-context task.\nHowever, this result is limited to one evaluation set.')
    assert 'does not improve' in benefits
    assert 'limited to one evaluation set' in benefits
    assert steps is None


def test_html_notes_ignore_scripts_and_preserve_visible_paragraphs():
    source = '<script>Install malicious-program and reduce cost by 99%.</script><p>A small language model adds a new local workflow for testing.</p><p>Supports offline inference on the tested laptop.</p><p>Install the official package from the documented repository.</p>'
    summary = source_summary(source, '')
    benefits, steps = extract_source_notes(source, summary)
    assert 'small language model' in summary
    assert 'offline inference' in benefits
    assert 'official package' in steps
    assert 'malicious' not in str((summary, benefits, steps))
    assert '99%' not in str((summary, benefits, steps))


def test_feed_prefers_full_content_over_short_teaser(monkeypatch):
    feed = b'''<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item>
    <title>New AI agent release</title><link>https://example.com/agent</link>
    <description>Read more about our AI agent.</description>
    <content:encoded><![CDATA[<p>A new AI agent handles repository tasks with local execution.</p><p>Reduces repeated setup by reusing an existing environment.</p><p>Install the package with pip install example-agent.</p>]]></content:encoded>
    </item></channel></rss>'''
    monkeypatch.setattr(collector, 'fetch', lambda _url: feed)
    payload = parse_feed({'name': 'Example', 'url': 'https://example.com/feed', 'official': True})[0].payload()
    assert 'Read more' not in payload['summary']
    assert 'reusing an existing environment' in payload['why_it_matters']
    assert 'pip install example-agent' in payload['try_this']


def test_empty_release_is_not_replaced_by_generic_copy(monkeypatch):
    monkeypatch.setattr(collector, 'fetch', lambda *_args: b'[{"name":"AI v2", "body":"", "html_url":"https://github.com/example/agent/releases/v2"}]')
    assert collector.collect_github({'name': 'Example', 'repository': 'example/agent'}, None) == []


def test_dependency_file_changelog_is_not_treated_as_setup_guidance():
    _, steps = extract_source_notes('Update pyproject.toml and requirements by @author in https://example.com/pull/1\ndocs: fix Python version requirement from 3.10 to >=3.11.0')
    assert 'pyproject.toml' not in steps
    assert '>=3.11.0' in steps


def test_event_advertisement_and_markdown_image_do_not_become_summary():
    source = 'We will attend the AWS Summit next month!\n![Banner](https://example.com/image.png)\nAdded **support for local AI inference** on the new device.'
    result = source_summary(source, '')
    assert result == 'Added support for local AI inference on the new device.'


def test_internal_ci_and_model_architecture_are_not_setup_steps():
    source = 'Update daily CI Docker image to torch 2.13.0 / CUDA 13.0\nTranscription requires a single forward pass and greedy CTC decoding.\nDownload the model from https://example.com/model.'
    _, steps = extract_source_notes(source)
    assert 'CI Docker' not in steps
    assert 'forward pass' not in steps
    assert 'Download the model' in steps


def test_duplicate_release_bullets_only_appear_once():
    source = 'Adds support for a small language model.\nAdds support for a small language model.\nReduces memory use for the tested model.'
    benefits, _ = extract_source_notes(source)
    assert benefits.count('Adds support') == 1
    assert 'Reduces memory' in benefits


@pytest.mark.parametrize('failures,expected_status,expected_code', [
    (2, 'failed', 1), (1, 'partial_failure', 1), (0, 'ok', 0),
])
def test_collection_failures_are_reported_and_fail_the_job(tmp_path, monkeypatch, failures, expected_status, expected_code):
    sources = tmp_path / 'sources.json'
    sources.write_text(json.dumps({'github_repositories':[{'name':'one'}, {'name':'two'}]}), encoding='utf-8')
    report = tmp_path / 'report.json'
    def collect(source, _token):
        if source['name'] in ['one', 'two'][:failures]:
            raise RuntimeError('source temporarily unavailable')
        return []
    monkeypatch.setattr(collector, 'collect_github', collect)
    monkeypatch.setattr(collector.time, 'sleep', lambda _seconds: None)
    monkeypatch.setattr(sys, 'argv', ['collect', '--sources', str(sources), '--dry-run', '--report', str(report)])
    assert collector.main() == expected_code
    saved = json.loads(report.read_text(encoding='utf-8'))
    assert saved['status'] == expected_status
    assert len(saved['source_failures']) == failures
    assert saved['created'] == saved['submit_failures'] == 0
    assert len(saved['empty_sources']) == 2 - failures


def test_freshness_uses_age_and_does_not_reward_invalid_or_future_dates():
    now = datetime(2026, 9, 6, tzinfo=timezone.utc)
    def value(date):
        return collector.score('AI language model inference update', 'An AI agent release with model improvements.', date, now=now)
    assert value('2026-09-05T00:00:00Z') > value('2026-08-20T00:00:00Z') > value('2025-01-01T00:00:00Z')
    assert value('2030-01-01T00:00:00Z') == value(None) == value('not a date')


def test_recent_source_is_a_hard_seven_day_window():
    now = datetime(2026, 9, 7, 12, tzinfo=timezone.utc)
    for value in ('2026-09-07T12:00:00Z', '2026-08-31T12:00:00Z'):
        assert collector.recent_source(value, now=now)
    for value in (None, 'invalid', '2026-08-31T11:59:59Z', '2026-09-07T12:00:01Z', '2021-06-17T00:00:00Z'):
        assert not collector.recent_source(value, now=now)


def test_real_collector_never_adds_fixture_disclaimers():
    result = Candidate(title='New AI release', summary='A documented change in a released AI tool.', source_name='Official', source_url='https://example.com/release', source_kind='official_blog', content_kind='workflow').payload()
    assert '운영 샘플' not in json.dumps(result, ensure_ascii=False)
    assert result['summary'] == 'A documented change in a released AI tool.'
