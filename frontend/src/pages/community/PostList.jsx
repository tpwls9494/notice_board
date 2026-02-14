import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { postsAPI } from '../../services/api';
import useCategoriesStore from '../../stores/categoriesStore';
import LoginModal from '../../components/LoginModal';
import TodayStatsBar from '../../components/community/TodayStatsBar';
import CommunityHero from '../../components/community/CommunityHero';
import HotPostsSection from '../../components/community/HotPostsSection';
import PinnedGuideSection from '../../components/community/PinnedGuideSection';
import PostCardList from '../../components/community/PostCardList';
import EmptyState from '../../components/community/EmptyState';

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

function PostList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [sort, setSort] = useState('latest');
  const [window, setWindow] = useState('24h');
  const [showLoginModal, setShowLoginModal] = useState(false);

  const { categories, fetchCategories } = useCategoriesStore();

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['posts', page, search, categoryId, sort, window],
    queryFn: () => postsAPI.getPosts(page, 10, search, categoryId, sort, window),
  });

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const posts = data?.data?.posts || [];
  const total = data?.data?.total || 0;
  const pageSize = data?.data?.page_size || 10;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="animate-fade-up">
      {/* 1. Today Stats */}
      <TodayStatsBar />

      {/* 2. Hero */}
      <CommunityHero onLoginClick={() => setShowLoginModal(true)} />

      {/* 3. Hot Posts */}
      <HotPostsSection />

      {/* 4. Pinned Guides */}
      <PinnedGuideSection />

      {/* 5. Category Grid */}
      <section className="mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[...categories].sort((a, b) => {
            if (a.slug === 'notice') return 1;
            if (b.slug === 'notice') return -1;
            return 0;
          }).map((category) => {
            const isNotice = category.slug === 'notice';
            return (
              <button
                key={category.id}
                onClick={() => { setCategoryId(category.id); setPage(1); }}
                className={`card px-4 py-5 text-center transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${
                  categoryId === category.id
                    ? 'ring-2 ring-ink-950 border-ink-950'
                    : 'hover:border-ink-200'
                } ${isNotice ? 'opacity-50 hover:opacity-100' : ''}`}
              >
                <span className="text-2xl block mb-2">{category.icon}</span>
                <span className="text-sm font-semibold text-ink-800 block">{category.name}</span>
                {category.today_post_count > 0 && (
                  <span className="text-xs text-blue-600 font-medium mt-1 block">오늘 +{category.today_post_count}</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 6. Category Tabs + Search + Sort */}
      <div className="mb-6">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
          <button
            onClick={() => { setCategoryId(null); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
              categoryId === null
                ? 'bg-ink-950 text-paper-50 shadow-soft'
                : 'bg-paper-200 text-ink-600 hover:bg-paper-300'
            }`}
          >
            전체
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => { setCategoryId(category.id); setPage(1); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                categoryId === category.id
                  ? 'bg-ink-950 text-paper-50 shadow-soft'
                  : category.slug === 'notice'
                    ? 'bg-paper-200 text-ink-400 hover:bg-paper-300'
                    : 'bg-paper-200 text-ink-600 hover:bg-paper-300'
              }`}
            >
              {category.icon && <span className="mr-1">{category.icon}</span>}
              {category.name}
            </button>
          ))}
        </div>

        {/* Search + Sort */}
        <div className="card p-4">
          <div className="flex gap-2">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
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
                  placeholder="제목 또는 내용으로 검색..."
                  className="input-field pl-10"
                />
              </div>
              <button type="submit" className="btn-primary whitespace-nowrap">
                검색
              </button>
            </form>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className="input-field w-auto min-w-[120px]"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {sort === 'hot' && (
              <select
                value={window}
                onChange={(e) => { setWindow(e.target.value); setPage(1); }}
                className="input-field w-auto min-w-[100px]"
              >
                {WINDOW_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* Active Search Filter */}
          {search && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-ink-100">
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
            </div>
          )}
        </div>
      </div>

      {/* 6. Posts List / Loading / Error / Empty */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-8 h-8 border-2 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
          <p className="text-sm text-ink-400">불러오는 중&#x2026;</p>
        </div>
      ) : error ? (
        <div className="text-center py-24">
          <div className="inline-flex items-center gap-2 px-4 py-3 bg-red-50 text-red-700 rounded-xl text-sm" role="alert">
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

      {/* 7. Pagination */}
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

      {/* 8. Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}

export default PostList;
