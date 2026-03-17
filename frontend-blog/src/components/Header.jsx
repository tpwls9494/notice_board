import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { CATEGORIES } from '../constants/categories'
import { authAPI } from '../services/api'

export default function Header() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const currentCategory = searchParams.get('category') || 'all'

  const [user, setUser] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    authAPI
      .getMe()
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('token')
        setUser(null)
      })
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    setUser(null)
    navigate('/')
  }

  return (
    <header className="bg-white border-b border-ink-100 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold text-ink-900 no-underline tracking-tight">
          Jion Blog
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {user?.is_admin && (
            <Link
              to="/write"
              className="px-3.5 py-1.5 bg-ink-800 text-white rounded-lg no-underline hover:bg-ink-900 transition-colors"
            >
              글쓰기
            </Link>
          )}
          {user && (
            <button
              onClick={handleLogout}
              className="text-ink-400 hover:text-ink-700 transition-colors"
            >
              로그아웃
            </button>
          )}
          <a
            href="https://jionc.com"
            className="text-ink-400 hover:text-ink-700 no-underline transition-colors"
          >
            Community
          </a>
        </nav>
      </div>
    </header>
  )
}
