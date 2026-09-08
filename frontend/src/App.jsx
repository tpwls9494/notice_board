import { Fragment, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'

import Layout from './components/Layout'
import { ConfirmProvider } from './components/ConfirmModal'
import useAuthStore from './stores/authStore'
import useTheme from './hooks/useTheme'
import TodayPage from './pages/TodayPage'
import SignalDetailPage from './pages/signals/SignalDetailPage'
import SignalIndexPage from './pages/signals/SignalIndexPage'
import SignalReviewPage from './pages/signals/SignalReviewPage'
import SocialFeedPage from './pages/social/SocialFeedPage'
import SocialPostDetailPage from './pages/social/SocialPostDetailPage'
import SocialPostFormPage from './pages/social/SocialPostFormPage'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import OAuthCallback from './pages/OAuthCallback'
import MyPage from './pages/MyPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import ContactPage from './pages/ContactPage'

function ProtectedRoute({ children }) {
  const token = useAuthStore((state) => state.token)
  const ready = useAuthStore((state) => state.isAuthReady)
  const userId = useAuthStore((state) => state.user?.id)
  const location = useLocation()
  const next = `${location.pathname}${location.search}`
  if (!ready) return <p role="status">로그인을 확인하고 있습니다.</p>
  return token ? <Fragment key={userId}>{children}</Fragment> : <Navigate to={`/?login=true&next=${encodeURIComponent(next)}`} replace />
}

function AdminRoute({ children }) {
  const { token, user, isAuthReady } = useAuthStore()
  const location = useLocation()
  if (!isAuthReady) {
    return <div className="mx-auto mt-24 h-10 w-10 animate-spin rounded-full border-2 border-ink-200 border-t-ink-700" aria-label="관리자 권한 확인 중" />
  }
  if (!token) return <Navigate to={`/?login=true&next=${encodeURIComponent(location.pathname)}`} replace />
  return user?.is_admin ? <Fragment key={user.id}>{children}</Fragment> : <Navigate to="/" replace />
}

function App() {
  const { resolved: theme } = useTheme()
  const { fetchUser } = useAuthStore()
  const queryClient = useQueryClient()

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void fetchUser() }
    void fetchUser()
    const unsubscribe = useAuthStore.subscribe((state, previous) => {
      if (state.user?.id !== previous.user?.id) queryClient.clear()
    })
    window.addEventListener('focus', refresh)
    window.addEventListener('jion-auth-check', refresh)
    document.addEventListener('visibilitychange', refresh)
    const timer = window.setInterval(refresh, 30000)
    return () => {
      unsubscribe()
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('jion-auth-check', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [fetchUser, queryClient])

  return (
    <ConfirmProvider>
      <Toaster theme={theme} position="top-center" />
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route path="/login" element={<Navigate to="/?login=true" replace />} />

        <Route path="/" element={<Layout />}>
          <Route index element={<TodayPage />} />
          <Route path="ai" element={<SignalIndexPage />} />
          <Route path="how-to" element={<SignalIndexPage kind="workflow" />} />
          <Route path="papers" element={<SignalIndexPage kind="research" />} />
          <Route path="signals/:slug" element={<SignalDetailPage />} />
          <Route path="community" element={<SocialFeedPage />} />
          <Route path="lounge" element={<SocialFeedPage space="lounge" />} />
          <Route path="community/write" element={<ProtectedRoute><SocialPostFormPage /></ProtectedRoute>} />
          <Route path="community/:postId/edit" element={<ProtectedRoute><SocialPostFormPage /></ProtectedRoute>} />
          <Route path="community/:postId" element={<SocialPostDetailPage />} />
          <Route path="submit" element={<Navigate to="/community/write" replace />} />
          <Route path="review" element={<AdminRoute><SignalReviewPage /></AdminRoute>} />
          <Route path="mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="contact" element={<ContactPage />} />

          <Route path="marketplace/*" element={<Navigate to="/" replace />} />
          <Route path="posts/*" element={<Navigate to="/community" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ConfirmProvider>
  )
}

export default App
