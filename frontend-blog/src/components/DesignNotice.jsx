import { useState } from 'react'
import api from '../services/api'

export default function DesignNotice() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  async function startPreview(destination = 'reader') {
    setPending(true)
    try {
      await api.post(destination === 'reader' ? '/auth/preview-session' : '/auth/preview-writer')
      window.location.assign(destination === 'manage' ? '/admin/posts' : destination === 'writer' ? '/write' : '/design-note-1#comments')
    } catch {
      setError('미리보기 연결을 확인해 주세요.')
      setPending(false)
    }
  }
  return <div className="design-notice">디자인 미리보기 · 글과 반응은 로컬에만 저장됩니다. <button disabled={pending} onClick={() => startPreview('reader')}>좋아요·댓글 체험 ↗</button><button disabled={pending} onClick={() => startPreview('writer')}>글쓰기 체험 ↗</button><button disabled={pending} onClick={() => startPreview('manage')}>{pending ? '연결 중…' : '기록 관리 체험 ↗'}</button>{error && <span role="alert"> {error}</span>}</div>
}
