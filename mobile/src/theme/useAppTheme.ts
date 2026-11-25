import { useMemo } from 'react'
import { useColorScheme } from 'react-native'

import { useAuth } from '../features/auth/AuthContext'
import { darkColors, lightColors, type AppColors, type ThemeMode } from './index'

export function useAppTheme(): { colors: AppColors; mode: ThemeMode } {
  const systemScheme = useColorScheme()
  const { user } = useAuth()
  const preference = user?.preferences.theme ?? 'system'

  return useMemo(() => {
    const mode: ThemeMode =
      preference === 'system'
        ? systemScheme === 'dark'
          ? 'dark'
          : 'light'
        : preference
    return { colors: mode === 'dark' ? darkColors : lightColors, mode }
  }, [preference, systemScheme])
}
