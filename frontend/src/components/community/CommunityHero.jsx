import { useQuery } from '@tanstack/react-query';
import { communityAPI } from '../../services/api';
import CommunityHeroConstellation from './CommunityHeroConstellation';

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
      <div className="relative overflow-hidden rounded-2xl border border-ink-200/70 bg-gradient-to-br from-paper-50/95 via-white/92 to-paper-200/72 px-5 py-4 sm:px-6 sm:py-5">
        <CommunityHeroConstellation />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 via-white/14 to-white/28" />

        <div className="relative z-10">
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
      </div>
    </section>
  );
}

export default CommunityHero;
