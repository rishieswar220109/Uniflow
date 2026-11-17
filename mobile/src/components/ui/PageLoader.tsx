import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { spacing } from '../../theme'
import { useAppTheme } from '../../theme/useAppTheme'

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  const { colors } = useAppTheme()

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
})
