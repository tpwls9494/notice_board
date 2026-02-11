import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { postsAPI } from '../../services/api';
import { useState, useEffect } from 'react';
import useCategoriesStore from '../../stores/categoriesStore';

function PostList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoryId, setCategoryId] = useState(null);

  const { categories, fetchCategories } = useCategoriesStore();

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['posts', page, search, categoryId],
    queryFn: () => postsAPI.getPosts(page, 10, search, categoryId),
  });

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleCategoryChange = (e) => {
    const value = e.target.value;
    setCategoryId(value ? parseInt(value) : null);
    setPage(1);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-2 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
        <p className="text-sm text-ink-400">불러오는 중&#x2026;</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-24">
        <div className="inline-flex items-center gap-2 px-4 py-3 bg-red-50 text-red-700 rounded-xl text-sm" role="alert">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          게시글을 불러오는데 실패했습니다.
        </div>
      </div>
    );
  }

  const posts = data?.data?.posts || [];
  const total = data?.data?.total || 0;
  const pageSize = data?.data?.page_size || 10;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold text-ink-950 tracking-tight text-balance">
              커뮤니티
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              전체 <span className="font-semibold text-ink-700">{total}</span>개의 게시글
            </p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="card p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400"
                  fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="제목 또는 내용으로 검색&#x2026;"
                  className="input-field pl-10"
                />
              </div>
              <button type="submit" className="btn-primary whitespace-nowrap">
                검색
              </button>
            </form>

            <select
              value={categoryId || ''}
              onChange={handleCategoryChange}
              className="input-field sm:w-48"
            >
              <option value="">전체 카테고리</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Active Filters */}
          {(search || categoryId) && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-ink-100">
              {search && (
                <span className="badge-accent flex items-center gap-1.5">
                  검색: {search}
                  <button
                    onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
                    className="text-accent hover:text-accent-dark ml-0.5"
                    aria-label="검색 필터 제거"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {categoryId && (
                <span className="badge-default flex items-center gap-1.5">
                  {categories.find((c) => c.id === categoryId)?.name}
                  <button
                    onClick={() => { setCategoryId(null); setPage(1); }}
                    className="text-ink-500 hover:text-ink-800 ml-0.5"
                    aria-label="카테고리 필터 제거"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Posts List */}
      <div className="space-y-2">
        {posts.length === 0 ? (
          <div className="card px-6 py-16 text-center">
            <div className="text-ink-300 mb-3">
              <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-ink-500 font-medium">게시글이 없습니다</p>
            <p className="text-ink-400 text-sm mt-1">첫 번째 게시글을 작성해보세요</p>
          </div>
        ) : (
          posts.map((post, index) => (
            <Link
              key={post.id}
              to={`/community/posts/${post.id}`}
              className={`card-hover block opacity-0 animate-fade-up stagger-${Math.min(index + 1, 8)}`}
            >
              <div className="px-5 py-4 flex items-center gap-4">
                {/* Post Number */}
                <div className="hidden sm:flex w-10 h-10 rounded-lg bg-paper-200 items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-ink-400 font-mono">
                    {post.id}
                  </span>
                </div>

                {/* Post Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-[15px] font-semibold text-ink-900 truncate">
                      {post.title}
                    </h2>
                    {post.category_name && (
                      <span className="badge-default text-[11px] flex-shrink-0">
                        {post.category_name}
                      </span>
                    )}
                    {post.comment_count > 0 && (
                      <span className="text-xs text-ink-500 font-semibold flex-shrink-0">
                        [{post.comment_count}]
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-ink-400">
                    <span className="font-medium text-ink-600">{post.author_username}</span>
                    <span>{new Intl.DateTimeFormat('ko-KR').format(new Date(post.created_at))}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-1 text-xs text-ink-400">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{post.views}</span>
                  </div>
                  {post.likes_count > 0 && (
                    <div className="flex items-center gap-1 text-xs text-ink-500">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                      </svg>
                      <span className="font-semibold">{post.likes_count}</span>
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <svg className="w-4 h-4 text-ink-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="이전 페이지"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          <div className="flex items-center gap-1 mx-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) {
                  acc.push('...');
                }
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-ink-400 text-sm">&#x2026;</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium ${
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
            className="btn-ghost text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="다음 페이지"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default PostList;
