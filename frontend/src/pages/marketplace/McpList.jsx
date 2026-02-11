import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { mcpServersAPI } from '../../services/api';
import { useState, useEffect } from 'react';
import useMcpCategoriesStore from '../../stores/mcpCategoriesStore';

function McpList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [sortBy, setSortBy] = useState('newest');

  const { categories, fetchCategories } = useMcpCategoriesStore();

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['mcp-servers', page, search, categoryId, sortBy],
    queryFn: () => mcpServersAPI.getServers(page, 12, search, categoryId, null, sortBy),
  });

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
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
          MCP 서버 목록을 불러오는데 실패했습니다.
        </div>
      </div>
    );
  }

  const servers = data?.data?.servers || [];
  const total = data?.data?.total || 0;
  const pageSize = data?.data?.page_size || 12;
  const totalPages = Math.ceil(total / pageSize);

  const CATEGORY_ICONS = {
    folder: '📁', wrench: '🔧', globe: '🌐', database: '🗄️', brain: '🧠', zap: '⚡',
  };

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold text-ink-950 tracking-tight text-balance">
            MCP 마켓플레이스
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            <span className="font-semibold text-ink-700">{total}</span>개의 MCP 서버를 탐색하세요
          </p>
        </div>

        {/* Search & Sort */}
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
                  placeholder="MCP 서버 검색&#x2026;"
                  className="input-field pl-10"
                />
              </div>
              <button type="submit" className="btn-primary whitespace-nowrap">
                검색
              </button>
            </form>

            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
              className="input-field sm:w-40"
            >
              <option value="newest">최신순</option>
              <option value="stars">GitHub 스타순</option>
              <option value="rating">별점순</option>
            </select>
          </div>
        </div>
      </div>

      {/* Category Filter Chips */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => { setCategoryId(null); setPage(1); }}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
              categoryId === null
                ? 'bg-ink-950 text-paper-50 shadow-soft'
                : 'bg-paper-200 text-ink-600 hover:bg-paper-300'
            }`}
          >
            전체
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setCategoryId(cat.id); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-1.5 ${
                categoryId === cat.id
                  ? 'bg-ink-950 text-paper-50 shadow-soft'
                  : 'bg-paper-200 text-ink-600 hover:bg-paper-300'
              }`}
            >
              <span>{CATEGORY_ICONS[cat.icon] || '📦'}</span>
              {cat.name}
              {cat.server_count > 0 && (
                <span className={`text-xs ${categoryId === cat.id ? 'text-paper-200' : 'text-ink-400'}`}>
                  {cat.server_count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Active Search Filter */}
      {search && (
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="badge-accent flex items-center gap-1.5">
            검색: {search}
            <button
              onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
              className="text-ink-500 hover:text-ink-800 ml-0.5"
              aria-label="검색 필터 제거"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        </div>
      )}

      {/* Server Grid */}
      {servers.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <div className="text-ink-300 mb-3">
            <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25" />
            </svg>
          </div>
          <p className="text-ink-500 font-medium">MCP 서버가 없습니다</p>
          <p className="text-ink-400 text-sm mt-1">검색 조건을 변경해보세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {servers.map((server, index) => (
            <Link
              key={server.id}
              to={`/servers/${server.id}`}
              className={`card-hover block opacity-0 animate-fade-up stagger-${Math.min(index + 1, 8)}`}
            >
              <div className="p-5">
                {/* Top badges */}
                <div className="flex items-center gap-2 mb-3 min-h-[22px]">
                  {server.category_name && (
                    <span className="badge-default text-[11px]">{server.category_name}</span>
                  )}
                  {server.is_verified && (
                    <span className="badge-accent text-[11px]">검증됨</span>
                  )}
                  {server.is_featured && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">추천</span>
                  )}
                </div>

                {/* Name */}
                <h3 className="text-lg font-semibold text-ink-900 mb-1.5 truncate">
                  {server.name}
                </h3>

                {/* Description */}
                <p className="text-sm text-ink-500 mb-4" style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {server.short_description || server.description}
                </p>

                {/* Stats row */}
                <div className="flex items-center gap-4 text-xs text-ink-400">
                  {/* GitHub stars */}
                  <div className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                    <span>{server.github_stars?.toLocaleString() || 0}</span>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-1">
                    <span className="text-amber-500">&#9733;</span>
                    <span>{(server.avg_rating || 0).toFixed(1)}</span>
                    <span className="text-ink-300">({server.review_count || 0})</span>
                  </div>

                  {/* Tools count */}
                  <div className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.384 3.208a.75.75 0 01-1.094-.697l.979-5.707a.75.75 0 00-.18-.556L1.3 7.115a.75.75 0 01.44-1.267l5.69-.828a.75.75 0 00.463-.268L11.07 1.15a.75.75 0 011.36 0l3.178 4.602a.75.75 0 00.463.268l5.69.828a.75.75 0 01.44 1.267l-4.441 4.303a.75.75 0 00-.18.556l.979 5.707a.75.75 0 01-1.094.697l-5.384-3.208a.75.75 0 00-.762 0z" />
                    </svg>
                    <span>{server.tools?.length || 0} tools</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

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

export default McpList;
