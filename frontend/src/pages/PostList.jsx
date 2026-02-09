import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { postsAPI } from '../services/api';
import { useState, useEffect } from 'react';
import useCategoriesStore from '../stores/categoriesStore';

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
      <div className="text-center py-12">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">게시글을 불러오는데 실패했습니다.</p>
      </div>
    );
  }

  const posts = data?.data?.posts || [];
  const total = data?.data?.total || 0;
  const pageSize = data?.data?.page_size || 10;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">게시판</h1>
          <p className="text-gray-600">전체 {total}개</p>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4 mb-4">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="제목 또는 내용으로 검색..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              검색
            </button>
          </form>

          <select
            value={categoryId || ''}
            onChange={handleCategoryChange}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 카테고리</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* Active Filters Display */}
        {(search || categoryId) && (
          <div className="flex gap-2 items-center text-sm">
            <span className="text-gray-600">필터:</span>
            {search && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full flex items-center gap-2">
                검색: {search}
                <button
                  onClick={() => {
                    setSearch('');
                    setSearchInput('');
                    setPage(1);
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            )}
            {categoryId && (
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full flex items-center gap-2">
                {categories.find((c) => c.id === categoryId)?.name}
                <button
                  onClick={() => {
                    setCategoryId(null);
                    setPage(1);
                  }}
                  className="text-green-600 hover:text-green-800"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {posts.length === 0 ? (
            <li className="px-6 py-12 text-center text-gray-500">
              게시글이 없습니다.
            </li>
          ) : (
            posts.map((post) => (
              <li key={post.id}>
                <Link
                  to={`/posts/${post.id}`}
                  className="block hover:bg-gray-50 transition"
                >
                  <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <h2 className="text-lg font-medium text-gray-900 truncate">
                          {post.title}
                        </h2>
                        {post.category_name && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">
                            {post.category_name}
                          </span>
                        )}
                      </div>
                      <div className="ml-2 flex-shrink-0 flex gap-2">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          조회 {post.views}
                        </span>
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          ❤️ {post.likes_count}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center text-sm text-gray-500">
                        <span>{post.author_username}</span>
                        <span className="mx-2">·</span>
                        <span>댓글 {post.comment_count}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(post.created_at).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex justify-center space-x-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            이전
          </button>
          <span className="px-4 py-2 text-sm text-gray-700">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

export default PostList;
