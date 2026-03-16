import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { blogAPI } from '../services/api'

export default function BlogDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    blogAPI
      .getPost(slug)
      .then((res) => setPost(res.data))
      .catch((err) => {
        if (err.response?.status === 404) {
          setError('글을 찾을 수 없습니다.')
        } else {
          setError('오류가 발생했습니다.')
        }
      })
      .finally(() => setLoading(false))
  }, [slug])

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-ink-300 border-t-ink-800 rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-500 mb-4">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="text-sm text-blue-600 underline"
        >
          목록으로 돌아가기
        </button>
      </div>
    )
  }

  if (!post) return null

  return (
    <article>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-ink-900 mb-3">{post.title}</h1>
        <div className="flex items-center gap-3 text-sm text-ink-400">
          <span>{post.author?.username}</span>
          <span>&middot;</span>
          <span>{formatDate(post.published_at || post.created_at)}</span>
          <span>&middot;</span>
          <span>조회 {post.views}</span>
        </div>
        {post.tags && (
          <div className="mt-3 flex gap-1.5 flex-wrap">
            {post.tags.split(',').map((t) => t.trim()).filter(Boolean).map((tag) => (
              <span
                key={tag}
                className="text-xs bg-paper-200 text-ink-600 rounded px-2 py-0.5"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {post.thumbnail_url && (
        <img
          src={post.thumbnail_url}
          alt={post.title}
          className="w-full rounded-lg mb-8"
        />
      )}

      <div className="prose">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
        >
          {post.content}
        </ReactMarkdown>
      </div>

      <div className="mt-12 pt-6 border-t border-ink-100">
        <Link to="/" className="text-sm text-ink-500 hover:text-ink-800 no-underline">
          &larr; 목록으로 돌아가기
        </Link>
      </div>
    </article>
  )
}
