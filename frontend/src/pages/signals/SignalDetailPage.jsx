import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { formatRelativeTime } from '../../components/signals/EditorialSignal'
import RelatedExperiences from '../../components/signals/RelatedExperiences'
import SignalBody from '../../components/signals/SignalBody'
import ThreadComment from '../../components/social/ThreadComment'
import { signalsAPI } from '../../services/api'
import useAuthStore from '../../stores/authStore'
import { useSeo } from '../../utils/seo'
import { signalPublicationDate, formatSourceDate } from '../../utils/signalDates'

const KIND_LABEL = { release: 'AI 소식', workflow: 'AI 활용법', research: '논문' }
const VERIFY_LABEL = { official: '공식 출처', cross_checked: '여러 출처 확인', community: '커뮤니티에서 화제', unverified: '확인 전' }

function referenceKey(value) {
  try {
    const url = new URL(value)
    url.hash = ''
    return url.href.replace(/\/$/, '')
  } catch { return value }
}

export default function SignalDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { token, user } = useAuthStore()
  const [comment, setComment] = useState('')
  useEffect(() => { setComment('') }, [slug])
  const signalQuery = useQuery({ queryKey: ['signal', slug], queryFn: () => signalsAPI.getSignal(slug) })
  const commentsQuery = useQuery({ queryKey: ['signal-comments', slug], queryFn: () => signalsAPI.getComments(slug), enabled: Boolean(signalQuery.data) })
  const signal = signalQuery.data?.data
  const loginPath = '/?login=true&next=' + encodeURIComponent('/signals/' + slug)
  useSeo({ title: signal?.title || 'AI 정보', description: signal?.summary, url: '/signals/' + slug, type: 'article' })

  const refreshComments = () => {
    queryClient.invalidateQueries({ queryKey: ['home-feed'] })
    queryClient.invalidateQueries({ queryKey: ['today-signals'] })
    queryClient.invalidateQueries({ queryKey: ['signal-comments', slug] })
    queryClient.invalidateQueries({ queryKey: ['signal', slug] })
  }
  const createComment = useMutation({
    mutationFn: () => signalsAPI.createComment(slug, { content: comment.trim() }),
    onSuccess: () => { setComment(''); refreshComments(); toast.success('댓글을 남겼습니다.') },
    onError: (error) => toast.error(error.response?.data?.detail || '댓글을 등록하지 못했습니다.'),
  })
  const recommend = useMutation({
    mutationFn: () => signal.is_recommended ? signalsAPI.unrecommendSignal(slug) : signalsAPI.recommendSignal(slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signal', slug] })
      queryClient.invalidateQueries({ queryKey: ['home-feed'] })
      queryClient.invalidateQueries({ queryKey: ['today-signals'] })
    },
    onError: (error) => toast.error(error.response?.data?.detail || '추천을 반영하지 못했습니다.'),
  })

  if (signalQuery.isPending) return <div role="status" className="h-96 animate-pulse rounded-xl bg-paper-200"><span className="sr-only">소식을 불러오는 중입니다.</span></div>
  if (signalQuery.isError || !signal) return <div className="py-20 text-center"><h1 className="text-2xl font-semibold">{signalQuery.error?.response?.status === 404 ? '소식을 찾을 수 없습니다.' : '소식을 불러오지 못했습니다.'}</h1><div className="mt-5 flex justify-center gap-5 text-sm"><Link to="/" className="text-accent-dark">오늘의 발견으로 돌아가기</Link><button type="button" onClick={() => signalQuery.refetch()} className="text-ink-600">다시 시도</button></div></div>
  const comments = commentsQuery.data?.data || []
  const roots = comments.filter((item) => !item.parent_id)
  const repliesByParent = comments.reduce((result, item) => { if (item.parent_id) (result[item.parent_id] ||= []).push(item); return result }, {})
  const commentCount = comments.filter((item) => !item.is_deleted && !item.is_hidden).length
  const backPath = signal.content_kind === 'research' ? '/papers' : signal.content_kind === 'workflow' ? '/how-to' : '/'
  const references = [...new Map((signal.evidence || [])
    .filter((url) => referenceKey(url) !== referenceKey(signal.source_url))
    .map((url) => [referenceKey(url), url])).values()]

  return (
    <div className="mx-auto max-w-[800px]">
      <Link to={backPath} className="text-[13px] font-medium text-ink-500 hover:text-accent-dark">← {KIND_LABEL[signal.content_kind]}</Link>
        <article className="mt-6 min-w-0 sm:mt-8">
          <header>
            <h1 className="break-keep text-[28px] font-semibold leading-[1.35] tracking-[-0.025em] text-ink-950 [overflow-wrap:anywhere] sm:text-[36px]">{signal.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] leading-5 text-ink-500">
              <span className="font-medium text-ink-600">{signal.source_name}</span>
              <span>{VERIFY_LABEL[signal.verification_level]}</span>
              <span>게시 {formatRelativeTime(signalPublicationDate(signal))}</span>
              {signal.source_published_at && <span>원문 공개 {formatSourceDate(signal.source_published_at)}</span>}
            </div>
          </header>

          <section id="summary" aria-label="요약" className="mt-6 border-t border-ink-200/80 pt-6">
            <p className="whitespace-pre-line break-words text-base leading-8 text-ink-700">{signal.summary}</p>
            {signal.image_url && <img src={signal.image_url} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} className="mt-5 max-h-72 w-full rounded-lg object-contain" />}
          </section>

          {signal.body?.trim() && <section id="article-body" aria-label="본문" className="mt-7"><SignalBody body={signal.body} /></section>}

          {!signal.body?.trim() && signal.why_it_matters?.trim() && <section className="mt-7">
            <h2 className="text-lg font-semibold">활용 포인트</h2>
            <p className="mt-2 whitespace-pre-line break-words text-[15px] leading-8 text-ink-700">{signal.why_it_matters}</p>
          </section>}

          {signal.try_this?.trim() && <section id="try-it" className="mt-7">
            <h2 className="text-lg font-semibold">직접 해보기</h2>
            <p className="mt-2 whitespace-pre-line break-words text-[15px] leading-8 text-ink-700">{signal.try_this}</p>
          </section>}

          {references.length > 0 && <section className="mt-7"><h2 className="text-sm font-medium text-ink-500">참고 자료</h2><ul className="mt-2 space-y-2">{references.map((url) => <li key={url}><a href={url} target="_blank" rel="noreferrer" className="break-all text-[13px] leading-6 text-ink-600 underline decoration-ink-300 underline-offset-4 hover:text-accent-dark">{url}</a></li>)}</ul></section>}

          <section id="source" aria-label="원문 자료" className="mt-8 border-t border-ink-200 pt-3">
            <a href={signal.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 max-w-full items-center gap-2 py-2 text-sm leading-6 text-ink-600 underline decoration-ink-300 underline-offset-4 hover:text-accent-dark"><span className="min-w-0 break-words [overflow-wrap:anywhere]">{signal.original_title?.trim() || `${signal.source_name} 원문`}</span><span aria-hidden="true" className="shrink-0">↗</span><span className="sr-only"> (새 탭)</span></a>
          </section>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
            <button type="button" aria-pressed={Boolean(signal.is_recommended)} disabled={recommend.isPending} onClick={() => token ? recommend.mutate() : navigate(loginPath)} className={'rounded-lg border px-3 py-2 text-[13px] font-medium disabled:opacity-40 ' + (signal.is_recommended ? 'border-accent/30 bg-accent-glow text-accent-dark' : 'border-ink-200 text-ink-600 hover:border-ink-400')}>추천 {signal.recommendation_count || 0}</button>
            {signal.tags?.length > 0 && <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-500">{signal.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
          </div>

          <div className="mt-8"><RelatedExperiences key={signal.id} signal={signal} /></div>

          <section id="discussion" className="mt-8 scroll-mt-36 border-t border-ink-200 pt-6 md:scroll-mt-24">
            <h2 className="text-lg font-semibold">댓글 <span className="ml-1 text-sm font-normal text-ink-500">{commentCount}</span></h2>
            {token ? <form onSubmit={(event) => { event.preventDefault(); if (comment.trim() && !createComment.isPending) createComment.mutate() }} className="mt-5">
              <label htmlFor="signal-comment" className="sr-only">댓글 내용</label>
              <textarea id="signal-comment" value={comment} maxLength={5000} onChange={(event) => setComment(event.target.value)} placeholder="댓글을 남겨주세요." rows={3} className="w-full min-w-0 resize-y rounded-lg border border-ink-200 bg-paper-50 p-3 text-sm leading-7 outline-none focus:border-accent" />
              <div className="mt-2 flex justify-end"><button disabled={!comment.trim() || createComment.isPending} className="rounded-lg bg-ink-950 px-5 py-2.5 text-xs font-semibold text-paper-50 disabled:opacity-40">{createComment.isPending ? '등록 중' : '댓글 등록'}</button></div>
            </form> : <Link to={loginPath} className="mt-5 block rounded-lg bg-paper-200 py-4 text-center text-sm text-ink-600">로그인하고 댓글 남기기</Link>}
            {commentsQuery.isPending && <p role="status" className="py-5 text-sm text-ink-500">댓글을 불러오는 중입니다.</p>}
            {commentsQuery.isError && <p role="alert" className="py-5 text-sm text-ink-500">댓글을 불러오지 못했어요. <button type="button" onClick={() => commentsQuery.refetch()} className="text-accent-dark">다시 시도</button></p>}
            {!commentsQuery.isError && <div className="mt-4">{roots.map((item) => <ThreadComment key={item.id} item={item} replies={repliesByParent[item.id] || []} user={user} loginPath={loginPath} refresh={refreshComments} onReply={(parentId, content) => signalsAPI.createComment(slug, { content, parent_id: parentId })} onEdit={(id, content) => signalsAPI.updateComment(id, { content })} onDelete={signalsAPI.deleteComment} onModerate={signalsAPI.moderateComment} />)}</div>}
          </section>
        </article>

    </div>
  )
}
