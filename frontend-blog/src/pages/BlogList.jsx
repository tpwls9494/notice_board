import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { blogAPI } from '../services/api'
import useBlogActivity from '../hooks/useBlogActivity'
import ActivityCounts from '../components/ActivityCounts'
import BlogProfileAvatar from '../components/BlogProfileAvatar'

const pageSize = 8
const formatDate = (value) => new Date(value).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })

export default function BlogList({ user }) {
  const [params, setParams] = useSearchParams()
  const category = params.get('category') || ''
  const search = params.get('search') || ''
  const rawPage = Number(params.get('page'))
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const [categories, setCategories] = useState([])
  const [categoryError, setCategoryError] = useState(false)
  useEffect(() => {
    let active = true
    blogAPI.getCategories().then(({ data }) => { if (active) setCategories(data) })
      .catch(() => { if (active) setCategoryError(true) })
    return () => { active = false }
  }, [])
  function navigateList(values) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, String(value))
      else next.delete(key)
    }
    setParams(next)
  }
  return (
    <div className="journal-grid">
      <aside className="journal-sidebar">
        <div className="journal-profile">
          <BlogProfileAvatar canEdit={user?.can_write_blog === true} />
          <p className="journal-eyebrow">JION’S DEV JOURNAL</p>
          <h1>배우고, 만들고, <br />기록합니다<span>.</span></h1>
          <p className="journal-bio">직접 부딪히며 이해한 것들. <br />AI와 개발, 그 사이의 생각을<br /> 차곡차곡 남깁니다.</p>
        </div>
        <nav className="journal-topics" aria-label="글 주제">
          <p className="journal-eyebrow">주제별로 보기</p>
          <Link to={search ? `/?${new URLSearchParams({ search })}` : '/'} aria-current={!category ? 'page' : undefined}><span>모든 기록</span><span aria-hidden="true">↗</span></Link>
          {categories.map((item) => <Link key={item.id} to={`/?${new URLSearchParams({ ...(search ? { search } : {}), category: item.name })}`} aria-current={category === item.name ? 'page' : undefined}><span>{item.name}</span><span aria-hidden="true">↗</span></Link>)}
          {categoryError && <p className="journal-category-error">주제 목록을 불러오지 못했습니다.</p>}
        </nav>
        <div className="journal-now"><p className="journal-eyebrow"><span className="journal-status-dot" /> 지금 탐구하는 것</p><p>Small Language Models</p><span>논문을 읽고, 코드로 옮기는 중.</span></div>
      </aside>
      <section className="journal-archive" aria-label="글 목록">
        <div className="journal-archive-heading"><div><p className="journal-eyebrow">개발 노트</p><h2>{category || '모든 기록'}<span className="journal-heading-dot">.</span></h2></div><span className="journal-archive-note">한 편씩 쌓아가는 이해</span></div>
        <SearchForm key={search} search={search} onSearch={(value) => navigateList({ search: value, page: '' })} />
        <PostResults key={`${category}:${search}:${page}`} category={category} search={search} page={page} onPage={(value) => navigateList({ page: value === 1 ? '' : value })} onReset={() => setParams({})} />
      </section>
    </div>
  )
}
function SearchForm({ search, onSearch }) {
  const [value, setValue] = useState(search)
  return <form className="journal-search" role="search" onSubmit={(event) => { event.preventDefault(); onSearch(value.trim()) }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
    <input aria-label="글 검색" type="search" value={value} onChange={(event) => setValue(event.target.value)} placeholder="궁금한 주제나 키워드를 찾아보세요" />
    {search && <button type="button" onClick={() => { setValue(''); onSearch('') }}>초기화</button>}
    <button type="submit">검색 <span aria-hidden="true">↵</span></button>
  </form>
}
function PostResults({ category, search, page, onPage, onReset }) {
  const [result, setResult] = useState({ status: 'loading', posts: [], total: 0 })
  const [attempt, setAttempt] = useState(0)
  const activity = useBlogActivity(result.posts.map((post) => post.id))
  useEffect(() => {
    let active = true
    blogAPI.getPosts({ page, page_size: pageSize, ...(category ? { tag: category } : {}), ...(search ? { search } : {}) })
      .then(({ data }) => { if (active) setResult({ status: 'success', posts: data.items, total: data.total }) })
      .catch(() => { if (active) setResult({ status: 'error', posts: [], total: 0 }) })
    return () => { active = false }
  }, [category, search, page, attempt])
  if (result.status === 'loading') return <div className="journal-state" role="status"><span className="journal-loading-dot" />기록을 불러오고 있습니다.</div>
  if (result.status === 'error') return <div className="journal-state" role="alert"><h3>기록을 불러오지 못했습니다.</h3><p>잠시 후 다시 시도해 주세요.</p><button onClick={() => { setResult({ status: 'loading', posts: [], total: 0 }); setAttempt((n) => n + 1) }}>다시 불러오기 ↗</button></div>
  const totalPages = Math.ceil(result.total / pageSize)
  return <>
    <div className="journal-list-meta"><span>{search ? `“${search}” 검색 결과` : '기록 목록'} <strong>{result.total}</strong></span><span>최신순</span></div>
    {!result.posts.length ? <div className="journal-state"><span className="journal-empty-symbol" aria-hidden="true">↳</span><h3>{search || category ? '일치하는 기록이 없습니다.' : '첫 번째 기록을 준비하고 있습니다.'}</h3><p>{search || category ? '다른 키워드나 주제로 찾아보세요.' : '직접 배우고 만들어 본 이야기로 채워갈게요.'}</p>{(search || category || page > 1) && <button onClick={onReset}>모든 기록 보기 ↗</button>}</div> : <div className="journal-posts">
      {result.posts.map((post, index) => {
        const first = index === 0 && page === 1 && !search && !category
        const href = `/${post.slug}${category ? `?${new URLSearchParams({ cat: category })}` : ''}`
        return <article className={`journal-post ${first ? 'journal-post-latest' : ''}`} key={post.id}>
          {post.thumbnail_url && <PostThumbnail key={post.thumbnail_url} src={post.thumbnail_url} href={href} title={post.title} />}
          <Link className="journal-post-link" to={href}>
            <div className="journal-post-copy">
              <div className="journal-post-meta">{first && <span className="journal-latest-label">최근 기록</span>}<span>{post.tags?.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 2).join(' / ') || '기록'}</span></div>
              <h3>{post.title}</h3>
              {post.summary && <p className="journal-post-summary">{post.summary}</p>}
            </div>
          </Link>
          <div className="journal-post-footer"><time dateTime={post.published_at || post.created_at}>{formatDate(post.published_at || post.created_at)}</time><Link to={`${href}#comments`} aria-label={`${post.title} 반응 보기`}><ActivityCounts activity={activity.data[post.id]} views={post.views} stale={activity.stale} showLabels /></Link></div>
        </article>
      })}
    </div>}
    {totalPages > 1 && <nav className="journal-pagination" aria-label="글 목록 페이지"><button disabled={page === 1} onClick={() => onPage(page - 1)}>← 이전</button><span><strong>{page}</strong> / {totalPages}</span><button disabled={page >= totalPages} onClick={() => onPage(page + 1)}>다음 →</button></nav>}
    <p className="journal-endnote">배운 것이 흩어지지 않도록, 여기에.</p>
  </>
}

function PostThumbnail({ src, href, title }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return <Link className="journal-post-media" to={href} aria-label={`${title} 읽기`}><img className="journal-post-image" src={src} alt="" loading="lazy" onError={() => setFailed(true)} /></Link>
}
