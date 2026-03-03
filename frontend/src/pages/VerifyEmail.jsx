import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { authAPI } from '../services/api'

function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = (searchParams.get('token') || '').trim()
  const [status, setStatus] = useState(token ? 'loading' : 'error')
  const [message, setMessage] = useState(token ? '이메일 인증을 확인하고 있습니다.' : '인증 토큰이 없습니다.')

  useEffect(() => {
    let cancelled = false

    const verify = async () => {
      if (!token) {
        setStatus('error')
        setMessage('인증 토큰이 없습니다.')
        return
      }

      try {
        await authAPI.verifyEmail(token)
        if (cancelled) return
        setStatus('success')
        setMessage('이메일 인증이 완료되었습니다. 이제 글/댓글/첨부 작성이 가능합니다.')
      } catch (error) {
        if (cancelled) return
        const detail = error?.response?.data?.detail
        setStatus('error')
        setMessage(detail || '인증에 실패했습니다. 토큰이 만료되었거나 올바르지 않습니다.')
      }
    }

    verify()
    return () => {
      cancelled = true
    }
  }, [token])

  const statusBadgeClass =
    status === 'success'
      ? 'bg-green-50 text-green-700 border-green-200'
      : status === 'loading'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : 'bg-red-50 text-red-700 border-red-200'

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper-100 bg-noise px-6 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-ink-100 bg-white p-8 shadow-[0_20px_60px_-20px_rgba(20,20,20,0.2)]">
        <h1 className="font-display text-2xl font-bold text-ink-950">이메일 인증</h1>
        <p className="text-sm text-ink-500 mt-2">인증 후 메인으로 돌아가서 계속 이용해 주세요.</p>

        <div className={`mt-6 rounded-xl border px-4 py-3 text-sm ${statusBadgeClass}`}>
          {message}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link to="/community" className="btn-accent px-4 py-2.5">
            메인으로 이동
          </Link>
          <Link
            to="/community?login=true"
            className="px-4 py-2.5 rounded-lg border border-ink-200 text-ink-700 hover:bg-ink-50 transition-colors"
          >
            로그인 열기
          </Link>
        </div>
      </div>
    </div>
  )
}

export default VerifyEmail
