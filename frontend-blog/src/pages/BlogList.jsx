import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { blogAPI } from '../services/api'

export default function BlogList() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10

  useEffect(() => {
    setLoading(true)
    blogAPI
      .getPosts({ page, page_size: pageSize })
      .then((res) => {
        setPosts(res.data.items)
        setTotal(res.data.total)
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [page])

  const totalPages = Math.ceil(total / pageSize)

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

  if (posts.length === 0) {
    return (
      <div className="text-center py-20 text-ink-400">
        <p className="text-lg">아직 작성된 글이 없습니다.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="space-y-10">
        {posts.map((post) => (
          <article key={post.id}>
            <Link
              to={`/${post.slug}`}
              className="block group no-underline"
            >
              {post.thumbnail_url && (
                <img
                  src={post.thumbnail_url}
                  alt={post.title}
                  className="w-full h-48 object-cover rounded-lg mb-3"
                />
              )}
              <h2 className="text-xl font-bold text-ink-900 group-hover:text-blue-600 transition-colors mb-1">
                {post.title}
              </h2>
              {post.summary && (
                <p className="text-ink-500 text-sm mb-2 line-clamp-2">
                  {post.summary}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs text-ink-400">
                <span>{formatDate(post.published_at || post.created_at)}</span>
                <span>&middot;</span>
                <span>조회 {post.views}</span>
                {post.tags && (
                  <>
                    <span>&middot;</span>
                    <span>
                      {post.tags.split(',').map((t) => t.trim()).filter(Boolean).map((tag) => (
                        <span
                          key={tag}
                          className="inline-block bg-paper-200 rounded px-1.5 py-0.5 mr-1"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  </>
                )}
              </div>
            </Link>
          </article>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-12">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded border border-ink-100 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-3 py-1.5 text-sm text-ink-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm rounded border border-ink-100 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
