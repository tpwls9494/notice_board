import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { followsAPI, socialAPI } from '../../services/api'
import useAuthStore from '../../stores/authStore'
import { formatRelativeTime } from '../../components/signals/EditorialSignal'
import { useSeo } from '../../utils/seo'
import ThreadComment from '../../components/social/ThreadComment'

const TOPICS = { story: '이야기', question: '질문', experience: '사용 후기', tip: '팁', chat: '잡담' }
const textAreaClass = 'w-full min-w-0 resize-y rounded-lg border border-ink-200 bg-paper-50 p-3 text-sm leading-7 outline-none focus:border-accent'


export default function SocialPostDetailPage() {
  const { postId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { token, user } = useAuthStore()
  const [comment, setComment] = useState('')
  useEffect(() => setComment(''), [postId])
  const postQuery = useQuery({ queryKey: ['social-post', postId], queryFn: () => socialAPI.getPost(postId) })
  const commentsQuery = useQuery({ queryKey: ['social-comments', postId], queryFn: () => socialAPI.getComments(postId), enabled: Boolean(postQuery.data) })
  const post = postQuery.data?.data
  const loginPath = '/?login=true&next=' + encodeURIComponent('/community/' + postId)
  useSeo({ title: post?.title || '커뮤니티', description: post?.content?.slice(0, 150), url: '/community/' + postId })
  const follow = useQuery({ queryKey: ['follow-status', post?.user_id, user?.id], queryFn: () => followsAPI.getFollowStatus(post.user_id), enabled: Boolean(token && post && user?.id !== post.user_id) })
  const refreshPost = () => queryClient.invalidateQueries({ queryKey: ['social-post', postId] })
  const refreshComments = () => { queryClient.invalidateQueries({ queryKey: ['social-comments', postId] }); refreshPost() }
  const postAction = useMutation({
    mutationFn: async (type) => {
      if (type === 'delete') return socialAPI.deletePost(postId)
      if (type === 'follow') return follow.data?.data?.is_following ? followsAPI.unfollowUser(post.user_id) : followsAPI.followUser(post.user_id)
      return post.is_recommended ? socialAPI.unrecommendPost(postId) : socialAPI.recommendPost(postId)
    },
    onSuccess: (_, type) => {
      if (type === 'follow') { queryClient.invalidateQueries({ queryKey: ['follow-status', post.user_id] }); queryClient.invalidateQueries({ queryKey: ['social-posts'] }); return }
      for (const key of ['social-posts', 'community-preview', 'signal-experiences', 'site-activity']) queryClient.invalidateQueries({ queryKey: [key] })
      if (type === 'delete') navigate(post.space === 'lounge' ? '/lounge' : '/community')
      else refreshPost()
    },
    onError: (error) => toast.error(error.response?.data?.detail || '요청을 처리하지 못했습니다.'),
  })
  const createComment = useMutation({
    mutationFn: () => socialAPI.createComment(postId, { content: comment.trim() }),
    onSuccess: () => { setComment(''); refreshComments() },
    onError: (error) => toast.error(error.response?.data?.detail || '댓글을 작성하지 못했습니다.'),
  })

  if (postQuery.isPending) return <div role="status" className="mx-auto h-80 max-w-[800px] animate-pulse rounded-xl bg-paper-200"><span className="sr-only">글을 불러오는 중입니다.</span></div>
  if (postQuery.isError || !post) return <div className="py-16 text-center"><h1 className="text-xl font-semibold">{postQuery.error?.response?.status === 404 ? '글을 찾을 수 없습니다.' : '글을 불러오지 못했습니다.'}</h1><div className="mt-4 flex justify-center gap-4 text-sm"><Link to="/community" className="text-accent-dark">커뮤니티로 돌아가기</Link><button type="button" onClick={() => postQuery.refetch()} className="text-ink-500">다시 시도</button></div></div>
  const comments = commentsQuery.data?.data || []
  const roots = comments.filter((item) => !item.parent_id)
  const repliesByParent = comments.reduce((result, item) => { if (item.parent_id) (result[item.parent_id] ||= []).push(item); return result }, {})
  const isOwner = user?.id === post.user_id

  return (
    <article className="mx-auto max-w-[800px]">
      <Link to={post.space === 'lounge' ? '/lounge' : '/community'} className="text-[13px] text-ink-500 hover:text-accent-dark">← {post.space === 'lounge' ? '라운지' : '커뮤니티'}</Link>
      <header className="mt-6 border-b border-ink-200/80 pb-5 sm:mt-8">
        <h1 className="break-keep text-[28px] font-semibold leading-[1.35] tracking-[-0.025em] text-ink-950 [overflow-wrap:anywhere] sm:text-[36px]">{post.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] leading-5 text-ink-500"><span className="break-all font-medium text-ink-700">{post.author_username}</span><span>{TOPICS[post.topic]}</span><span>{formatRelativeTime(post.created_at)}</span><span>조회 {post.views}</span>{token && !isOwner && <button type="button" disabled={postAction.isPending || follow.isPending || follow.isError} onClick={() => postAction.mutate('follow')} className="text-accent-dark disabled:opacity-40">{follow.data?.data?.is_following ? '팔로우 취소' : '팔로우'}</button>}</div>
      </header>
      <div className="whitespace-pre-wrap break-words py-6 text-[16px] leading-8 text-ink-800">{post.content}</div>
      {post.image_url && <img src={post.image_url} alt="글에 첨부한 이미지" className="mb-6 max-h-[640px] w-full rounded-lg object-contain" />}
      {post.related_signal && <div className="mb-6 border-l-2 border-ink-200 pl-4"><p className="text-xs text-ink-500">함께 읽을 소식</p><Link to={'/signals/' + post.related_signal.slug} className="mt-1 block text-sm leading-6 text-accent-dark">{post.related_signal.title} ↗</Link></div>}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-200 pb-6">
        <button type="button" aria-pressed={Boolean(post.is_recommended)} disabled={postAction.isPending} onClick={() => token ? postAction.mutate('recommend') : navigate(loginPath)} className={'rounded-lg border px-3 py-2 text-[13px] disabled:opacity-40 ' + (post.is_recommended ? 'border-accent/30 bg-accent-glow text-accent-dark' : 'border-ink-200 text-ink-600')}>추천 {post.recommendation_count}</button>
        <div className="flex flex-wrap items-center gap-4 text-xs text-ink-500">{post.tags?.map((tag) => <span key={tag}>#{tag}</span>)}{isOwner && <><Link to={'/community/' + post.id + '/edit'}>수정</Link><button type="button" disabled={postAction.isPending} onClick={() => window.confirm('글을 삭제할까요?') && postAction.mutate('delete')}>삭제</button></>}</div>
      </div>
      <section className="mt-6">
        <h2 className="text-lg font-semibold">댓글 <span className="ml-1 text-sm font-normal text-ink-500">{post.comment_count}</span></h2>
        {token ? <form onSubmit={(event) => { event.preventDefault(); if (comment.trim() && !createComment.isPending) createComment.mutate() }} className="mt-4"><label htmlFor="social-comment" className="sr-only">댓글 내용</label><textarea id="social-comment" value={comment} maxLength={5000} onChange={(event) => setComment(event.target.value)} rows={3} placeholder="댓글을 남겨주세요." className={textAreaClass} /><div className="mt-2 flex justify-end"><button disabled={!comment.trim() || createComment.isPending} className="rounded-lg bg-ink-950 px-4 py-2.5 text-xs font-medium text-paper-50 disabled:opacity-40">{createComment.isPending ? '등록 중' : '댓글 등록'}</button></div></form> : <Link to={loginPath} className="mt-4 block rounded-lg bg-paper-200 py-4 text-center text-sm text-ink-600">로그인하고 댓글 남기기</Link>}
        {commentsQuery.isPending && <p role="status" className="py-5 text-sm text-ink-500">댓글을 불러오는 중입니다.</p>}
        {commentsQuery.isError && <p role="alert" className="py-5 text-sm text-ink-500">댓글을 불러오지 못했어요. <button type="button" onClick={() => commentsQuery.refetch()} className="text-accent-dark">다시 시도</button></p>}
        {!commentsQuery.isError && <div className="mt-4">{roots.map((item) => <ThreadComment key={item.id} item={item} replies={repliesByParent[item.id] || []} user={user} refresh={refreshComments} loginPath={loginPath} onReply={(parentId, content) => socialAPI.createComment(postId, { content, parent_id: parentId })} onEdit={(id, content) => socialAPI.updateComment(id, { content })} onDelete={socialAPI.deleteComment} onRecommend={(comment) => comment.is_recommended ? socialAPI.unrecommendComment(comment.id) : socialAPI.recommendComment(comment.id)} />)}</div>}
      </section>
    </article>
  )
}
