import type { ThemePreference } from '../services/types'

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function systemThemeIsDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(DARK_QUERY).matches
}

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') {
    return systemThemeIsDark() ? 'dark' : 'light'
  }
  return preference
}

export function applyTheme(preference: ThemePreference): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = resolveTheme(preference)
}

export function applyInitialTheme(): void {
  applyTheme('system')
}

export function watchSystemTheme(
  preference: ThemePreference,
  onChange: () => void,
): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => undefined
  }
  if (preference !== 'system') return () => undefined

  const media = window.matchMedia(DARK_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
