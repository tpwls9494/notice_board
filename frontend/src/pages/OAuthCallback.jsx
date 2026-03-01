import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import { trackAnalyticsEvent } from '../utils/analytics';

const OAUTH_ERROR_MESSAGES = {
  oauth_access_denied: '소셜 로그인 권한이 거부되었습니다.',
  oauth_missing_code: '소셜 로그인 인증 코드가 누락되었습니다.',
  oauth_invalid_state: '소셜 로그인 상태 검증에 실패했습니다.',
  oauth_provider_mismatch: '소셜 로그인 제공자 정보가 올바르지 않습니다.',
  oauth_not_configured: '소셜 로그인이 아직 설정되지 않았습니다.',
  oauth_exchange_failed: '소셜 로그인 처리 중 오류가 발생했습니다.',
  oauth_email_missing: '소셜 계정 이메일을 가져오지 못했습니다.',
  oauth_user_upsert_failed: '소셜 계정 연결 중 오류가 발생했습니다.',
  unsupported_provider: '지원하지 않는 소셜 로그인 제공자입니다.',
};

function normalizeNextPath(rawNext) {
  if (!rawNext || typeof rawNext !== 'string') {
    return '/community';
  }
  if (!rawNext.startsWith('/') || rawNext.startsWith('//')) {
    return '/community';
  }
  return rawNext;
}

function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setToken = useAuthStore((state) => state.setToken);
  const fetchUser = useAuthStore((state) => state.fetchUser);
  const [status, setStatus] = useState('processing');

  const errorMessage = useMemo(() => {
    const errorCode = searchParams.get('error');
    if (!errorCode) return null;
    return OAUTH_ERROR_MESSAGES[errorCode] || '소셜 로그인에 실패했습니다.';
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;

    const processCallback = async () => {
      const token = searchParams.get('token');
      const nextPath = normalizeNextPath(searchParams.get('next'));
      const provider = searchParams.get('provider') || 'oauth';

      if (!token) {
        if (mounted) {
          setStatus('error');
        }
        return;
      }

      try {
        setToken(token);
        await fetchUser();
        trackAnalyticsEvent('login_success', {
          method: 'oauth',
          provider,
          source: 'oauth_callback',
        });
        if (mounted) {
          setStatus('success');
          navigate(nextPath, { replace: true });
        }
      } catch (_error) {
        if (mounted) {
          setStatus('error');
        }
      }
    };

    processCallback();
    return () => {
      mounted = false;
    };
  }, [fetchUser, navigate, searchParams, setToken]);

  if (status === 'processing') {
    return (
      <div className="min-h-screen bg-paper-100 flex items-center justify-center px-6">
        <div className="card p-8 text-center w-full max-w-sm">
          <div className="w-8 h-8 mx-auto border-2 border-ink-200 border-t-ink-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-ink-600">소셜 로그인 처리 중입니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-100 flex items-center justify-center px-6">
      <div className="card p-8 text-center w-full max-w-sm">
        <p className="text-sm text-red-600 mb-4">{errorMessage || '로그인 처리에 실패했습니다.'}</p>
        <Link to="/community?login=true" className="btn-primary inline-flex">
          다시 로그인
        </Link>
      </div>
    </div>
  );
}

export default OAuthCallback;
