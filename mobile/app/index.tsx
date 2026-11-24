import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

import { Badge } from '../src/components/ui/Badge'
import { Button } from '../src/components/ui/Button'
import { Card } from '../src/components/ui/Card'
import { Logo } from '../src/components/ui/Logo'
import { Screen } from '../src/components/ui/Screen'
import { useAuth } from '../src/features/auth/AuthContext'
import { radius, spacing } from '../src/theme'
import { useAppTheme } from '../src/theme/useAppTheme'

const previewItems = [
  {
    icon: 'wallet-outline' as const,
    title: 'Account balances',
    detail: 'One calm overview of authorised accounts.',
    phase: 'Phase 2',
  },
  {
    icon: 'calendar-outline' as const,
    title: 'Upcoming payments',
    detail: 'Know what is due before it arrives.',
    phase: 'Phase 2',
  },
  {
    icon: 'trending-up-outline' as const,
    title: 'Projected balance',
    detail: 'Deterministic forecasts, clearly explained.',
    phase: 'Phase 3',
  },
  {
    icon: 'sparkles-outline' as const,
    title: 'Ask UniFlow',
    detail: 'Answers grounded in your verified data.',
    phase: 'Phase 4',
  },
]

export default function WelcomeScreen() {
  const router = useRouter()
  const { status } = useAuth()
  const { colors } = useAppTheme()
  const authenticated = status === 'authenticated'

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} contentStyle={styles.page}>
      <Logo />

      <View style={styles.hero}>
        <Badge label="AI-powered financial intelligence" tone="primary" icon="sparkles" />
        <Text style={[styles.title, { color: colors.text }]}>
          Know what&apos;s coming.{' '}
          <Text style={{ color: colors.primary }}>Stay in control.</Text>
        </Text>
        <Text style={[styles.lede, { color: colors.muted }]}>
          UniFlow turns authorised financial data into clear answers
          about your balance, upcoming payments and the decisions ahead — so you
          can act with confidence, never guesswork.
        </Text>
      </View>

      <View style={styles.actions}>
        {authenticated ? (
          <Button
            label="Open your dashboard"
            onPress={() => router.push('/dashboard')}
          />
        ) : (
          <>
            <Button
              label="Create a secure account"
              onPress={() => router.push('/register')}
              loading={status === 'loading'}
            />
            <Button
              label="Sign in"
              variant="secondary"
              onPress={() => router.push('/login')}
              disabled={status === 'loading'}
            />
          </>
        )}
      </View>

      <View style={styles.trustRow}>
        {[
          ['lock-closed-outline', 'Argon2id passwords'],
          ['sync-outline', 'Revocable sessions'],
          ['shield-checkmark-outline', 'No banking PINs'],
        ].map(([icon, label]) => (
          <View key={label} style={styles.trustItem}>
            <Ionicons
              name={icon as keyof typeof Ionicons.glyphMap}
              size={15}
              color={colors.primary}
            />
            <Text style={[styles.trustLabel, { color: colors.muted }]}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      <Card>
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            What UniFlow will unlock
          </Text>
          <Badge label="Phase 1 foundation" tone="neutral" />
        </View>
        <Text style={[styles.sectionCopy, { color: colors.muted }]}>
          Your account is the first step. No financial data is displayed or
          implied until you explicitly connect an authorised source.
        </Text>

        <View style={styles.previewList}>
          {previewItems.map((item) => (
            <View
              key={item.title}
              style={[styles.previewRow, { borderColor: colors.border }]}
            >
              <View
                style={[
                  styles.previewIcon,
                  { backgroundColor: colors.primarySoft },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={colors.primarySoftText}
                />
              </View>
              <View style={styles.previewCopy}>
                <Text style={[styles.previewTitle, { color: colors.text }]}>
                  {item.title}
                </Text>
                <Text style={[styles.previewDetail, { color: colors.muted }]}>
                  {item.detail}
                </Text>
              </View>
              <Text style={[styles.phase, { color: colors.subtle }]}>
                {item.phase}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card muted>
        <View style={styles.securityHead}>
          <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
          <Text style={[styles.securityTitle, { color: colors.text }]}>
            Consent first. Approval always.
          </Text>
        </View>
        <Text style={[styles.securityCopy, { color: colors.muted }]}>
          UniFlow never asks for banking passwords, UPI PINs, OTPs or CVVs.
          Every consequential action in later phases will require your explicit
          approval.
        </Text>
      </Card>

      <Text style={[styles.footer, { color: colors.subtle }]}>
        UniFlow · Secure account foundation
      </Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.xl,
    paddingTop: spacing.lg,
  },
  hero: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  title: {
    fontSize: 38,
    lineHeight: 43,
    fontWeight: '800',
    letterSpacing: -1.1,
  },
  lede: {
    fontSize: 15,
    lineHeight: 23,
  },
  actions: {
    gap: spacing.sm,
  },
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trustLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionCopy: {
    fontSize: 13,
    lineHeight: 19,
  },
  previewList: {
    gap: 0,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  previewIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCopy: {
    flex: 1,
    gap: 2,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  previewDetail: {
    fontSize: 12,
    lineHeight: 17,
  },
  phase: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  securityHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  securityTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  securityCopy: {
    fontSize: 13,
    lineHeight: 20,
  },
  footer: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '500',
    paddingTop: spacing.sm,
  },
})
