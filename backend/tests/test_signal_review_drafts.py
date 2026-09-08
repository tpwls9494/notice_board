import json
from datetime import datetime,timezone
import pytest
from scripts.collect_ai_signals import Candidate
from scripts.signal_review_drafts import select_candidates,validate_draft

NOW=datetime(2026,9,7,12,tzinfo=timezone.utc)

def candidate(**kwargs):
    return Candidate(**{'title':'AI workflow release','summary':'A new documented AI workflow supports local testing. '*4,'source_text':'A new documented AI workflow supports local testing. '*4,'source_name':'Example','source_url':'https://example.com/release','source_kind':'github','content_kind':'workflow','source_published_at':'2026-09-05T10:00:00Z',**kwargs})

def draft():
    return {'eligible':True,'reason':'구체적인 활용 방법이 있습니다','title':'로컬 작업을 확인하는 새로운 기능','summary':'공식 자료에서 로컬 테스트를 지원하는 작업 흐름을 소개했습니다.','why_it_matters':'작은 작업부터 검토할 수 있다는 점이 활용 포인트입니다.','steps':['공개 예제로 지원 조건을 확인합니다.','작은 작업으로 결과를 비교합니다.'],'limitations':'실제 환경에서의 효과는 별도 검증이 필요합니다.','evidence_quote':'A new documented AI workflow supports local testing.'}

def test_always_review_and_preserves_source_identity():
    output=validate_draft(json.dumps(draft()),candidate().__dict__,now=NOW)['payload']
    assert output['status']=='review' and output['source_url']=='https://example.com/release'
    assert 'published_at' not in output and '제안' in output['try_this'] and output['external_reactions']==0

@pytest.mark.parametrize('change',[{'status':'published'},{'evidence_quote':'Invented evidence'},{'summary':'It is English only.'},{'summary':'테스트에서 99% 향상되었습니다.'},{'title':'운영 샘플을 직접 사용해보니 효과가 있었습니다.'}])
def test_invalid_or_unfounded_drafts_rejected(change):
    with pytest.raises(ValueError):validate_draft(json.dumps({**draft(),**change}),candidate().__dict__,now=NOW)

def test_editorial_rejection_stays_out_of_queue():
    assert validate_draft(json.dumps({**draft(),'eligible':False}),candidate().__dict__,now=NOW) is None

def test_stale_draft_cannot_be_saved():
    with pytest.raises(ValueError):validate_draft(json.dumps(draft()),candidate(source_published_at='2021-01-01T00:00:00Z').__dict__,now=NOW)

def test_selection_excludes_duplicates_short_old_and_future_sources():
    rows=[candidate(),candidate(source_url='https://www.example.com/release?utm_source=x'),candidate(source_url='https://example.com/short',source_text='too short'),candidate(source_url='https://example.com/old',source_published_at='2021-01-01T00:00:00Z'),candidate(source_url='https://example.com/future',source_published_at='2030-01-01T00:00:00Z')]
    assert len(select_candidates(rows,now=NOW))==1
    assert select_candidates(rows,existing_urls=['http://example.com/release'],now=NOW)==[]

def test_selection_caps_sources_and_types():
    rows=[candidate(source_url=f'https://example.com/{i}') for i in range(5)]
    assert len(select_candidates(rows,now=NOW))==2
