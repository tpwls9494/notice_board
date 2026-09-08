import useTheme from '../hooks/useTheme'

export default function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme()
  const isDark = resolved === 'dark'
  const action = isDark ? '라이트 모드로 전환' : '다크 모드로 전환'
  return <div className="theme-control">
    <button
      type="button"
      className="theme-trigger"
      aria-label={action}
      title={preference === 'system' ? `기기 설정 사용 중 · ${action}` : action}
      onClick={() => setPreference(isDark ? 'light' : 'dark')}
    >{isDark ? 'Dark' : 'Light'}</button>
  </div>
}
