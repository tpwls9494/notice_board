import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import { safeNextPath } from '../utils/auth'

export default function OAuthCallback({ onAuthenticated }) {
  const navigate = useNavigate()
  const [payload] = useState(() => Object.fromEntries(new URLSearchParams(window.location.search)))
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    window.history.replaceState(window.history.state, '', window.location.pathname)
    async function finish() {
      if (payload.session !== '1') { if (active) setFailed(true); return }
      try {
        const { data } = await authAPI.getSession()
        if (!data.user) throw new Error('Session was not established')
        if (active) onAuthenticated(data.user)
        if (active) navigate(safeNextPath(payload.next), { replace: true })
      } catch { if (active) setFailed(true) }
    }
    finish()
    return () => { active = false }
  }, [payload, navigate, onAuthenticated])
  return <div className="journal-state">{failed ? <><h1>로그인을 완료하지 못했습니다.</h1><p>다시 로그인해 주세요.</p><Link to="/login">로그인으로 돌아가기 →</Link></> : <p role="status">로그인을 확인하고 있습니다.</p>}</div>
}
