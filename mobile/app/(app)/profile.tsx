import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Alert } from '../../src/components/ui/Alert'
import { Badge } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { Card } from '../../src/components/ui/Card'
import { Screen } from '../../src/components/ui/Screen'
import { TextField } from '../../src/components/ui/TextField'
import { useAuth } from '../../src/features/auth/AuthContext'
import { userApi } from '../../src/services/userApi'
import { radius, spacing } from '../../src/theme'
import { useAppTheme } from '../../src/theme/useAppTheme'
import { extractApiError } from '../../src/utils/errors'
import { formatDate, initials } from '../../src/utils/format'

export default function ProfileScreen() {
  const { user, updateUser } = useAuth()
  const { colors } = useAppTheme()
  const router = useRouter()
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [error, setError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) setFullName(user.full_name)
  }, [user])

  if (!user) return null

  const normalized = fullName.trim().replace(/\s+/g, ' ')
  const dirty = normalized !== user.full_name

  const save = async () => {
    setSuccess(null)
    setApiError(null)

    if (!normalized) {
      setError('Enter your full name.')
      return
    }
    if (normalized.length < 2) {
      setError('Your name must be at least 2 characters.')
      return
    }
    if (normalized.length > 120) {
      setError('Your name must be at most 120 characters.')
      return
    }

    setError(null)
    setSaving(true)
    try {
      const updated = await userApi.updateProfile({ full_name: normalized })
      updateUser(updated)
      setSuccess('Your profile has been updated securely.')
    } catch (caught) {
      setApiError(extractApiError(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: colors.text }]}>Your profile</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Keep your UniFlow identity accurate. Only you can access this account.
        </Text>
      </View>

      <Card>
        <View style={styles.identity}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.primarySoft, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.avatarText, { color: colors.primarySoftText }]}>
              {initials(user.full_name)}
            </Text>
          </View>
          <View style={styles.identityCopy}>
            <Text style={[styles.name, { color: colors.text }]}>
              {user.full_name}
            </Text>
            <Text style={[styles.email, { color: colors.muted }]}>
              {user.email}
            </Text>
            <Badge label="Account secured" tone="success" icon="shield-checkmark" />
          </View>
        </View>

        <View style={[styles.metaRow, { borderColor: colors.border }]}>
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: colors.subtle }]}>
              Member since
            </Text>
            <Text style={[styles.metaValue, { color: colors.text }]}>
              {formatDate(user.created_at)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: colors.subtle }]}>
              Workspace
            </Text>
            <Text style={[styles.metaValue, { color: colors.text }]}>
              Personal
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <View style={styles.sectionHead}>
          <View style={styles.sectionHeadCopy}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Personal details
            </Text>
            <Text style={[styles.sectionCopy, { color: colors.muted }]}>
              Your email is used to sign in and cannot be changed in Phase 1.
            </Text>
          </View>
        </View>

        {apiError ? <Alert message={apiError} /> : null}
        {success ? <Alert message={success} tone="success" /> : null}

        <TextField
          label="Full name"
          value={fullName}
          onChangeText={(value) => {
            setFullName(value)
            setError(null)
            setSuccess(null)
            setApiError(null)
          }}
          error={error ?? undefined}
          autoCapitalize="words"
          autoCorrect={false}
          textContentType="name"
        />

        <View style={styles.readOnly}>
          <Text style={[styles.readOnlyLabel, { color: colors.subtle }]}>
            Email address
          </Text>
          <View
            style={[
              styles.readOnlyValue,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="mail-outline" size={17} color={colors.subtle} />
            <Text style={[styles.readOnlyText, { color: colors.muted }]}>
              {user.email}
            </Text>
            <Ionicons name="lock-closed" size={13} color={colors.subtle} />
          </View>
        </View>

        <Button
          label="Save profile"
          onPress={save}
          loading={saving}
          disabled={!dirty}
        />
      </Card>

      <Card>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [
            styles.settingsRow,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <View
            style={[styles.securityIcon, { backgroundColor: colors.primarySoft }]}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={colors.primary}
            />
          </View>
          <View style={styles.securityCopy}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Preferences &amp; settings
            </Text>
            <Text style={[styles.sectionCopy, { color: colors.muted }]}>
              Currency, timezone, theme and notification preferences.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
        </Pressable>
      </Card>

      <Card muted>
        <View style={styles.securityRow}>
          <View
            style={[styles.securityIcon, { backgroundColor: colors.primarySoft }]}
          >
            <Ionicons
              name="finger-print-outline"
              size={21}
              color={colors.primary}
            />
          </View>
          <View style={styles.securityCopy}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              This account belongs to you
            </Text>
            <Text style={[styles.sectionCopy, { color: colors.muted }]}>
              API requests are scoped to your authenticated session. UniFlow
              never shares your profile with another account.
            </Text>
          </View>
        </View>
      </Card>
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
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
  },
  identityCopy: {
    flex: 1,
    gap: 4,
    alignItems: 'flex-start',
  },
  name: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  email: {
    fontSize: 13,
  },
  metaRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  metaItem: {
    flex: 1,
    gap: 2,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHead: {
    flexDirection: 'row',
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
  readOnly: {
    gap: 6,
  },
  readOnlyLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  readOnlyValue: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  readOnlyText: {
    flex: 1,
    fontSize: 15,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  securityIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityCopy: {
    flex: 1,
    gap: 3,
  },
})
