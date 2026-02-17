import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { postsAPI } from '../../services/api';

const PREVIEW_LIMIT = 5;
const EXCLUDED_CATEGORY_SLUGS = new Set(['notice']);
const MAX_CATEGORY_CARDS = 6;

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
    })
      .filter((category) => !EXCLUDED_CATEGORY_SLUGS.has(category.slug))
      .slice(0, MAX_CATEGORY_CARDS);
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

  return (
    <section className="mb-5">
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink-900">게시판별 최근 글</h2>
        <span className="text-[12px] text-ink-400">공지 제외 6개 게시판</span>
      </header>

      {previewCards.length === 0 ? (
        <p className="px-1 text-[12px] text-ink-400">최근 글이 있는 게시판이 아직 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {previewCards.map(({ category, posts, isLoading }) => (
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
                            <span className="flex items-center justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span className="truncate text-[13px] font-medium text-ink-800">
                                  {post.title}
                                </span>
                                {post.comment_count > 0 && (
                                  <span className="shrink-0 text-[11px] text-ink-500">
                                    [{post.comment_count}]
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 text-[11px] text-ink-400">
                                {timeText}
                              </span>
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
