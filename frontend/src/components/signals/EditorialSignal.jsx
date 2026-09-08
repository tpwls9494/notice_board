import { useState } from 'react'
import { Link } from 'react-router-dom'
import { signalPublicationDate } from '../../utils/signalDates'

const KIND_LABEL = {
  release: '오늘의 AI',
  workflow: 'AI 활용법',
  research: '논문',
}

const formatCount = (value) => new Intl.NumberFormat('ko-KR', { notation: value >= 10000 ? 'compact' : 'standard' }).format(value || 0)

function SignalMeta({ signal }) {
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-ink-500"><span className="font-medium text-ink-600">{signal.source_name}</span><span title="사이트 게시 시각">{formatRelativeTime(signalPublicationDate(signal))}</span>{signal.external_reactions > 0 && <span>외부 반응 {formatCount(signal.external_reactions)}</span>}<span>추천 {formatCount(signal.recommendation_count)}</span><span>댓글 {signal.comment_count || 0}</span></div>
}

export const formatRelativeTime = (value) => {
  if (!value) return ''
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.max(1, Math.floor(diff / 60000))
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

export function SourceArtwork({ signal, className = '' }) {
  const [failed, setFailed] = useState(false)
  if (signal.image_url && !failed) {
    return <img src={signal.image_url} alt="" onError={() => setFailed(true)} className={`h-full w-full object-cover ${className}`} />
  }
  return (
    <div className={`flex h-full w-full items-center justify-center overflow-hidden bg-accent-glow text-accent-dark ${className}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" fill="none" className="h-3/4 w-3/4 max-w-48"><rect x="16" y="16" width="68" height="68" rx="18" stroke="currentColor" strokeWidth="1" opacity=".18"/><rect x="29" y="29" width="42" height="42" rx="10" fill="currentColor" opacity=".08"/><path d="M42 39 31 50l11 11m16-22 11 11-11 11m-5-28-6 34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </div>
  )
}

export function LeadSignal({ signal, featured = true }) {
  if (!signal) return null
  return (
    <article className="border-b border-ink-100 bg-accent-glow/20 p-5 sm:p-6">
      <div className="flex items-center gap-2 text-xs font-medium"><span className="rounded-md bg-accent-glow px-2 py-1 text-accent-dark">{featured ? '주목할 소식' : '새로운 소식'}</span><span className="text-ink-500">{KIND_LABEL[signal.content_kind]}</span></div>
      <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,1fr)_136px]">
        <div className="min-w-0"><Link to={`/signals/${signal.slug}`} className="block break-keep text-xl font-bold leading-snug tracking-[-0.025em] text-ink-950 hover:text-accent-dark sm:text-2xl">{signal.title}</Link><p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-600">{signal.summary}</p></div>
        <Link to={`/signals/${signal.slug}`} aria-label={`${signal.title} 자세히 보기`} className="hidden h-[136px] overflow-hidden rounded-lg border border-accent/10 sm:block"><SourceArtwork signal={signal} /></Link>
      </div>
      <div className="mt-5"><SignalMeta signal={signal} /></div>
    </article>
  )
}

export function RankedSignal({ signal, rank }) {
  return (
    <article className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 border-t border-ink-100 py-5 first:border-t-0">
      <span className="pt-0.5 text-sm font-semibold tabular-nums text-ink-400">{String(rank).padStart(2, '0')}</span>
      <div className="min-w-0">
        <Link to={`/signals/${signal.slug}`} className="text-base font-semibold leading-6 tracking-[-0.015em] text-ink-900 hover:text-accent-dark">{signal.title}</Link>
        <p className="mt-1.5 line-clamp-1 text-[13px] leading-6 text-ink-500">{signal.summary}</p>
        <div className="mt-2"><SignalMeta signal={signal} /></div>
      </div>
    </article>
  )
}

export function SignalListRow({ signal }) {
  return (
    <article className="grid gap-2.5 border-b border-ink-300 py-5 sm:grid-cols-[8rem_1fr_auto] sm:items-start sm:gap-4 sm:py-6">
      <div className="font-body text-xs font-medium leading-5 text-accent-dark sm:text-[13px]">{KIND_LABEL[signal.content_kind]}</div>
      <div>
        <Link to={`/signals/${signal.slug}`} className="font-editorial text-xl font-semibold leading-snug tracking-[-0.025em] text-ink-950 hover:text-accent-dark sm:text-2xl">{signal.title}</Link>
        <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-ink-600">{signal.summary}</p>
      </div>
      <div className="flex gap-3 text-xs text-ink-500 sm:block sm:min-w-24 sm:text-right"><p>{signal.source_name}</p><p className="sm:mt-2">댓글 {signal.comment_count || 0}</p></div>
    </article>
  )
}
