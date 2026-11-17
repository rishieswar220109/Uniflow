import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'

import { radius, spacing } from '../../theme'
import { useAppTheme } from '../../theme/useAppTheme'

type AlertTone = 'error' | 'success' | 'info' | 'warning'

const icons: Record<AlertTone, keyof typeof Ionicons.glyphMap> = {
  error: 'alert-circle-outline',
  success: 'checkmark-circle-outline',
  info: 'information-circle-outline',
  warning: 'warning-outline',
}

export function Alert({
  message,
  tone = 'error',
}: {
  message: string
  tone?: AlertTone
}) {
  const { colors } = useAppTheme()
  const palette = {
    error: { bg: colors.dangerSoft, fg: colors.danger },
    success: { bg: colors.successSoft, fg: colors.success },
    info: { bg: colors.primarySoft, fg: colors.primarySoftText },
    warning: { bg: colors.warningSoft, fg: colors.warning },
  }[tone]

  return (
    <View
      accessibilityRole="alert"
      style={[styles.container, { backgroundColor: palette.bg }]}
    >
      <Ionicons name={icons[tone]} size={18} color={palette.fg} />
      <Text style={[styles.message, { color: palette.fg }]}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  message: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
})
