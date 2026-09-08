import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { socialAPI } from '../services/api'

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function useKoreaDate() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer
    const refresh = () => {
      window.clearTimeout(timer)
      const current = new Date()
      setNow(current)
      // Align updates to the minute so the date changes at midnight as well.
      timer = window.setTimeout(refresh, 60000 - (current.getTime() % 60000))
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    refresh()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  const parts = Object.fromEntries(dateFormatter.formatToParts(now).map(({ type, value }) => [type, value]))
  const isoDate = `${parts.year}-${parts.month}-${parts.day}`
  return { parts, isoDate }
}

export default function DigitalCalendar() {
  const { parts, isoDate } = useKoreaDate()
  return (
    <time dateTime={isoDate} aria-label={`한국 시간 ${parts.year}년 ${parts.month}월 ${parts.day}일`} title="한국 시간 기준" className="inline-flex shrink-0 font-body text-xs leading-5 text-ink-500">
      <span className="tabular-nums">{parts.year}.{parts.month}.{parts.day}</span>
    </time>
  )
}

export function SiteActivitySummary() {
  const { isoDate } = useKoreaDate()
  const activity = useQuery({
    queryKey: ['site-activity', isoDate],
    queryFn: () => socialAPI.getSiteActivity(),
    staleTime: 60000,
    refetchInterval: 60000,
    retry: 1,
  })
  const stats = !activity.isError && activity.data?.data?.date === isoDate ? activity.data.data : null
  const formatCount = (value) => value == null ? (activity.isLoading ? '…' : '—') : new Intl.NumberFormat('ko-KR').format(value)

  return (
    <div className="mt-2 font-body">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <DigitalCalendar />
      <dl aria-label="사이트 활동" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs leading-5 text-ink-500">
        <div title="한국 시간 오늘 0시부터 현재까지 본사이트에 공개된 소식" className="flex items-center gap-1.5"><dt>오늘 소식</dt><dd className="font-medium tabular-nums text-ink-700">{formatCount(stats?.today_signals)}<span className="ml-0.5 font-normal text-ink-500">개</span></dd></div>
        <div title="한국 시간 이번 주 월요일부터 현재까지 공개된 커뮤니티 사용 후기" className="flex items-center gap-1.5"><dt>이번 주 후기</dt><dd className="font-medium tabular-nums text-ink-700">{formatCount(stats?.week_experiences)}<span className="ml-0.5 font-normal text-ink-500">개</span></dd></div>
      </dl>
      </div>
      {activity.isError && <p role="status" className="mt-1.5 text-xs text-ink-500">집계를 불러오지 못했어요. <button type="button" onClick={() => activity.refetch()} className="font-medium text-accent-dark">다시 시도</button></p>}
    </div>
  )
}
