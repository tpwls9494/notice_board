import { create } from 'zustand'

export const THEME_STORAGE_KEY = 'jion_theme'
export const THEME_LIGHT = 'light'
export const THEME_DARK = 'dark'

// Compatibility adapter. The head bootstrap owns persistence and OS sync.
const useThemeStore = create(() => ({
  theme: window.JionTheme?.get().resolved || 'light',
  setTheme: (value) => window.JionTheme?.set(value),
  toggleTheme: () => window.JionTheme?.set(window.JionTheme.get().resolved === 'dark' ? 'light' : 'dark'),
}))
window.addEventListener('jion-theme-change', () => {
  useThemeStore.setState({ theme: window.JionTheme.get().resolved })
})
export default useThemeStore
