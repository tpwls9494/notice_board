import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { deadlinePostsAPI } from '../services/api'
import { useCountdown } from '../hooks/useCountdown'
import useAuthStore from '../stores/authStore'

function CountdownTimer({ deadlineAt }) {
  const { hours, minutes, seconds, isUrgent, isExpired } = useCountdown(deadlineAt)

  if (isExpired) {
    return <span className="badge-expired">만료</span>
  }

  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  if (isUrgent) {
    return (
      <span className="countdown-urgent">
        {timeStr}
      </span>
    )
  }

  return <span className="countdown-display text-ink-600">{timeStr}</span>
}

function DeadlinePostRow({ post, index }) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const completeMutation = useMutation({
    mutationFn: () => deadlinePostsAPI.completePost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries(['deadlinePosts'])
    },
    onError: (error) => {
      alert(error.response?.data?.detail || '완료 처리에 실패했습니다.')
    },
  })

  const handleComplete = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (window.confirm('이 게시글을 완료 처리하시겠습니까?')) {
      completeMutation.mutate()
    }
  }

  const isAuthor = user?.id === post.user_id
  const isCompleted = post.is_completed
  const isExpired = post.is_expired

  return (
    <Link
      to={`/deadline/${post.id}`}
      className={`card-hover block opacity-0 animate-fade-up stagger-${Math.min(index + 1, 8)} ${
        isCompleted || isExpired ? 'opacity-60' : ''
      }`}
    >
      <div className="px-5 py-4 flex items-center gap-4">
        {/* Status indicator */}
        <div className={`hidden sm:flex w-10 h-10 rounded-lg items-center justify-center flex-shrink-0 ${
          isCompleted ? 'bg-emerald-100' : isExpired ? 'bg-ink-100' : post.is_urgent ? 'bg-red-100' : 'bg-paper-200'
        }`}>
          {isCompleted ? (
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-ink-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        {/* Post Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className={`text-[15px] font-semibold truncate ${
              isCompleted || isExpired ? 'text-ink-400 line-through' : 'text-ink-900'
            }`}>
              {post.title}
            </h2>
            {isCompleted && <span className="badge-success text-[11px]">완료</span>}
            {!isCompleted && post.is_urgent && <span className="badge-urgent text-[11px]">긴급</span>}
            {post.comment_count > 0 && (
              <span className="text-xs text-ink-500 font-semibold flex-shrink-0">
                [{post.comment_count}]
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-400">
            <span className="font-medium text-ink-600">{post.author_username}</span>
            <span>{new Intl.DateTimeFormat('ko-KR').format(new Date(post.created_at))}</span>
          </div>
        </div>

        {/* Timer / Complete */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {isCompleted ? (
            <span className="badge-success text-[11px]">완료</span>
          ) : (
            <CountdownTimer deadlineAt={post.deadline_at} />
          )}

          {isAuthor && !isCompleted && !isExpired && (
            <button
              onClick={handleComplete}
              disabled={completeMutation.isLoading}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              완료
            </button>
          )}
        </div>

        {/* Arrow */}
        <svg className="w-4 h-4 text-ink-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
  )
}

function DeadlineList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['deadlinePosts'],
    queryFn: () => deadlinePostsAPI.getPosts(),
    refetchInterval: 30000,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-2 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
        <p className="text-sm text-ink-400">불러오는 중&#x2026;</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-24">
        <div className="inline-flex items-center gap-2 px-4 py-3 bg-red-50 text-red-700 rounded-xl text-sm" role="alert">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          게시글을 불러오는데 실패했습니다.
        </div>
      </div>
    )
  }

  const posts = data?.data?.posts || []
  const total = data?.data?.total || 0

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold text-ink-950 tracking-tight text-balance">
              마감기한
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              전체 <span className="font-semibold text-ink-700">{total}</span>개의 게시글
              <span className="ml-2 text-ink-400">&#183; 시간 순 정렬</span>
            </p>
          </div>
        </div>
      </div>

      {/* Posts List */}
      <div className="space-y-2">
        {posts.length === 0 ? (
          <div className="card px-6 py-16 text-center">
            <div className="text-ink-300 mb-3">
              <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-ink-500 font-medium">마감기한 게시글이 없습니다</p>
            <p className="text-ink-400 text-sm mt-1">새로운 마감기한 게시글을 작성해보세요</p>
          </div>
        ) : (
          posts.map((post, index) => (
            <DeadlinePostRow key={post.id} post={post} index={index} />
          ))
        )}
      </div>
    </div>
  )
}

export default DeadlineList
