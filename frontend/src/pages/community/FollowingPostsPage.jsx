import { useNavigate } from 'react-router-dom';
import PostListPage from '../../components/community/PostListPage';
import useAuthStore from '../../stores/authStore';
import { useSeo } from '../../utils/seo';

function FollowingPostsPage() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);

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

  return (
    <div className="animate-fade-up">
      <section className="mb-4">
        <h1 className="font-display text-2xl font-bold text-ink-950 tracking-tight text-balance">
          팔로잉 피드
        </h1>
        <p className="mt-1 text-xs text-ink-500 max-w-md">
          내가 팔로우한 작성자의 게시글만 확인할 수 있습니다.
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
          <button
            onClick={() => navigate('/community/recruits')}
            className="inline-flex items-center px-3 py-1.5 text-[12px] font-medium rounded-full border whitespace-nowrap transition-colors bg-white text-ink-600 border-ink-200 hover:bg-paper-100"
          >
            모집
          </button>
          <button
            onClick={() => navigate('/community/following')}
            className="inline-flex items-center px-3 py-1.5 text-[12px] font-medium rounded-full border whitespace-nowrap transition-colors bg-ink-900 text-paper-50 border-ink-900"
          >
            팔로잉
          </button>
        </div>
      </section>

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
