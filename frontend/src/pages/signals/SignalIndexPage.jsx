import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { SignalListRow } from '../../components/signals/EditorialSignal'
import { signalsAPI } from '../../services/api'
import { useSeo } from '../../utils/seo'

const COPY = {
  all: { eyebrow: 'All AI', title: '오늘의 AI', description: '새 모델과 중요한 변화를 시간순으로 살펴봅니다.' },
  workflow: { eyebrow: 'How to use AI', title: 'AI 활용법', description: '누구나 오늘 바로 적용해볼 수 있는 방법을 모읍니다.' },
  research: { eyebrow: 'Research papers', title: '논문', description: '핵심 아이디어와 선행 개념, 공개 코드를 한국어로 풀어봅니다.' },
}

export default function SignalIndexPage({ kind = 'all' }) {
  const copy = COPY[kind]
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  useSeo({ title: copy.title, description: copy.description, url: kind === 'all' ? '/ai' : kind === 'workflow' ? '/how-to' : '/papers' })
  const signals = useQuery({
    queryKey: ['signal-index', kind, query],
    queryFn: () => signalsAPI.getSignals({ page_size: 30, sort: 'new', ...(kind !== 'all' ? { kind } : {}), ...(query ? { search: query } : {}) }),
  })
  const items = signals.data?.data?.items || []

  return (
    <div className="signal-index">
      <header className="grid gap-5 md:grid-cols-[1fr_22rem] md:items-end md:gap-8">
        <div><p className="font-body text-xs font-medium leading-5 text-accent-dark">{copy.eyebrow}</p><h1 className="mt-2 font-editorial text-4xl font-semibold tracking-[-0.045em] text-ink-950 sm:text-5xl">{copy.title}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-ink-600">{copy.description}</p></div>
        <form onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()) }} className="flex min-h-12 items-center gap-3 rounded-xl border border-ink-200 bg-paper-50 px-3 py-2 transition-colors focus-within:border-accent-dark">
          <svg className="shrink-0 text-ink-400" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
          <label htmlFor="signal-index-search" className="sr-only">검색</label><input id="signal-index-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="제목과 내용 검색" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-400" /><button className="shrink-0 rounded-lg bg-paper-200 px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-paper-300">검색</button>
        </form>
      </header>
      <section className="mt-7 sm:mt-9" aria-labelledby="signal-index-results">
        <div className="flex items-center justify-between border-b border-ink-300 pb-3"><h2 id="signal-index-results" className="text-sm font-semibold text-ink-800">{query ? '검색 결과' : kind === 'workflow' ? '최신 활용법' : kind === 'research' ? '최근 논문' : '최신 소식'}</h2><span className="text-xs text-ink-500">최신순</span></div>
        {signals.isLoading && <div className="mt-5 h-52 animate-pulse rounded-xl bg-paper-200" />}
        {!signals.isLoading && items.length === 0 && <p className="py-14 text-center text-sm text-ink-500">아직 표시할 정보가 없습니다.</p>}
        {items.map((signal) => <SignalListRow key={signal.id} signal={signal} />)}
      </section>
    </div>
  )
}
