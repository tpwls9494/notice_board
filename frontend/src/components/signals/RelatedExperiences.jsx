import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { socialAPI } from '../../services/api'
import SocialPostRow from '../social/SocialPostRow'

export default function RelatedExperiences({ signal }) {
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['signal-experiences', signal.id, page],
    queryFn: () => socialAPI.getPosts({ signal_id: signal.id, space: 'community', topic: 'experience', page_size: 4, page }),
  })
  const data = query.data?.data
  return (
    <section id="experiences" className="scroll-mt-36 border-t border-ink-200 pt-6 md:scroll-mt-24" aria-labelledby="experiences-heading">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="experiences-heading" className="text-lg font-semibold">써본 후기{data && <span className="ml-2 text-sm font-normal text-ink-500">{data.total}</span>}</h2><Link to={'/community/write?topic=experience&signal=' + encodeURIComponent(signal.slug)} className="text-[13px] font-medium text-accent-dark">후기 쓰기 ↗</Link></div>
      {query.isPending && <p role="status" className="py-6 text-sm text-ink-500">후기를 불러오는 중입니다.</p>}
      {query.isError && <p role="alert" className="py-6 text-sm text-ink-500">후기를 불러오지 못했어요. <button type="button" onClick={() => query.refetch()} className="text-accent-dark">다시 시도</button></p>}
      {!query.isPending && !query.isError && !data?.items?.length && <p className="py-5 text-sm text-ink-500">아직 작성된 후기가 없습니다.</p>}
      {!query.isError && <div className="mt-4">{data?.items?.map((post) => <SocialPostRow key={post.id} post={post} />)}</div>}
      {data?.total > 4 && <div className="mt-3 flex items-center justify-between text-xs text-ink-500"><span>후기 {data.total}개 · {page} / {Math.ceil(data.total / 4)}</span><div className="flex gap-4"><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="disabled:opacity-30">이전</button><button type="button" disabled={page * 4 >= data.total} onClick={() => setPage((value) => value + 1)} className="disabled:opacity-30">다음</button></div></div>}
    </section>
  )
}
