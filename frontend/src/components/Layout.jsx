import { Outlet, Link, useLocation } from 'react-router-dom'
import useAuthStore from '../stores/authStore'

function Layout() {
  const { user, logout } = useAuthStore()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-paper-100 bg-noise">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-paper-50/80 backdrop-blur-xl border-b border-subtle">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link
              to="/"
              className="group flex items-center gap-3 transition-opacity hover:opacity-80"
            >
              <div className="w-8 h-8 bg-ink-950 rounded-lg flex items-center justify-center
                            group-hover:scale-105 transition-transform duration-200">
                <span className="text-paper-50 font-display font-bold text-sm">AG</span>
              </div>
              <span className="font-display text-lg font-bold text-ink-950 tracking-tight">
                사내 게시판
              </span>
            </Link>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center mr-2 px-3 py-1.5 bg-ink-50 rounded-full">
                <div className="w-5 h-5 rounded-full bg-ink-300 flex items-center justify-center mr-2">
                  <span className="text-[10px] font-bold text-ink-700">
                    {(user?.username || '?')[0].toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-medium text-ink-700">
                  {user?.username || '사용자'}
                </span>
              </div>

              <Link
                to="/posts/new"
                className="btn-primary text-sm flex items-center gap-1.5"
                aria-label="새 글 쓰기"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="hidden sm:inline">글쓰기</span>
              </Link>

              <button
                onClick={logout}
                className="btn-ghost text-sm text-ink-500"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 lg:px-8 py-8 animate-fade-in">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-subtle mt-auto">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-6">
          <p className="text-center text-xs text-ink-400 tracking-wide">
            Antigravity Internal Board
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Layout
