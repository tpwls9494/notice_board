import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import { qaAPI } from '../services/api'
import useAuthStore from '../stores/authStore'

function QADetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, token, fetchUser } = useAuthStore()
  const [answer, setAnswer] = useState('')

  const { data: questionData, isLoading } = useQuery({
    queryKey: ['qaQuestion', id],
    queryFn: () => qaAPI.getQuestion(id),
  })

  const deleteQuestionMutation = useMutation({
    mutationFn: () => qaAPI.deleteQuestion(id),
    onSuccess: () => {
      fetchUser()
      alert('질문이 삭제되었습니다. 포인트가 환불되었습니다.')
      navigate('/qa')
    },
    onError: (error) => {
      alert(error.response?.data?.detail || '삭제에 실패했습니다.')
    },
  })

  const createAnswerMutation = useMutation({
    mutationFn: (content) => qaAPI.createAnswer({ question_id: parseInt(id), content }),
    onSuccess: () => {
      queryClient.invalidateQueries(['qaQuestion', id])
      setAnswer('')
    },
    onError: (error) => {
      alert(error.response?.data?.detail || '답변 작성에 실패했습니다.')
    },
  })

  const deleteAnswerMutation = useMutation({
    mutationFn: (answerId) => qaAPI.deleteAnswer(answerId),
    onSuccess: () => {
      queryClient.invalidateQueries(['qaQuestion', id])
    },
    onError: (error) => {
      alert(error.response?.data?.detail || '답변 삭제에 실패했습니다.')
    },
  })

  const acceptAnswerMutation = useMutation({
    mutationFn: (answerId) => qaAPI.acceptAnswer(id, answerId),
    onSuccess: () => {
      fetchUser()
      queryClient.invalidateQueries(['qaQuestion', id])
      queryClient.invalidateQueries(['qaQuestions'])
      alert('답변이 채택되었습니다!')
    },
    onError: (error) => {
      alert(error.response?.data?.detail || '채택에 실패했습니다.')
    },
  })

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-2 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
        <p className="text-sm text-ink-400">로딩 중&#x2026;</p>
      </div>
    )
  }

  const question = questionData?.data
  const answers = question?.answers || []
  const isAuthor = user?.id === question?.user_id
  const isAdmin = user?.is_admin

  const handleDelete = () => {
    if (window.confirm('질문을 삭제하시겠습니까? 포인트가 환불됩니다.')) {
      deleteQuestionMutation.mutate()
    }
  }

  const handleAnswerSubmit = (e) => {
    e.preventDefault()
    if (!answer.trim()) return
    createAnswerMutation.mutate(answer)
  }

  const handleAcceptAnswer = (answerId) => {
    if (window.confirm('이 답변을 채택하시겠습니까? 채택 후 취소할 수 없습니다.')) {
      acceptAnswerMutation.mutate(answerId)
    }
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-up">
      {/* Back Navigation */}
      <Link
        to="/qa"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 mb-6 group"
        style={{ transition: 'color 0.2s ease-out' }}
      >
        <svg className="w-4 h-4 group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ transition: 'transform 0.2s ease-out' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        목록으로
      </Link>

      <article className="card overflow-hidden">
        {/* Question Header */}
        <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-5 border-b border-ink-100">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                {question?.is_solved ? (
                  <span className="badge-success">해결됨</span>
                ) : (
                  <span className="badge-points">{question?.bounty}P</span>
                )}
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-950 tracking-tight leading-snug text-balance">
                {question?.title}
              </h1>
            </div>
            {(isAuthor || isAdmin) && !question?.is_solved && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={handleDelete}
                  className="btn-ghost text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  삭제
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-ink-200 flex items-center justify-center">
              <span className="text-xs font-bold text-ink-600">
                {(question?.author_username || '?')[0].toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-800">{question?.author_username}</p>
              <span className="text-xs text-ink-400">
                {question?.created_at && new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(question.created_at))}
              </span>
            </div>
          </div>
        </div>

        {/* Question Content */}
        <div className="px-6 sm:px-8 py-8">
          <div className="prose prose-ink max-w-none whitespace-pre-wrap text-ink-800 leading-relaxed">
            {question?.content}
          </div>
        </div>

        {/* Answers Section */}
        <div className="px-6 sm:px-8 py-6 border-t border-ink-100">
          <h2 className="text-sm font-semibold text-ink-700 mb-5 flex items-center gap-2">
            <svg className="w-4 h-4 text-ink-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            답변 {answers.length}개
          </h2>

          {/* Answer Form */}
          {token && !question?.is_solved && user?.id !== question?.user_id && (
            <form onSubmit={handleAnswerSubmit} className="mb-6">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="답변을 입력하세요&#x2026;"
                className="input-field resize-none"
                rows="4"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={createAnswerMutation.isLoading || !answer.trim()}
                  className="btn-primary text-sm"
                >
                  {createAnswerMutation.isLoading ? '작성 중\u2026' : '답변 작성'}
                </button>
              </div>
            </form>
          )}

          {/* Answers List */}
          <div className="space-y-3">
            {answers.length === 0 && (
              <p className="text-center py-8 text-sm text-ink-400">아직 답변이 없습니다</p>
            )}
            {answers.map((a) => (
              <div
                key={a.id}
                className={`group px-4 py-3.5 rounded-xl ${
                  a.is_accepted
                    ? 'bg-emerald-50 border-2 border-emerald-200'
                    : 'bg-paper-50 hover:bg-paper-100'
                }`}
                style={{ transition: 'background-color 0.2s ease-out' }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-ink-200 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-ink-600">
                        {(a.author_username || '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-ink-800">{a.author_username}</span>
                    <span className="text-xs text-ink-400">
                      {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(a.created_at))}
                    </span>
                    {a.is_accepted && (
                      <span className="badge-success text-[11px] flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        채택됨
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isAuthor && !question?.is_solved && !a.is_accepted && (
                      <button
                        onClick={() => handleAcceptAnswer(a.id)}
                        disabled={acceptAnswerMutation.isLoading}
                        className="btn-primary text-xs px-3 py-1"
                      >
                        채택
                      </button>
                    )}
                    {(user?.id === a.user_id || isAdmin) && !a.is_accepted && (
                      <button
                        onClick={() => {
                          if (window.confirm('답변을 삭제하시겠습니까?')) {
                            deleteAnswerMutation.mutate(a.id)
                          }
                        }}
                        className="text-xs text-ink-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                        style={{ transition: 'opacity 0.2s ease-out, color 0.2s ease-out' }}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-ink-700 whitespace-pre-wrap pl-8 leading-relaxed">{a.content}</p>
              </div>
            ))}
          </div>
        </div>
      </article>
    </div>
  )
}

export default QADetail
