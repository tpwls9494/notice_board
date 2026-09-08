import { useEffect, useState } from 'react'

export default function useTheme() {
  const [theme, setTheme] = useState(() => window.JionTheme?.get() || { preference: 'system', resolved: 'light' })
  useEffect(() => {
    const update = () => setTheme(window.JionTheme.get())
    window.addEventListener('jion-theme-change', update)
    update()
    return () => window.removeEventListener('jion-theme-change', update)
  }, [])
  return { ...theme, setPreference: (value) => window.JionTheme?.set(value) }
}
