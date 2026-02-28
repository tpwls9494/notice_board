import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import useAuthStore from '../stores/authStore';
import LoginModal from './LoginModal';
import { notificationsAPI } from '../services/api';
import { getAvatarInitial, resolveProfileImageUrl } from '../utils/userProfile';

const formatNotificationContent = (notification) => {
  const raw = notification?.content?.trim();
  if (!raw) {
    return '새 알림이 도착했습니다.';
  }

  if (/[가-힣]/.test(raw)) {
    return raw;
  }

  if (notification?.type === 'like') {
    const actor = raw.match(/^(.+?) liked your post\.?$/i)?.[1];
    if (actor) {
      return `${actor}님이 회원님의 게시글을 좋아합니다.`;
    }
    return '회원님의 게시글에 새 좋아요가 있습니다.';
  }

  if (notification?.type === 'comment') {
    const actor = raw.match(/^(.+?) commented on your post\.?$/i)?.[1];
    if (actor) {
      return `${actor}님이 회원님의 게시글에 댓글을 남겼습니다.`;
    }
    return '회원님의 게시글에 새 댓글이 달렸습니다.';
  }

  return raw;
};

function Layout() {
  const { user, logout, token } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);

  const notificationButtonRef = useRef(null);
  const notificationPanelRef = useRef(null);

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

  const { data: notificationsData, isLoading: notificationsLoading } = useQuery({
    queryKey: ['my-notifications'],
    queryFn: () => notificationsAPI.getMyNotifications(1, 30),
    enabled: !!token,
    refetchInterval: showNotificationPanel ? 30000 : false,
  });

  const markNotificationReadMutation = useMutation({
    mutationFn: (notificationId) => notificationsAPI.markAsRead(notificationId),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries(['my-notifications']);
      await queryClient.cancelQueries(['notifications-unread-count']);

      const previousNotifications = queryClient.getQueryData(['my-notifications']);
      const previousUnreadCount = queryClient.getQueryData(['notifications-unread-count']);

      queryClient.setQueryData(['my-notifications'], (cached) => {
        if (!cached?.data?.notifications) return cached;
        return {
          ...cached,
          data: {
            ...cached.data,
            notifications: cached.data.notifications.map((item) => (
              item.id === notificationId
                ? { ...item, is_read: true }
                : item
            )),
          },
        };
      });

      queryClient.setQueryData(['notifications-unread-count'], (cached) => {
        if (!cached?.data) return cached;
        return {
          ...cached,
          data: {
            ...cached.data,
            unread_count: Math.max(0, (cached.data.unread_count || 0) - 1),
          },
        };
      });

      return { previousNotifications, previousUnreadCount };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['my-notifications']);
      queryClient.invalidateQueries(['notifications-unread-count']);
    },
    onError: (_error, _notificationId, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(['my-notifications'], context.previousNotifications);
      }
      if (context?.previousUnreadCount) {
        queryClient.setQueryData(['notifications-unread-count'], context.previousUnreadCount);
      }
    },
  });

  const markAllNotificationsReadMutation = useMutation({
    mutationFn: () => notificationsAPI.markAllAsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries(['my-notifications']);
      await queryClient.cancelQueries(['notifications-unread-count']);

      const previousNotifications = queryClient.getQueryData(['my-notifications']);
      const previousUnreadCount = queryClient.getQueryData(['notifications-unread-count']);

      queryClient.setQueryData(['my-notifications'], (cached) => {
        if (!cached?.data?.notifications) return cached;
        return {
          ...cached,
          data: {
            ...cached.data,
            notifications: cached.data.notifications.map((item) => ({ ...item, is_read: true })),
          },
        };
      });

      queryClient.setQueryData(['notifications-unread-count'], (cached) => {
        if (!cached?.data) return cached;
        return {
          ...cached,
          data: {
            ...cached.data,
            unread_count: 0,
          },
        };
      });

      return { previousNotifications, previousUnreadCount };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['my-notifications']);
      queryClient.invalidateQueries(['notifications-unread-count']);
    },
    onError: (_error, _variables, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(['my-notifications'], context.previousNotifications);
      }
      if (context?.previousUnreadCount) {
        queryClient.setQueryData(['notifications-unread-count'], context.previousUnreadCount);
      }
    },
  });

  const unreadCount = unreadCountData?.data?.unread_count || 0;
  const notifications = notificationsData?.data?.notifications || [];
  const unreadNotifications = notifications.filter((item) => !item.is_read);

  useEffect(() => {
    if (searchParams.get('login') === 'true') {
      setShowLoginModal(true);
      searchParams.delete('login');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setShowNotificationPanel(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!showNotificationPanel) {
      return;
    }

    const handleOutsideClick = (event) => {
      if (
        notificationButtonRef.current?.contains(event.target)
        || notificationPanelRef.current?.contains(event.target)
      ) {
        return;
      }
      setShowNotificationPanel(false);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setShowNotificationPanel(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showNotificationPanel]);

  const handleLogout = () => {
    setShowNotificationPanel(false);
    logout();
    navigate('/community', { replace: true });
  };

  const toggleNotificationPanel = () => {
    setShowNotificationPanel((prev) => {
      const next = !prev;
      if (next) {
        queryClient.invalidateQueries(['my-notifications']);
      }
      return next;
    });
  };

  const handleNotificationOpen = (notification, closePanel = false) => {
    if (!notification?.is_read && !markNotificationReadMutation.isPending) {
      markNotificationReadMutation.mutate(notification.id);
    }
    if (closePanel) {
      setShowNotificationPanel(false);
    }
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

                  <div className="relative">
                    <button
                      ref={notificationButtonRef}
                      type="button"
                      onClick={toggleNotificationPanel}
                      className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-700"
                      aria-label="알림"
                      aria-expanded={showNotificationPanel}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                      </svg>
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </button>

                    {showNotificationPanel && (
                      <div
                        ref={notificationPanelRef}
                        className="absolute right-0 mt-2 w-[min(92vw,23rem)] rounded-2xl border border-ink-200 bg-white shadow-soft overflow-hidden"
                      >
                        <div className="px-4 py-3 border-b border-ink-100 bg-paper-50 flex items-center justify-between">
                          <p className="text-sm font-semibold text-ink-900">알림</p>
                          <button
                            type="button"
                            onClick={() => markAllNotificationsReadMutation.mutate()}
                            disabled={markAllNotificationsReadMutation.isPending || unreadNotifications.length === 0}
                            className="text-xs text-ink-500 hover:text-ink-800 disabled:text-ink-300"
                          >
                            모두 읽음
                          </button>
                        </div>

                        <div className="max-h-[380px] overflow-y-auto p-2">
                          {notificationsLoading && (
                            <div className="px-3 py-5 text-center text-xs text-ink-400">알림을 불러오는 중입니다.</div>
                          )}

                          {!notificationsLoading && unreadNotifications.length === 0 && (
                            <div className="px-3 py-5 text-center text-xs text-ink-400">새 알림이 없습니다.</div>
                          )}

                          {!notificationsLoading && unreadNotifications.map((item) => {
                            const content = formatNotificationContent(item);
                            const timeText = new Intl.DateTimeFormat('ko-KR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            }).format(new Date(item.created_at));

                            const itemClassName = 'block w-full text-left rounded-xl px-3 py-2.5 transition-colors bg-paper-50 hover:bg-paper-100 border border-ink-100';

                            if (item.related_post_id) {
                              return (
                                <Link
                                  key={item.id}
                                  to={`/posts/${item.related_post_id}`}
                                  onClick={() => handleNotificationOpen(item, true)}
                                  className={itemClassName}
                                >
                                  <p className="text-sm text-ink-800 break-words">{content}</p>
                                  {item.post_title && (
                                    <p className="text-xs text-ink-500 mt-1 truncate">{item.post_title}</p>
                                  )}
                                  <p className="text-[11px] text-ink-400 mt-1">{timeText}</p>
                                </Link>
                              );
                            }

                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleNotificationOpen(item)}
                                className={itemClassName}
                              >
                                <p className="text-sm text-ink-800 break-words">{content}</p>
                                <p className="text-[11px] text-ink-400 mt-1">{timeText}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

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
