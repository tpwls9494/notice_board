// Site publication and the original source's publication are different events.
export function signalPublicationDate(signal) {
  return signal.published_at || signal.created_at || null
}

export function formatSourceDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}
