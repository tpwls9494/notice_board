import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuthStore from '../stores/authStore'

function Register() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const { register, isLoading, error } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      alert('비밀번호가 일치하지 않습니다')
      return
    }
    const success = await register(email, username, password)
    if (success) {
      alert('회원가입 성공! 로그인해주세요.')
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen flex bg-paper-100 bg-noise">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-ink-900 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        />
        <div className="relative z-10 text-center px-12 animate-fade-in">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-8 border border-white/10">
            <span className="font-display text-2xl font-bold text-white">AG</span>
          </div>
          <h1 className="font-display text-4xl font-bold text-white tracking-tight mb-4 text-balance">
            함께 만들어가는
          </h1>
          <p className="text-ink-400 text-lg leading-relaxed max-w-sm mx-auto">
            Antigravity의 일원이 되어<br />
            자유롭게 소통하세요
          </p>
          <div className="mt-12 flex items-center justify-center gap-3">
            <div className="w-2 h-0.5 bg-ink-700 rounded-full" />
            <div className="w-8 h-0.5 bg-ink-400 rounded-full" />
            <div className="w-2 h-0.5 bg-ink-600 rounded-full" />
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md animate-fade-up">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="w-12 h-12 bg-ink-950 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="font-display text-lg font-bold text-paper-50">AG</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-ink-950 text-balance">사내 게시판</h1>
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
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="name@company.com"
              />
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
                onChange={(e) => setUsername(e.target.value)}
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
                onChange={(e) => setPassword(e.target.value)}
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
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              <Link to="/login" className="font-semibold text-ink-800 hover:text-ink-950 underline underline-offset-2 transition-colors duration-200">
                로그인
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Register
