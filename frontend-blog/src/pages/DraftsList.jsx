import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { blogAPI, authAPI } from '../services/api'

export default function DraftsList() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10

  useEffect(() => {
    authAPI
      .getMe()
      .then((res) => {
        if (res.data?.can_write_blog !== true) {
          navigate('/')
          return
        }
        setUser(res.data)
      })
      .catch(() => navigate('/login'))
  }, [navigate])

  useEffect(() => {
    if (user?.can_write_blog !== true) return
    // Loading state intentionally resets for each authenticated draft request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    blogAPI
      .getDrafts({ page, page_size: pageSize })
      .then((res) => {
        setPosts(res.data.items)
        setTotal(res.data.total)
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [page, user])

  const totalPages = Math.ceil(total / pageSize)

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (user?.can_write_blog !== true) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-bold text-ink-900">초안 관리</h1>
        <span className="text-sm text-ink-400">{total}개의 글</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-6 h-6 border-2 border-ink-200 border-t-ink-700 rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-24 text-ink-400">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-paper-200 flex items-center justify-center">
            <svg className="w-6 h-6 text-ink-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m3 0H9.75m0 0V18m-6-13.5V21a.75.75 0 00.75.75h10.5a.75.75 0 00.75-.75V6.108c0-.29-.168-.554-.432-.653a11.91 11.91 0 00-3.209-.508" />
            </svg>
          </div>
          <p className="text-base font-medium text-ink-500">초안이 없습니다</p>
          <p className="text-sm text-ink-300 mt-1">글 작성 시 발행하지 않으면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <article
              key={post.id}
              className="flex items-center gap-4 p-4 rounded-xl border border-ink-100 hover:border-ink-200 bg-white hover:shadow-sm transition-all"
            >
              {post.thumbnail_url ? (
                <img
                  src={post.thumbnail_url}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-ink-800 to-ink-900 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-white/20">{post.title.charAt(0)}</span>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-md ${
                    post.is_published
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-amber-50 text-amber-600'
                  }`}>
                    {post.is_published ? '발행됨' : '초안'}
                  </span>
                  {post.tags && (
                    <span className="text-xs text-ink-300 truncate">
                      {post.tags}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-ink-800 truncate">{post.title}</h3>
                <p className="text-xs text-ink-400 mt-0.5">
                  {formatDate(post.created_at)}
                </p>
              </div>

              <Link
                to={`/edit/${post.slug}`}
                className="px-3.5 py-1.5 text-sm font-medium text-ink-600 bg-paper-100 hover:bg-paper-200 rounded-lg no-underline transition-colors flex-shrink-0"
              >
                수정
              </Link>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-1.5 mt-10">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-sm text-ink-400 hover:bg-paper-200 disabled:opacity-25 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 ${
                p === page
                  ? 'bg-ink-900 text-white shadow-sm'
                  : 'text-ink-400 hover:bg-paper-200 hover:text-ink-700'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-sm text-ink-400 hover:bg-paper-200 disabled:opacity-25 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
