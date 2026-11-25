import { StyleSheet, Switch, Text, View } from 'react-native'

import { spacing } from '../../theme'
import { useAppTheme } from '../../theme/useAppTheme'

interface SwitchFieldProps {
  label: string
  description?: string
  value: boolean
  onValueChange: (value: boolean) => void
  disabled?: boolean
}

export function SwitchField({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
}: SwitchFieldProps) {
  const { colors } = useAppTheme()

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, { color: colors.muted }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.borderStrong, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
  },
})
