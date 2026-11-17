import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'

import { radius, spacing } from '../../theme'
import { useAppTheme } from '../../theme/useAppTheme'

type BadgeTone = 'success' | 'neutral' | 'warning' | 'primary'

export function Badge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string
  tone?: BadgeTone
  icon?: keyof typeof Ionicons.glyphMap
}) {
  const { colors } = useAppTheme()
  const palette = {
    success: { bg: colors.successSoft, fg: colors.success },
    neutral: { bg: colors.surfaceMuted, fg: colors.muted },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    primary: { bg: colors.primarySoft, fg: colors.primarySoftText },
  }[tone]

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={palette.fg} /> : null}
      <Text style={[styles.text, { color: palette.fg }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
})
