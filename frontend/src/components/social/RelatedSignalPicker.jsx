import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { signalsAPI } from '../../services/api'

export default function RelatedSignalPicker({ value, onChange }) {
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250)
    return () => clearTimeout(timer)
  }, [search])
  const results = useQuery({
    queryKey: ['related-signal-picker', query],
    queryFn: () => signalsAPI.getSignals({ page_size: 6, sort: 'latest', ...(query ? { search: query } : {}) }),
    enabled: expanded && !value,
  })

  return (
    <section aria-labelledby="related-signal-label" className="surface-panel p-4 sm:p-5">
      <h2 id="related-signal-label" className="text-sm font-semibold">관련 소식 <span className="ml-1 text-xs font-normal text-ink-500">선택</span></h2>
      {value ? <div className="mt-3 flex items-start justify-between gap-4"><Link to={'/signals/' + value.slug} className="text-sm font-medium leading-6 text-accent-dark">{value.title}</Link><button type="button" onClick={() => { onChange(null); setExpanded(false) }} className="shrink-0 py-1 text-xs text-ink-500">연결 해제</button></div> : <>
        <p className="mt-2 text-[13px] leading-6 text-ink-500">써본 도구의 소식이 있다면 연결해 주세요. 소식을 읽는 사람도 이 글을 찾을 수 있어요.</p>
        {!expanded ? <button type="button" onClick={() => setExpanded(true)} className="mt-3 text-[13px] font-semibold text-accent-dark">소식 찾아 연결하기</button> : <div className="mt-3">
          <label htmlFor="related-signal-search" className="sr-only">관련 소식 검색</label>
          <input id="related-signal-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="도구 이름이나 소식 제목 검색" className="w-full rounded-lg border border-ink-200 bg-paper-100 px-3 py-2.5 text-sm outline-none focus:border-accent" />
          {results.isFetching && <p role="status" className="py-3 text-xs text-ink-500">소식을 찾고 있어요.</p>}
          {results.isError && <p role="alert" className="py-3 text-xs text-ink-500">소식을 불러오지 못했어요. <button type="button" onClick={() => results.refetch()} className="text-accent-dark">다시 시도</button></p>}
          {!results.isFetching && !results.isError && results.data?.data?.items?.length === 0 && <p className="py-3 text-xs text-ink-500">검색 결과가 없어요. 소식 연결 없이도 작성할 수 있습니다.</p>}
          {!results.isError && <ul className="mt-2 divide-y divide-ink-100">{results.data?.data?.items?.map((item) => <li key={item.id}><button type="button" onClick={() => { onChange({ id: item.id, slug: item.slug, title: item.title }); setExpanded(false) }} className="w-full rounded px-2 py-3 text-left text-sm leading-6 text-ink-700 hover:bg-paper-200 hover:text-accent-dark">{item.title}</button></li>)}</ul>}
        </div>}
      </>}
    </section>
  )
}
