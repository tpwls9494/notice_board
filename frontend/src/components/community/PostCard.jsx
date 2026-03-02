import { Link } from 'react-router-dom';
import { hasInlineAttachmentInContent } from '../../utils/richContent';
import AttachmentIcon from './AttachmentIcon';

function getRecruitDdayLabel(deadlineAt) {
  if (!deadlineAt) return null;
  const target = new Date(deadlineAt);
  if (Number.isNaN(target.getTime())) return null;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.floor((startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000);

  if (diffDays < 0) return '마감';
  if (diffDays === 0) return 'D-day';
  return `D-${diffDays}`;
}

function PostCard({ post, index }) {
  const hasInlineAttachment = hasInlineAttachmentInContent(post.content);
  const isRecruitPost = post.post_type === 'RECRUIT';
  const recruitDdayLabel = getRecruitDdayLabel(post?.recruit_meta?.deadline_at);

  return (
    <Link
      to={`/posts/${post.id}`}
      className={`card-hover block rounded-xl opacity-0 animate-fade-up stagger-${Math.min((index || 0) + 1, 8)}`}
    >
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          {post.category_name && (
            <span className="badge-default text-[10px] flex-shrink-0">{post.category_name}</span>
          )}
          {isRecruitPost && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 flex-shrink-0">
              모집
            </span>
          )}
          {isRecruitPost && recruitDdayLabel && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 flex-shrink-0">
              {recruitDdayLabel}
            </span>
          )}
          <h3 className="text-[13px] font-semibold text-ink-900 truncate flex-1">{post.title}</h3>
          {hasInlineAttachment && <AttachmentIcon />}
          {post.comment_count > 0 && (
            <span className="text-[11px] text-ink-500 font-semibold flex-shrink-0">[{post.comment_count}]</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-ink-400">
          <span className="font-medium text-ink-600 truncate">{post.author_username}</span>
          <span>{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short' }).format(new Date(post.created_at))}</span>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              </svg>
              {post.views}
            </span>
            {post.likes_count > 0 && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
                {post.likes_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default PostCard;
