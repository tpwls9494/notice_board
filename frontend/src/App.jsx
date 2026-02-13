import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Toaster } from 'sonner'
import useAuthStore from './stores/authStore'
import Layout from './components/Layout'
import { ConfirmProvider } from './components/ConfirmModal'
import Login from './pages/Login'
import Register from './pages/Register'
// Marketplace
import McpList from './pages/marketplace/McpList'
import McpDetail from './pages/marketplace/McpDetail'
import McpPlayground from './pages/marketplace/McpPlayground'
// Community
import PostList from './pages/community/PostList'
import PostDetail from './pages/community/PostDetail'
import PostForm from './pages/community/PostForm'

function ProtectedRoute({ children }) {
  const token = useAuthStore((state) => state.token)

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return children
}

function App() {
  const { token, fetchUser } = useAuthStore()

  useEffect(() => {
    if (token) {
      fetchUser()
    }
  }, [token, fetchUser])

  return (
    <ConfirmProvider>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            fontFamily: '"Pretendard", "Noto Sans KR", system-ui, sans-serif',
            borderRadius: '0.875rem',
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1), 0 4px 25px -5px rgba(0,0,0,0.05)',
            border: '1px solid rgba(0,0,0,0.06)',
            padding: '14px 18px',
            fontSize: '14px',
          },
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {/* Community (default home) */}
          <Route index element={<PostList />} />
          <Route path="posts/:id" element={<PostDetail />} />
          <Route path="posts/new" element={<PostForm />} />
          <Route path="posts/:id/edit" element={<PostForm />} />

          {/* Marketplace */}
          <Route path="marketplace" element={<McpList />} />
          <Route path="marketplace/servers/:id" element={<McpDetail />} />
          <Route path="marketplace/playground" element={<McpPlayground />} />
          <Route path="marketplace/playground/:serverId" element={<McpPlayground />} />
        </Route>
      </Routes>
    </ConfirmProvider>
  )
}

export default App
