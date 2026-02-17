import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import useAuthStore from '../stores/authStore'
import LoginModal from './LoginModal'

function Layout() {
  const { user, logout, token } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const authActionClass = 'inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-700'

  const isMarketplace = location.pathname.startsWith('/marketplace')

  // 쿼리 파라미터로 로그인 모달 띄우기
  useEffect(() => {
    if (searchParams.get('login') === 'true') {
      setShowLoginModal(true)
      // 쿼리 파라미터 제거
      searchParams.delete('login')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const handleLogout = () => {
    logout()
    navigate('/community', { replace: true })
  }

  return (
    <div className="min-h-screen bg-paper-100 bg-noise">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-paper-50/80 backdrop-blur-xl border-b border-subtle">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="relative flex justify-between items-center h-16">
            {/* Logo */}
            <Link
              to="/community"
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
                to="/community"
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
              {user && token ? (
                <>
                  {/* 로그인 상태 */}
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
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-ink-200 bg-white text-ink-600 hover:bg-paper-100 hover:text-ink-900 transition-colors"
                      aria-label="새 글 쓰기"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      <span className="hidden sm:inline">글쓰기</span>
                    </Link>
                  )}

                  <button
                    onClick={handleLogout}
                    className="btn-ghost text-sm text-ink-500"
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  {/* 비로그인 상태 */}
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className={authActionClass}
                  >
                    로그인
                  </button>
                  <Link
                    to="/register"
                    className={authActionClass}
                  >
                    회원가입
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile Tabs */}
          <div className="flex sm:hidden items-center gap-1 pb-2 -mt-1">
            <Link
              to="/community"
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

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={() => setShowLoginModal(false)}
      />
    </div>
  )
}

export default Layout
