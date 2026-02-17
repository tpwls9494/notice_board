import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import useAuthStore from '../stores/authStore'

function Register() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const { register, isLoading, error, clearError } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.error('비밀번호가 일치하지 않습니다')
      return
    }
    const success = await register(email, username, password)
    if (success) {
      toast.success('회원가입 성공! 로그인해주세요.')
      navigate('/')
    }
  }

  const handleLoginClick = (e) => {
    e.preventDefault()
    navigate('/community?login=true')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper-100 bg-noise px-6 py-12">
      <div className="w-full max-w-md animate-fade-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-12 h-12 bg-ink-950 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="font-display text-lg font-bold text-paper-50">J</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-ink-950 text-balance">jion</h1>
        </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-ink-950 tracking-tight text-balance">
              회원가입
            </h2>
            <p className="text-sm text-ink-500 mt-1.5">
              새 계정을 만들어 게시판에 참여하세요
            </p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl animate-scale-in" role="alert">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-ink-700 mb-2">
                이메일
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) clearError()
                }}
                className="input-field"
                placeholder="name@company.com"
              />
              <p className="text-xs text-ink-400 mt-1.5">이메일 형식으로 입력해주세요 (예: user@example.com)</p>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-ink-700 mb-2">
                사용자명
              </label>
              <input
                id="username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  if (error) clearError()
                }}
                className="input-field"
                placeholder="표시될 이름을 입력하세요&#x2026;"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-ink-700 mb-2">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) clearError()
                }}
                className="input-field"
                placeholder="최소 6자 이상&#x2026;"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-ink-700 mb-2">
                비밀번호 확인
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (error) clearError()
                }}
                className={`input-field ${
                  confirmPassword && password !== confirmPassword
                    ? 'border-red-300 focus:border-red-400 focus:ring-red-200/50'
                    : ''
                }`}
                placeholder="비밀번호를 다시 입력하세요&#x2026;"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-500 mt-1.5">비밀번호가 일치하지 않습니다</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-accent w-full mt-6 py-3"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  가입 중&#x2026;
                </span>
              ) : (
                '회원가입'
              )}
            </button>

            <p className="text-center text-sm text-ink-500 mt-6">
              이미 계정이 있으신가요?{' '}
              <button
                onClick={handleLoginClick}
                className="font-semibold text-ink-800 hover:text-ink-950 underline underline-offset-2 transition-colors duration-200"
              >
                로그인
              </button>
            </p>
          </form>
        </div>
    </div>
  )
}

export default Register
