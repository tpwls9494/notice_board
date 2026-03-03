import { useEffect, useMemo } from 'react';
import PostListPage from '../../components/community/PostListPage';
import CommunityTabs from '../../components/community/CommunityTabs';
import useAuthStore from '../../stores/authStore';
import useCategoriesStore from '../../stores/categoriesStore';
import { sortCategoriesByOrder } from '../../utils/communityCategories';
import { useSeo } from '../../utils/seo';

function FollowingPostsPage() {
  const token = useAuthStore((state) => state.token);
  const { categories, fetchCategories } = useCategoriesStore();

  useSeo({
    title: '팔로잉 피드',
    description: '내가 팔로우한 작성자의 게시글만 모아보는 피드',
    url: '/community/following',
  });

  const emptyStateTitle = token
    ? '팔로잉한 작성자의 글이 없습니다'
    : '로그인 후 팔로잉 피드를 볼 수 있습니다';

  const emptyStateDescription = token
    ? '게시글 상세에서 작성자를 팔로우하면 여기에 글이 표시됩니다.'
    : '게시글 상세에서 작성자 옆 팔로우 버튼을 눌러보세요.';

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const sortedCategories = useMemo(() => {
    return sortCategoriesByOrder(categories);
  }, [categories]);

  return (
    <div className="animate-fade-up">
      <section className="mb-4">
        <h1 className="font-display text-2xl font-extrabold text-ink-950 tracking-tight text-balance">
          팔로잉 피드
        </h1>
        <p className="mt-1 text-xs text-ink-500 max-w-md">
          내가 팔로우한 작성자의 게시글만 확인할 수 있습니다.
        </p>
      </section>

      <CommunityTabs
        categories={sortedCategories}
        showFollowing={Boolean(token)}
        activeTab="following"
      />

      <PostListPage
        categoryId={null}
        categoryName="팔로잉"
        title="팔로잉 글"
        scope="following"
        emptyStateTitle={emptyStateTitle}
        emptyStateDescription={emptyStateDescription}
        emptyStateShowWriteButton={false}
      />
    </div>
  );
}

export default FollowingPostsPage;
