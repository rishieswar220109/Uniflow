import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Badge } from '../../src/components/ui/Badge'
import { Card } from '../../src/components/ui/Card'
import { Screen } from '../../src/components/ui/Screen'
import { useAuth } from '../../src/features/auth/AuthContext'
import { radius, spacing } from '../../src/theme'
import { useAppTheme } from '../../src/theme/useAppTheme'
import { firstName, initials, todayLabel } from '../../src/utils/format'

const setupSteps = [
  {
    title: 'Create your secure account',
    description: 'Your identity and encrypted credentials are ready.',
    state: 'Done',
    status: 'done' as const,
    icon: 'checkmark' as const,
  },
  {
    title: 'Connect a financial account',
    description:
      'Consent-based bank connections arrive in Phase 2. No banking PINs or OTPs are ever collected.',
    state: 'Next',
    status: 'next' as const,
    icon: 'business-outline' as const,
  },
  {
    title: 'Let Guardian forecast ahead',
    description: 'Balance projections and insights are built in Phase 3.',
    state: 'Later',
    status: 'pending' as const,
    icon: 'trending-up-outline' as const,
  },
]

export default function DashboardScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { colors } = useAppTheme()

  if (!user) return null

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.kicker, { color: colors.muted }]}>
            {todayLabel()}
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            Welcome back, {firstName(user.full_name)}
          </Text>
        </View>
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
      </View>

      <View style={styles.statusRow}>
        <Badge label="Account secured" tone="success" icon="shield-checkmark" />
        <Badge label="Phase 1 of 6" tone="neutral" />
      </View>

      <Text style={[styles.lede, { color: colors.muted }]}>
        Your secure account is ready. Guardian will build on this foundation as
        financial connections and intelligence arrive in the next phases.
      </Text>

      <Card>
        <View style={styles.cardHead}>
          <View style={styles.cardHeadCopy}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Account setup
            </Text>
            <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
              One of three steps complete. Each phase unlocks the next.
            </Text>
          </View>
          <Badge label="In progress" tone="primary" />
        </View>

        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: 33 }}
          style={[styles.progressTrack, { backgroundColor: colors.surfaceMuted }]}
        >
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.primary, width: '33%' },
            ]}
          />
        </View>
        <View style={styles.progressLabels}>
          <Text style={[styles.progressText, { color: colors.muted }]}>
            Foundation complete
          </Text>
          <Text style={[styles.progressText, { color: colors.muted }]}>
            1 / 3
          </Text>
        </View>

        <View style={[styles.steps, { borderColor: colors.border }]}>
          {setupSteps.map((step) => {
            const done = step.status === 'done'
            const next = step.status === 'next'
            return (
              <View key={step.title} style={styles.step}>
                <View
                  style={[
                    styles.stepIcon,
                    {
                      backgroundColor: done
                        ? colors.successSoft
                        : next
                          ? colors.primarySoft
                          : colors.surfaceMuted,
                    },
                  ]}
                >
                  <Ionicons
                    name={step.icon}
                    size={15}
                    color={
                      done
                        ? colors.success
                        : next
                          ? colors.primary
                          : colors.subtle
                    }
                  />
                </View>
                <View style={styles.stepCopy}>
                  <Text style={[styles.stepTitle, { color: colors.text }]}>
                    {step.title}
                  </Text>
                  <Text style={[styles.stepDescription, { color: colors.muted }]}>
                    {step.description}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.stepState,
                    {
                      color: done
                        ? colors.success
                        : next
                          ? colors.primary
                          : colors.subtle,
                    },
                  ]}
                >
                  {step.state}
                </Text>
              </View>
            )
          })}
        </View>
      </Card>

      <Card>
        <View style={styles.cardHead}>
          <View style={styles.cardHeadCopy}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Balances &amp; activity
            </Text>
            <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
              Real financial data appears only after an authorised connection.
            </Text>
          </View>
          <Badge label="Not connected" tone="neutral" />
        </View>

        <View
          style={[
            styles.emptyState,
            {
              backgroundColor: colors.surfaceInset,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}
          >
            <Ionicons name="wallet-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No financial accounts yet
          </Text>
          <Text style={[styles.emptyCopy, { color: colors.muted }]}>
            Guardian does not display placeholder balances. When bank-data
            connections arrive in Phase 2, your authorised accounts, transactions
            and upcoming payments will appear here.
          </Text>
          <Badge label="No financial data stored" tone="warning" icon="lock-closed" />
        </View>
      </Card>

      <Card>
        <View style={styles.guardianHead}>
          <View
            style={[styles.guardianOrb, { backgroundColor: colors.primarySoft }]}
          >
            <Ionicons name="sparkles" size={21} color={colors.primary} />
          </View>
          <View style={styles.guardianCopy}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Guardian is standing by
            </Text>
            <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
              Waiting for authorised financial data. No analysis is fabricated.
            </Text>
          </View>
        </View>

        {[
          ['Spending analysis', 'Phase 3'],
          ['Plain-language answers', 'Phase 4'],
          ['Approval-based actions', 'Phase 5'],
        ].map(([label, phase]) => (
          <View
            key={label}
            style={[styles.detailRow, { borderColor: colors.border }]}
          >
            <Text style={[styles.detailLabel, { color: colors.muted }]}>
              {label}
            </Text>
            <Text style={[styles.detailValue, { color: colors.subtle }]}>
              {phase}
            </Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Next steps
        </Text>
        {[
          ['person-outline', 'Complete your profile', '/profile' as const],
          ['options-outline', 'Review your preferences', '/settings' as const],
        ].map(([icon, label, href]) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            onPress={() => router.push(href)}
            style={({ pressed }) => [
              styles.nextRow,
              {
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons
              name={icon as keyof typeof Ionicons.glyphMap}
              size={18}
              color={colors.primary}
            />
            <Text style={[styles.nextLabel, { color: colors.text }]}>
              {label}
            </Text>
            <Ionicons name="chevron-forward" size={17} color={colors.subtle} />
          </Pressable>
        ))}
      </Card>

      <Card muted>
        <View style={styles.securityHead}>
          <Ionicons
            name="shield-checkmark-outline"
            size={19}
            color={colors.primary}
          />
          <Text style={[styles.securityTitle, { color: colors.text }]}>
            Protection active
          </Text>
        </View>
        {[
          'Argon2id password hashing',
          'Short-lived, revocable sessions',
          'Protected API endpoints',
          'Preferences synced across devices',
        ].map((line) => (
          <View key={line} style={styles.checkRow}>
            <Ionicons name="checkmark" size={14} color={colors.success} />
            <Text style={[styles.checkText, { color: colors.muted }]}>
              {line}
            </Text>
          </View>
        ))}
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  lede: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: -4,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardHeadCopy: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  progressTrack: {
    height: 7,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -6,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
  },
  steps: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  stepIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCopy: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  stepDescription: {
    fontSize: 11,
    lineHeight: 16,
  },
  stepState: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyCopy: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  guardianHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  guardianOrb: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guardianCopy: {
    flex: 1,
    gap: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailLabel: {
    fontSize: 12,
  },
  detailValue: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  nextLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  securityHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  securityTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkText: {
    fontSize: 12,
    lineHeight: 18,
  },
})
