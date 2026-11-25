import type { ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import {
  SafeAreaView,
  type Edge,
} from 'react-native-safe-area-context'

import { spacing } from '../../theme'
import { useAppTheme } from '../../theme/useAppTheme'

interface ScreenProps {
  children: ReactNode
  scroll?: boolean
  edges?: Edge[]
  contentStyle?: StyleProp<ViewStyle>
  keyboardAware?: boolean
}

export function Screen({
  children,
  scroll = true,
  edges = ['top', 'left', 'right'],
  contentStyle,
  keyboardAware = true,
}: ScreenProps) {
  const { colors } = useAppTheme()

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    children
  )

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.safe, { backgroundColor: colors.bg }]}
    >
      {keyboardAware ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
})
