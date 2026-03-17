import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { blogAPI } from '../services/api'

export default function BlogList() {
  const [searchParams] = useSearchParams()
  const category = searchParams.get('category') || 'all'

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 6

  useEffect(() => {
    setPage(1)
  }, [category])

  useEffect(() => {
    setLoading(true)
    const params = { page, page_size: pageSize }
    if (category !== 'all') {
      params.tag = category
    }
    blogAPI
      .getPosts(params)
      .then((res) => {
        setPosts(res.data.items)
        setTotal(res.data.total)
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [page, category])

  const totalPages = Math.ceil(total / pageSize)

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div>
      {/* Hero Section — flush to top */}
      <section className="hero-section mb-12 -mt-8">
        <div className="hero-content">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Jion Blog
          </h1>
          <p className="text-base md:text-lg text-white/60 max-w-md">
            개발, AI, 그리고 일상에 대한 생각을 기록합니다.
          </p>
        </div>
      </section>

      {/* Posts */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-ink-300 border-t-ink-800 rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-ink-400">
          <p className="text-lg">아직 작성된 글이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post) => (
            <article key={post.id} className="blog-card group">
              <Link to={`/${post.slug}`} className="block no-underline">
                <div className="aspect-[16/9] overflow-hidden">
                  {post.thumbnail_url ? (
                    <img
                      src={post.thumbnail_url}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full card-placeholder flex items-center justify-center">
                      <span className="text-4xl font-bold text-white/20">
                        {post.title.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  {post.tags && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {post.tags
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean)
                        .map((tag) => (
                          <span
                            key={tag}
                            className="inline-block bg-paper-200 text-ink-500 rounded px-2 py-0.5 text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                    </div>
                  )}
                  <h2 className="text-base font-bold text-ink-900 group-hover:text-blue-600 transition-colors mb-1.5 line-clamp-2">
                    {post.title}
                  </h2>
                  {post.summary && (
                    <p className="text-ink-400 text-sm mb-3 line-clamp-2">
                      {post.summary}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-ink-300">
                    <span>
                      {formatDate(post.published_at || post.created_at)}
                    </span>
                    <span>&middot;</span>
                    <span>조회 {post.views}</span>
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-1 mt-14">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-sm text-ink-500 hover:bg-paper-200 disabled:opacity-30 transition-colors"
          >
            &larr;
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm transition-colors ${
                p === page
                  ? 'bg-ink-800 text-white'
                  : 'text-ink-500 hover:bg-paper-200'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-sm text-ink-500 hover:bg-paper-200 disabled:opacity-30 transition-colors"
          >
            &rarr;
          </button>
        </div>
      )}
    </div>
  )
}
