import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useCategoriesStore from '../../stores/categoriesStore';
import CommunityHero from '../../components/community/CommunityHero';
import CommunityTopFeeds from '../../components/community/CommunityTopFeeds';
import CategoryPreviewGrid from '../../components/community/CategoryPreviewGrid';
import WeeklySummaryCard from '../../components/community/WeeklySummaryCard';
import OpenRecruitsSection from '../../components/community/OpenRecruitsSection';
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

  const quickCategoryLinks = useMemo(
    () => sortedCategories.filter((category) => category.slug !== 'notice').slice(0, 4),
    [sortedCategories]
  );

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
          <button
            onClick={() => navigate('/community/recruits')}
            className="inline-flex items-center px-3 py-1.5 text-[12px] font-medium rounded-full border whitespace-nowrap transition-colors bg-white text-ink-600 border-ink-200 hover:bg-paper-100"
          >
            모집
          </button>
          <button
            onClick={() => navigate('/community/following')}
            className="inline-flex items-center px-3 py-1.5 text-[12px] font-medium rounded-full border whitespace-nowrap transition-colors bg-white text-ink-600 border-ink-200 hover:bg-paper-100"
          >
            팔로잉
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

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start xl:gap-4">
        <div className="min-w-0">
          <div className="xl:hidden">
            <WeeklySummaryCard />
            <OpenRecruitsSection />
          </div>

          <CommunityTopFeeds categoryId={null} />

          <CategoryPreviewGrid
            categories={sortedCategories}
            onSelectCategory={(slug) => navigate(`/community/${slug}`)}
          />
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-24 space-y-3">
            <WeeklySummaryCard />
            <OpenRecruitsSection />

            <section className="card rounded-xl p-4">
              <header className="flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-semibold tracking-tight text-ink-900">빠른 이동</h2>
                <span className="text-[11px] text-ink-400">Shortcuts</span>
              </header>

              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => navigate('/community/posts?sort=latest')}
                  className="rounded-md border border-ink-200 bg-white px-2 py-1.5 text-[12px] font-medium text-ink-600 transition-colors hover:bg-paper-100 hover:text-ink-900"
                >
                  최신글
                </button>
                <button
                  onClick={() => navigate('/community/posts?sort=hot&window=24h')}
                  className="rounded-md border border-ink-200 bg-white px-2 py-1.5 text-[12px] font-medium text-ink-600 transition-colors hover:bg-paper-100 hover:text-ink-900"
                >
                  인기글
                </button>
                <button
                  onClick={() => navigate('/community/recruits')}
                  className="rounded-md border border-ink-200 bg-white px-2 py-1.5 text-[12px] font-medium text-ink-600 transition-colors hover:bg-paper-100 hover:text-ink-900"
                >
                  모집
                </button>
                <button
                  onClick={() => navigate('/community/following')}
                  className="rounded-md border border-ink-200 bg-white px-2 py-1.5 text-[12px] font-medium text-ink-600 transition-colors hover:bg-paper-100 hover:text-ink-900"
                >
                  팔로잉
                </button>
              </div>

              {quickCategoryLinks.length > 0 && (
                <div className="mt-3 border-t border-ink-100 pt-3">
                  <p className="mb-1.5 text-[11px] font-medium text-ink-500">주요 게시판</p>
                  <div className="space-y-1">
                    {quickCategoryLinks.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => navigate(`/community/${category.slug}`)}
                        className="w-full rounded-md px-2 py-1.5 text-left text-[12px] text-ink-600 transition-colors hover:bg-paper-100 hover:text-ink-900"
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default CommunityHubPage;
