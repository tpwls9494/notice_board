import { useQuery } from '@tanstack/react-query';
import { communityAPI, postsAPI } from '../../services/api';
import CommunityHeroConstellation from './CommunityHeroConstellation';

function CommunityHero() {
  const { data, isSuccess: isStatsSuccess } = useQuery({
    queryKey: ['community', 'stats'],
    queryFn: () => communityAPI.getStats(),
    staleTime: 60_000,
  });

  const { data: recruitCountData, isSuccess: isRecruitCountSuccess } = useQuery({
    queryKey: ['community', 'open-recruit-count'],
    queryFn: () => postsAPI.getPosts(1, 1, '', null, 'deadline', '24h', {
      postType: 'RECRUIT',
      recruitStatus: 'OPEN',
    }),
    staleTime: 60_000,
  });

  const stats = data?.data;
  const todayPosts = stats?.today_posts;
  const todayComments = stats?.today_comments;
  const openRecruitCount = recruitCountData?.data?.total;
  const shouldShowStatus = isStatsSuccess
    && isRecruitCountSuccess
    && Number.isFinite(todayPosts)
    && Number.isFinite(todayComments)
    && Number.isFinite(openRecruitCount);

  return (
    <section className="mb-3">
      <div className="relative overflow-hidden rounded-2xl border border-ink-200/70 bg-gradient-to-br from-paper-50/95 via-white/92 to-paper-200/72 px-5 py-4 sm:px-6 sm:py-5">
        <CommunityHeroConstellation />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-white/6 to-white/16" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/42 via-white/16 to-transparent" />

        <div className="relative z-10">
          <h1 className="font-display text-2xl font-extrabold text-ink-950 tracking-tight text-balance">
            커뮤니티
          </h1>
          <p className="mt-1 text-xs text-ink-500 max-w-md">
            질문·회고·자료 공유, 그리고 스터디/모집까지.
          </p>
          {shouldShowStatus && (
            <p className="mt-1.5 text-[11px] text-ink-400">
              오늘 새 글 {todayPosts} · 댓글 {todayComments} · 모집중 {openRecruitCount}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default CommunityHero;
