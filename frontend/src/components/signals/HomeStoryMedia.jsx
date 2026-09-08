import { useState } from 'react'

export default function HomeStoryMedia({ src, featured = false, children }) {
  const [failed, setFailed] = useState(false)
  const hasImage = Boolean(src?.trim()) && !failed
  const columns = !hasImage ? '' : featured ? 'sm:grid-cols-[minmax(0,1fr)_160px]' : 'grid-cols-[minmax(0,1fr)_80px] sm:grid-cols-[minmax(0,1fr)_112px]'
  return <div className={'home-story-media grid items-start gap-4 ' + columns}>
    <div className="min-w-0">{children}</div>
    {hasImage && <img src={src} alt="" loading={featured ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={'home-story-image w-full rounded-lg border border-ink-200 bg-paper-100 object-contain ' + (featured ? 'max-h-48 sm:aspect-[4/3]' : 'aspect-[4/3]')} />}
  </div>
}
