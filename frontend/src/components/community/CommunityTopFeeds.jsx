import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { communityAPI, postsAPI } from '../../services/api';

const LIST_LIMIT = 6;

function FeedRows({ posts, showPopularity = false, isLoading = false }) {
  if (isLoading) {
    return (
      <div className="px-3 py-2 text-xs text-ink-400">
        목록을 불러오는 중...
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-ink-400">
        표시할 글이 없습니다.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-ink-100">
      {posts.map((post) => (
        <li key={post.id}>
          <Link
            to={`/posts/${post.id}`}
            className="block px-3 py-2 hover:bg-paper-50 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0 text-[13px]">
              {post.category_name && (
                <span className="badge-default text-[10px] px-1.5 py-0 leading-5">
                  {post.category_name}
                </span>
              )}
              <span className="truncate text-ink-900 font-medium flex-1">
                {post.title}
              </span>
              <span className="text-[11px] text-ink-500 shrink-0">
                댓글 {post.comment_count || 0}
              </span>
            </div>
            {showPopularity && (
              <div className="mt-1 pl-0.5 flex items-center gap-2 text-[11px] text-ink-400">
                <span>추천 {post.likes_count || 0}</span>
                <span>댓글 {post.comment_count || 0}</span>
                <span>조회 {post.views || 0}</span>
              </div>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FeedPanel({ title, posts, isLoading, showPopularity = false }) {
  return (
    <section className="card rounded-xl overflow-hidden">
      <header className="px-3 py-2.5 border-b border-ink-100 bg-paper-50">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
      </header>
      <FeedRows
        posts={posts}
        showPopularity={showPopularity}
        isLoading={isLoading}
      />
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
        />
        <FeedPanel
          title="인기글 (24h)"
          posts={hotPosts}
          isLoading={hotLoading}
          showPopularity
        />
      </div>

      <div className="md:hidden">
        {mobileTab === 'latest' ? (
          <FeedPanel
            title="최신글"
            posts={latestPosts}
            isLoading={latestLoading}
          />
        ) : (
          <FeedPanel
            title="인기글 (24h)"
            posts={hotPosts}
            isLoading={hotLoading}
            showPopularity
          />
        )}
      </div>
    </section>
  );
}

export default CommunityTopFeeds;
