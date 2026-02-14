import { Link } from 'react-router-dom';
import PostCard from './PostCard';

function PostCardList({ posts }) {
  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block">
        <div className="card overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-3 bg-paper-50 border-b border-ink-100 grid grid-cols-12 gap-4 text-xs font-semibold text-ink-500 uppercase tracking-wide">
            <div className="col-span-1">번호</div>
            <div className="col-span-1">카테고리</div>
            <div className="col-span-5">제목</div>
            <div className="col-span-2">작성자</div>
            <div className="col-span-2">날짜</div>
            <div className="col-span-1 text-center">조회/추천</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-ink-100">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/posts/${post.id}`}
                className="px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-paper-50 transition-colors block"
              >
                {/* 번호 */}
                <div className="col-span-1 text-sm font-mono text-ink-400">
                  {post.id}
                </div>

                {/* 카테고리 */}
                <div className="col-span-1">
                  {post.category_name && (
                    <span className="badge-default text-[11px]">
                      {post.category_name}
                    </span>
                  )}
                </div>

                {/* 제목 + 댓글수 */}
                <div className="col-span-5 min-w-0">
                  <span className="text-sm font-medium text-ink-900 hover:underline truncate">
                    {post.title}
                  </span>
                  {post.comment_count > 0 && (
                    <span className="ml-1.5 text-xs text-ink-500 font-semibold">
                      [{post.comment_count}]
                    </span>
                  )}
                </div>

                {/* 작성자 */}
                <div className="col-span-2 text-sm text-ink-600 truncate">
                  {post.author_username}
                </div>

                {/* 날짜 */}
                <div className="col-span-2 text-xs text-ink-400">
                  {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short' }).format(new Date(post.created_at))}
                </div>

                {/* 조회수/추천수 */}
                <div className="col-span-1 text-center">
                  <div className="flex flex-col gap-0.5 text-xs text-ink-400">
                    <span className="flex items-center justify-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      </svg>
                      {post.views}
                    </span>
                    {post.likes_count > 0 && (
                      <span className="flex items-center justify-center gap-1 text-ink-500">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                        </svg>
                        {post.likes_count}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-2">
        {posts.map((post, index) => (
          <PostCard key={post.id} post={post} index={index} />
        ))}
      </div>
    </>
  );
}

export default PostCardList;
