import { Link } from 'react-router-dom'
import { formatRelativeTime } from '../signals/EditorialSignal'

const TOPIC_LABELS = { story: '이야기', question: '질문', experience: '사용 후기', tip: '팁', chat: '잡담' }

export default function SocialPostRow({ post, compact = false }) {
  return (
    <article className={`grid gap-4 border-t border-ink-100 ${compact ? 'py-4' : post.image_url ? 'py-6 sm:grid-cols-[minmax(0,1fr)_10rem]' : 'py-6'}`}>
      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-[13px] leading-5 tracking-normal text-ink-600">
          <span className="rounded bg-accent-glow/60 px-1.5 font-medium text-accent-dark">{TOPIC_LABELS[post.topic] || '이야기'}</span>
          <span>{post.author_username}</span>
          <span>{formatRelativeTime(post.created_at)}</span>
        </div>
        <Link to={`/community/${post.id}`} className={`mt-2 block break-words font-semibold tracking-[-0.015em] text-ink-950 hover:text-accent-dark ${compact ? 'text-[15px] leading-6' : 'text-lg leading-7 sm:text-xl'}`}>{post.title}</Link>
        {!compact && <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-600">{post.content}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-500">
          <span>추천 {post.recommendation_count}</span><span className={post.comment_count > 0 ? 'font-medium text-accent-dark' : ''}>댓글 {post.comment_count}</span>{!compact && <span>조회 {post.views}</span>}
          {!compact && post.tags?.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}
        </div>
      </div>
      {!compact && post.image_url && <img src={post.image_url} alt="" className="hidden h-24 w-40 object-cover sm:block" />}
    </article>
  )
}
