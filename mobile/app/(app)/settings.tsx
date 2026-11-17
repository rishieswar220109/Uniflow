import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  Alert as NativeAlert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { Alert } from '../../src/components/ui/Alert'
import { Badge } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { Card } from '../../src/components/ui/Card'
import { Screen } from '../../src/components/ui/Screen'
import { SwitchField } from '../../src/components/ui/SwitchField'
import { useAuth } from '../../src/features/auth/AuthContext'
import { userApi } from '../../src/services/userApi'
import type {
  PreferencesUpdate,
  ThemePreference,
  UserPreferences,
} from '../../src/services/types'
import { radius, spacing } from '../../src/theme'
import { useAppTheme } from '../../src/theme/useAppTheme'
import { extractApiError } from '../../src/utils/errors'

const themeOptions: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

type PreferenceKey = keyof PreferencesUpdate

export default function SettingsScreen() {
  const router = useRouter()
  const { user, updateUser, logout } = useAuth()
  const { colors, mode } = useAppTheme()
  const [savingKey, setSavingKey] = useState<PreferenceKey | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  if (!user) return null

  const savePreference = async (
    key: PreferenceKey,
    value: UserPreferences[PreferenceKey],
  ) => {
    setApiError(null)
    setSuccess(null)
    setSavingKey(key)
    try {
      const preferences = await userApi.updatePreferences({ [key]: value })
      updateUser({ ...user, preferences })
      setSuccess('Preferences saved.')
    } catch (error) {
      setApiError(extractApiError(error))
    } finally {
      setSavingKey(null)
    }
  }

  const confirmSignOut = () => {
    NativeAlert.alert(
      'Sign out?',
      'You will need to sign in again to access your Guardian workspace.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setSigningOut(true)
              await logout()
              router.replace('/login')
            })()
          },
        },
      ],
    )
  }

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Preferences sync across your web and mobile sessions.
        </Text>
      </View>

      {apiError ? <Alert message={apiError} /> : null}
      {success ? <Alert message={success} tone="success" /> : null}

      <Card>
        <View style={styles.sectionHead}>
          <View style={styles.sectionHeadCopy}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Appearance
            </Text>
            <Text style={[styles.sectionCopy, { color: colors.muted }]}>
              Currently using the {mode} theme on this device.
            </Text>
          </View>
          {savingKey === 'theme' ? <Badge label="Saving" tone="primary" /> : null}
        </View>

        <View
          style={[styles.segmented, { backgroundColor: colors.surfaceMuted }]}
        >
          {themeOptions.map((option) => {
            const selected = user.preferences.theme === option.value
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={savingKey !== null}
                onPress={() => savePreference('theme', option.value)}
                style={[
                  styles.segment,
                  selected && {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    {
                      color: selected ? colors.text : colors.muted,
                      fontWeight: selected ? '700' : '500',
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </Card>

      <Card>
        <View style={styles.sectionHead}>
          <View style={styles.sectionHeadCopy}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Notifications
            </Text>
            <Text style={[styles.sectionCopy, { color: colors.muted }]}>
              Choose what Guardian may send when alerts launch in later phases.
            </Text>
          </View>
        </View>

        <SwitchField
          label="Email notifications"
          description="Important account and payment alerts by email."
          value={user.preferences.email_notifications}
          onValueChange={(value) => savePreference('email_notifications', value)}
          disabled={savingKey !== null}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SwitchField
          label="Push notifications"
          description="Time-sensitive updates on this device."
          value={user.preferences.push_notifications}
          onValueChange={(value) => savePreference('push_notifications', value)}
          disabled={savingKey !== null}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SwitchField
          label="Weekly summary"
          description="A concise overview once financial data is connected."
          value={user.preferences.weekly_summary}
          onValueChange={(value) => savePreference('weekly_summary', value)}
          disabled={savingKey !== null}
        />
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Regional preferences
        </Text>
        <View style={styles.detailRow}>
          <View style={styles.detailCopy}>
            <Text style={[styles.detailLabel, { color: colors.text }]}>
              Currency
            </Text>
            <Text style={[styles.detailHint, { color: colors.muted }]}>
              Applied to financial views in Phase 2.
            </Text>
          </View>
          <Text style={[styles.detailValue, { color: colors.muted }]}>
            {user.preferences.currency}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.detailRow}>
          <View style={styles.detailCopy}>
            <Text style={[styles.detailLabel, { color: colors.text }]}>
              Time zone
            </Text>
            <Text style={[styles.detailHint, { color: colors.muted }]}>
              Used for payment dates and reminders.
            </Text>
          </View>
          <Text
            style={[styles.detailValue, { color: colors.muted }]}
            numberOfLines={1}
          >
            {user.preferences.timezone}
          </Text>
        </View>
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Security &amp; session
        </Text>
        <View style={styles.infoRow}>
          <Ionicons name="shield-checkmark-outline" size={17} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.muted }]}>
            Access tokens are short-lived and held in memory.
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="key-outline" size={17} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.muted }]}>
            The rotating refresh token is stored in the device keychain or
            keystore, never in plain app storage.
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={17} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.muted }]}>
            Signed in as {user.email}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Button
          label="Sign out securely"
          variant="danger"
          onPress={confirmSignOut}
          loading={signingOut}
        />
      </Card>

      <Text style={[styles.footer, { color: colors.subtle }]}>
        AI Payment Guardian · Phase 1 secure foundation
      </Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  heading: {
    gap: 4,
    paddingTop: spacing.sm,
  },
  title: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  sectionHeadCopy: {
    flex: 1,
    gap: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionCopy: {
    fontSize: 12,
    lineHeight: 18,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: 9,
  },
  segmentLabel: {
    fontSize: 13,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 4,
  },
  detailCopy: {
    flex: 1,
    gap: 2,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailHint: {
    fontSize: 11,
    lineHeight: 16,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    maxWidth: '42%',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '500',
    paddingTop: spacing.sm,
  },
})
