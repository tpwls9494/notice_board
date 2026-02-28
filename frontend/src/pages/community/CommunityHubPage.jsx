import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useCategoriesStore from '../../stores/categoriesStore';
import CommunityHero from '../../components/community/CommunityHero';
import CommunityTopFeeds from '../../components/community/CommunityTopFeeds';
import CategoryPreviewGrid from '../../components/community/CategoryPreviewGrid';
import { useSeo } from '../../utils/seo';

function CommunityHubPage() {
  const navigate = useNavigate();
  const { categories, fetchCategories } = useCategoriesStore();

  useSeo({
    title: '커뮤니티',
    description: 'MCP, 개발, IT 주제로 소통하는 커뮤니티 허브',
    url: '/community',
  });

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      if (a.order != null && b.order != null) return a.order - b.order;
      return a.id - b.id;
    });
  }, [categories]);

  return (
    <div className="animate-fade-up">
      <CommunityHero />

      <section className="mb-3.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => navigate('/community')}
            className="inline-flex items-center px-3 py-1.5 text-[12px] font-medium rounded-full border whitespace-nowrap transition-colors bg-ink-900 text-paper-50 border-ink-900"
          >
            전체
          </button>
          {sortedCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => navigate(`/community/${category.slug}`)}
              className={`inline-flex items-center px-3 py-1.5 text-[12px] font-medium rounded-full border whitespace-nowrap transition-colors ${
                category.slug === 'notice'
                  ? 'bg-paper-100 text-ink-500 border-ink-200 hover:bg-paper-200'
                  : 'bg-white text-ink-600 border-ink-200 hover:bg-paper-100'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </section>

      <CommunityTopFeeds categoryId={null} />

      <CategoryPreviewGrid
        categories={sortedCategories}
        onSelectCategory={(slug) => navigate(`/community/${slug}`)}
      />
    </div>
  );
}

export default CommunityHubPage;
