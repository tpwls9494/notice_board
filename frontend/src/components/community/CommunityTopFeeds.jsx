import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { communityAPI, postsAPI } from '../../services/api';
import { hasInlineAttachmentInContent } from '../../utils/richContent';
import AttachmentIcon from './AttachmentIcon';

const LIST_LIMIT = 5;
const LATEST_MORE_LINK = '/community/posts?sort=latest';
const HOT_MORE_LINK = '/community/posts?sort=hot&window=24h';

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

function FeedRows({ posts, isLoading = false }) {
  const visiblePosts = posts.slice(0, LIST_LIMIT);

  if (isLoading) {
    return (
      <div className="flex min-h-[230px] items-center px-4 py-3 text-xs text-ink-400">
        목록을 불러오는 중...
      </div>
    );
  }

  if (visiblePosts.length === 0) {
    return (
      <div className="min-h-[230px] px-4 pt-4 pb-3 text-xs text-ink-400">
        표시할 글이 없습니다.
      </div>
    );
  }

  return (
    <ul className="px-2.5 py-2.5 space-y-1.5">
      {visiblePosts.map((post) => {
        const author = post.author_username || '익명';
        const relativeTime = formatRelativeTime(post.created_at);
        const authorMeta = `${author} · ${relativeTime}`;
        const metaText = `조회 ${post.views || 0} · 댓글 ${post.comment_count || 0}`;
        const hasInlineAttachment = hasInlineAttachmentInContent(post.content);

        return (
          <li key={post.id}>
            <Link
              to={`/posts/${post.id}`}
              className="group block rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-ink-100 hover:bg-paper-50/90"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="min-w-0 flex items-center gap-1.5">
                    <h3 className="flex-1 truncate text-[14px] font-bold text-ink-900">
                      {post.title}
                    </h3>
                    {hasInlineAttachment && <AttachmentIcon />}
                  </div>
                  <p className="mt-1 truncate text-[12px] text-ink-400">
                    {authorMeta}
                  </p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-[12px] text-ink-500">
                  {metaText}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function FeedPanel({ title, posts, isLoading, moreLink }) {
  return (
    <section className="card rounded-xl overflow-hidden min-h-[312px] xl:min-h-[336px] flex flex-col">
      <header className="px-4 py-3 border-b border-ink-100">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold tracking-tight text-ink-900">{title}</h2>
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
          isLoading={isLoading}
        />
      </div>
    </section>
  );
}

function CommunityTopFeeds({ categoryId }) {
  const [mobileTab, setMobileTab] = useState('latest');

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
          moreLink={LATEST_MORE_LINK}
        />
        <FeedPanel
          title="인기글 (24h)"
          posts={hotPosts}
          isLoading={hotLoading}
          moreLink={HOT_MORE_LINK}
        />
      </div>

      <div className="md:hidden">
        {mobileTab === 'latest' ? (
          <FeedPanel
            title="최신글"
            posts={latestPosts}
            isLoading={latestLoading}
            moreLink={LATEST_MORE_LINK}
          />
        ) : (
          <FeedPanel
            title="인기글 (24h)"
            posts={hotPosts}
            isLoading={hotLoading}
            moreLink={HOT_MORE_LINK}
          />
        )}
      </div>
    </section>
  );
}

export default CommunityTopFeeds;
