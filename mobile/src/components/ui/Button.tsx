import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'

import { radius, spacing } from '../../theme'
import { useAppTheme } from '../../theme/useAppTheme'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  loading?: boolean
  disabled?: boolean
  compact?: boolean
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  compact = false,
}: ButtonProps) {
  const { colors } = useAppTheme()
  const inactive = disabled || loading

  const background =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.dangerSoft
        : variant === 'secondary'
          ? colors.surfaceMuted
          : 'transparent'
  const textColor =
    variant === 'primary'
      ? colors.onPrimary
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.text
          : colors.primary
  const borderColor =
    variant === 'secondary'
      ? colors.border
      : variant === 'danger'
        ? colors.dangerSoft
        : 'transparent'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor,
          opacity: inactive ? 0.55 : pressed ? 0.85 : 1,
          paddingVertical: compact ? 10 : 14,
          paddingHorizontal: compact ? spacing.lg : spacing.xl,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text
          style={[
            styles.label,
            { color: textColor, fontSize: compact ? 14 : 15 },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.1,
  },
})
