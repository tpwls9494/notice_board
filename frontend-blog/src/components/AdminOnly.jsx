import { Link, useLocation } from 'react-router-dom'

export default function AdminOnly({ children, user, ready }) {
  const status = !ready ? 'loading' : !user ? 'login' : user.can_write_blog === true ? 'allowed' : 'denied'
  const location = useLocation()
  if (status === 'loading') return <p className="journal-state" role="status">작성 화면을 준비하고 있습니다.</p>
  if (status !== 'allowed') return <div className="journal-state"><h1>{status === 'login' ? '로그인이 필요합니다.' : '블로그 작성자만 글을 쓸 수 있습니다.'}</h1><p><Link to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}>작성자 계정으로 로그인하기 →</Link></p></div>
  return children
}
