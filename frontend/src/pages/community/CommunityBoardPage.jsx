import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import useCategoriesStore from '../../stores/categoriesStore';
import useAuthStore from '../../stores/authStore';
import CommunityTabs from '../../components/community/CommunityTabs';
import PostListPage from '../../components/community/PostListPage';
import { sortCategoriesByOrder } from '../../utils/communityCategories';
import { useSeo } from '../../utils/seo';

function CommunityBoardPage() {
  const { slug } = useParams();
  const token = useAuthStore((state) => state.token);
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
    return sortCategoriesByOrder(categories);
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

  if (slug === 'team-recruit') {
    return <Navigate to="/community/recruits" replace />;
  }

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
        <h1 className="font-display text-2xl font-extrabold text-ink-950 tracking-tight text-balance">
          {activeCategory.name} 게시판
        </h1>
        <p className="mt-1 text-xs text-ink-500 max-w-md">
          {activeCategory.description || '선택한 게시판의 글 목록입니다.'}
        </p>
      </section>

      <CommunityTabs
        categories={sortedCategories}
        showFollowing={Boolean(token)}
        activeCategorySlug={activeCategory.slug}
      />

      <PostListPage
        categoryId={activeCategory.id}
        categoryName={activeCategory.name}
      />
    </div>
  );
}

export default CommunityBoardPage;
