import { useEffect, useRef, useState } from 'react'
import { blogAPI } from '../services/api'

const defaultAvatar = '/avatar-default.svg'
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

function AvatarImage({ src, large = false }) {
  const [failed, setFailed] = useState(false)
  return <img className={large ? 'blog-avatar-preview' : 'blog-avatar-image'} src={failed ? defaultAvatar : src} alt="jion 프로필 이미지" onError={() => setFailed(true)} />
}

export default function BlogProfileAvatar({ canEdit }) {
  const [profile, setProfile] = useState({ image_url: null })
  const [open, setOpen] = useState(false)
  const [selection, setSelection] = useState(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const dialog = useRef(null)
  const input = useRef(null)

  useEffect(() => {
    let active = true
    blogAPI.getProfile().then(({ data }) => { if (active) setProfile(data) }).catch(() => {})
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (open && canEdit) dialog.current?.showModal()
    else dialog.current?.close()
  }, [open, canEdit])
  useEffect(() => () => { if (selection) URL.revokeObjectURL(selection.url) }, [selection])

  function close() {
    if (pending) return
    setOpen(false)
    setSelection(null)
    setError('')
  }
  function choose(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setSelection(null)
    if (!allowedTypes.has(file.type)) { setError('JPG, PNG, GIF, WebP 이미지를 선택해 주세요.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('5MB 이하의 이미지를 선택해 주세요.'); return }
    setSelection({ file, url: URL.createObjectURL(file) })
  }
  async function save(reset = false) {
    if (pending || (!reset && !selection)) return
    setPending(true)
    setError('')
    try {
      const { data } = reset ? await blogAPI.resetAvatar() : await blogAPI.updateAvatar(selection.file)
      setProfile(data)
      setSelection(null)
      setOpen(false)
    } catch (err) {
      const message = err.response?.data?.detail
      setError(typeof message === 'string' ? message : '이미지를 저장하지 못했습니다. 다시 시도해 주세요.')
    } finally { setPending(false) }
  }
  const imageUrl = profile.image_url || defaultAvatar
  const previewUrl = selection?.url || imageUrl
  return <div className="blog-avatar">
    {canEdit ? <button type="button" className="blog-avatar-edit" aria-label="프로필 이미지 변경" title="프로필 이미지 변경" onClick={() => setOpen(true)}><AvatarImage key={imageUrl} src={imageUrl} /><span aria-hidden="true"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 7h4l2-3h4l2 3h4v13H4z"/><circle cx="12" cy="13" r="3"/></svg></span></button> : <AvatarImage key={imageUrl} src={imageUrl} />}
    <dialog ref={dialog} className="blog-avatar-dialog" aria-labelledby="avatar-dialog-title" onCancel={event => { event.preventDefault(); close() }}>
      <h2 id="avatar-dialog-title">프로필 이미지</h2>
      <p>블로그 소개에 표시할 이미지를 선택해 주세요.<br />나중에 언제든 다시 바꿀 수 있어요.</p>
      <AvatarImage key={previewUrl} src={previewUrl} large />
      <button type="button" className="avatar-choose" disabled={pending} onClick={() => input.current?.click()}>이미지 선택</button>
      <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/gif,image/webp" onChange={choose} />
      <p className="avatar-file-hint">정사각형 이미지를 권장해요 · 최대 5MB</p>
      {error && <p className="avatar-error" role="alert">{error}</p>}
      <button type="button" className="avatar-reset" disabled={pending || (!profile.image_url && !selection)} onClick={() => save(true)}>기본 이미지로 되돌리기</button>
      <div className="avatar-dialog-actions"><button type="button" disabled={pending} onClick={close}>취소</button><button type="button" className="avatar-apply" disabled={pending || !selection} onClick={() => save(false)}>{pending ? '저장 중…' : '적용하기'}</button></div>
    </dialog>
  </div>
}
