import { useQuery } from '@tanstack/react-query';
import { communityAPI } from '../../services/api';

function TodayStatsBar() {
  const { data, isError } = useQuery({
    queryKey: ['community', 'stats'],
    queryFn: () => communityAPI.getStats(),
    staleTime: 60_000,
  });

  if (isError) return null;

  const stats = data?.data;

  return (
    <div className="flex items-center gap-4 px-5 py-3 mb-6 bg-paper-100 rounded-xl border border-ink-100 text-sm">
      <span className="text-ink-400 font-medium">오늘</span>
      <div className="flex items-center gap-1.5">
        <svg className="w-4 h-4 text-ink-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <span className="font-semibold text-ink-800">{stats?.today_posts ?? '-'}</span>
        <span className="text-ink-400">새 글</span>
      </div>
      <div className="w-px h-4 bg-ink-200" />
      <div className="flex items-center gap-1.5">
        <svg className="w-4 h-4 text-ink-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
        <span className="font-semibold text-ink-800">{stats?.today_comments ?? '-'}</span>
        <span className="text-ink-400">댓글</span>
      </div>
      {stats?.active_users != null && (
        <>
          <div className="w-px h-4 bg-ink-200" />
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-ink-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span className="font-semibold text-ink-800">{stats.active_users}</span>
            <span className="text-ink-400">접속 중</span>
          </div>
        </>
      )}
    </div>
  );
}

export default TodayStatsBar;
