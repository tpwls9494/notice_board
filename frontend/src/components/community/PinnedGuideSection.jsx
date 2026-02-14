import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { communityAPI } from '../../services/api';

function PinnedGuideSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['community', 'pinned'],
    queryFn: () => communityAPI.getPinnedPosts(3),
    staleTime: 10 * 60_000,
  });

  const posts = data?.data || [];

  if (isLoading || posts.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="section-title mb-4">공지 & 가이드</h2>
      <div className="space-y-2">
        {posts.map((post) => (
          <Link
            key={post.id}
            to={`/posts/${post.id}`}
            className="card-hover block px-5 py-4"
          >
            <div className="flex items-center gap-3">
              <span className="badge-accent text-[11px] flex-shrink-0 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                고정
              </span>
              <h3 className="text-sm font-semibold text-ink-900 truncate flex-1">{post.title}</h3>
              <span className="text-xs text-ink-400 flex-shrink-0">
                {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short' }).format(new Date(post.created_at))}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default PinnedGuideSection;
