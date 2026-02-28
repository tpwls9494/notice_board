import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import useAuthStore from '../stores/authStore';
import LoginModal from './LoginModal';
import { notificationsAPI } from '../services/api';
import { getAvatarInitial, resolveProfileImageUrl } from '../utils/userProfile';

function Layout() {
  const { user, logout, token } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const authActionClass =
    'inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-700';

  const isMarketplace = location.pathname.startsWith('/marketplace');
  const isMyPage = location.pathname.startsWith('/mypage');
  const avatarInitial = getAvatarInitial(user?.username);
  const profileImageUrl = resolveProfileImageUrl(user?.profile_image_url);

  const { data: unreadCountData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationsAPI.getUnreadCount(),
    enabled: !!token,
    refetchInterval: 30000,
  });

  const unreadCount = unreadCountData?.data?.unread_count || 0;

  useEffect(() => {
    if (searchParams.get('login') === 'true') {
      setShowLoginModal(true);
      searchParams.delete('login');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleLogout = () => {
    logout();
    navigate('/community', { replace: true });
  };

  return (
    <div className="min-h-screen bg-paper-100 bg-noise">
      <nav className="sticky top-0 z-50 bg-paper-50/80 backdrop-blur-xl border-b border-subtle">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="relative flex justify-between items-center h-16">
            <Link to="/community" className="group flex items-center gap-3 transition-opacity hover:opacity-80 z-10">
              <div className="w-8 h-8 bg-ink-950 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                <span className="text-paper-50 font-display font-bold text-sm">J</span>
              </div>
              <span className="font-display text-lg font-bold text-ink-950 tracking-tight">jion</span>
            </Link>

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

            <div className="flex items-center gap-2 z-10">
              {user && token ? (
                <>
                  <div className="hidden sm:flex items-center mr-2 px-3 py-1.5 bg-ink-50 rounded-full">
                    <div className="w-5 h-5 rounded-full bg-ink-300 overflow-hidden flex items-center justify-center mr-2">
                      {profileImageUrl ? (
                        <img
                          src={profileImageUrl}
                          alt={`${user?.username || '사용자'} 프로필`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-ink-700">{avatarInitial}</span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-ink-700">{user?.username || '사용자'}</span>
                  </div>

                  {!isMyPage && (
                    <Link to="/mypage" className={authActionClass}>
                      마이페이지
                    </Link>
                  )}

                  <Link
                    to="/mypage#notifications"
                    className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-700"
                    aria-label="알림"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>

                  {!isMarketplace && !isMyPage && (
                    <Link
                      to="/posts/new"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-ink-200 bg-white text-ink-600 hover:bg-paper-100 hover:text-ink-900 transition-colors"
                      aria-label="글쓰기"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      <span className="hidden sm:inline">글쓰기</span>
                    </Link>
                  )}

                  <button onClick={handleLogout} className="btn-ghost text-sm text-ink-500">
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setShowLoginModal(true)} className={authActionClass}>
                    로그인
                  </button>
                  <Link to="/register" className={authActionClass}>
                    회원가입
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="flex sm:hidden items-center gap-1 pb-2 -mt-1">
            <Link
              to="/community"
              className={`flex-1 text-center px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                !isMarketplace ? 'bg-ink-100 text-ink-900' : 'text-ink-500'
              }`}
            >
              커뮤니티
            </Link>
            <Link
              to="/marketplace"
              className={`flex-1 text-center px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                isMarketplace ? 'bg-ink-100 text-ink-900' : 'text-ink-500'
              }`}
            >
              마켓플레이스
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 lg:px-8 py-8 animate-fade-in">
        <Outlet />
      </main>

      <footer className="border-t border-subtle mt-auto">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-6">
          <p className="text-center text-xs text-ink-400 tracking-wide">Jion</p>
        </div>
      </footer>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={() => setShowLoginModal(false)}
      />
    </div>
  );
}

export default Layout;
