import { useEffect } from 'react'

import type { ThemePreference } from '../services/types'
import { applyTheme, watchSystemTheme } from '../utils/theme'

/** Keep the document theme in sync with the user's saved preference. */
export function useThemePreference(theme: ThemePreference | undefined): void {
  const preference = theme ?? 'system'

  useEffect(() => {
    applyTheme(preference)
    return watchSystemTheme(preference, () => applyTheme(preference))
  }, [preference])
}
