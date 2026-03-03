import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMainNavCategories } from '../../utils/communityCategories';

const tabButtonBaseClass =
  'inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold leading-tight whitespace-normal break-keep text-center transition-all duration-200 ease-out hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.98]';

function resolveTabClassName({ isActive, isNotice = false }) {
  if (isActive) {
    return `${tabButtonBaseClass} bg-ink-900 text-paper-50 border-ink-900 shadow-sm`;
  }

  if (isNotice) {
    return `${tabButtonBaseClass} bg-paper-100 text-ink-600 border-ink-200 hover:bg-paper-200`;
  }

  return `${tabButtonBaseClass} bg-white text-ink-600 border-ink-200 hover:bg-paper-100`;
}

function CommunityTabs({
  categories = [],
  showFollowing = false,
  activeTab = 'home',
  activeCategorySlug = null,
}) {
  const navigate = useNavigate();
  const navCategories = useMemo(() => getMainNavCategories(categories), [categories]);

  return (
    <section className="sticky top-[5.25rem] sm:top-[4.25rem] z-20 mb-3.5">
      <div className="rounded-xl border border-ink-200/70 bg-paper-50/95 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-paper-50/85">
        <div className="flex flex-wrap items-stretch gap-2">
          <button
            onClick={() => navigate('/community')}
            className={resolveTabClassName({ isActive: activeTab === 'home' })}
          >
            전체
          </button>

          <button
            onClick={() => navigate('/community/recruits')}
            className={resolveTabClassName({ isActive: activeTab === 'recruits' })}
          >
            모집
          </button>

          {navCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => navigate(`/community/${category.slug}`)}
              className={resolveTabClassName({
                isActive: activeCategorySlug === category.slug,
                isNotice: category.slug === 'notice',
              })}
            >
              {category.name}
            </button>
          ))}

          {showFollowing && (
            <button
              onClick={() => navigate('/community/following')}
              className={resolveTabClassName({ isActive: activeTab === 'following' })}
            >
              팔로잉
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default CommunityTabs;
