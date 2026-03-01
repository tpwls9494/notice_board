import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { communityAPI } from '../../services/api';
import useAuthStore from '../../stores/authStore';

const WEEKLY_SUMMARY_DISMISS_KEY = 'community-weekly-summary-dismissed-week';

function getWeekStartKey(baseDate = new Date()) {
  const date = new Date(baseDate);
  const day = date.getDay();
  const diffToMonday = (day + 6) % 7;
  date.setDate(date.getDate() - diffToMonday);
  date.setHours(0, 0, 0, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}`;
}

function formatPeriod(periodStart, periodEnd) {
  const formatter = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' });
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return '지난 7일';
  }
  return `${formatter.format(start)} ~ ${formatter.format(end)}`;
}

function WeeklySummaryCard() {
  const { token } = useAuthStore();
  const currentWeekKey = useMemo(() => getWeekStartKey(), []);
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(WEEKLY_SUMMARY_DISMISS_KEY) === getWeekStartKey();
  });

  const { data, isLoading } = useQuery({
    queryKey: ['community', 'weekly-summary', currentWeekKey],
    queryFn: () => communityAPI.getWeeklySummary(5),
    enabled: Boolean(token) && !isDismissed,
    staleTime: 5 * 60 * 1000,
  });

  if (!token || isDismissed) return null;

  if (isLoading) {
    return (
      <section className="mb-4 rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
        <p className="text-sm text-ink-400">주간 요약을 불러오는 중입니다.</p>
      </section>
    );
  }

  const summary = data?.data;
  const posts = summary?.posts || [];
  if (!summary || posts.length === 0) return null;

  const periodLabel = formatPeriod(summary.period_start, summary.period_end);

  const handleDismissThisWeek = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(WEEKLY_SUMMARY_DISMISS_KEY, currentWeekKey);
    }
    setIsDismissed(true);
  };

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-ink-100 bg-gradient-to-br from-white via-paper-50 to-paper-100 shadow-soft">
      <header className="flex items-start justify-between gap-3 border-b border-ink-100/70 px-4 py-3.5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-500">Weekly Summary</p>
          <h2 className="mt-1 text-lg font-display font-semibold text-ink-900">이번 주 놓치면 아쉬운 글</h2>
          <p className="mt-1 text-xs text-ink-500">{periodLabel} 기준 상위 반응 게시글</p>
        </div>
        <button
          type="button"
          onClick={handleDismissThisWeek}
          className="rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink-500 transition-colors hover:bg-paper-100 hover:text-ink-700"
        >
          이번 주 닫기
        </button>
      </header>

      <ul className="space-y-1 px-2 py-2.5">
        {posts.map((post, index) => (
          <li key={post.id}>
            <Link
              to={`/posts/${post.id}`}
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/80"
            >
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink-200 bg-white text-xs font-bold text-ink-700">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900 group-hover:text-ink-950">{post.title}</p>
                <p className="mt-0.5 truncate text-[12px] text-ink-500">
                  {post.category_name || '일반'} | 좋아요 {post.likes_count || 0} | 댓글 {post.comment_count || 0} |
                  조회 {post.views || 0}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-end border-t border-ink-100/70 px-4 py-3">
        <Link
          to="/community/posts?sort=hot&window=7d"
          className="text-xs font-semibold text-ink-600 underline underline-offset-2 transition-colors hover:text-ink-900"
        >
          7일 인기글 전체 보기
        </Link>
      </div>
    </section>
  );
}

export default WeeklySummaryCard;
