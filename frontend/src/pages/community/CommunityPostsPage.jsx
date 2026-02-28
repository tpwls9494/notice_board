import { useSearchParams } from 'react-router-dom';
import PostListPage from '../../components/community/PostListPage';
import { useSeo } from '../../utils/seo';

const ALLOWED_WINDOWS = new Set(['24h', '7d', '30d']);

function CommunityPostsPage() {
  const [searchParams] = useSearchParams();

  const rawSort = searchParams.get('sort');
  const rawWindow = searchParams.get('window');
  const sort = rawSort === 'hot' ? 'hot' : 'latest';
  const window = rawWindow && ALLOWED_WINDOWS.has(rawWindow) ? rawWindow : '24h';

  const heading = sort === 'hot' ? `인기글 (${window})` : '최신글';
  const description = sort === 'hot'
    ? '최근 기간 기준 인기글 전체 목록입니다.'
    : '전체 게시판 최신 글 목록입니다.';

  useSeo({
    title: sort === 'hot' ? `인기글 ${window}` : '최신글',
    description: sort === 'hot'
      ? `${window} 기준 커뮤니티 인기 게시글 목록`
      : '커뮤니티 최신 게시글 목록',
    url: sort === 'hot' ? `/community/posts?sort=hot&window=${window}` : '/community/posts',
  });

  return (
    <div className="animate-fade-up">
      <section className="mb-4">
        <h1 className="font-display text-2xl font-bold text-ink-950 tracking-tight text-balance">
          {heading}
        </h1>
        <p className="mt-1 text-xs text-ink-500 max-w-md">
          {description}
        </p>
      </section>

      <PostListPage
        categoryId={null}
        categoryName="전체"
        title={sort === 'hot' ? '전체 인기글' : '전체 최신글'}
        initialSort={sort}
        initialWindow={window}
      />
    </div>
  );
}

export default CommunityPostsPage;
