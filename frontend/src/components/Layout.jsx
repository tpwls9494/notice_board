import { Outlet, Link, useLocation } from 'react-router-dom'
import useAuthStore from '../stores/authStore'

function Layout() {
  const { user, logout } = useAuthStore()
  const location = useLocation()

  const isMarketplace = location.pathname.startsWith('/marketplace')

  return (
    <div className="min-h-screen bg-paper-100 bg-noise">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-paper-50/80 backdrop-blur-xl border-b border-subtle">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="relative flex justify-between items-center h-16">
            {/* Logo */}
            <Link
              to="/"
              className="group flex items-center gap-3 transition-opacity hover:opacity-80 z-10"
            >
              <div className="w-8 h-8 bg-ink-950 rounded-lg flex items-center justify-center
                            group-hover:scale-105 transition-transform duration-200">
                <span className="text-paper-50 font-display font-bold text-sm">J</span>
              </div>
              <span className="font-display text-lg font-bold text-ink-950 tracking-tight">
                jion
              </span>
            </Link>

            {/* Navigation Tabs - Centered */}
            <div className="absolute left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-1">
              <Link
                to="/"
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  !isMarketplace
                    ? 'bg-ink-100 text-ink-900'
                    : 'text-ink-500 hover:text-ink-700 hover:bg-ink-50'
                }`}
              >
                커뮤니티
              </Link>
              <Link
                to="/marketplace"
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  isMarketplace
                    ? 'bg-ink-100 text-ink-900'
                    : 'text-ink-500 hover:text-ink-700 hover:bg-ink-50'
                }`}
              >
                마켓플레이스
              </Link>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2 z-10">
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

              {!isMarketplace && (
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
              )}

              <button
                onClick={logout}
                className="btn-ghost text-sm text-ink-500"
              >
                로그아웃
              </button>
            </div>
          </div>

          {/* Mobile Tabs */}
          <div className="flex sm:hidden items-center gap-1 pb-2 -mt-1">
            <Link
              to="/"
              className={`flex-1 text-center px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                !isMarketplace
                  ? 'bg-ink-100 text-ink-900'
                  : 'text-ink-500'
              }`}
            >
              커뮤니티
            </Link>
            <Link
              to="/marketplace"
              className={`flex-1 text-center px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                isMarketplace
                  ? 'bg-ink-100 text-ink-900'
                  : 'text-ink-500'
              }`}
            >
              마켓플레이스
            </Link>
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
             MCP Marketplace
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Layout
