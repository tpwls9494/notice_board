import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { SiteActivitySummary } from '../components/DigitalCalendar'
import { formatRelativeTime } from '../components/signals/EditorialSignal'
import SocialPostRow from '../components/social/SocialPostRow'
import HomeStoryMedia from '../components/signals/HomeStoryMedia'
import { signalsAPI, socialAPI } from '../services/api'
import { signalPublicationDate } from '../utils/signalDates'
import { loadHomeSignals, selectHomeStories } from '../utils/homeStories'
import { useSeo } from '../utils/seo'

function FeedState({ query }) {
  if (query.isPending) return <div role="status" className="h-40 animate-pulse rounded-xl bg-paper-200"><span className="sr-only">소식을 불러오는 중입니다.</span></div>
  if (query.isError) return <div role="alert" className="rounded-xl border border-ink-200 p-6 text-sm text-ink-600"><p>잠시 정보를 불러오지 못했어요.</p><button type="button" onClick={() => query.refetch()} className="mt-3 font-semibold text-accent-dark">다시 불러오기</button></div>
  if (!query.data?.data?.items?.length) return <p className="py-8 text-sm text-ink-500">새로운 이야기를 준비하고 있어요.</p>
  return null
}

const kindLabel = signal => signal.content_kind === 'workflow' ? '활용법' : signal.content_kind === 'research' ? '연구 이야기' : signal.body?.trim() ? '해설' : '소식'

