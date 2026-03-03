import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { authAPI } from '../services/api'
import useAuthStore from '../stores/authStore'

function Register() {
  const navigate = useNavigate()
  const { register, isLoading, error, clearError } = useAuthStore()
  const verificationInputClass = 'input-field !h-10 !px-3 !py-0 text-sm placeholder:text-sm'
  const inlineActionButtonClass = 'inline-flex h-10 min-w-[84px] shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-ink-200 bg-white px-3 text-sm font-semibold leading-none text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-60 disabled:cursor-not-allowed'

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [sendingCode, setSendingCode] = useState(false)
  const [verifyingCode, setVerifyingCode] = useState(false)
  const [verifiedEmail, setVerifiedEmail] = useState('')
  const [verificationTicket, setVerificationTicket] = useState('')

  const isEmailVerified = Boolean(verificationTicket) && verifiedEmail === email.trim()

  useEffect(() => {
    if (verifiedEmail && verifiedEmail !== email.trim()) {
      setVerificationTicket('')
      setVerifiedEmail('')
      setCode('')
    }
  }, [email, verifiedEmail])

  const handleSendCode = async () => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      toast.error('이메일을 먼저 입력해 주세요.')
      return
    }

    try {
      setSendingCode(true)
      await authAPI.sendSignupEmailCode(trimmedEmail)
      toast.success('인증 코드를 전송했습니다. 메일함을 확인해 주세요.')
    } catch (_error) {
      toast.success('인증 코드를 전송했습니다. 메일함을 확인해 주세요.')
    } finally {
      setSendingCode(false)
    }
  }

  const handleVerifyCode = async () => {
    const trimmedEmail = email.trim()
    const trimmedCode = code.trim()

    if (!trimmedEmail) {
      toast.error('이메일을 먼저 입력해 주세요.')
      return
    }
    if (!trimmedCode) {
      toast.error('인증 코드를 입력해 주세요.')
      return
    }

    try {
      setVerifyingCode(true)
      const response = await authAPI.confirmSignupEmailCode(trimmedEmail, trimmedCode)
      setVerificationTicket(response.data?.verification_ticket || '')
      setVerifiedEmail(trimmedEmail)
      toast.success('이메일 인증이 완료되었습니다.')
    } catch (verifyError) {
      const detail = verifyError?.response?.data?.detail || '인증 코드가 올바르지 않거나 만료되었습니다.'
      toast.error(detail)
    } finally {
      setVerifyingCode(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!isEmailVerified) {
      toast.error('이메일 인증을 먼저 완료해 주세요.')
      return
    }
    if (password !== confirmPassword) {
      toast.error('비밀번호가 일치하지 않습니다.')
      return
    }

    const success = await register(email.trim(), username.trim(), password, verificationTicket)
    if (success) {
      toast.success('회원가입이 완료되었습니다. 로그인 후 이용해 주세요.')
      navigate('/community?login=true')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper-100 bg-noise px-6 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <div className="text-center mb-10">
          <div className="w-12 h-12 bg-ink-950 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="font-display text-lg font-bold text-paper-50">J</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-ink-950 text-balance">jion</h1>
        </div>

        <div>
          <h2 className="font-display text-2xl font-bold text-ink-950 tracking-tight text-balance">
            회원가입
          </h2>
          <p className="text-sm text-ink-500 mt-1.5">
            이메일 인증 후 계정을 만들 수 있습니다.
          </p>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl animate-scale-in" role="alert">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-ink-700 mb-2">
              이메일
            </label>
            <div className="flex gap-1.5">
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  if (error) clearError()
                }}
                className={`${verificationInputClass} flex-1 min-w-0`}
                placeholder="name@example.com"
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={sendingCode}
                className={inlineActionButtonClass}
              >
                {sendingCode ? '전송 중' : '코드 전송'}
              </button>
            </div>
            <p className="text-xs text-ink-500 mt-1.5">
              가입 전에 이메일 인증이 필요합니다.
            </p>
          </div>

          <div>
            <label htmlFor="verification-code" className="block text-sm font-semibold text-ink-700 mb-2">
              인증 코드
            </label>
            <div className="flex gap-1.5">
              <input
                id="verification-code"
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className={`${verificationInputClass} flex-1 min-w-0`}
                placeholder="메일로 받은 코드 입력"
              />
              <button
                type="button"
                onClick={handleVerifyCode}
                disabled={verifyingCode}
                className={inlineActionButtonClass}
              >
                {verifyingCode ? '확인 중' : '인증 확인'}
              </button>
            </div>
            <p className={`text-xs mt-1.5 ${isEmailVerified ? 'text-green-700' : 'text-ink-500'}`}>
              {isEmailVerified ? '이메일 인증이 완료되었습니다.' : '코드를 확인한 뒤 아래 정보를 입력해 주세요.'}
            </p>
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-semibold text-ink-700 mb-2">
              닉네임
            </label>
            <input
              id="username"
              type="text"
              required
              minLength={2}
              autoComplete="username"
              disabled={!isEmailVerified}
              value={username}
              onChange={(event) => {
                setUsername(event.target.value)
                if (error) clearError()
              }}
              className="input-field disabled:bg-ink-100 disabled:text-ink-500"
              placeholder="닉네임 입력"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-ink-700 mb-2">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              disabled={!isEmailVerified}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                if (error) clearError()
              }}
              className="input-field disabled:bg-ink-100 disabled:text-ink-500"
              placeholder="최소 6자 이상"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-ink-700 mb-2">
              비밀번호 확인
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              disabled={!isEmailVerified}
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value)
                if (error) clearError()
              }}
              className="input-field disabled:bg-ink-100 disabled:text-ink-500"
              placeholder="비밀번호 재입력"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !isEmailVerified}
            className="btn-accent w-full mt-6 py-3 disabled:opacity-60"
          >
            {isLoading ? '가입 중...' : '회원가입'}
          </button>

          <p className="text-center text-sm text-ink-500 mt-6">
            이미 계정이 있나요?{' '}
            <button
              type="button"
              onClick={() => navigate('/community?login=true')}
              className="font-semibold text-ink-800 hover:text-ink-950 underline underline-offset-2 transition-colors duration-200"
            >
              로그인
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}

export default Register
