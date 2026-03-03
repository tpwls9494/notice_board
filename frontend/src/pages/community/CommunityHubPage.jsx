import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useCategoriesStore from '../../stores/categoriesStore';
import useAuthStore from '../../stores/authStore';
import CommunityHero from '../../components/community/CommunityHero';
import CommunityTopFeeds from '../../components/community/CommunityTopFeeds';
import CategoryPreviewGrid from '../../components/community/CategoryPreviewGrid';
import CommunityTabs from '../../components/community/CommunityTabs';
import WeeklySummaryCard from '../../components/community/WeeklySummaryCard';
import OpenRecruitsSection from '../../components/community/OpenRecruitsSection';
import { sortCategoriesByOrder } from '../../utils/communityCategories';
import { useSeo } from '../../utils/seo';

function CommunityHubPage() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
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
    return sortCategoriesByOrder(categories);
  }, [categories]);

  return (
    <div className="animate-fade-up">
      <CommunityHero />
      <WeeklySummaryCard />
      <OpenRecruitsSection />

      <CommunityTabs
        categories={sortedCategories}
        showFollowing={Boolean(token)}
        activeTab="home"
      />

      <CommunityTopFeeds categoryId={null} />

      <CategoryPreviewGrid
        categories={sortedCategories}
        onSelectCategory={(slug) => navigate(`/community/${slug}`)}
      />
    </div>
  );
}

export default CommunityHubPage;
