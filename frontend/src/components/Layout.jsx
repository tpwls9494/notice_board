import { Outlet, Link } from 'react-router-dom'
import useAuthStore from '../stores/authStore'

function Layout() {
  const { user, logout } = useAuthStore()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/" className="flex items-center text-xl font-bold text-gray-900">
                사내 게시판
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">
                {user?.username || '사용자'}
              </span>
              <Link
                to="/posts/new"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                글쓰기
              </Link>
              <button
                onClick={logout}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
