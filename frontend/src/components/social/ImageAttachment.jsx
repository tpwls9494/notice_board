import { useEffect, useRef, useState } from 'react'

export default function ImageAttachment({ file, imageUrl, onSelect, onRemove, disabled }) {
  const input = useRef(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
    if (!file) { setPreviewUrl(''); return }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file, imageUrl])
  const url = file ? previewUrl : imageUrl
  const hasImage = Boolean(file || imageUrl)
  return (
    <section aria-labelledby="image-attachment-label">
      <h2 id="image-attachment-label" className="text-xs font-medium text-ink-600">이미지 <span className="font-normal text-ink-500">선택</span></h2>
      <input ref={input} id="community-image-file" type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled} className="sr-only" aria-label="첨부 이미지 선택" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) onSelect(selected); event.target.value = '' }} />
      {hasImage && <div className="mt-3 rounded-lg border border-ink-200 bg-paper-50 p-3">{failed ? <p role="alert" className="py-5 text-center text-sm text-ink-500">이미지를 미리 볼 수 없습니다. 다른 이미지를 선택해 주세요.</p> : url && <img src={url} alt="첨부 이미지 미리보기" onError={() => setFailed(true)} className="mx-auto max-h-64 max-w-full rounded object-contain" />}{file && <p className="mt-2 truncate text-xs text-ink-500">{file.name}</p>}</div>}
      <div className="mt-3 flex items-center gap-4"><button type="button" disabled={disabled} onClick={() => input.current?.click()} className="rounded-lg border border-ink-200 bg-paper-50 px-3 py-2 text-[13px] font-medium text-ink-700 hover:border-accent/40 disabled:opacity-40">{hasImage ? '이미지 교체' : '이미지 선택'}</button>{hasImage && <button type="button" disabled={disabled} onClick={onRemove} className="text-[13px] text-ink-500 disabled:opacity-40">제거</button>}</div>
      <p className="mt-2 text-xs leading-6 text-ink-500">PNG·JPG·WebP 한 장, 5MB 이하. 본문에 이미지를 붙여넣어도 첨부됩니다.</p>
    </section>
  )
}
