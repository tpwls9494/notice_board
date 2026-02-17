import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import useCategoriesStore from '../../stores/categoriesStore';
import PostListPage from '../../components/community/PostListPage';

function CommunityBoardPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { categories, fetchCategories } = useCategoriesStore();
  const [hasFetchedCategories, setHasFetchedCategories] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadCategories = async () => {
      await fetchCategories();
      if (isMounted) {
        setHasFetchedCategories(true);
      }
    };

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, [fetchCategories]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      if (a.order != null && b.order != null) return a.order - b.order;
      return a.id - b.id;
    });
  }, [categories]);

  const activeCategory = useMemo(
    () => sortedCategories.find((category) => category.slug === slug),
    [sortedCategories, slug]
  );

  if (hasFetchedCategories && !activeCategory) {
    return <Navigate to="/community" replace />;
  }

  if (!activeCategory) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-2 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
        <p className="text-sm text-ink-400">게시판 정보를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <section className="mb-4">
        <h1 className="font-display text-2xl font-bold text-ink-950 tracking-tight text-balance flex items-center gap-2">
          {activeCategory.icon && (
            <span className="text-2xl leading-none" aria-hidden="true">
              {activeCategory.icon}
            </span>
          )}
          <span>{activeCategory.name} 게시판</span>
        </h1>
        <p className="mt-1 text-xs text-ink-500 max-w-md">
          {activeCategory.description || '선택한 게시판의 글 목록입니다.'}
        </p>
      </section>

      <section className="mb-3.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => navigate('/community')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-colors bg-white text-ink-600 border-ink-200 hover:bg-paper-100"
          >
            전체
          </button>
          {sortedCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => navigate(`/community/${category.slug}`)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-colors ${
                category.slug === activeCategory.slug
                  ? 'bg-ink-900 text-paper-50 border-ink-900'
                  : category.slug === 'notice'
                    ? 'bg-paper-100 text-ink-500 border-ink-200 hover:bg-paper-200'
                    : 'bg-white text-ink-600 border-ink-200 hover:bg-paper-100'
              }`}
            >
              {category.icon && (
                <span className="text-[20px] leading-none" aria-hidden="true">
                  {category.icon}
                </span>
              )}
              <span>{category.name}</span>
            </button>
          ))}
        </div>
      </section>

      <PostListPage
        categoryId={activeCategory.id}
        categoryName={activeCategory.name}
      />
    </div>
  );
}

export default CommunityBoardPage;
