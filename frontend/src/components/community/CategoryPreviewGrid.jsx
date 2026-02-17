import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { postsAPI } from '../../services/api';

const PREVIEW_LIMIT = 5;

function formatRelativeTime(dateValue) {
  if (!dateValue) return '방금 전';

  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return '방금 전';

  const diffMs = Date.now() - parsedDate.getTime();
  if (diffMs < 60_000) return '방금 전';

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) return `${diffMinutes}분 전`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}일 전`;

  return `${Math.floor(diffDays / 7)}주 전`;
}

function CategoryPreviewGrid({ categories, onSelectCategory }) {
  const orderedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      if (a.order != null && b.order != null) return a.order - b.order;
      return a.id - b.id;
    });
  }, [categories]);

  const previewQueries = useQueries({
    queries: orderedCategories.map((category) => ({
      queryKey: ['community', 'category-preview', category.id],
      queryFn: () => postsAPI.getPosts(1, PREVIEW_LIMIT, '', category.id, 'latest'),
      staleTime: 60_000,
    })),
  });

  const previewCards = orderedCategories.map((category, index) => {
    const query = previewQueries[index];
    const posts = query?.data?.data?.posts || [];
    const isLoading = query?.isLoading;

    return {
      category,
      posts,
      isLoading,
    };
  });

  // 글이 없는 카테고리는 카드 자체를 숨겨서 피드 밀도를 유지합니다.
  const visibleCards = previewCards.filter(({ posts, isLoading }) => isLoading || posts.length > 0);

  return (
    <section className="mb-5">
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink-900">게시판별 최근 글</h2>
        <span className="text-[12px] text-ink-400">각 게시판 최근 5개</span>
      </header>

      {visibleCards.length === 0 ? (
        <p className="px-1 text-[12px] text-ink-400">최근 글이 있는 게시판이 아직 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleCards.map(({ category, posts, isLoading }) => (
            <section key={category.id} className="card rounded-xl px-3 py-2">
              <header className="flex items-center justify-between gap-2 border-b border-ink-100 pb-1.5">
                <div className="min-w-0">
                  <h3 className="truncate text-[14px] font-semibold tracking-tight text-ink-900">
                    {category.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectCategory(category.slug)}
                  className="whitespace-nowrap text-[12px] font-medium text-ink-500 transition-colors hover:text-ink-900"
                >
                  더보기
                </button>
              </header>

              <div className="pt-1.5">
                {isLoading ? (
                  <p className="text-[12px] text-ink-400">불러오는 중...</p>
                ) : posts.length === 0 ? (
                  <p className="text-[12px] text-ink-400">아직 글이 없습니다.</p>
                ) : (
                  <ul className="space-y-1">
                    {posts.map((post) => {
                      const timeText = formatRelativeTime(post.created_at);

                      return (
                        <li key={post.id}>
                          <Link
                            to={`/posts/${post.id}`}
                            className="block rounded-md px-1.5 py-1.5 transition-colors hover:bg-paper-50"
                          >
                            <span className="block truncate text-[13px] font-medium text-ink-800">
                              {post.title}
                            </span>
                            <span className="mt-0.5 flex items-center justify-between text-[12px] text-ink-400">
                              <span>{timeText}</span>
                              <span>댓글 {post.comment_count || 0}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

export default CategoryPreviewGrid;
