import { StyleSheet, View, type ViewProps } from 'react-native'

import { radius, spacing } from '../../theme'
import { useAppTheme } from '../../theme/useAppTheme'

interface CardProps extends ViewProps {
  muted?: boolean
}

export function Card({ muted = false, style, ...props }: CardProps) {
  const { colors } = useAppTheme()

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: muted ? colors.surfaceMuted : colors.surface,
          borderColor: colors.border,
        },
        style,
      ]}
      {...props}
    />
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
})
