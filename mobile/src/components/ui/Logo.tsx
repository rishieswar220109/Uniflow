import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'

import { useAppTheme } from '../../theme/useAppTheme'

interface LogoProps {
  compact?: boolean
}

export function Logo({ compact = false }: LogoProps) {
  const { colors } = useAppTheme()
  const markSize = compact ? 34 : 42

  return (
    <View style={styles.container} accessibilityLabel="UniFlow">
      <View
        style={[
          styles.mark,
          {
            width: markSize,
            height: markSize,
            borderRadius: markSize / 2.6,
            backgroundColor: colors.primarySoft,
          },
        ]}
      >
        <Ionicons
          name="shield-checkmark-outline"
          size={compact ? 19 : 23}
          color={colors.primary}
        />
      </View>
      <View>
        <Text
          style={[
            styles.name,
            { color: colors.text, fontSize: compact ? 16 : 18 },
          ]}
        >
          UniFlow
        </Text>
        {compact ? null : (
          <Text style={[styles.tagline, { color: colors.muted }]}>
            Personal finance, safeguarded
          </Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  tagline: {
    fontSize: 11,
    marginTop: 1,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
})
