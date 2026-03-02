import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { postsAPI } from '../../services/api';

const TYPE_LABELS = {
  PROJECT: '프로젝트',
  STUDY: '스터디',
  HACKATHON: '해커톤/공모전',
  CLUB: '동아리/커뮤니티',
  ETC: '기타',
};

const getDdayLabel = (deadlineAt) => {
  if (!deadlineAt) return '-';
  const target = new Date(deadlineAt);
  if (Number.isNaN(target.getTime())) return '-';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.floor((startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000);

  if (diffDays < 0) return '마감';
  if (diffDays === 0) return 'D-day';
  return `D-${diffDays}`;
};

function OpenRecruitsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['community', 'open-recruits'],
    queryFn: () => postsAPI.getPosts(1, 3, '', null, 'deadline', '24h', {
      postType: 'RECRUIT',
      recruitStatus: 'OPEN',
    }),
    staleTime: 60_000,
  });

  const posts = data?.data?.posts || [];

  if (isLoading) {
    return (
      <section className="mb-4 card rounded-xl p-4">
        <p className="text-xs text-ink-400">열린 모집을 불러오는 중입니다.</p>
      </section>
    );
  }

  if (posts.length === 0) {
    return null;
  }

  return (
    <section className="mb-4 card rounded-xl overflow-hidden">
      <header className="px-4 py-3 border-b border-ink-100 bg-paper-50 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-900">Open Recruits</h2>
        <Link
          to="/community/recruits"
          className="text-xs text-ink-500 hover:text-ink-700 transition-colors"
        >
          전체 보기
        </Link>
      </header>

      <div className="divide-y divide-ink-100">
        {posts.map((post) => {
          const recruitMeta = post.recruit_meta || {};
          return (
            <Link
              key={post.id}
              to={`/posts/${post.id}`}
              className="px-4 py-3 block hover:bg-paper-50 transition-colors"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-ink-100 text-ink-700 border border-ink-200">
                  {TYPE_LABELS[recruitMeta.recruit_type] || recruitMeta.recruit_type || '모집'}
                </span>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-paper-200 text-ink-600 border border-ink-200">
                  {recruitMeta.is_online ? '온라인' : '오프라인'}
                </span>
                <span className="ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                  {getDdayLabel(recruitMeta.deadline_at)}
                </span>
              </div>

              <p className="text-sm font-semibold text-ink-900 line-clamp-1">{post.title}</p>
              <p className="mt-1 text-xs text-ink-500 line-clamp-1">
                일정: {recruitMeta.schedule_text || '-'}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default OpenRecruitsSection;
