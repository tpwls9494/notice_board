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
    <header className="bg-[#0a0a0a] sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold text-white no-underline tracking-tight">
          Jion Blog
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {user?.is_admin && (
            <Link
              to="/write"
              className="px-3.5 py-1.5 bg-white/15 text-white rounded-lg no-underline hover:bg-white/25 transition-colors"
            >
              글쓰기
            </Link>
          )}
          {user && (
            <button
              onClick={handleLogout}
              className="text-white/40 hover:text-white/70 transition-colors"
            >
              로그아웃
            </button>
          )}
          <a
            href="https://jionc.com"
            className="text-white/40 hover:text-white/70 no-underline transition-colors"
          >
            Community
          </a>
        </nav>
      </div>
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide -mb-px">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.key}
              to={cat.key === 'all' ? '/' : `/?category=${cat.key}`}
              className={`px-3.5 py-2.5 text-sm font-medium no-underline whitespace-nowrap border-b-2 transition-all duration-200 ${
                currentCategory === cat.key
                  ? 'border-white text-white'
                  : 'border-transparent text-white/40 hover:text-white/70 hover:border-white/20'
              }`}
            >
              {cat.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
