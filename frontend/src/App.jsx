import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import useAuthStore from './stores/authStore'
import Layout from './components/Layout'
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
        {/* Marketplace (default home) */}
        <Route index element={<McpList />} />
        <Route path="servers/:id" element={<McpDetail />} />
        <Route path="playground" element={<McpPlayground />} />
        <Route path="playground/:serverId" element={<McpPlayground />} />

        {/* Community (existing board, moved) */}
        <Route path="community" element={<PostList />} />
        <Route path="community/posts/:id" element={<PostDetail />} />
        <Route path="community/posts/new" element={<PostForm />} />
        <Route path="community/posts/:id/edit" element={<PostForm />} />
      </Route>
    </Routes>
  )
}

export default App
