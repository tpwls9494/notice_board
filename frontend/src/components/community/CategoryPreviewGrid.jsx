import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { postsAPI } from '../../services/api';

const PREVIEW_LIMIT = 5;

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

  return (
    <section className="mb-5">
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink-900">게시판별 최근 글</h2>
        <span className="text-[11px] text-ink-400">각 게시판 최근 5개</span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {orderedCategories.map((category, index) => {
          const query = previewQueries[index];
          const posts = query?.data?.data?.posts || [];
          const isLoading = query?.isLoading;

          return (
            <section key={category.id} className="card rounded-xl px-3 py-2.5">
              <header className="flex items-center justify-between gap-2 pb-2 border-b border-ink-100">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-ink-900 truncate">
                    {category.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectCategory(category.slug)}
                  className="text-[11px] text-ink-500 hover:text-ink-900 whitespace-nowrap"
                >
                  더보기
                </button>
              </header>

              <div className="pt-1">
                {isLoading ? (
                  <p className="py-2 text-[12px] text-ink-400">불러오는 중...</p>
                ) : posts.length === 0 ? (
                  <p className="py-2 text-[12px] text-ink-400">아직 글이 없습니다.</p>
                ) : (
                  <ul>
                    {posts.map((post) => (
                      <li key={post.id} className="border-b border-ink-100 last:border-b-0">
                        <Link
                          to={`/posts/${post.id}`}
                          className="py-1.5 flex items-center gap-1.5 min-w-0 hover:text-ink-900"
                        >
                          <span className="text-[12px] text-ink-800 truncate flex-1">
                            {post.title}
                          </span>
                          {post.comment_count > 0 && (
                            <span className="text-[11px] text-ink-500 shrink-0">
                              {post.comment_count}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

export default CategoryPreviewGrid;