export default function TodayPage() {
  const [sort, setSort] = useState('latest')
  useSeo({ title: '오늘의 발견', description: '알아둘 AI 소식, 이해를 돕는 해설, 직접 써본 사람들의 경험', url: '/' })
  const signals = useQuery({ queryKey: ['today-signals', 'editorial'], queryFn: () => loadHomeSignals(signalsAPI.getSignals) })
  const community = useQuery({ queryKey: ['community-preview'], queryFn: () => socialAPI.getPosts({ space: 'community', sort: 'popular', page_size: 4 }) })
  const { lead } = selectHomeStories(signals.data?.data?.items || [])
  const feed = useQuery({
    queryKey: ['home-feed', sort, lead?.id],
    queryFn: () => signalsAPI.getSignals({ page_size: 4, sort, exclude_id: lead?.id }),
    enabled: !signals.isPending,
    refetchOnMount: 'always',
  })
  const stories = feed.isError ? [] : feed.data?.data?.items || []
  const posts = community.isError ? [] : community.data?.data?.items || []

  return (
    <div className="home-editorial">
      <header className="mb-6">
        <h1 className="text-[28px] font-semibold tracking-[-0.035em] sm:text-4xl">오늘의 발견</h1>
        <p className="mt-2 text-sm leading-6 text-ink-600">알아둘 소식부터, 내 일에 써볼 아이디어까지.</p>
        <SiteActivitySummary />
      </header>

      <div className="home-columns grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
      <div className="home-news min-w-0">
      <FeedState query={signals} />
      {!signals.isError && lead && <section aria-labelledby="featured-heading" className="home-lead rounded-xl border border-ink-200 bg-paper-50 p-5 sm:p-6">
        <div className="flex items-center gap-3 text-xs font-medium"><h2 id="featured-heading" className="text-accent-dark">먼저 읽을 이야기</h2><span className="text-ink-500">{kindLabel(lead)}</span></div>
        <div className="mt-4">
          <HomeStoryMedia key={lead.id + ':' + (lead.image_url || '')} src={lead.image_url} featured>
          <Link to={'/signals/' + lead.slug} className="block break-keep text-2xl font-semibold leading-[1.4] tracking-[-0.025em] text-ink-950 [overflow-wrap:anywhere] hover:text-accent-dark sm:text-[28px]">{lead.title}</Link>
          <p className="mt-3 text-sm leading-7 text-ink-600 sm:text-[15px]">{lead.summary}</p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-500"><span>출처 {lead.source_name}</span><span>{formatRelativeTime(signalPublicationDate(lead))}</span><span>추천 {lead.recommendation_count || 0}</span><span>댓글 {lead.comment_count || 0}</span></div>
          </HomeStoryMedia>
        </div>
      </section>}

      <section aria-labelledby="news-heading" className="mt-6">
        <div className="mb-4 flex items-center justify-between gap-4 border-b border-ink-200 pb-3"><h2 id="news-heading" className="text-lg font-semibold">함께 볼 소식</h2><Link to="/ai" className="py-2 text-xs font-medium text-ink-500 hover:text-accent-dark">전체 소식 →</Link></div>
        <div className="mb-4 inline-flex gap-1 rounded-lg border border-ink-200 bg-paper-200 p-1" role="group" aria-label="소식 정렬">
          {[['latest', '최신'], ['popular', '인기']].map(([value, label]) => <button key={value} type="button" aria-pressed={sort === value} onClick={() => setSort(value)} className={'min-w-16 rounded-md px-4 py-2 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ' + (sort === value ? 'bg-paper-50 text-ink-950 shadow-sm' : 'text-ink-500 hover:text-ink-900')}>{label}</button>)}
        </div>
        <div className="rounded-xl border border-ink-200 bg-paper-50 px-5 sm:px-6">
          {feed.isPending && <p role="status" className="py-6 text-sm text-ink-500">소식을 불러오고 있어요.</p>}
          {feed.isError && <div role="alert" className="py-6 text-sm text-ink-500">소식을 불러오지 못했어요. <button type="button" onClick={() => feed.refetch()} className="text-accent-dark">다시 불러오기</button></div>}
          {feed.isSuccess && stories.length === 0 && <p className="py-6 text-sm leading-7 text-ink-500">{sort === 'latest' ? '다른 소식을 준비하고 있어요.' : '인기 글이 아직 없어요.'}</p>}
          {stories.map(signal => <article key={signal.id} className="min-w-0 border-b border-ink-200 py-5 last:border-b-0 sm:py-6">
            <HomeStoryMedia key={signal.id + ':' + (signal.image_url || '')} src={signal.image_url}>
            <p className="text-xs font-medium text-accent-dark">{kindLabel(signal)}</p>
            <Link to={'/signals/' + signal.slug} className="mt-2 block break-keep text-lg font-semibold leading-7 text-ink-950 [overflow-wrap:anywhere] hover:text-accent-dark">{signal.title}</Link>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-600">{signal.summary}</p>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-500"><span>{signal.source_name}</span><span>추천 {signal.recommendation_count || 0}</span><span>댓글 {signal.comment_count || 0}</span></div>
            </HomeStoryMedia>
          </article>)}
        </div>
      </section>
      </div>
      <aside className="home-community min-w-0 rounded-xl border border-ink-200 bg-paper-50" aria-labelledby="community-heading">
        <div className="p-5 pb-3">
          <div className="flex items-center justify-between gap-3"><h2 id="community-heading" className="text-lg font-semibold">커뮤니티 이야기</h2><Link to="/community" className="py-2 text-xs font-medium text-ink-500 hover:text-accent-dark">더 보기 →</Link></div>
          <p className="mt-1 text-[13px] leading-6 text-ink-500">써본 경험과 궁금한 점을 함께 나눠요.</p>
        </div>
        <div className="px-5">
          {community.isPending && <p role="status" className="py-5 text-sm text-ink-500">이야기를 불러오고 있어요.</p>}
          {community.isError && <div role="alert" className="py-5 text-sm leading-6 text-ink-500"><p>커뮤니티 이야기를 불러오지 못했어요.</p><button type="button" onClick={() => community.refetch()} className="mt-2 text-accent-dark">다시 불러오기</button></div>}
          {community.isSuccess && posts.length === 0 && <p className="py-5 text-sm leading-6 text-ink-500">아직 올라온 이야기가 없어요.</p>}
          {posts.map(post => <SocialPostRow key={post.id} post={post} compact />)}
        </div>
        <div className="border-t border-ink-200 p-5"><Link to="/community/write" className="block rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-accent-dark">경험·질문 남기기</Link></div>
      </aside>
      </div>
    </div>
  )
}
