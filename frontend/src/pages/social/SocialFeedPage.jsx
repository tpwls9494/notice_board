import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'

import SocialPostRow from '../../components/social/SocialPostRow'
import { socialAPI } from '../../services/api'
import useAuthStore from '../../stores/authStore'
import { useSeo } from '../../utils/seo'

const SORTS = [['latest', '최신'], ['popular', '인기'], ['following', '팔로잉']]
const PAGE_SIZE = 20

export default function SocialFeedPage({ space = 'community' }) {
  const [params, setParams] = useSearchParams()
  const { token, user } = useAuthStore()
  const sort = SORTS.some(([value]) => value === params.get('sort')) ? params.get('sort') : 'latest'
  const requestedPage = Number(params.get('page') || 1)
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const isLounge = space === 'lounge'
  const basePath = isLounge ? '/lounge' : '/community'
  const needsLogin = sort === 'following' && !token
  const loginPath = '/?login=true&next=' + encodeURIComponent(basePath + '?' + params.toString())
  useSeo({ title: isLounge ? '라운지' : '커뮤니티', description: isLounge ? '가벼운 이야기와 친목을 나누는 공간' : 'AI와 개발 경험, 질문, 기술을 나누는 공간', url: basePath })
  const posts = useQuery({
    queryKey: ['social-posts', space, sort, page, user?.id || null],
    queryFn: () => socialAPI.getPosts({ space, sort, page, page_size: PAGE_SIZE }),
    enabled: !needsLogin,
  })
  const items = posts.data?.data?.items || []
  const total = posts.data?.data?.total || 0
  const updateParams = (values) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(values)) next.set(key, String(value))
    setParams(next)
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-950 sm:text-4xl">{isLounge ? '라운지' : '커뮤니티'}</h1>
          <p className="mt-2 text-sm leading-6 text-ink-500">{isLounge ? '일상과 가벼운 이야기를 편하게 나눠요.' : '써본 경험과 궁금한 점, 도움이 되는 팁을 나눠요.'}</p>
          {!isLounge && <Link to="/lounge" className="mt-2 inline-block py-1 text-xs text-ink-500 hover:text-accent-dark">라운지 글 모아보기 →</Link>}
        </div>
        <Link to={'/community/write?space=' + space} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark">글쓰기</Link>
      </header>
      <div className="mt-6 flex items-center justify-between gap-4 border-b border-ink-200 pb-3">
        <div className="flex gap-1" aria-label="글 정렬">{SORTS.map(([value, label]) => <button key={value} type="button" aria-pressed={sort === value} onClick={() => updateParams({ sort: value, page: 1 })} className={'rounded-md px-3 py-2 text-[13px] font-medium ' + (sort === value ? 'bg-accent-glow text-accent-dark' : 'text-ink-500 hover:bg-paper-200')}>{label}</button>)}</div>
        {!needsLogin && posts.isSuccess && <span className="text-xs text-ink-500">{total.toLocaleString('ko-KR')}개의 글</span>}
      </div>
      <div className="mt-4 rounded-xl border border-ink-200/80 bg-paper-50 px-5 sm:px-6">
        {needsLogin ? <Link to={loginPath} className="block py-12 text-center text-sm text-ink-600">로그인하고 팔로잉 글 보기</Link> : <>
          {posts.isPending && <div role="status" className="h-52 animate-pulse bg-paper-200/50"><span className="sr-only">글을 불러오는 중입니다.</span></div>}
          {posts.isError && <div role="alert" className="py-12 text-center text-sm text-ink-500">{sort === 'following' && posts.error?.response?.status === 401 ? <Link to={loginPath} className="text-accent-dark">로그인하고 팔로잉 글 보기</Link> : <><p>글을 불러오지 못했어요.</p><button type="button" onClick={() => posts.refetch()} className="mt-3 font-medium text-accent-dark">다시 시도</button></>}</div>}
          {posts.isSuccess && items.length === 0 && <div className="py-12 text-center text-sm text-ink-500"><p>{sort === 'following' ? '팔로우한 사람의 글이 아직 없습니다.' : '아직 글이 없습니다.'}</p>{page > 1 && <button type="button" onClick={() => updateParams({ page: 1 })} className="mt-3 text-accent-dark">첫 페이지로</button>}</div>}
          {!posts.isError && items.map((post) => <SocialPostRow key={post.id} post={post} />)}
        </>}
      </div>
      {!needsLogin && posts.isSuccess && total > PAGE_SIZE && <nav aria-label="글 목록 페이지" className="mt-5 flex items-center justify-between text-[13px] text-ink-600"><span>{page} / {Math.ceil(total / PAGE_SIZE)}</span><div className="flex gap-4"><button type="button" disabled={page === 1 || posts.isFetching} onClick={() => updateParams({ page: page - 1 })} className="disabled:opacity-30">이전</button><button type="button" disabled={page * PAGE_SIZE >= total || posts.isFetching} onClick={() => updateParams({ page: page + 1 })} className="disabled:opacity-30">다음</button></div></nav>}
    </div>
  )
}
