import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMainNavCategories } from '../../utils/communityCategories';

const tabButtonBaseClass =
  'inline-flex h-9 items-center justify-center rounded-lg border px-3 text-[13px] font-semibold leading-none whitespace-nowrap transition-colors duration-200 ease-out hover:bg-paper-100 active:scale-[0.98]';

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
  const noticeCategory = navCategories.find((category) => category.slug === 'notice');
  const boardCategories = navCategories.filter((category) => category.slug !== 'notice');

  return (
    <section className="sticky top-[5.25rem] sm:top-[4.25rem] z-20 mb-3.5">
      <div className="overflow-x-auto pb-1 scrollbar-hide sm:overflow-visible">
        <div className="flex min-w-max items-center gap-1.5 sm:min-w-0 sm:flex-wrap">
          <button
            onClick={() => navigate('/community')}
            className={resolveTabClassName({ isActive: activeTab === 'home' })}
          >
            전체
          </button>

          {noticeCategory && (
            <button
              onClick={() => navigate(`/community/${noticeCategory.slug}`)}
              className={resolveTabClassName({
                isActive: activeCategorySlug === noticeCategory.slug,
                isNotice: true,
              })}
            >
              {noticeCategory.name}
            </button>
          )}

          <button
            onClick={() => navigate('/community/recruits')}
            className={resolveTabClassName({ isActive: activeTab === 'recruits' })}
          >
            모집
          </button>

          {boardCategories.map((category) => (
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
