import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { blogAPI } from '../services/api'
import PostActionDialog from '../components/PostActionDialog'
import './ManagePosts.css'

const pageSize = 10
const statuses = [['all', '전체'], ['published', '발행'], ['draft', '초안']]

export default function ManagePosts() {
  const [params, setParams] = useSearchParams()
  const status = statuses.some(([value]) => value === params.get('status')) ? params.get('status') : 'all'
  const search = params.get('search') || ''
  const rawPage = Number(params.get('page'))
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const [result, setResult] = useState({ items: [], total: 0, counts: {}, key: '', error: false })
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [action, setAction] = useState(null)
  const requestKey = JSON.stringify([page, status, search, revision])
  const loading = result.key !== requestKey
  const error = !loading && result.error

  useEffect(() => {
    let active = true
    blogAPI.getManagedPosts({ page, page_size: pageSize, status, ...(search ? { search } : {}) })
      .then(({ data }) => {
        if (!active) return
        const lastPage = Math.max(1, Math.ceil(data.total / pageSize))
        if (page > lastPage) {
          setParams(previous => { const next = new URLSearchParams(previous); if (lastPage === 1) next.delete('page'); else next.set('page', String(lastPage)); return next }, { replace: true })
          return
        }
        setResult({ ...data, key: requestKey, error: false })
      })
      .catch(() => { if (active) setResult(previous => ({ ...previous, key: requestKey, error: true })) })
    return () => { active = false }
  }, [page, status, search, requestKey, setParams])

  function changeQuery(values) {
    const next = new URLSearchParams(params)
    next.delete('page')
    for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key) }
    setParams(next)
  }
  function movePage(value) {
    const next = new URLSearchParams(params)
    if (value === 1) next.delete('page'); else next.set('page', String(value))
    setParams(next)
  }
  const totalPages = Math.ceil(result.total / pageSize)
  return <div className="manage-posts">
    <div className="manage-heading"><div><p className="journal-eyebrow">나의 기록</p><h1>기록 관리</h1><p>발행한 글과 작성 중인 초안을 한곳에서 관리하세요.</p></div><Link className="manage-create" to="/write">+ 새 기록 쓰기</Link></div>
    <div className="manage-filters"><nav aria-label="발행 상태">{statuses.map(([value, label]) => <button type="button" key={value} aria-pressed={status === value} onClick={() => changeQuery({ status: value === 'all' ? '' : value })}>{label}<span>{result.counts[value === 'all' ? 'total' : value] ?? '—'}</span></button>)}</nav><Search key={search} value={search} onSearch={value => changeQuery({ search: value })} /></div>
    {notice && <p className="manage-notice" role="status">{notice}</p>}
    <div className="manage-list-heading"><span>{search ? `“${search}” 검색 결과` : '기록 목록'} {!loading && !error && `${result.total}개`}</span><span>최근 수정순</span></div>
    {loading ? <p className="journal-state" role="status">기록을 불러오고 있습니다.</p> : error ? <div className="journal-state" role="alert"><p>기록을 불러오지 못했습니다.</p><button onClick={() => setRevision(n => n + 1)}>다시 불러오기</button></div> : result.items.length === 0 ? <div className="journal-state"><h2>{search ? '검색한 기록이 없습니다.' : status === 'draft' ? '보관 중인 초안이 없습니다.' : '아직 기록이 없습니다.'}</h2><p>{search ? '다른 제목이나 키워드로 검색해 보세요.' : '새 기록을 쓰고 초안으로 저장하거나 발행해 보세요.'}</p>{search && <button onClick={() => changeQuery({ search: '' })}>검색 초기화</button>}</div> : <div className="manage-list">
      {result.items.map(post => <article key={post.id} className="manage-record" data-post-id={post.id}>
        <div className="manage-record-main"><div className="manage-record-meta"><span className={`manage-status ${post.is_published ? 'is-published' : ''}`}>{post.is_published ? '발행됨' : '초안'}</span>{post.tags && <span>{post.tags}</span>}</div><h2><Link to={`/edit/${post.slug}`}>{post.title}</Link></h2><p>{new Date(post.updated_at || post.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 수정 · 조회 {post.views.toLocaleString()}</p></div>
        <div className="manage-record-actions"><Link to={`/${post.slug}`}>{post.is_published ? '보기' : '미리보기'}</Link><Link className="manage-edit" to={`/edit/${post.slug}`}>{post.is_published ? '수정' : '이어서 쓰기'}</Link>{post.is_published && <button onClick={() => setAction({ kind: 'unpublish', post })}>비공개 전환</button>}<button className="manage-delete" onClick={() => setAction({ kind: 'delete', post })}>삭제</button></div>
      </article>)}
    </div>}
    {!loading && !error && totalPages > 1 && <nav className="journal-pagination" aria-label="관리 목록 페이지"><button disabled={page === 1} onClick={() => movePage(page - 1)}>← 이전</button><span>{page} / {totalPages}</span><button disabled={page >= totalPages} onClick={() => movePage(page + 1)}>다음 →</button></nav>}
    {action && <PostActionDialog key={`${action.kind}:${action.post.id}`} post={action.post} action={action.kind} onClose={() => setAction(null)} onComplete={(kind, post) => { setAction(null); setNotice(`“${post.title}” ${kind === 'delete' ? '기록을 삭제했습니다.' : '기록을 초안으로 보관했습니다.'}`); setRevision(n => n + 1) }} />}
  </div>
}

function Search({ value, onSearch }) {
  const [text, setText] = useState(value)
  return <form className="manage-search" role="search" onSubmit={event => { event.preventDefault(); onSearch(text.trim()) }}><input aria-label="관리할 기록 검색" type="search" maxLength={255} value={text} onChange={event => setText(event.target.value)} placeholder="제목이나 설명으로 찾기" />{value && <button type="button" onClick={() => onSearch('')}>초기화</button>}<button type="submit">검색</button></form>
}
