export type ThemeMode = 'light' | 'dark'

export const lightColors = {
  bg: '#f4f7f4',
  surface: '#ffffff',
  surfaceMuted: '#eef3ef',
  surfaceInset: '#f7faf8',
  text: '#13221e',
  muted: '#5b6f68',
  subtle: '#7c8f88',
  border: '#dbe4de',
  borderStrong: '#c3d1c9',
  primary: '#0c6b56',
  primaryPressed: '#084839',
  primarySoft: '#e0f2eb',
  primarySoftText: '#095b4a',
  onPrimary: '#ffffff',
  accent: '#a85a08',
  accentSoft: '#fdf3de',
  danger: '#b42318',
  dangerSoft: '#fee4e2',
  success: '#067647',
  successSoft: '#dcfae6',
  warning: '#b54708',
  warningSoft: '#fef0c7',
  overlay: 'rgba(9, 32, 26, 0.35)',
} as const

export type AppColors = {
  [K in keyof typeof lightColors]: string
}

export const darkColors: AppColors = {
  bg: '#0b1512',
  surface: '#111e1a',
  surfaceMuted: '#172722',
  surfaceInset: '#0e1a16',
  text: '#e9f2ed',
  muted: '#a2b4ad',
  subtle: '#849790',
  border: '#223630',
  borderStrong: '#2f4740',
  primary: '#45d6a4',
  primaryPressed: '#86ecc6',
  primarySoft: '#14362c',
  primarySoftText: '#8af0c9',
  onPrimary: '#04251c',
  accent: '#f0b35b',
  accentSoft: '#352816',
  danger: '#ff9b92',
  dangerSoft: '#3a1a18',
  success: '#6ce9a6',
  successSoft: '#113225',
  warning: '#f6c26a',
  warningSoft: '#352713',
  overlay: 'rgba(0, 0, 0, 0.55)',
}

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 28,
  pill: 999,
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const shadows = {
  card: {
    shadowColor: '#102820',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  raised: {
    shadowColor: '#092b22',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 8,
  },
} as const
