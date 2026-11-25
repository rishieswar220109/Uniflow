import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

import { Button } from '../src/components/ui/Button'
import { Logo } from '../src/components/ui/Logo'
import { Screen } from '../src/components/ui/Screen'
import { spacing } from '../src/theme'
import { useAppTheme } from '../src/theme/useAppTheme'

export default function NotFoundScreen() {
  const router = useRouter()
  const { colors } = useAppTheme()

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} contentStyle={styles.page}>
      <Logo compact />
      <View style={styles.center}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="compass-outline" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          This screen does not exist
        </Text>
        <Text style={[styles.copy, { color: colors.muted }]}>
          The page may have moved, or the link may be incomplete.
        </Text>
        <View style={styles.action}>
          <Button label="Return home" onPress={() => router.replace('/')} />
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  icon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  copy: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
  action: {
    alignSelf: 'stretch',
    paddingTop: spacing.md,
  },
})
