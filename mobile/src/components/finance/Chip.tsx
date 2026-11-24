import { Pressable, StyleSheet, Text } from 'react-native'

import { radius, spacing } from '../../theme'
import { useAppTheme } from '../../theme/useAppTheme'

export function Chip({
  label,
  active = false,
  onPress,
  disabled = false,
}: {
  label: string
  active?: boolean
  onPress: () => void
  disabled?: boolean
}) {
  const { colors } = useAppTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? colors.primarySoft : colors.surface,
          borderColor: active ? colors.primary : colors.border,
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: active ? colors.primarySoftText : colors.muted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
})
