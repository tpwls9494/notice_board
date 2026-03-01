import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { authAPI } from '../services/api';

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9A6 6 0 1 1 12 6a5.4 5.4 0 0 1 3.9 1.5l2.6-2.5A9.2 9.2 0 0 0 12 2.5a9.5 9.5 0 1 0 0 19c5.5 0 9.1-3.8 9.1-9.2 0-.6-.1-1.1-.2-1.6H12z" />
      <path fill="#34A853" d="M3.8 7.9l3.2 2.3A5.9 5.9 0 0 1 12 6c1.5 0 2.9.5 3.9 1.5l2.6-2.5A9.2 9.2 0 0 0 12 2.5 9.5 9.5 0 0 0 3.8 7.9z" />
      <path fill="#FBBC05" d="M12 21.5c2.5 0 4.6-.8 6.1-2.3l-2.8-2.3A5.8 5.8 0 0 1 12 18a6 6 0 0 1-5.6-4l-3.3 2.5A9.5 9.5 0 0 0 12 21.5z" />
      <path fill="#4285F4" d="M21.1 12.3c0-.7-.1-1.3-.2-1.9H12v3.9h5.5c-.2 1.2-.9 2.2-2 2.9l2.8 2.3c1.7-1.6 2.8-4 2.8-7.2z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.2-3.4-1.2-.4-1-.9-1.3-.9-1.3-.8-.6 0-.6 0-.6.8.1 1.3.8 1.3.8.8 1.3 2 1 2.5.8.1-.5.3-1 .6-1.2-2.2-.2-4.5-1.1-4.5-4.9 0-1.1.4-2 1-2.8-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.3 9.3 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.7.8 1 1.7 1 2.8 0 3.8-2.3 4.6-4.5 4.9.4.3.7.9.7 1.8V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z" />
    </svg>
  );
}

function SocialLoginButtons({ className = '' }) {
  const [providers, setProviders] = useState({ google: false, github: false });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadProviders = async () => {
      try {
        const response = await authAPI.getOAuthProviders();
        if (!mounted) return;
        setProviders({
          google: Boolean(response.data?.google),
          github: Boolean(response.data?.github),
        });
      } catch (_error) {
        if (!mounted) return;
        setProviders({ google: false, github: false });
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadProviders();
    return () => {
      mounted = false;
    };
  }, []);

  const nextPath = useMemo(() => {
    if (typeof window === 'undefined') return '/community';
    return `${window.location.pathname}${window.location.search}${window.location.hash}` || '/community';
  }, []);

  const redirectUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/oauth/callback`;
  }, []);

  const startOAuth = (provider) => {
    if (!providers[provider]) {
      toast.error(`${provider} 소셜 로그인 설정이 아직 활성화되지 않았습니다.`);
      return;
    }
    const startUrl = authAPI.getOAuthStartUrl(provider, redirectUrl, nextPath);
    window.location.href = startUrl;
  };

  if (isLoading) return null;
  if (!providers.google && !providers.github) return null;

  return (
    <div className={className}>
      <div className="mb-3 flex items-center gap-3">
        <div className="h-px flex-1 bg-ink-200" />
        <span className="text-xs font-medium tracking-wide text-ink-500">소셜 계정으로 간편 로그인</span>
        <div className="h-px flex-1 bg-ink-200" />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => startOAuth('google')}
          disabled={!providers.google}
          className="group inline-flex items-center justify-center gap-2 rounded-xl border border-[#DADCE0] bg-white px-3 py-2.5 text-sm font-semibold text-[#3C4043] shadow-sm transition hover:bg-[#F8F9FA] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#E6E8EB] bg-white">
            <GoogleIcon />
          </span>
          <span className="leading-none">Google로 계속하기</span>
        </button>

        <button
          type="button"
          onClick={() => startOAuth('github')}
          disabled={!providers.github}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#1f2328] bg-[#24292f] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1f2328] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#1f2328]">
            <GitHubIcon />
          </span>
          <span className="leading-none">GitHub로 계속하기</span>
        </button>
      </div>
    </div>
  );
}

export default SocialLoginButtons;
