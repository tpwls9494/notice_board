import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { communityAPI, postsAPI } from '../../services/api';
import useCategoriesStore from '../../stores/categoriesStore';

const LIST_LIMIT = 5;
const LATEST_MORE_LINK = '/community/posts?sort=latest';
const HOT_MORE_LINK = '/community/posts?sort=hot&window=24h';

const CATEGORY_FALLBACK_SLUG = {
  '공지': 'notice',
  '자유': 'free',
  '유머': 'humor',
  '질문': 'qna',
  'IT 뉴스': 'dev-news',
  '팁 추천': 'tips',
  '프로젝트': 'showcase',
};

const CATEGORY_BAR_COLOR = {
  notice: '#A5B3C2',
  free: '#8EA3B3',
  humor: '#8FA598',
  qna: '#B5A48F',
  'dev-news': '#9CA9C1',
  tips: '#8EA7A5',
  showcase: '#AE9B9B',
  default: '#D4DDE6',
};

function resolveCategorySlug(post, categorySlugById) {
  if (post?.category_id != null && categorySlugById[post.category_id]) {
    return categorySlugById[post.category_id];
  }

  return CATEGORY_FALLBACK_SLUG[post?.category_name] || 'default';
}

function formatRelativeTime(dateValue) {
  if (!dateValue) return '방금 전';

  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return '방금 전';

  const diffMs = Date.now() - parsedDate.getTime();
  if (diffMs < 60_000) return '방금 전';

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) return `${diffMinutes}분 전`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}일 전`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}주 전`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}개월 전`;

  return `${Math.floor(diffDays / 365)}년 전`;
}

function FeedRows({ posts, showPopularity = false, isLoading = false, categorySlugById = {} }) {
  const visiblePosts = posts.slice(0, LIST_LIMIT);

  if (isLoading) {
    return (
      <div className="px-3 py-2 text-xs text-ink-400">
        목록을 불러오는 중...
      </div>
    );
  }

  if (visiblePosts.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-ink-400">
        표시할 글이 없습니다.
      </div>
    );
  }

  return (
    <ul className="px-2 py-2 space-y-1">
      {visiblePosts.map((post) => {
        const categorySlug = resolveCategorySlug(post, categorySlugById);
        const barColor = CATEGORY_BAR_COLOR[categorySlug] || CATEGORY_BAR_COLOR.default;
        const author = post.author_username || '익명';
        const relativeTime = formatRelativeTime(post.created_at);
        const authorMeta = `${author} · ${relativeTime}`;
        const metaText = showPopularity
          ? `추천 ${post.likes_count || 0} · 조회 ${post.views || 0} · 댓글 ${post.comment_count || 0}`
          : `댓글 ${post.comment_count || 0}`;

        return (
          <li key={post.id}>
            <Link
              to={`/posts/${post.id}`}
              className="group relative block rounded-lg border border-transparent px-3 py-2 pl-4 hover:bg-paper-50/90 hover:border-ink-100 transition-colors"
            >
              <span
                className="absolute left-1 top-2.5 bottom-2.5 w-[1.5px] rounded-full opacity-35 group-hover:opacity-80 transition-opacity"
                style={{ backgroundColor: barColor }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className="flex items-start gap-2 min-w-0">
                  {post.category_name && (
                    <span className="mt-[1px] inline-flex items-center rounded-full border border-ink-100 bg-paper-50 px-1.5 py-[2px] text-[11px] font-medium text-ink-500 shrink-0 leading-none">
                      {post.category_name}
                    </span>
                  )}
                  <h3 className="truncate text-[14px] font-semibold text-ink-900 flex-1">
                    {post.title}
                  </h3>
                </div>

                <div className="mt-1 flex items-center justify-between gap-2 text-[12px] text-ink-400">
                  <span className="truncate">{authorMeta}</span>
                  <span className="shrink-0 whitespace-nowrap">{metaText}</span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function FeedPanel({ title, posts, isLoading, showPopularity = false, categorySlugById, moreLink }) {
  return (
    <section className="card rounded-xl overflow-hidden min-h-[280px] flex flex-col">
      <header className="px-3.5 py-2.5 border-b border-ink-100">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink-900">{title}</h2>
          <Link
            to={moreLink}
            className="text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors"
          >
            더보기
          </Link>
        </div>
      </header>
      <div className="flex-1">
        <FeedRows
          posts={posts}
          showPopularity={showPopularity}
          isLoading={isLoading}
          categorySlugById={categorySlugById}
        />
      </div>
    </section>
  );
}

function CommunityTopFeeds({ categoryId }) {
  const [mobileTab, setMobileTab] = useState('latest');
  const { categories, fetchCategories } = useCategoriesStore();

  useEffect(() => {
    if (categories.length === 0) {
      fetchCategories();
    }
  }, [categories.length, fetchCategories]);

  const { data: latestData, isLoading: latestLoading } = useQuery({
    queryKey: ['community', 'latest', categoryId],
    queryFn: () => postsAPI.getPosts(1, LIST_LIMIT, '', categoryId, 'latest'),
    staleTime: 60_000,
  });

  const { data: hotData, isLoading: hotLoading } = useQuery({
    queryKey: ['community', 'hot', '24h', categoryId],
    queryFn: () => communityAPI.getHotPosts('24h', LIST_LIMIT, categoryId),
    staleTime: 60_000,
  });

  const latestPosts = useMemo(
    () => latestData?.data?.posts || [],
    [latestData]
  );
  const hotPosts = useMemo(() => hotData?.data || [], [hotData]);
  const categorySlugById = useMemo(() => {
    const map = {};
    categories.forEach((category) => {
      map[category.id] = category.slug;
    });
    return map;
  }, [categories]);

  return (
    <section className="mb-4">
      <div className="flex md:hidden items-center gap-1.5 mb-2">
        <button
          onClick={() => setMobileTab('latest')}
          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
            mobileTab === 'latest'
              ? 'bg-ink-900 text-paper-50 border-ink-900'
              : 'bg-white text-ink-600 border-ink-200 hover:bg-paper-100'
          }`}
        >
          최신글
        </button>
        <button
          onClick={() => setMobileTab('hot')}
          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
            mobileTab === 'hot'
              ? 'bg-ink-900 text-paper-50 border-ink-900'
              : 'bg-white text-ink-600 border-ink-200 hover:bg-paper-100'
          }`}
        >
          인기글 24h
        </button>
      </div>

      <div className="hidden md:grid md:grid-cols-2 gap-3">
        <FeedPanel
          title="최신글"
          posts={latestPosts}
          isLoading={latestLoading}
          categorySlugById={categorySlugById}
          moreLink={LATEST_MORE_LINK}
        />
        <FeedPanel
          title="인기글 (24h)"
          posts={hotPosts}
          isLoading={hotLoading}
          showPopularity
          categorySlugById={categorySlugById}
          moreLink={HOT_MORE_LINK}
        />
      </div>

      <div className="md:hidden">
        {mobileTab === 'latest' ? (
          <FeedPanel
            title="최신글"
            posts={latestPosts}
            isLoading={latestLoading}
            categorySlugById={categorySlugById}
            moreLink={LATEST_MORE_LINK}
          />
        ) : (
          <FeedPanel
            title="인기글 (24h)"
            posts={hotPosts}
            isLoading={hotLoading}
            showPopularity
            categorySlugById={categorySlugById}
            moreLink={HOT_MORE_LINK}
          />
        )}
      </div>
    </section>
  );
}

export default CommunityTopFeeds;
