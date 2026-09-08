import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import LoginModal from './LoginModal'
import BrandWordmark from './BrandWordmark'
import ThemeToggle from './ThemeToggle'
import '../theme-control.css'
import useAuthStore from '../stores/authStore'
import { getAvatarInitial, resolveProfileImageUrl } from '../utils/userProfile'

const navClass = ({ isActive }) => `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${isActive ? 'bg-accent-glow/70 text-accent-dark' : 'text-ink-600 hover:bg-paper-200 hover:text-ink-950'}`

export default function Layout() {
  const { user, token, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showAccount, setShowAccount] = useState(false)

  useEffect(() => {
    if (searchParams.get('login') === 'true') {
      setShowLoginModal(true)
      const next = new URLSearchParams(searchParams)
      next.delete('login')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => setShowAccount(false), [location.pathname])
  const avatarUrl = resolveProfileImageUrl(user?.profile_image_url)
  const handleLogout = async () => {
    try { await logout(); navigate('/', { replace: true }) }
    catch { toast.error('로그아웃을 완료하지 못했습니다. 다시 시도해 주세요.') }
  }
  const handleLoginSuccess = () => {
    setShowLoginModal(false)
    const next = searchParams.get('next')
    if (next?.startsWith('/') && !next.startsWith('//')) {
      navigate(next, { replace: true })
      return
    }
    const cleaned = new URLSearchParams(searchParams)
    cleaned.delete('next')
    setSearchParams(cleaned, { replace: true })
  }

  return (
    <div className="min-h-screen bg-paper-100 text-ink-950">
      <header className="sticky top-0 z-50 border-b border-ink-200/80 bg-paper-50/95 backdrop-blur-md">
        <div className="mx-auto max-w-[1280px] px-5 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3 sm:gap-5">
            <Link to="/" aria-label="jion 홈" className="inline-flex h-11 w-[80px] shrink-0 items-center rounded-md text-ink-950 transition-colors hover:text-accent-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:w-[92px]"><BrandWordmark /></Link>
            <nav className="hidden items-center gap-1 md:flex" aria-label="주요 메뉴">
              <NavLink to="/" end className={navClass}>오늘의 AI</NavLink>
              <NavLink to="/how-to" className={navClass}>AI 활용법</NavLink>
              <NavLink to="/papers" className={navClass}>논문</NavLink>
              <NavLink to="/community" className={navClass}>커뮤니티</NavLink>
            </nav>
            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              <a href="https://blog.jionc.com" className="text-xs font-medium text-ink-500 hover:text-ink-950">jion.log ↗</a>
              <ThemeToggle />
              {token && user ? (
                <div className="relative">
                  <button type="button" onClick={() => setShowAccount((value) => !value)} className="flex items-center gap-2 border-l border-ink-400 pl-4 text-xs font-bold text-ink-800">
                    <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-ink-950 text-[10px] text-paper-100">{avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : getAvatarInitial(user.username)}</span>
                    <span className="hidden max-w-24 truncate sm:block">{user.username}</span>
                  </button>
                  {showAccount && <div className="surface-panel absolute right-0 mt-3 w-48 p-2 shadow-soft-lg"><Link to="/mypage" className="block px-3 py-2 text-xs font-bold hover:bg-paper-200">마이페이지</Link>{user.is_admin && <Link to="/review" className="block px-3 py-2 text-xs font-bold hover:bg-paper-200">수집 검토</Link>}<button type="button" onClick={handleLogout} className="block w-full px-3 py-2 text-left text-xs font-bold hover:bg-paper-200">로그아웃</button></div>}
                </div>
              ) : <button type="button" onClick={() => setShowLoginModal(true)} className="rounded-lg bg-ink-950 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-dark">로그인</button>}
            </div>
          </div>
          <nav className="-mx-2 flex gap-1 overflow-x-auto border-t border-ink-100 py-2 md:hidden" aria-label="모바일 주요 메뉴">
            <NavLink to="/" end className={navClass}>오늘의 AI</NavLink><NavLink to="/how-to" className={navClass}>AI 활용법</NavLink><NavLink to="/papers" className={navClass}>논문</NavLink><NavLink to="/community" className={navClass}>커뮤니티</NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto min-h-[calc(100vh-180px)] max-w-[1280px] px-5 py-8 sm:py-10 lg:px-8"><Outlet /></main>

      <footer className="mt-10 border-t border-ink-200/80"><div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-5 py-7 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between lg:px-8"><p>© {new Date().getFullYear()} jion · 발견은 함께할수록 넓어집니다.</p><div className="flex gap-5"><Link to="/terms">이용약관</Link><Link to="/privacy">개인정보처리방침</Link><Link to="/contact">문의</Link></div></div></footer>
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} onSuccess={handleLoginSuccess} />
    </div>
  )
}
