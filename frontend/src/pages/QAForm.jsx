import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { qaAPI } from '../services/api'
import useAuthStore from '../stores/authStore'

function QAForm() {
  const navigate = useNavigate()
  const { user, fetchUser } = useAuthStore()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [bounty, setBounty] = useState(10)

  const createMutation = useMutation({
    mutationFn: (data) => qaAPI.createQuestion(data),
    onSuccess: (response) => {
      fetchUser()
      alert('질문이 등록되었습니다.')
      navigate(`/qa/${response.data.id}`)
    },
    onError: (error) => {
      alert(error.response?.data?.detail || '질문 등록에 실패했습니다.')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.')
      return
    }

    if (bounty < 10) {
      alert('최소 10포인트 이상 걸어야 합니다.')
      return
    }

    if (bounty > (user?.points || 0)) {
      alert('보유 포인트가 부족합니다.')
      return
    }

    createMutation.mutate({
      title: title.trim(),
      content: content.trim(),
      bounty,
    })
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

      <div className="card overflow-hidden">
        <div className="px-6 sm:px-8 py-5 border-b border-ink-100">
          <h1 className="font-display text-xl font-bold text-ink-950 tracking-tight text-balance">
            새 질문 등록
          </h1>
          <p className="text-sm text-ink-400 mt-1">
            포인트를 걸고 질문을 등록하세요. 답변을 채택하면 해당 직원에게 포인트가 지급됩니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          <div>
            <label htmlFor="title" className="block text-sm font-semibold text-ink-700 mb-2">
              질문 제목
            </label>
            <input
              id="title"
              type="text"
              autoComplete="off"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="질문 제목을 입력하세요&#x2026;"
              className="input-field text-lg font-medium"
              required
            />
          </div>

          <div>
            <label htmlFor="bounty" className="block text-sm font-semibold text-ink-700 mb-2">
              포인트
            </label>
            <div className="flex items-center gap-3">
              <input
                id="bounty"
                type="number"
                min={10}
                max={user?.points || 50}
                value={bounty}
                onChange={(e) => setBounty(Math.max(10, parseInt(e.target.value) || 10))}
                className="input-field w-32"
              />
              <div className="flex items-center gap-2 text-sm text-ink-500">
                <span>보유:</span>
                <span className="badge-points">{user?.points ?? 0}P</span>
              </div>
            </div>
            <p className="text-xs text-ink-400 mt-1.5">
              최소 10포인트 이상, 보유 포인트 이하로 설정할 수 있습니다
            </p>
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-semibold text-ink-700 mb-2">
              질문 내용
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="질문 내용을 상세히 입력하세요&#x2026;"
              className="input-field resize-y leading-relaxed"
              rows="15"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-ink-100">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn-secondary"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={createMutation.isLoading || bounty > (user?.points || 0)}
              className="btn-accent"
            >
              {createMutation.isLoading ? '등록 중\u2026' : `${bounty}P 걸고 질문하기`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default QAForm
