import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { communityAPI } from '../../services/api';
import useAuthStore from '../../stores/authStore';

const WEEKLY_SUMMARY_DISMISS_KEY = 'community-weekly-summary-dismissed-week';
const COMMUNITY_LAST_VISIT_KEY = 'community-last-visit-at';
const INACTIVE_DAYS = 7;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SUMMARY_LIMIT = 3;

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
  const [isReady, setIsReady] = useState(false);
  const [isInactiveUser, setIsInactiveUser] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(WEEKLY_SUMMARY_DISMISS_KEY) === getWeekStartKey();
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const now = new Date();
    const lastVisitRaw = localStorage.getItem(COMMUNITY_LAST_VISIT_KEY);
    const lastVisit = lastVisitRaw ? new Date(lastVisitRaw) : null;
    const isInactive =
      !lastVisit ||
      Number.isNaN(lastVisit.getTime()) ||
      now.getTime() - lastVisit.getTime() >= INACTIVE_DAYS * ONE_DAY_MS;

    setIsInactiveUser(isInactive);
    localStorage.setItem(COMMUNITY_LAST_VISIT_KEY, now.toISOString());
    setIsReady(true);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['community', 'weekly-summary', currentWeekKey, SUMMARY_LIMIT],
    queryFn: () => communityAPI.getWeeklySummary(SUMMARY_LIMIT),
    enabled: Boolean(token) && isReady && isInactiveUser && !isDismissed,
    staleTime: 5 * 60 * 1000,
  });

  if (!token || !isReady || !isInactiveUser || isDismissed) return null;

  if (isLoading) {
    return (
      <section className="mb-3 rounded-xl border border-ink-100 bg-white px-3 py-2">
        <p className="text-xs text-ink-400">주간 요약을 확인하는 중입니다.</p>
      </section>
    );
  }

  const summary = data?.data;
  const posts = (summary?.posts || []).slice(0, SUMMARY_LIMIT);
  if (!summary || posts.length === 0) return null;

  const periodLabel = formatPeriod(summary.period_start, summary.period_end);

  const handleDismissThisWeek = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(WEEKLY_SUMMARY_DISMISS_KEY, currentWeekKey);
    }
    setIsDismissed(true);
  };

  return (
    <section className="mb-3 rounded-xl border border-ink-100 bg-white px-3 py-2.5">
      <header className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold tracking-wide text-ink-500">
            주간 요약 | {periodLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismissThisWeek}
          className="shrink-0 rounded-md border border-ink-200 px-2 py-1 text-[11px] text-ink-500 hover:bg-paper-100"
        >
          이번 주 닫기
        </button>
      </header>

      <ul className="space-y-1">
        {posts.map((post) => (
          <li key={post.id}>
            <Link
              to={`/posts/${post.id}`}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-700 transition-colors hover:bg-paper-100 hover:text-ink-900"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-400" aria-hidden="true" />
              <span className="min-w-0 truncate">{post.title}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-1.5 flex justify-end">
        <Link
          to="/community/posts?sort=hot&window=7d"
          className="text-[11px] font-medium text-ink-500 underline underline-offset-2 hover:text-ink-700"
        >
          7일 인기글 보기
        </Link>
      </div>
    </section>
  );
}

export default WeeklySummaryCard;
