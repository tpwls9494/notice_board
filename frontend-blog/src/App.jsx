import { Routes, Route, useLocation, Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Footer from './components/Footer'
import BlogList from './pages/BlogList'
import BlogDetail from './pages/BlogDetail'
import BlogEditor from './pages/BlogEditor'
import Login from './pages/Login'
import { CATEGORIES } from './constants/categories'
import { authAPI } from './services/api'
import WorkingPerson from './components/WorkingPerson'

function App() {
  const location = useLocation()
  const isHome = location.pathname === '/' || location.search.includes('category=')

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background 3D lines */}
      <div className="bg-lines" aria-hidden="true">
        <div className="bg-line bg-line-1" />
        <div className="bg-line bg-line-2" />
        <div className="bg-line bg-line-3" />
      </div>

      {isHome ? <HeroBanner /> : <SimpleHeader />}

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 relative z-10">
        <div className="page-enter" key={location.pathname}>
          <Routes>
            <Route path="/" element={<BlogList />} />
            <Route path="/login" element={<Login />} />
            <Route path="/write" element={<BlogEditor />} />
            <Route path="/edit/:slug" element={<BlogEditor />} />
            <Route path="/:slug" element={<BlogDetail />} />
          </Routes>
        </div>
      </main>
      <Footer />
      <WorkingPerson />
    </div>
  )
}

function HeroBanner() {
  const [searchParams] = useSearchParams()
  const currentCategory = searchParams.get('category') || 'all'
  const { user, handleLogout } = useAuth()
  return (
    <header className="bg-[#0a0a0a] sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold text-white no-underline tracking-tight">
          Jion Blog
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {user?.is_admin && (
            <Link to="/write" className="px-3.5 py-1.5 bg-white/15 text-white rounded-lg no-underline hover:bg-white/25 transition-colors">
              글쓰기
            </Link>
          )}
          {user && (
            <button onClick={handleLogout} className="text-white/40 hover:text-white/70 transition-colors">
              로그아웃
            </button>
          )}
          <a href="https://jionc.com" className="text-white/40 hover:text-white/70 no-underline transition-colors">
            Community
          </a>
        </nav>
      </div>
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <p className="text-[11px] text-white/25 font-medium tracking-widest uppercase pt-0.5 pb-2">
          Dev · AI · Life
        </p>
      </div>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-2">
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.key}
              to={cat.key === 'all' ? '/' : `/?category=${cat.key}`}
              className={`px-3.5 py-1.5 text-sm font-medium no-underline whitespace-nowrap rounded-lg transition-all duration-200 ${
                currentCategory === cat.key
                  ? 'bg-white text-ink-900'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/8'
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

function SimpleHeader() {
  const { user, handleLogout } = useAuth()

  return (
    <header className="bg-white border-b border-ink-100 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold text-ink-900 no-underline tracking-tight">
          Jion Blog
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {user?.is_admin && (
            <Link to="/write" className="px-3.5 py-1.5 bg-ink-800 text-white rounded-lg no-underline hover:bg-ink-900 transition-colors">
              글쓰기
            </Link>
          )}
          {user && (
            <button onClick={handleLogout} className="text-ink-400 hover:text-ink-700 transition-colors">
              로그아웃
            </button>
          )}
          <a href="https://jionc.com" className="text-ink-400 hover:text-ink-700 no-underline transition-colors">
            Community
          </a>
        </nav>
      </div>
    </header>
  )
}

function useAuth() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    authAPI.getMe()
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

  return { user, handleLogout }
}

export default App
