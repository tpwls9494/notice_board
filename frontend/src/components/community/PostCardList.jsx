import { Link } from 'react-router-dom';
import PostCard from './PostCard';

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

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

function PostCardList({ posts, selectedCategoryId }) {
  const showCategory = selectedCategoryId == null;

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block">
        <div className="card rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="px-4 py-2 bg-paper-50 border-b border-ink-100 grid grid-cols-12 gap-3 text-[11px] font-semibold text-ink-500 uppercase tracking-wide">
            <div className="col-span-1">번호</div>
            {showCategory && <div className="col-span-1">카테고리</div>}
            <div className={showCategory ? 'col-span-4' : 'col-span-5'}>제목</div>
            <div className="col-span-2">작성자</div>
            <div className="col-span-2">날짜</div>
            <div className="col-span-1 text-center">조회</div>
            <div className="col-span-1 text-center">추천</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-ink-100">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/posts/${post.id}`}
                className={`px-4 py-2.5 grid grid-cols-12 gap-3 items-center hover:bg-paper-50 transition-colors block${
                  post.is_pinned ? ' bg-amber-50/50' : ''
                }`}
              >
                {/* 번호 / 공지 */}
                <div className="col-span-1">
                  {post.is_pinned ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                      공지
                    </span>
                  ) : (
                    <span className="text-xs font-mono text-ink-400">{post.id}</span>
                  )}
                </div>

                {/* 카테고리 */}
                {showCategory && (
                  <div className="col-span-1">
                    {post.category_name && (
                      <span className="badge-default text-[10px]">
                        {post.category_name}
                      </span>
                    )}
                  </div>
                )}

                {/* 제목 + 댓글수 */}
                <div className={`${showCategory ? 'col-span-4' : 'col-span-5'} min-w-0`}>
                  <span className={`text-[13px] font-medium hover:underline truncate${
                    post.is_pinned ? ' text-ink-950 font-semibold' : ' text-ink-900'
                  }`}>
                    {post.title}
                  </span>
                  {post.comment_count > 0 && (
                    <span className="ml-1 text-[11px] text-ink-500 font-semibold">
                      [{post.comment_count}]
                    </span>
                  )}
                </div>

                {/* 작성자 */}
                <div className="col-span-2 text-xs text-ink-600 truncate">
                  {post.author_username}
                </div>

                {/* 날짜 */}
                <div className="col-span-2 text-[11px] text-ink-400">
                  {formatDate(post.created_at)}
                </div>

                {/* 조회수 */}
                <div className="col-span-1 text-center text-[11px] text-ink-400">
                  {post.views}
                </div>

                {/* 추천수 */}
                <div className="col-span-1 text-center text-[11px] text-ink-400">
                  {post.likes_count || 0}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-1.5">
        {posts.map((post, index) => (
          <PostCard key={post.id} post={post} index={index} />
        ))}
      </div>
    </>
  );
}

export default PostCardList;
