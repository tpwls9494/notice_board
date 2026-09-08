export function ActivityIcon({ kind }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    {kind === 'like' ? <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /> : kind === 'comment' ? <path d="M20 11.5a8 8 0 0 1-8 8H4l-2 2v-10a9 9 0 0 1 18 0Z" /> : <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
  </svg>
}

export default function ActivityCounts({ activity, views, stale = false, showLabels = false }) {
  return <span className="journal-activity" title={stale ? '반응 갱신이 지연되고 있습니다.' : undefined}>
    <span aria-label={`조회 ${activity?.views ?? views ?? 0}`}><ActivityIcon kind="view" />{showLabels && '조회 '}{(activity?.views ?? views ?? 0).toLocaleString()}</span>
    {activity && <><span aria-label={`좋아요 ${activity.like_count}`}><ActivityIcon kind="like" />{showLabels && '좋아요 '}{activity.like_count.toLocaleString()}</span><span aria-label={`댓글 ${activity.comment_count}`}><ActivityIcon kind="comment" />{showLabels && '댓글 '}{activity.comment_count.toLocaleString()}</span></>}
    {stale && <span className="journal-activity-stale">갱신 지연</span>}
  </span>
}
