import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import BlogList from './pages/BlogList'
import BlogDetail from './pages/BlogDetail'
import BlogEditor from './pages/BlogEditor'
import Login from './pages/Login'

function App() {
  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background 3D lines */}
      <div className="bg-lines" aria-hidden="true">
        <div className="bg-line bg-line-1" />
        <div className="bg-line bg-line-2" />
        <div className="bg-line bg-line-3" />
      </div>

      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 relative z-10">
        <Routes>
          <Route path="/" element={<BlogList />} />
          <Route path="/login" element={<Login />} />
          <Route path="/write" element={<BlogEditor />} />
          <Route path="/edit/:id" element={<BlogEditor />} />
          <Route path="/:slug" element={<BlogDetail />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
