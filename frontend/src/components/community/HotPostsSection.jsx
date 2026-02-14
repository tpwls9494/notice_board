import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { communityAPI } from '../../services/api';

function HotPostsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['community', 'hot', '24h'],
    queryFn: () => communityAPI.getHotPosts('24h', 6),
    staleTime: 5 * 60_000,
  });

  const posts = data?.data || [];

  if (isLoading) {
    return (
      <section className="mb-8">
        <h2 className="section-title mb-4 flex items-center gap-2">
          <span>인기 글</span>
          <span className="badge-accent text-xs">24h</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card px-5 py-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-ink-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-ink-100 rounded w-3/4" />
                  <div className="h-3 bg-ink-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (posts.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="section-title mb-4 flex items-center gap-2">
        <span>인기 글</span>
        <span className="badge-accent text-xs">24h</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {posts.map((post, index) => (
          <Link
            key={post.id}
            to={`/posts/${post.id}`}
            className={`card-hover block px-5 py-4 opacity-0 animate-fade-up stagger-${Math.min(index + 1, 8)}`}
          >
            <div className="flex items-start gap-3">
              <span className="flex w-7 h-7 rounded-lg bg-ink-950 text-paper-50 items-center justify-center flex-shrink-0 text-xs font-bold">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-ink-900 truncate">{post.title}</h3>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-ink-400">
                  {post.category_name && (
                    <span className="badge-default text-[10px]">{post.category_name}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                    </svg>
                    {post.likes_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                    {post.comment_count}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default HotPostsSection;
