import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { blogAPI } from '../services/api'
import { applyBlogMetadata } from '../utils/seo'
import MermaidBlock from '../components/MermaidBlock'
import BlogDiscussion from '../components/BlogDiscussion'
import PostActionDialog from '../components/PostActionDialog'

function useTableOfContents(content) {
  return useMemo(() => {
    if (!content) return []
    const headingRegex = /^(#{2,3})\s+(.+)$/gm
    const headings = []
    let match
    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length
      const text = match[2].trim()
      const id = text
        .toLowerCase()
        .replace(/[^\w\s가-힣-]/g, '')
        .replace(/\s+/g, '-')
      headings.push({ id, text, level })
    }
    return headings
  }, [content])
}

function useActiveHeading(headings) {
  const [activeId, setActiveId] = useState('')

  useEffect(() => {
    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    )

    headings.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [headings])

  return activeId
}

function TableOfContents({ headings, activeId, mobile = false }) {
  if (headings.length < 3) return null

  const contents = (
      <nav className={mobile ? 'article-mobile-toc-links' : 'toc'} aria-label="이 글의 목차">
        {!mobile && <p className="toc-title">목차</p>}
        <ul className="toc-list">
          {headings.map((h) => (
            <li key={h.id} className="toc-item">
              <a
                href={`#${h.id}`}
                className={`toc-link ${activeId === h.id ? 'active' : ''}`}
                data-depth={h.level}
                onClick={(e) => {
                  e.preventDefault()
                  if (mobile) e.currentTarget.closest('details')?.removeAttribute('open')
                  requestAnimationFrame(() => document.getElementById(h.id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }))
                }}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
  )
  return mobile
    ? <details className="article-mobile-toc"><summary>이 글의 목차 <span>{headings.length}개 항목</span></summary>{contents}</details>
    : <aside className="hidden xl:block w-56 shrink-0">{contents}</aside>
}

function HeadingRenderer({ level, children }) {
  const text = typeof children === 'string'
    ? children
    : Array.isArray(children)
      ? children.map((c) => (typeof c === 'string' ? c : c?.props?.children || '')).join('')
      : ''
  const id = text
    .toLowerCase()
    .replace(/[^\w\s가-힣-]/g, '')
    .replace(/\s+/g, '-')
  const Tag = `h${level}`
  return <Tag id={id}>{children}</Tag>
}

export default function BlogDetail({ user }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const categoryFromList = searchParams.get('cat') || null
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [adjacentPosts, setAdjacentPosts] = useState({ prev: null, next: null })

  useEffect(() => {
    if (post) applyBlogMetadata({ post })
    else if (error) applyBlogMetadata({ privatePage: true, title: '기록을 찾을 수 없습니다 · jion.log' })
  }, [post, error])

  useEffect(() => {
    // Loading state intentionally resets when the route slug changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
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

  // Fetch adjacent posts — scoped to category tab if navigated from list, otherwise all posts
  useEffect(() => {
    if (!post) return
    const params = { page: 1, page_size: 50 }
    if (categoryFromList) params.tag = categoryFromList
    blogAPI
      .getPosts(params)
      .then((res) => {
        const allPosts = res.data.items || []
        const currentIndex = allPosts.findIndex((p) => p.slug === slug)
        if (currentIndex === -1) return
        setAdjacentPosts({
          prev: currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null,
          next: currentIndex > 0 ? allPosts[currentIndex - 1] : null,
        })
      })
      .catch(() => {})
  }, [post, slug, categoryFromList])

  const headings = useTableOfContents(post?.content)
  const activeHeadingId = useActiveHeading(headings)

  useEffect(() => {
    if (!post) return
    const frame = requestAnimationFrame(() => {
      if (window.location.hash === '#comments') document.getElementById('comments')?.scrollIntoView()
      else if (!window.location.hash) window.scrollTo(0, 0)
    })
    return () => cancelAnimationFrame(frame)
  }, [post])

  const formatDate = useCallback((dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-6 h-6 border-2 border-ink-200 border-t-ink-700 rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-24">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-paper-200 flex items-center justify-center">
          <svg className="w-7 h-7 text-ink-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-ink-500 mb-4 font-medium">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="text-sm text-ink-500 hover:text-ink-800 underline underline-offset-3 transition-colors"
        >
          목록으로 돌아가기
        </button>
      </div>
    )
  }

  if (!post) return null

  return (
    <div className="flex gap-10">
      {/* Main article */}
      <article className="min-w-0 flex-1">
        {/* Hero image */}
        {post.thumbnail_url && (
          <div className="article-hero">
            <img src={post.thumbnail_url} alt={post.title} />
          </div>
        )}

        {/* Header */}
        <header className="mb-10">
          {!post.is_published && <p className="mb-4 rounded-md bg-paper-100 px-3 py-2 text-xs text-ink-400">초안 미리보기 · 작성자에게만 보입니다.</p>}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 leading-tight tracking-tight">
              {post.title}
            </h1>
            {user?.can_write_blog === true && (
              <div className="flex items-center gap-2 shrink-0 mt-1">
                <Link
                  to={`/edit/${post.slug}`}
                  className="px-3 py-1.5 text-sm bg-ink-800 text-white rounded-lg no-underline hover:bg-ink-900 transition-colors"
                >
                  수정
                </Link>
                <button
                  onClick={() => setDeleteOpen(true)}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  삭제
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-ink-400 mt-3">
            <span>{formatDate(post.published_at || post.created_at)}</span>
            <span className="text-ink-200">&middot;</span>
            <span>조회 {post.views}</span>
          </div>
          {post.tags && (
            <div className="mt-4 flex gap-1.5 flex-wrap">
              {post.tags.split(',').map((t) => t.trim()).filter(Boolean).map((tag) => (
                <span key={tag} className="tag-chip">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        <TableOfContents headings={headings} activeId={activeHeadingId} mobile />

        {/* Content */}
        <div className="prose">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              table: ({ children }) => <div className="article-table-scroll" tabIndex={0} role="region" aria-label="표, 가로로 스크롤할 수 있습니다"><table>{children}</table></div>,
              h2: ({ children }) => <HeadingRenderer level={2}>{children}</HeadingRenderer>,
              h3: ({ children }) => <HeadingRenderer level={3}>{children}</HeadingRenderer>,
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '')
                const lang = match?.[1] || ''
                if (lang === 'mermaid') {
                  return <MermaidBlock code={String(children).replace(/\n$/, '')} />
                }
                return <code className={className} {...props}>{children}</code>
              },
            }}
          >
            {post.content}
          </ReactMarkdown>
        </div>

        {post.is_published && <BlogDiscussion key={post.id} postId={post.id} user={user} slug={post.slug} />}

        {/* Post navigation */}
        <div className="mt-16 pt-8 border-t border-ink-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {adjacentPosts.prev ? (
              <Link to={`/${adjacentPosts.prev.slug}${categoryFromList ? `?cat=${categoryFromList}` : ''}`} className="post-nav-card group">
                <svg className="w-4 h-4 text-ink-300 shrink-0 group-hover:text-ink-500 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                <div className="min-w-0">
                  <p className="post-nav-label">이전 글</p>
                  <p className="post-nav-title">{adjacentPosts.prev.title}</p>
                </div>
              </Link>
            ) : (
              <div />
            )}
            {adjacentPosts.next ? (
              <Link to={`/${adjacentPosts.next.slug}${categoryFromList ? `?cat=${categoryFromList}` : ''}`} className="post-nav-card group justify-end text-right">
                <div className="min-w-0">
                  <p className="post-nav-label">다음 글</p>
                  <p className="post-nav-title">{adjacentPosts.next.title}</p>
                </div>
                <svg className="w-4 h-4 text-ink-300 shrink-0 group-hover:text-ink-500 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ) : (
              <div />
            )}
          </div>

          <div className="mt-6 text-center">
            <Link to={categoryFromList ? `/?category=${categoryFromList}` : '/'} className="inline-flex items-center gap-2 text-sm text-ink-400 hover:text-ink-700 no-underline transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              전체 목록 보기
            </Link>
          </div>
        </div>
      </article>

      {/* Table of Contents sidebar */}
      <TableOfContents headings={headings} activeId={activeHeadingId} />
      {deleteOpen && <PostActionDialog post={post} onClose={() => setDeleteOpen(false)} onComplete={() => navigate('/admin/posts')} />}
    </div>
  )
}
