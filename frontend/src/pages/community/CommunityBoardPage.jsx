import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import useCategoriesStore from '../../stores/categoriesStore';
import PostListPage from '../../components/community/PostListPage';
import { useSeo } from '../../utils/seo';

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

  useSeo({
    title: activeCategory ? `${activeCategory.name} 게시판` : '게시판',
    description: activeCategory?.description || '카테고리별 커뮤니티 게시글 목록',
    url: activeCategory ? `/community/${activeCategory.slug}` : '/community',
  });

  if (hasFetchedCategories && !activeCategory) {
    return <Navigate to="/community" replace />;
  }

  if (!activeCategory) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-2 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
        <p className="text-sm text-ink-400">게시판 정보를 불러오는 중입니다.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <section className="mb-4">
        <h1 className="font-display text-2xl font-bold text-ink-950 tracking-tight text-balance flex items-center gap-2">
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-ink-200 bg-paper-100 text-ink-500 shrink-0"
            aria-hidden="true"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5v13.5H3.75V5.25zm5.25 0v13.5m5.25-13.5v13.5M3.75 9.75h16.5m-16.5 4.5h16.5" />
            </svg>
          </span>
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
            className="inline-flex items-center px-3 py-1.5 text-[12px] font-medium rounded-full border whitespace-nowrap transition-colors bg-white text-ink-600 border-ink-200 hover:bg-paper-100"
          >
            전체
          </button>
          {sortedCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => navigate(`/community/${category.slug}`)}
              className={`inline-flex items-center px-3 py-1.5 text-[12px] font-medium rounded-full border whitespace-nowrap transition-colors ${
                category.slug === activeCategory.slug
                  ? 'bg-ink-900 text-paper-50 border-ink-900'
                  : category.slug === 'notice'
                    ? 'bg-paper-100 text-ink-500 border-ink-200 hover:bg-paper-200'
                    : 'bg-white text-ink-600 border-ink-200 hover:bg-paper-100'
              }`}
            >
              {category.name}
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
