import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { postsAPI } from '../../services/api';
import CommunityTabs from '../../components/community/CommunityTabs';
import useCategoriesStore from '../../stores/categoriesStore';
import useAuthStore from '../../stores/authStore';
import { sortCategoriesByOrder } from '../../utils/communityCategories';
import { useSeo } from '../../utils/seo';

const PAGE_SIZE = 12;

const RECRUIT_TYPE_OPTIONS = [
  { value: 'ALL', label: '전체 유형' },
  { value: 'PROJECT', label: '프로젝트' },
  { value: 'STUDY', label: '스터디' },
  { value: 'HACKATHON', label: '해커톤/공모전' },
  { value: 'CLUB', label: '동아리/커뮤니티' },
  { value: 'ETC', label: '기타' },
];

const RECRUIT_STATUS_OPTIONS = [
  { value: 'ALL', label: '전체 상태' },
  { value: 'OPEN', label: '모집중' },
  { value: 'CLOSED', label: '마감' },
];

const RECRUIT_ONLINE_OPTIONS = [
  { value: 'ALL', label: '온라인/오프라인 전체' },
  { value: 'ONLINE', label: '온라인' },
  { value: 'OFFLINE', label: '오프라인' },
];

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

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.floor((startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000);

  if (diffDays < 0) return '마감';
  if (diffDays === 0) return 'D-day';
  return `D-${diffDays}`;
};

function RecruitPostsPage() {
  const token = useAuthStore((state) => state.token);
  const { categories, fetchCategories } = useCategoriesStore();
  const [page, setPage] = useState(1);
  const [recruitType, setRecruitType] = useState('ALL');
  const [recruitStatus, setRecruitStatus] = useState('OPEN');
  const [recruitOnline, setRecruitOnline] = useState('ALL');

  useSeo({
    title: '모집 게시판',
    description: '프로젝트/스터디 모집 글을 모아서 보고 바로 지원해보세요.',
    url: '/community/recruits',
  });

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const sortedCategories = useMemo(() => {
    return sortCategoriesByOrder(categories);
  }, [categories]);

  const filterOptions = useMemo(() => ({
    postType: 'RECRUIT',
    recruitType: recruitType === 'ALL' ? null : recruitType,
    recruitStatus: recruitStatus === 'ALL' ? null : recruitStatus,
    recruitIsOnline: recruitOnline === 'ALL' ? null : recruitOnline === 'ONLINE',
  }), [recruitType, recruitStatus, recruitOnline]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['recruit-posts', page, filterOptions],
    queryFn: () => postsAPI.getPosts(page, PAGE_SIZE, '', null, 'deadline', '24h', filterOptions),
  });

  const posts = data?.data?.posts || [];
  const total = data?.data?.total || 0;
  const pageSize = data?.data?.page_size || PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="animate-fade-up">
      <section className="mb-4">
        <h1 className="font-display text-2xl font-extrabold text-ink-950 tracking-tight text-balance">
          모집 게시판
        </h1>
        <p className="mt-1 text-xs text-ink-500 max-w-lg">
          모집중인 프로젝트/스터디를 한 눈에 확인하고, 상세 페이지에서 바로 지원할 수 있습니다.
        </p>
      </section>

      <CommunityTabs
        categories={sortedCategories}
        showFollowing={Boolean(token)}
        activeTab="recruits"
      />

      <section className="card rounded-xl p-3 mb-4">
        <div className="grid md:grid-cols-3 gap-2">
          <select
            value={recruitType}
            onChange={(event) => {
              setRecruitType(event.target.value);
              setPage(1);
            }}
            className="input-field !py-2.5 !px-3 text-sm"
          >
            {RECRUIT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <select
            value={recruitStatus}
            onChange={(event) => {
              setRecruitStatus(event.target.value);
              setPage(1);
            }}
            className="input-field !py-2.5 !px-3 text-sm"
          >
            {RECRUIT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <select
            value={recruitOnline}
            onChange={(event) => {
              setRecruitOnline(event.target.value);
              setPage(1);
            }}
            className="input-field !py-2.5 !px-3 text-sm"
          >
            {RECRUIT_ONLINE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </section>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-14 gap-2">
          <div className="w-7 h-7 border-2 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
          <p className="text-sm text-ink-400">모집 글을 불러오는 중입니다.</p>
        </div>
      ) : isError ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-ink-500">모집 글을 불러오지 못했습니다.</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-ink-500">조건에 맞는 모집 글이 없습니다.</p>
        </div>
      ) : (
        <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {posts.map((post) => {
            const recruitMeta = post.recruit_meta || {};
            const ddayLabel = getDdayLabel(recruitMeta.deadline_at);
            const isOpen = recruitMeta.status === 'OPEN';
            return (
              <Link
                key={post.id}
                to={`/posts/${post.id}`}
                className="card-hover rounded-xl p-4 block"
              >
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-ink-100 text-ink-700 border border-ink-200">
                    {TYPE_LABELS[recruitMeta.recruit_type] || recruitMeta.recruit_type || '모집'}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                    isOpen
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      : 'bg-rose-100 text-rose-700 border-rose-200'
                  }`}
                  >
                    {isOpen ? '모집중' : '마감'}
                  </span>
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-paper-200 text-ink-600 border border-ink-200">
                    {recruitMeta.is_online ? '온라인' : '오프라인'}
                  </span>
                  <span className="ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                    {ddayLabel}
                  </span>
                </div>

                <h3 className="text-[15px] font-semibold text-ink-900 line-clamp-2 leading-snug min-h-[42px]">
                  {post.title}
                </h3>

                <div className="mt-3 space-y-1 text-xs text-ink-500">
                  <p className="truncate">일정: {recruitMeta.schedule_text || '-'}</p>
                  {!recruitMeta.is_online && recruitMeta.location_text && (
                    <p className="truncate">장소: {recruitMeta.location_text}</p>
                  )}
                  <p>모집 인원: 최대 {recruitMeta.headcount_max || '-'}명</p>
                  <p>
                    마감일:{' '}
                    {recruitMeta.deadline_at
                      ? new Intl.DateTimeFormat('ko-KR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(recruitMeta.deadline_at))
                      : '-'}
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-ink-100 flex items-center justify-between text-[11px] text-ink-400">
                  <span className="truncate max-w-[55%]">{post.author_username || '익명'}</span>
                  <span>
                    {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short' }).format(new Date(post.created_at))}
                  </span>
                </div>
              </Link>
            );
          })}
        </section>
      )}

      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="btn-ghost text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            이전
          </button>
          <span className="text-sm text-ink-500">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
            className="btn-ghost text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

export default RecruitPostsPage;
