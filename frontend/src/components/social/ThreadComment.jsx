import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { formatRelativeTime } from '../signals/EditorialSignal'

const fieldClass = 'w-full min-w-0 resize-y rounded-lg border border-ink-200 bg-paper-50 p-3 text-sm leading-7 outline-none focus:border-accent'

export default function ThreadComment({ item, replies = [], user, loginPath, refresh, onReply, onEdit, onDelete, onModerate, onRecommend }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState(null)
  const [text, setText] = useState('')
  const unavailable = item.is_deleted || item.is_hidden
  const canEdit = user?.id === item.user_id && !unavailable
  const action = useMutation({
    mutationFn: ({ type }) => {
      if (type === 'reply') return onReply(item.id, text.trim())
      if (type === 'edit') return onEdit(item.id, text.trim())
      if (type === 'delete') return onDelete(item.id)
      if (type === 'hide') return onModerate(item.id)
      return onRecommend(item)
    },
    onSuccess: () => { setText(''); setMode(null); refresh() },
    onError: (error) => toast.error(error.response?.data?.detail || '요청을 처리하지 못했습니다.'),
  })
  const submit = (event) => {
    event.preventDefault()
    if (text.trim() && !action.isPending) action.mutate({ type: mode })
  }

  return (
    <div className="min-w-0 border-t border-ink-100 py-5" data-comment-id={item.id} data-parent-id={item.parent_id || ''}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="break-all font-medium text-ink-800">{item.author_username}</span>
          <span className="text-ink-500">{formatRelativeTime(item.created_at)}</span>
          {!unavailable && item.updated_at && Date.parse(item.updated_at) > Date.parse(item.created_at) && <span className="text-ink-400">수정됨</span>}
        </div>
        {(canEdit || (user?.is_admin && onModerate && !unavailable)) && <div className="flex gap-3 text-xs text-ink-500">
          {canEdit && <>
            <button type="button" disabled={action.isPending} onClick={() => { setMode('edit'); setText(item.content) }}>수정</button>
            <button type="button" disabled={action.isPending} onClick={() => window.confirm('댓글을 삭제할까요?') && action.mutate({ type: 'delete' })}>삭제</button>
          </>}
          {user?.is_admin && onModerate && !unavailable && <button type="button" disabled={action.isPending} onClick={() => window.confirm('댓글을 숨길까요?') && action.mutate({ type: 'hide' })}>숨김</button>}
        </div>}
      </div>
      {mode === 'edit' ? <form onSubmit={submit} className="mt-3">
        <label className="sr-only" htmlFor={'edit-comment-' + item.id}>댓글 수정</label>
        <textarea autoFocus id={'edit-comment-' + item.id} value={text} maxLength={5000} disabled={action.isPending} onChange={(event) => setText(event.target.value)} rows={3} className={fieldClass} />
        <div className="mt-2 flex justify-end gap-4 text-xs"><button type="button" disabled={action.isPending} onClick={() => setMode(null)} className="text-ink-500">취소</button><button disabled={!text.trim() || action.isPending} className="font-medium text-accent-dark disabled:opacity-40">저장</button></div>
      </form> : <p className={'mt-2 whitespace-pre-wrap break-words text-sm leading-7 ' + (unavailable ? 'text-ink-400' : 'text-ink-700')}>{item.content}</p>}
      {!unavailable && <div className="mt-3 flex gap-4 text-xs text-ink-500">
        {onRecommend && <button type="button" aria-pressed={Boolean(item.is_recommended)} disabled={action.isPending} onClick={() => user ? action.mutate({ type: 'recommend' }) : navigate(loginPath)} className={item.is_recommended ? 'text-accent-dark' : ''}>추천 {item.recommendation_count || 0}</button>}
        {!item.parent_id && <button type="button" disabled={action.isPending} aria-expanded={mode === 'reply'} onClick={() => { if (!user) { navigate(loginPath); return } setMode(mode === 'reply' ? null : 'reply'); setText('') }}>답글</button>}
      </div>}
      {mode === 'reply' && <form onSubmit={submit} className="mt-4 border-l border-ink-200 pl-4">
        <label className="sr-only" htmlFor={'reply-comment-' + item.id}>답글 내용</label>
        <textarea autoFocus id={'reply-comment-' + item.id} value={text} maxLength={5000} disabled={action.isPending} onChange={(event) => setText(event.target.value)} placeholder="답글을 입력하세요." rows={3} className={fieldClass} />
        <div className="mt-2 flex justify-end gap-4 text-xs"><button type="button" disabled={action.isPending} onClick={() => setMode(null)} className="text-ink-500">취소</button><button disabled={!text.trim() || action.isPending} className="font-medium text-accent-dark disabled:opacity-40">등록</button></div>
      </form>}
      {replies.length > 0 && <div className="mt-4 border-l border-ink-200 pl-4 sm:ml-3 sm:pl-5">{replies.map((reply) => <ThreadComment key={reply.id} item={reply} user={user} loginPath={loginPath} refresh={refresh} onReply={onReply} onEdit={onEdit} onDelete={onDelete} onModerate={onModerate} onRecommend={onRecommend} />)}</div>}
    </div>
  )
}
