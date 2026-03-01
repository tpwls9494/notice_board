import { Link } from 'react-router-dom';
import PostCard from './PostCard';
import { hasInlineAttachmentInContent } from '../../utils/richContent';

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();

  if (isToday) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  const isSameYear = date.getFullYear() === now.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  if (isSameYear) {
    return `${mm}.${dd}`;
  }

  const yy = String(date.getFullYear()).slice(-2);
  return `${yy}.${mm}.${dd}`;
}

function AttachmentIcon() {
  return (
    <span
      className="inline-flex items-center justify-center text-ink-500 flex-shrink-0"
      title="첨부 포함"
      aria-label="첨부 포함"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739 10.682 20.43a4.5 4.5 0 1 1-6.364-6.364l8.218-8.218a3 3 0 0 1 4.243 4.243L8.56 18.31a1.5 1.5 0 0 1-2.122-2.121l7.247-7.247" />
      </svg>
    </span>
  );
}

function PostCardList({ posts, selectedCategoryId }) {
  const showCategory = selectedCategoryId == null;

  return (
    <>
      <div className="hidden md:block">
        <div className="card rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-paper-50 border-b border-ink-100 grid grid-cols-12 gap-3 text-[11px] font-semibold text-ink-500 uppercase tracking-wide">
            <div className="col-span-1">번호</div>
            {showCategory && <div className="col-span-1">카테고리</div>}
            <div className={showCategory ? 'col-span-4' : 'col-span-5'}>제목</div>
            <div className="col-span-2">작성자</div>
            <div className="col-span-2">날짜</div>
            <div className="col-span-1 text-center">조회</div>
            <div className="col-span-1 text-center">추천</div>
          </div>

          <div className="divide-y divide-ink-100">
            {posts.map((post) => {
              const hasInlineAttachment = hasInlineAttachmentInContent(post.content);

              return (
                <Link
                  key={post.id}
                  to={`/posts/${post.id}`}
                  className={`px-4 py-2.5 grid grid-cols-12 gap-3 items-center hover:bg-paper-50 transition-colors block${
                    post.is_pinned ? ' bg-amber-50/50' : ''
                  }`}
                >
                  <div className="col-span-1">
                    {post.is_pinned ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                        공지
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-ink-400">{post.id}</span>
                    )}
                  </div>

                  {showCategory && (
                    <div className="col-span-1">
                      {post.category_name && (
                        <span className="badge-default text-[10px]">
                          {post.category_name}
                        </span>
                      )}
                    </div>
                  )}

                  <div className={`${showCategory ? 'col-span-4' : 'col-span-5'} min-w-0`}>
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`text-[13px] font-medium hover:underline truncate min-w-0 flex-1${
                        post.is_pinned ? ' text-ink-950 font-semibold' : ' text-ink-900'
                      }`}
                      >
                        {post.title}
                      </span>
                      {hasInlineAttachment && <AttachmentIcon />}
                      {post.comment_count > 0 && (
                        <span className="ml-0.5 text-[11px] text-ink-500 font-semibold flex-shrink-0">
                          [{post.comment_count}]
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 text-xs text-ink-600 truncate">
                    {post.author_username}
                  </div>

                  <div className="col-span-2 text-[11px] text-ink-400">
                    {formatDate(post.created_at)}
                  </div>

                  <div className="col-span-1 text-center text-[11px] text-ink-400">
                    {post.views}
                  </div>

                  <div className="col-span-1 text-center text-[11px] text-ink-400">
                    {post.likes_count || 0}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="md:hidden space-y-1.5">
        {posts.map((post, index) => (
          <PostCard key={post.id} post={post} index={index} />
        ))}
      </div>
    </>
  );
}

export default PostCardList;
