import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { blogAPI } from '../services/api'
import useBlogActivity from '../hooks/useBlogActivity'
import ActivityCounts, { ActivityIcon } from './ActivityCounts'
import BlogCommentThread from './BlogCommentThread'

export default function BlogDiscussion({ postId, user, slug }) {
  const activity = useBlogActivity([postId])
  const stats = activity.data[postId]
  const [comments, setComments] = useState({ items: [], total: 0, thread_total: 0, page_size: 20 })
  const [page, setPage] = useState(1)
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [pending, setPending] = useState(false)
  const [revision, setRevision] = useState(0)
  const busyAction = useRef(false)

  useEffect(() => {
    let active = true
    let busy = false
    const controller = new AbortController()
    async function refresh() {
      if (document.hidden || busy) return
      busy = true
      try {
        const { data } = await blogAPI.getComments(postId, page, controller.signal)
        if (active) {
          const lastPage = Math.max(1, Math.ceil((data.thread_total ?? data.total) / data.page_size))
          if (page > lastPage) { setLoaded(false); setComments({ ...data, items: [] }); setPage(lastPage); return }
          setComments(data); setLoaded(true); setLoadError(false)
        }
      } catch { if (active) setLoadError(true) }
      finally { busy = false }
    }
    refresh()
    const timer = setInterval(refresh, 10000)
    document.addEventListener('visibilitychange', refresh)
    return () => { active = false; controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [postId, page, revision])

  async function act(action) {
    if (busyAction.current) return false
    busyAction.current = true
    setPending(true)
    setError('')
    try {
      await action()
      window.dispatchEvent(new Event('blog-activity-changed'))
      setRevision((n) => n + 1)
      return true
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : '반응을 저장하지 못했습니다. 다시 시도해 주세요.')
      return false
    } finally { busyAction.current = false; setPending(false) }
  }

  const roots = comments.items.filter(comment => !comment.parent_id)
  const replies = comments.items.reduce((groups, comment) => { if (comment.parent_id) (groups[comment.parent_id] ||= []).push(comment); return groups }, {})
  const pageCount = Math.max(1, Math.ceil((comments.thread_total ?? comments.total) / comments.page_size))
  const loginPath = `/login?next=${encodeURIComponent(`/${slug}#comments`)}`

  return <section id="comments" className="journal-discussion" aria-label="좋아요와 댓글">
    <div className="journal-discussion-heading"><h2>함께 나누는 생각</h2><ActivityCounts activity={stats} stale={activity.stale} /></div>
    {user ? <button className="journal-like-button" aria-pressed={stats?.liked ?? false} disabled={pending || !stats} onClick={() => act(() => stats.liked ? blogAPI.unlike(postId) : blogAPI.like(postId))}><ActivityIcon kind="like" />{stats?.liked ? '좋아요를 남겼어요' : '도움이 됐어요'} {stats?.like_count ?? ''}</button> : <p className="journal-login-prompt"><Link to={`/login?next=${encodeURIComponent(`/${slug}#comments`)}`}>로그인</Link>하고 좋아요와 댓글을 남겨보세요.</p>}
    {user && <form onSubmit={(event) => { event.preventDefault(); if (content.trim()) act(async () => { await blogAPI.addComment(postId, content.trim()); setContent(''); setPage(1) }) }} className="journal-comment-form">
      <label htmlFor="blog-comment">이 글을 읽고 어떤 생각이 들었나요?</label>
      <textarea id="blog-comment" value={content} onChange={(event) => setContent(event.target.value)} disabled={pending} required maxLength={2000} rows={3} placeholder="댓글을 남겨주세요." />
      <button disabled={pending || !content.trim()} type="submit">{pending ? '저장 중…' : '댓글 남기기'}</button>
    </form>}
    {error && <p role="alert" className="journal-discussion-error">{error}</p>}
    <div className="journal-comments-heading"><h3>댓글 {loaded ? comments.total : ''}</h3><span>댓글 최신순</span></div>
    {loadError && <p role="status" className="journal-discussion-error">댓글을 불러오지 못했습니다. <button onClick={() => setRevision((n) => n + 1)}>다시 시도</button></p>}
    {!loaded && !loadError && <p role="status">댓글을 불러오고 있습니다.</p>}
    {loaded && !comments.items.length && <p className="journal-no-comments">첫 번째 생각을 남겨주세요.</p>}
    {roots.map(comment => <BlogCommentThread key={comment.id} comment={comment} replies={replies[comment.id] || []} postId={postId} user={user} loginPath={loginPath} pending={pending} act={act} />)}
    {pageCount > 1 && <nav className="journal-pagination" aria-label="댓글 페이지"><button disabled={pending || page === 1} onClick={() => setPage(page - 1)}>← 이전</button><span>{page} / {pageCount}</span><button disabled={pending || page >= pageCount} onClick={() => setPage(page + 1)}>다음 →</button></nav>}
  </section>
}
