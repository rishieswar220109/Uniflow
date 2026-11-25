import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { MockBadge, StatusBadge } from '../../src/components/finance/StatusBadge'
import { Alert } from '../../src/components/ui/Alert'
import { Badge } from '../../src/components/ui/Badge'
import { Card } from '../../src/components/ui/Card'
import { Screen } from '../../src/components/ui/Screen'
import { useAuth } from '../../src/features/auth/AuthContext'
import { financeApi } from '../../src/services/financeApi'
import type {
  CashFlowForecast,
  FinancialInsight,
  Summary,
} from '../../src/services/types'
import { radius, spacing } from '../../src/theme'
import { useAppTheme } from '../../src/theme/useAppTheme'
import { extractApiError } from '../../src/utils/errors'
import {
  describeDueDate,
  firstName,
  formatDateTime,
  formatMoney,
  formatShortDate,
  formatSignedMoney,
  initials,
  todayLabel,
} from '../../src/utils/format'

const LATER_PHASES: [string, string][] = [
  ['Forecasting & insights', 'Active'],
  ['Plain-language answers', 'Phase 4'],
  ['Approval-based actions', 'Phase 5'],
]

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

export default function DashboardScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { colors } = useAppTheme()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [forecast, setForecast] = useState<CashFlowForecast | null>(null)
  const [insights, setInsights] = useState<FinancialInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      let active = true
      async function load() {
        try {
          const data = await financeApi.getSummary(30)
          if (active) {
            setSummary(data)
            setError(null)
          }
        } catch (caught) {
          if (active) {
            setError(
              extractApiError(
                caught,
                'Unable to load your financial overview.',
              ),
            )
          }
        } finally {
          if (active) setLoading(false)
        }

        // Phase 3 additions are supplementary; a failure must not hide the
        // Phase 2 overview that has already loaded.
        try {
          const forecastData = await financeApi.getCashFlowForecast({ days: 30 })
          if (active) setForecast(forecastData)
        } catch {
          if (active) setForecast(null)
        }

        try {
          const insightPage = await financeApi.listInsights({
            is_dismissed: false,
            limit: 5,
          })
          if (active) setInsights(insightPage.items)
        } catch {
          if (active) setInsights([])
        }
      }
      void load()
      return () => {
        active = false
      }
    }, []),
  )

  if (!user) return null

  const currency = summary?.currency ?? user.preferences.currency
  const hasAccounts = (summary?.accounts_count ?? 0) > 0
  const upcoming = (summary?.upcoming_payments ?? []).slice(0, 5)
  const recent = (summary?.recent_transactions ?? []).slice(0, 6)

  const hasForecast = Boolean(forecast) &&
    (Number(forecast?.expected_income ?? 0) > 0 ||
      Number(forecast?.expected_expenses ?? 0) > 0 ||
      Number(forecast?.available_balance ?? 0) > 0)

  const topInsight = [...insights].sort(
    (a, b) =>
      (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3),
  )[0]

  const otherCurrencyTotals = (summary?.currency_breakdown ?? []).filter(
    (row) => row.currency !== currency,
  )

  const stats: { label: string; value: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    {
      label: 'Total balance',
      value: formatMoney(summary?.total_balance ?? '0.00', currency),
      hint: `${summary?.accounts_count ?? 0} active account(s)`,
      icon: 'wallet-outline',
    },
    {
      label: 'Available',
      value: formatMoney(summary?.total_available ?? '0.00', currency),
      hint: 'After pending holds',
      icon: 'cash-outline',
    },
    {
      label: 'Spent this month',
      value: formatMoney(summary?.month_expenses ?? '0.00', currency),
      hint: `Income ${formatMoney(summary?.month_income ?? '0.00', currency)}`,
      icon: 'trending-down-outline',
    },
    {
      label: 'Upcoming · 30 days',
      value: formatMoney(summary?.upcoming_total ?? '0.00', currency),
      hint: `${summary?.upcoming_bills_count ?? 0} bills · ${
        summary?.upcoming_subscriptions_count ?? 0
      } subscriptions`,
      icon: 'calendar-outline',
    },
  ]

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

      <View style={styles.badgeRow}>
        <Badge label="Phase 3 · Financial intelligence" tone="primary" />
        {summary?.is_mock_data ? <MockBadge /> : null}
        {hasAccounts ? (
          <Badge label="Connected" tone="success" icon="shield-checkmark" />
        ) : (
          <Badge label="No connection yet" tone="neutral" />
        )}
      </View>

      <Text style={[styles.lede, { color: colors.muted }]}>
        Balances, activity and what is due next in one place. UniFlow tracks
        and reminds — you stay in control of every payment.
      </Text>

      {error ? <Alert message={error} tone="error" /> : null}

      {!loading && !hasAccounts ? (
        <Card style={{ borderColor: colors.primary }}>
          <View style={styles.connectHead}>
            <View
              style={[styles.connectIcon, { backgroundColor: colors.primarySoft }]}
            >
              <Ionicons name="business-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.connectCopy}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Connect a financial account
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
                Consent-based connections bring balances and transactions in.
                No banking passwords, PINs, OTPs or CVVs are ever requested.
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/accounts')}
            style={({ pressed }) => [
              styles.primaryLink,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.primaryLinkText, { color: colors.onPrimary }]}>
              Connect an account
            </Text>
          </Pressable>
        </Card>
      ) : null}

      <View style={styles.statGrid}>
        {stats.map((stat) => (
          <View
            key={stat.label}
            style={[
              styles.statCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[styles.statIcon, { backgroundColor: colors.primarySoft }]}
            >
              <Ionicons name={stat.icon} size={16} color={colors.primary} />
            </View>
            <Text style={[styles.statLabel, { color: colors.subtle }]}>
              {stat.label.toUpperCase()}
            </Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {loading ? '…' : stat.value}
            </Text>
            <Text style={[styles.statHint, { color: colors.muted }]}>
              {stat.hint}
            </Text>
          </View>
        ))}
      </View>

      {otherCurrencyTotals.length > 0 ? (
        <Card muted>
          <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
            Totals combine only {currency}.{' '}
            {otherCurrencyTotals
              .map(
                (row) =>
                  `${row.currency} ${formatMoney(
                    row.total_balance,
                    row.currency,
                  )}`,
              )
              .join(' · ')}
            {' '}are listed separately and never converted at an invented
            exchange rate.
          </Text>
        </Card>
      ) : null}

      {hasForecast ? (
        <Card>
          <View style={styles.sectionHead}>
            <View style={styles.sectionHeadCopy}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Projected balance
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
                Predicted in {forecast?.days ?? 30} days from recorded income and
                unpaid obligations. A forecast, not a guarantee.
              </Text>
            </View>
            <Ionicons name="trending-up-outline" size={19} color={colors.primary} />
          </View>
          <Text
            style={[
              styles.projectedValue,
              {
                color:
                  Number(forecast?.projected_balance ?? 0) < 0
                    ? colors.danger
                    : colors.text,
              },
            ]}
          >
            {formatMoney(
              forecast?.projected_balance ?? '0.00',
              forecast?.currency ?? currency,
            )}
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
            Available {formatMoney(forecast?.available_balance ?? '0.00', forecast?.currency ?? currency)} · expected
            income {formatMoney(forecast?.expected_income ?? '0.00', forecast?.currency ?? currency)} · expected
            expenses {formatMoney(forecast?.expected_expenses ?? '0.00', forecast?.currency ?? currency)}
          </Text>
        </Card>
      ) : null}

      <Card>
        <View style={styles.sectionHead}>
          <View style={styles.sectionHeadCopy}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Due soon</Text>
            <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
              Bills and subscriptions in the next 30 days.
            </Text>
          </View>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/payments')}
          >
            <Text style={[styles.link, { color: colors.primarySoftText }]}>
              Calendar
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <Text style={[styles.placeholder, { color: colors.muted }]}>
            Loading upcoming payments…
          </Text>
        ) : upcoming.length === 0 ? (
          <View
            style={[
              styles.emptyInline,
              { backgroundColor: colors.surfaceInset, borderColor: colors.border },
            ]}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Nothing due soon. Add a bill or subscription to build your payment
              calendar.
            </Text>
          </View>
        ) : (
          <View>
            {upcoming.map((item) => (
              <View
                key={`${item.kind}-${item.id}`}
                style={[styles.row, { borderColor: colors.border }]}
              >
                <View
                  style={[
                    styles.rowIcon,
                    { backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  <Ionicons
                    name={
                      item.kind === 'bill'
                        ? 'document-text-outline'
                        : 'sparkles-outline'
                    }
                    size={15}
                    color={colors.muted}
                  />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.rowSub, { color: colors.muted }]}>
                    {formatShortDate(item.due_date)} ·{' '}
                    {describeDueDate(item.due_date)}
                  </Text>
                </View>
                <View style={styles.rowEnd}>
                  <Text style={[styles.rowAmount, { color: colors.text }]}>
                    {formatMoney(item.amount, item.currency)}
                  </Text>
                  <StatusBadge status={item.status} />
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <View style={styles.sectionHead}>
          <View style={styles.sectionHeadCopy}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Recent activity
            </Text>
            <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
              The latest stored transactions across your accounts.
            </Text>
          </View>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/transactions')}
          >
            <Text style={[styles.link, { color: colors.primarySoftText }]}>
              All activity
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <Text style={[styles.placeholder, { color: colors.muted }]}>
            Loading activity…
          </Text>
        ) : recent.length === 0 ? (
          <View
            style={[
              styles.emptyInline,
              { backgroundColor: colors.surfaceInset, borderColor: colors.border },
            ]}
          >
            <Ionicons name="wallet-outline" size={20} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              No activity yet. Connect an account or record a manual transaction.
            </Text>
          </View>
        ) : (
          <View>
            {recent.map((transaction) => {
              const negative = Number(transaction.amount) < 0
              return (
                <View
                  key={transaction.id}
                  style={[styles.row, { borderColor: colors.border }]}
                >
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>
                      {transaction.description}
                    </Text>
                    <Text style={[styles.rowSub, { color: colors.muted }]}>
                      {formatShortDate(transaction.occurred_on)} ·{' '}
                      {transaction.account?.name ?? 'Account'}
                      {transaction.category ? ` · ${transaction.category.name}` : ''}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.rowAmount,
                      { color: negative ? colors.danger : colors.success },
                    ]}
                  >
                    {formatSignedMoney(
                      transaction.amount,
                      transaction.currency,
                    )}
                  </Text>
                </View>
              )
            })}
          </View>
        )}
      </Card>

      <Card>
        <View style={styles.sectionHead}>
          <View style={styles.sectionHeadCopy}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              UniFlow insight
            </Text>
            <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
              The most important finding from your stored records.
            </Text>
          </View>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/intelligence')}
          >
            <Text style={[styles.link, { color: colors.primarySoftText }]}>
              All insights
            </Text>
          </Pressable>
        </View>

        {topInsight ? (
          <View>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              {topInsight.title}
            </Text>
            <Text style={[styles.rowSub, { color: colors.muted }]}>
              {topInsight.description}
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.emptyInline,
              { backgroundColor: colors.surfaceInset, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={colors.muted}
            />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              No insights yet. Open UniFlow to generate insights from your
              stored records.
            </Text>
          </View>
        )}
      </Card>

      <Card muted>
        <View style={styles.guardianHead}>
          <View
            style={[styles.guardianOrb, { backgroundColor: colors.primarySoft }]}
          >
            <Ionicons name="sparkles" size={21} color={colors.primary} />
          </View>
          <View style={styles.guardianCopy}>
            <View style={styles.badgeRow}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Ask UniFlow
              </Text>
              <Badge label="Phase 4" tone="neutral" />
            </View>
            <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
              Plain-language answers about your money are planned for Phase 4.
              They are not available yet; nothing here is AI-generated.
            </Text>
          </View>
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
              {hasAccounts ? 'Tracking your money' : 'UniFlow is standing by'}
            </Text>
            <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
              {hasAccounts
                ? 'Balances, bills and subscriptions are up to date.'
                : 'Connect an account or add obligations manually.'}
            </Text>
          </View>
        </View>

        {LATER_PHASES.map(([label, phase]) => (
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
        <Text style={[styles.cardTitle, { color: colors.text }]}>This month</Text>
        <View style={[styles.detailRow, { borderColor: colors.border }]}>
          <Text style={[styles.detailLabel, { color: colors.muted }]}>Income</Text>
          <Text style={[styles.detailValue, { color: colors.success }]}>
            {formatMoney(summary?.month_income ?? '0.00', currency)}
          </Text>
        </View>
        <View style={[styles.detailRow, { borderColor: colors.border }]}>
          <Text style={[styles.detailLabel, { color: colors.muted }]}>
            Expenses
          </Text>
          <Text style={[styles.detailValue, { color: colors.danger }]}>
            {formatMoney(summary?.month_expenses ?? '0.00', currency)}
          </Text>
        </View>
        <View style={[styles.detailRow, { borderColor: colors.border }]}>
          <Text style={[styles.detailLabel, { color: colors.muted }]}>Net</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>
            {formatSignedMoney(summary?.net_this_month ?? '0.00', currency)}
          </Text>
        </View>
        <View style={styles.syncLine}>
          <Ionicons name="time-outline" size={14} color={colors.subtle} />
          <Text style={[styles.syncText, { color: colors.muted }]}>
            Last synced {formatDateTime(summary?.last_synced_at)}
          </Text>
        </View>
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
          'Consent-based financial data only',
          'No passwords, PINs, OTPs or CVVs stored',
          'Per-user isolation on every record',
          'Mock data is labelled wherever it appears',
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
    fontSize: 26,
    lineHeight: 32,
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
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  lede: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: -4,
  },
  connectHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  connectIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectCopy: {
    flex: 1,
    gap: 3,
  },
  primaryLink: {
    minHeight: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLinkText: {
    fontSize: 15,
    fontWeight: '700',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    width: '47.8%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 3,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  statHint: {
    fontSize: 11,
    lineHeight: 15,
  },
  projectedValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionHeadCopy: {
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
  link: {
    fontSize: 12,
    fontWeight: '700',
  },
  placeholder: {
    fontSize: 13,
  },
  emptyInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  emptyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 1,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  rowSub: {
    fontSize: 11,
    lineHeight: 16,
  },
  rowEnd: {
    alignItems: 'flex-end',
    gap: 4,
  },
  rowAmount: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
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
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailLabel: {
    fontSize: 12,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  syncLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: spacing.sm,
  },
  syncText: {
    fontSize: 11,
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
