import { Link } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';

function CommunityHero({ onLoginClick }) {
  const { token } = useAuthStore();

  return (
    <section className="mb-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950 tracking-tight text-balance">
            커뮤니티
          </h1>
          <p className="mt-1.5 text-sm text-ink-500 max-w-md">
            개발/IT 이야기 + 유머 + 자료를 모으는 커뮤니티
          </p>
        </div>
        {token ? (
          <Link to="/posts/new" className="btn-primary text-sm flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="hidden sm:inline">글쓰기</span>
          </Link>
        ) : (
          <button onClick={onLoginClick} className="btn-secondary text-sm">
            로그인하고 글쓰기
          </button>
        )}
      </div>
    </section>
  );
}

export default CommunityHero;
