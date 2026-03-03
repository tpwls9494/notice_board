import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authAPI } from '../services/api'

function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = (searchParams.get('token') || '').trim()
  const [status, setStatus] = useState(token ? 'loading' : 'error')
  const [message, setMessage] = useState(
    token ? 'Verifying your email...' : 'Verification token is missing.',
  )

  useEffect(() => {
    let cancelled = false

    const verify = async () => {
      if (!token) {
        setStatus('error')
        setMessage('Verification token is missing.')
        return
      }

      try {
        await authAPI.verifyEmail(token)
        if (cancelled) return
        setStatus('success')
        setMessage('Email verified successfully. You can now write posts and comments.')
      } catch (error) {
        if (cancelled) return
        const detail = error?.response?.data?.detail
        setStatus('error')
        setMessage(detail || 'Verification failed. The token is invalid or expired.')
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
        <h1 className="font-display text-2xl font-bold text-ink-950">Email Verification</h1>
        <p className="text-sm text-ink-500 mt-2">
          We are confirming your token now. You can close this page after verification.
        </p>

        <div className={`mt-6 rounded-xl border px-4 py-3 text-sm ${statusBadgeClass}`}>
          {message}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link to="/login" className="btn-accent px-4 py-2.5">
            Go to Login
          </Link>
          <Link
            to="/register"
            className="px-4 py-2.5 rounded-lg border border-ink-200 text-ink-700 hover:bg-ink-50 transition-colors"
          >
            Create Account
          </Link>
        </div>
      </div>
    </div>
  )
}

export default VerifyEmail
