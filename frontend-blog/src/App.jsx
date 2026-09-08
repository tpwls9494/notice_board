import { Routes, Route, useLocation, Link, useNavigate } from 'react-router-dom'
import { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react'
import Footer from './components/Footer'
import { Navigate } from 'react-router-dom'
import BlogList from './pages/BlogList'
import AdminOnly from './components/AdminOnly'
import { authAPI } from './services/api'
import { applyBlogMetadata } from './utils/seo'
import './journal.css'
import './theme-control.css'
import './dark.css'
import ThemeToggle from './components/ThemeToggle'

const BlogDetail = lazy(() => import('./pages/BlogDetail'))
const BlogEditor = lazy(() => import('./pages/BlogEditor'))
const ManagePosts = lazy(() => import('./pages/ManagePosts'))
const Login = lazy(() => import('./pages/Login'))
const OAuthCallback = lazy(() => import('./pages/OAuthCallback'))
const DesignNotice = lazy(() => import('./components/DesignNotice'))

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState('')
  const revision = useRef(0)
  const authenticated = useCallback((account) => {
    ++revision.current
    setUser(account)
    setAuthReady(true)
  }, [])
  useEffect(() => {
    let active = true
    let pending = false
    const refresh = async () => {
      if (pending || document.visibilityState !== 'visible') return
      pending = true
      const started = revision.current
      try {
        const { data } = await authAPI.getSession()
        if (active && started === revision.current) setUser(data.user)
      } catch { /* Preserve unsaved work on network failure; the API still enforces access. */ }
      finally { pending = false; if (active) setAuthReady(true) }
    }
    void refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener('blog-auth-check', refresh)
    document.addEventListener('visibilitychange', refresh)
    const timer = window.setInterval(refresh, 30000)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('blog-auth-check', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  const isHome = location.pathname === '/'
  const isEditor = /^\/(write|edit|drafts|admin)(\/|$)/.test(location.pathname)
  useEffect(() => {
    if (location.pathname === '/') applyBlogMetadata({ privatePage: Boolean(location.search) })
    else if (/^\/(login|oauth|write|edit|drafts|admin)(\/|$)/.test(location.pathname)) applyBlogMetadata({ privatePage: true })
  }, [location.pathname, location.search])
  useEffect(() => {
    window.dispatchEvent(new Event('blog-auth-check'))
  }, [location.pathname])
  async function logout() {
    ++revision.current
    setAuthError('')
    try {
      await authAPI.logout()
      ++revision.current
      setUser(null)
      navigate('/')
    } catch { setAuthError('로그아웃을 완료하지 못했습니다. 다시 시도해 주세요.') }
  }
  return (
    <div className="journal-app">
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      {import.meta.env.DEV && import.meta.env.VITE_DESIGN_PREVIEW === 'true' && <Suspense fallback={null}><DesignNotice /></Suspense>}
      <header className="journal-header">
        <div className="journal-header-inner">
          <Link to="/" className="journal-wordmark" aria-label="jion.log 홈">jion<span>.</span>log</Link>
          <nav aria-label="주 메뉴" className="journal-nav">
            <Link to="/" aria-current={isHome ? 'page' : undefined}>기록</Link>
            <ThemeToggle />
            {user?.can_write_blog === true && <><Link to="/admin/posts" aria-current={location.pathname === '/admin/posts' ? 'page' : undefined}>기록 관리</Link><Link to="/write">글쓰기</Link></>}
            {user && <button onClick={logout}>로그아웃</button>}
            {authReady && !user && <Link to="/login">로그인</Link>}
            <a href="https://jionc.com" className="journal-main-link">jionc.com <span aria-hidden="true">↗</span></a>
          </nav>
        </div>
      </header>
      <main id="main-content" className={`journal-main ${isHome ? 'journal-home' : isEditor ? 'journal-editor' : 'journal-reading'}`}>
        {authError && <p role="alert">{authError}</p>}
        {!isHome && !isEditor && <Link to="/" className="journal-back">← 모든 기록</Link>}
        <Suspense fallback={<p className="journal-state" role="status">화면을 불러오고 있습니다.</p>}>
          <Routes>
            <Route path="/" element={<BlogList key={user?.id ?? 'anonymous'} user={user} />} />
            <Route path="/login" element={<Login onAuthenticated={authenticated} />} />
            <Route path="/oauth/callback" element={<OAuthCallback onAuthenticated={authenticated} />} />
            <Route path="/drafts" element={<Navigate to="/admin/posts?status=draft" replace />} />
            <Route path="/admin/posts" element={<AdminOnly user={user} ready={authReady} key={user?.id}><ManagePosts /></AdminOnly>} />
            <Route path="/write" element={<AdminOnly user={user} ready={authReady} key={`${location.pathname}:${user?.id}`}><BlogEditor /></AdminOnly>} />
            <Route path="/edit/:slug" element={<AdminOnly user={user} ready={authReady} key={`${location.pathname}:${user?.id}`}><BlogEditor /></AdminOnly>} />
            <Route path="/:slug" element={<BlogDetail key={`${location.pathname}:${user?.id}`} user={user} />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
