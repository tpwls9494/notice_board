import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { postsAPI } from '../../services/api';
import PostCardList from './PostCardList';
import EmptyState from './EmptyState';

const SORT_OPTIONS = [
  { value: 'latest', label: '최신순' },
  { value: 'views', label: '조회순' },
  { value: 'likes', label: '추천순' },
  { value: 'comments', label: '댓글순' },
  { value: 'hot', label: '인기순' },
];

const WINDOW_OPTIONS = [
  { value: '24h', label: '24시간' },
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
];

function PostListPage({ categoryId, categoryName }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState('latest');
  const [window, setWindow] = useState('24h');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    setPage(1);
    setSearch('');
    setSearchInput('');
    setSort('latest');
    setWindow('24h');
    setIsFilterOpen(false);
  }, [categoryId]);

  useEffect(() => {
    if (search || sort !== 'latest' || window !== '24h') {
      setIsFilterOpen(true);
    }
  }, [search, sort, window]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['posts', page, search, categoryId, sort, window],
    queryFn: () => postsAPI.getPosts(page, 10, search, categoryId, sort, window),
    enabled: Boolean(categoryId),
  });

  const posts = data?.data?.posts || [];
  const total = data?.data?.total || 0;
  const pageSize = data?.data?.page_size || 10;
  const totalPages = Math.ceil(total / pageSize);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <section id="board-posts" className="mt-5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink-900">
          {categoryName} 게시판 글
        </h2>
        <button
          onClick={() => setIsFilterOpen((prev) => !prev)}
          className="px-2 py-1 text-xs rounded-md border border-ink-200 text-ink-600 hover:bg-paper-100 transition-colors"
        >
          검색/정렬 {isFilterOpen ? '접기' : '열기'}
        </button>
      </div>

      {isFilterOpen && (
        <div className="card rounded-xl p-3 mb-3">
          <div className="flex flex-col lg:flex-row gap-2">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="제목 또는 내용 검색"
                  className="input-field !py-2 !pr-3 !pl-9 text-sm"
                />
              </div>
              <button type="submit" className="btn-secondary text-xs !px-3 !py-2 whitespace-nowrap">
                검색
              </button>
            </form>

            <div className="flex gap-2">
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
                className="input-field !py-2 !px-3 text-sm w-auto min-w-[100px]"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {sort === 'hot' && (
                <select
                  value={window}
                  onChange={(e) => {
                    setWindow(e.target.value);
                    setPage(1);
                  }}
                  className="input-field !py-2 !px-3 text-sm w-auto min-w-[90px]"
                >
                  {WINDOW_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {search && (
            <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-ink-100">
              <span className="badge-accent text-[11px] flex items-center gap-1">
                검색: {search}
                <button
                  onClick={() => {
                    setSearch('');
                    setSearchInput('');
                    setPage(1);
                  }}
                  className="text-accent hover:text-accent-dark"
                  aria-label="검색 필터 제거"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <div className="w-6 h-6 border-2 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
          <p className="text-xs text-ink-400">불러오는 중...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-xs" role="alert">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            게시글을 불러오는데 실패했습니다.
          </div>
        </div>
      ) : posts.length === 0 ? (
        <EmptyState />
      ) : (
        <PostCardList posts={posts} selectedCategoryId={categoryId} />
      )}

      {totalPages > 1 && (
        <div className="mt-5 flex justify-center items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost text-xs !px-2.5 !py-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="이전 페이지"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          <div className="flex items-center gap-1 mx-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) {
                  acc.push('...');
                }
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-ink-400 text-xs">&#x2026;</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item)}
                    className={`w-8 h-8 rounded-md text-xs font-medium ${
                      page === item
                        ? 'bg-ink-950 text-paper-50 shadow-soft'
                        : 'text-ink-600 hover:bg-ink-100'
                    }`}
                    style={{ transition: 'background-color 0.2s ease-out, color 0.2s ease-out' }}
                  >
                    {item}
                  </button>
                )
              )}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-ghost text-xs !px-2.5 !py-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="다음 페이지"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}

export default PostListPage;
