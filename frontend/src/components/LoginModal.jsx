import { useState, useEffect } from 'react'
import useAuthStore from '../stores/authStore'
import SocialLoginButtons from './SocialLoginButtons'
import { trackAnalyticsEvent } from '../utils/analytics'

function LoginModal({ isOpen, onClose, onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, isLoading, error } = useAuthStore()

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const success = await login(email, password)
    if (success) {
      trackAnalyticsEvent('login_success', {
        method: 'password',
        source: 'login_modal',
      })
      setEmail('')
      setPassword('')
      if (onSuccess) onSuccess()
    }
  }

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-fade-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
          <div>
            <h2 className="font-display text-xl font-bold text-ink-950">로그인</h2>
            <p className="text-xs text-ink-500 mt-0.5">
              계정으로 로그인하면 커뮤니티 기능을 사용할 수 있습니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-400 hover:text-ink-600 transition-colors"
            aria-label="닫기"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form className="px-6 py-6 space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl animate-scale-in" role="alert">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="modal-email" className="block text-sm font-semibold text-ink-700 mb-2">
              이메일
            </label>
            <input
              id="modal-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input-field"
              placeholder="name@company.com"
            />
          </div>

          <div>
            <label htmlFor="modal-password" className="block text-sm font-semibold text-ink-700 mb-2">
              비밀번호
            </label>
            <input
              id="modal-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-field"
              placeholder="비밀번호를 입력하세요..."
            />
          </div>

          <SocialLoginButtons className="pt-1" />

          <button
            type="submit"
            disabled={isLoading}
            className="btn-accent w-full mt-6 py-3"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                로그인 중...
              </span>
            ) : (
              '로그인'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginModal
