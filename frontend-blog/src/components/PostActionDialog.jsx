import { useEffect, useRef, useState } from 'react'
import { blogAPI } from '../services/api'
import './PostActionDialog.css'

export default function PostActionDialog({ post, action = 'delete', onClose, onComplete }) {
  const dialog = useRef(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const deleting = action === 'delete'
  useEffect(() => { dialog.current?.showModal() }, [])

  async function confirm(event) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError('')
    try {
      if (deleting) {
        try { await blogAPI.delete(post.id) } catch (err) { if (err.response?.status !== 404) throw err }
        try { localStorage.removeItem(`jion-blog-editor:${post.slug}`) } catch { /* The server record was deleted. */ }
      } else {
        await blogAPI.update(post.id, { is_published: false })
      }
      onComplete(action, post)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : '처리하지 못했습니다. 다시 시도해 주세요.')
      setPending(false)
    }
  }
  return <dialog ref={dialog} className="post-action-dialog" aria-labelledby="post-action-title" onCancel={event => { event.preventDefault(); if (!pending) onClose() }}>
    <form onSubmit={confirm}>
      <h2 id="post-action-title">{deleting ? '이 기록을 삭제할까요?' : '이 기록을 비공개로 바꿀까요?'}</h2>
      <p className="post-action-target">{post.title}</p>
      <p className="post-action-explanation">{deleting ? '기록과 연결된 댓글·좋아요가 함께 삭제됩니다. 삭제한 기록은 복구할 수 없습니다.' : '공개 목록에서 내려가며, 작성자만 볼 수 있는 초안으로 보관됩니다. 나중에 다시 발행할 수 있습니다.'}</p>
      {error && <p className="post-action-error" role="alert">{error}</p>}
      <div className="post-action-buttons"><button type="button" disabled={pending} onClick={onClose}>취소</button><button type="submit" className={deleting ? 'post-action-delete' : 'post-action-confirm'} disabled={pending}>{pending ? '처리 중…' : deleting ? '삭제하기' : '비공개로 전환'}</button></div>
    </form>
  </dialog>
}
