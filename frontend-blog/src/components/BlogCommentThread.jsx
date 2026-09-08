import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { blogAPI } from '../services/api'

export default function BlogCommentThread({ comment, replies = [], postId, user, loginPath, pending, act }) {
  const [mode, setMode] = useState(null)
  const [text, setText] = useState('')
  const own = user?.id === comment.author.id
  const canEdit = own && !comment.is_deleted
  const canDelete = user && (own || user.is_admin) && !comment.is_deleted
  useEffect(() => { setMode(null); setText('') }, [user?.id, comment.is_deleted])

  async function save(event) {
    event.preventDefault()
    if (pending || !text.trim()) return
    const success = await act(() => mode === 'reply'
      ? blogAPI.addComment(postId, text.trim(), comment.id)
      : blogAPI.updateComment(postId, comment.id, text.trim()))
    if (success) { setMode(null); setText('') }
  }

  return <article className="journal-comment" data-comment-id={comment.id} data-parent-id={comment.parent_id || ''}>
    <div className="journal-comment-header">
      <strong>{comment.author.username}</strong>
      <time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
      {!comment.is_deleted && comment.updated_at && <span className="journal-comment-edited">수정됨</span>}
      {(canEdit || canDelete) && <div className="journal-comment-actions">
        {canEdit && <button type="button" disabled={pending} onClick={() => { setText(comment.content); setMode('edit') }}>수정</button>}
        {canDelete && <button type="button" disabled={pending} onClick={() => { if (window.confirm('댓글을 삭제할까요?')) act(() => blogAPI.deleteComment(postId, comment.id)) }}>삭제</button>}
      </div>}
    </div>
    {mode !== 'edit' && <p className={comment.is_deleted ? 'journal-comment-deleted' : undefined}>{comment.content}</p>}
    {!comment.is_deleted && !comment.parent_id && (user
      ? <button type="button" className="journal-comment-reply-toggle" disabled={pending} aria-expanded={mode === 'reply'} onClick={() => { setText(''); setMode(mode === 'reply' ? null : 'reply') }}>답글</button>
      : <Link className="journal-comment-reply-toggle" to={loginPath}>답글</Link>)}
    {mode && <form className="journal-comment-form journal-inline-comment-form" onSubmit={save}>
      <label htmlFor={'blog-'+mode+'-'+comment.id}>{mode === 'reply' ? '답글 내용' : '댓글 수정'}</label>
      <textarea autoFocus id={'blog-'+mode+'-'+comment.id} value={text} onChange={(event) => setText(event.target.value)} disabled={pending} required maxLength={2000} rows={3} placeholder={mode === 'reply' ? '답글을 입력하세요.' : undefined} />
      <div className="journal-inline-comment-actions">
        <button className="journal-comment-cancel" type="button" disabled={pending} onClick={() => setMode(null)}>취소</button>
        <button type="submit" disabled={pending || !text.trim()}>{pending ? '저장 중…' : mode === 'reply' ? '답글 등록' : '수정 완료'}</button>
      </div>
    </form>}
    {replies.length > 0 && <div className="journal-comment-replies">{replies.map(reply => <BlogCommentThread key={reply.id} comment={reply} postId={postId} user={user} loginPath={loginPath} pending={pending} act={act} />)}</div>}
  </article>
}
