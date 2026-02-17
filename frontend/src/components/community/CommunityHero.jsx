import { useQuery } from '@tanstack/react-query';
import { communityAPI } from '../../services/api';

function CommunityHero() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['community', 'stats'],
    queryFn: () => communityAPI.getStats(),
    staleTime: 60_000,
  });

  const stats = data?.data;
  const todayPosts = isError ? '-' : (stats?.today_posts ?? (isLoading ? '-' : 0));
  const todayComments = isError ? '-' : (stats?.today_comments ?? (isLoading ? '-' : 0));
  const todaySignups = isError ? '-' : (stats?.today_signups ?? (isLoading ? '-' : 0));

  return (
    <section className="mb-3">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950 tracking-tight text-balance">
          커뮤니티
        </h1>
        <p className="mt-1 text-xs text-ink-500 max-w-md">
          최신글, 인기글, 게시판별 최근 글을 한 화면에서 빠르게 확인하세요.
        </p>
        <p className="mt-1.5 text-[11px] text-ink-400">
          오늘 · 새 글 {todayPosts} · 댓글 {todayComments} · 가입 {todaySignups}
        </p>
      </div>
    </section>
  );
}

export default CommunityHero;
