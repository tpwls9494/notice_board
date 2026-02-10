import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import useAuthStore from './stores/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import PostList from './pages/PostList'
import PostDetail from './pages/PostDetail'
import PostForm from './pages/PostForm'
import DeadlineList from './pages/DeadlineList'
import DeadlineDetail from './pages/DeadlineDetail'
import DeadlineForm from './pages/DeadlineForm'
import QAList from './pages/QAList'
import QADetail from './pages/QADetail'
import QAForm from './pages/QAForm'

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
        <Route index element={<PostList />} />
        <Route path="posts/:id" element={<PostDetail />} />
        <Route path="posts/new" element={<PostForm />} />
        <Route path="posts/:id/edit" element={<PostForm />} />

        {/* Deadline Board */}
        <Route path="deadline" element={<DeadlineList />} />
        <Route path="deadline/:id" element={<DeadlineDetail />} />
        <Route path="deadline/new" element={<DeadlineForm />} />
        <Route path="deadline/:id/edit" element={<DeadlineForm />} />

        {/* Q&A Board */}
        <Route path="qa" element={<QAList />} />
        <Route path="qa/:id" element={<QADetail />} />
        <Route path="qa/new" element={<QAForm />} />
      </Route>
    </Routes>
  )
}

export default App
