import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authAPI } from '../services/api'
import { safeNextPath } from '../utils/auth'

export default function Login({ onAuthenticated }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [providers, setProviders] = useState({})
  useEffect(() => { authAPI.getProviders().then(({ data }) => setProviders(data)).catch(() => {}) }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await authAPI.login({ email, password })
      const { data } = await authAPI.getSession()
      if (!data.user) throw new Error('Session was not established')
      onAuthenticated(data.user)
      navigate(safeNextPath(params.get('next')))
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto py-20">
      <h1 className="text-2xl font-bold text-ink-900 mb-2">로그인</h1>
      <p className="text-sm text-ink-400 mb-8">jion 계정으로 로그인하고 생각을 나눠보세요.</p>
      {(providers.google || providers.github) && <div className="blog-social-login">{[['google', 'Google'], ['github', 'GitHub']].filter(([key]) => providers[key]).map(([key, label]) => <a key={key} href={authAPI.oauthURL(key, safeNextPath(params.get('next')))}>{label}로 계속하기</a>)}<p>또는 이메일로 로그인</p></div>}

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-ink-700 mb-1">
            이메일
          </label>
          <input
            type="email"
            id="login-email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-ink-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-ink-800"
            placeholder="name@example.com"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium text-ink-700 mb-1">
            비밀번호
          </label>
          <input
            type="password"
            id="login-password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-ink-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-ink-800"
            placeholder="비밀번호"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-ink-800 text-white rounded-lg text-sm font-medium hover:bg-ink-900 disabled:opacity-50"
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  )
}
