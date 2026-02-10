import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import { deadlinePostsAPI } from '../services/api'
import { useCountdown } from '../hooks/useCountdown'
import useAuthStore from '../stores/authStore'

function DeadlineTimer({ deadlineAt, isCompleted }) {
  const { hours, minutes, seconds, isUrgent, isExpired } = useCountdown(deadlineAt)

  if (isCompleted) {
    return <span className="badge-success">완료됨</span>
  }
  if (isExpired) {
    return <span className="badge-expired">만료됨</span>
  }

  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
      isUrgent ? 'bg-red-50 border border-red-200' : 'bg-paper-200 border border-ink-200'
    }`}>
      <svg className={`w-5 h-5 ${isUrgent ? 'text-red-500' : 'text-ink-500'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className={isUrgent ? 'countdown-urgent text-base' : 'countdown-display text-base text-ink-700'}>
        {timeStr}
      </span>
      {isUrgent && <span className="badge-urgent text-[11px]">긴급</span>}
    </div>
  )
}

function DeadlineDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, token } = useAuthStore()
  const [comment, setComment] = useState('')

  const { data: postData, isLoading: postLoading } = useQuery({
    queryKey: ['deadlinePost', id],
    queryFn: () => deadlinePostsAPI.getPost(id),
  })

  const { data: commentsData, isLoading: commentsLoading } = useQuery({
    queryKey: ['deadlineComments', id],
    queryFn: () => deadlinePostsAPI.getComments(id),
  })

  const deletePostMutation = useMutation({
    mutationFn: () => deadlinePostsAPI.deletePost(id),
    onSuccess: () => {
      alert('게시글이 삭제되었습니다.')
      navigate('/deadline')
    },
  })

  const completeMutation = useMutation({
    mutationFn: () => deadlinePostsAPI.completePost(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['deadlinePost', id])
      queryClient.invalidateQueries(['deadlinePosts'])
    },
    onError: (error) => {
      alert(error.response?.data?.detail || '완료 처리에 실패했습니다.')
    },
  })

  const createCommentMutation = useMutation({
    mutationFn: (content) => deadlinePostsAPI.createComment(id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries(['deadlineComments', id])
      queryClient.invalidateQueries(['deadlinePost', id])
      setComment('')
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId) => deadlinePostsAPI.deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries(['deadlineComments', id])
      queryClient.invalidateQueries(['deadlinePost', id])
    },
  })

  if (postLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-2 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
        <p className="text-sm text-ink-400">로딩 중&#x2026;</p>
      </div>
    )
  }

  const post = postData?.data
  const isAuthor = user?.id === post?.user_id
  const isAdmin = user?.is_admin

  const handleDelete = () => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      deletePostMutation.mutate()
    }
  }

  const handleComplete = () => {
    if (window.confirm('이 게시글을 완료 처리하시겠습니까?')) {
      completeMutation.mutate()
    }
  }

  const handleCommentSubmit = (e) => {
    e.preventDefault()
    if (!comment.trim()) return
    createCommentMutation.mutate(comment)
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-up">
      {/* Back Navigation */}
      <Link
        to="/deadline"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 mb-6 group"
        style={{ transition: 'color 0.2s ease-out' }}
      >
        <svg className="w-4 h-4 group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ transition: 'transform 0.2s ease-out' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        목록으로
      </Link>

      <article className="card overflow-hidden">
        {/* Post Header */}
        <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-5 border-b border-ink-100">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-950 tracking-tight leading-snug text-balance">
                {post?.title}
              </h1>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {isAuthor && !post?.is_completed && !post?.is_expired && (
                <button
                  onClick={handleComplete}
                  disabled={completeMutation.isLoading}
                  className="btn-primary text-sm"
                >
                  완료
                </button>
              )}
              {(isAuthor || isAdmin) && (
                <>
                  <Link to={`/deadline/${id}/edit`} className="btn-ghost text-sm">
                    수정
                  </Link>
                  <button
                    onClick={handleDelete}
                    className="btn-ghost text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    삭제
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-ink-200 flex items-center justify-center">
                <span className="text-xs font-bold text-ink-600">
                  {(post?.author_username || '?')[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-800">{post?.author_username}</p>
                <span className="text-xs text-ink-400">
                  {post?.created_at && new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(post.created_at))}
                </span>
              </div>
            </div>

            {post?.deadline_at && (
              <DeadlineTimer deadlineAt={post.deadline_at} isCompleted={post.is_completed} />
            )}
          </div>
        </div>

        {/* Post Content */}
        <div className="px-6 sm:px-8 py-8">
          <div className="prose prose-ink max-w-none whitespace-pre-wrap text-ink-800 leading-relaxed">
            {post?.content}
          </div>
        </div>

        {/* Comments Section */}
        <div className="px-6 sm:px-8 py-6 border-t border-ink-100">
          <h2 className="text-sm font-semibold text-ink-700 mb-5 flex items-center gap-2">
            <svg className="w-4 h-4 text-ink-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            댓글 {commentsData?.data?.length || 0}개
          </h2>

          {/* Comment Form */}
          {token && (
            <form onSubmit={handleCommentSubmit} className="mb-6">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="댓글을 입력하세요&#x2026;"
                className="input-field resize-none"
                rows="3"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={createCommentMutation.isLoading || !comment.trim()}
                  className="btn-primary text-sm"
                >
                  {createCommentMutation.isLoading ? '작성 중\u2026' : '댓글 작성'}
                </button>
              </div>
            </form>
          )}

          {/* Comments List */}
          {commentsLoading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {commentsData?.data?.length === 0 && (
                <p className="text-center py-8 text-sm text-ink-400">아직 댓글이 없습니다</p>
              )}
              {commentsData?.data?.map((c) => (
                <div key={c.id} className="group px-4 py-3.5 bg-paper-50 rounded-xl hover:bg-paper-100" style={{ transition: 'background-color 0.2s ease-out' }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-ink-200 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-ink-600">
                          {(c.author_username || '?')[0].toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-ink-800">{c.author_username}</span>
                      <span className="text-xs text-ink-400">
                        {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(c.created_at))}
                      </span>
                    </div>
                    {(user?.id === c.user_id || isAdmin) && (
                      <button
                        onClick={() => {
                          if (window.confirm('댓글을 삭제하시겠습니까?')) {
                            deleteCommentMutation.mutate(c.id)
                          }
                        }}
                        className="text-xs text-ink-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                        style={{ transition: 'opacity 0.2s ease-out, color 0.2s ease-out' }}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-ink-700 whitespace-pre-wrap pl-8 leading-relaxed">{c.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </article>
    </div>
  )
}

export default DeadlineDetail
