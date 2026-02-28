import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { authAPI } from '../services/api';

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
      toast.error(`${provider} 소셜 로그인이 아직 설정되지 않았습니다.`);
      return;
    }
    const startUrl = authAPI.getOAuthStartUrl(provider, redirectUrl, nextPath);
    window.location.href = startUrl;
  };

  if (isLoading) {
    return null;
  }

  if (!providers.google && !providers.github) {
    return null;
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-px bg-ink-200 flex-1" />
        <span className="text-xs text-ink-400">소셜 로그인</span>
        <div className="h-px bg-ink-200 flex-1" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => startOAuth('google')}
          disabled={!providers.google}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white py-2.5 text-sm font-medium text-ink-700 hover:bg-paper-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="text-xs font-semibold">G</span>
          <span>Google</span>
        </button>

        <button
          type="button"
          onClick={() => startOAuth('github')}
          disabled={!providers.github}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink-200 bg-ink-950 py-2.5 text-sm font-medium text-white hover:bg-ink-900 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="text-xs font-semibold">GH</span>
          <span>GitHub</span>
        </button>
      </div>
    </div>
  );
}

export default SocialLoginButtons;
