import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import BlogList from './pages/BlogList'
import BlogDetail from './pages/BlogDetail'
import BlogEditor from './pages/BlogEditor'

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <Routes>
          <Route path="/" element={<BlogList />} />
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
