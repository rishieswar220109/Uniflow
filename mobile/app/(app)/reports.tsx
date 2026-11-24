import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Alert } from '../../src/components/ui/Alert'
import { Card } from '../../src/components/ui/Card'
import { Screen } from '../../src/components/ui/Screen'
import { financeApi } from '../../src/services/financeApi'
import type { FinancialReport } from '../../src/services/types'
import { radius, spacing } from '../../src/theme'
import { useAppTheme } from '../../src/theme/useAppTheme'
import { extractApiError } from '../../src/utils/errors'
import { formatMoney } from '../../src/utils/format'

function monthLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function percent(value: number | null): string {
  if (value === null) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

export default function ReportsScreen() {
  const { colors } = useAppTheme()
  const today = new Date()
  const [period, setPeriod] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  })
  const [report, setReport] = useState<FinancialReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (year: number, month: number) => {
    try {
      const data = await financeApi.getFinancialReport({ year, month })
      setReport(data)
      setError(null)
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to load this financial report.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load(period.year, period.month)
    }, [load, period]),
  )

  function shift(delta: number) {
    setPeriod((current) => {
      let month = current.month + delta
      let year = current.year
      if (month < 1) {
        month = 12
        year -= 1
      } else if (month > 12) {
        month = 1
        year += 1
      }
      return { year, month }
    })
  }

  const currency = report?.currency ?? 'INR'
  const otherCurrencies = report
    ? Object.keys(report.currency_breakdown).filter((code) => code !== currency)
    : []

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: colors.text }]}>
          Financial reports
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          A deterministic monthly summary of stored transactions, budgets and
          savings. Reports are computed by the backend, never by an AI model.
        </Text>
      </View>

      <View style={styles.monthRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => shift(-1)}
          style={[styles.monthButton, { borderColor: colors.border }]}
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={[styles.monthLabel, { color: colors.text }]}>
          {monthLabel(period.year, period.month)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => shift(1)}
          style={[styles.monthButton, { borderColor: colors.border }]}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </Pressable>
      </View>

      {error ? <Alert message={error} tone="error" /> : null}

      {loading ? (
        <Text style={[styles.placeholder, { color: colors.muted }]}>
          Building your report…
        </Text>
      ) : !report ? (
        <Card>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No report available
          </Text>
          <Text style={[styles.emptyCopy, { color: colors.muted }]}>
            Choose a month to build a report from your stored records.
          </Text>
        </Card>
      ) : (
        <>
          <Card>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {report.period_start} to {report.period_end}
            </Text>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.muted }]}>
                  INCOME
                </Text>
                <Text style={[styles.statValue, { color: colors.success }]}>
                  {formatMoney(report.income, currency)}
                </Text>
                <Text style={[styles.statHint, { color: colors.muted }]}>
                  {percent(report.change.income_percent)} vs last month
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.muted }]}>
                  EXPENSES
                </Text>
                <Text style={[styles.statValue, { color: colors.danger }]}>
                  {formatMoney(report.expenses, currency)}
                </Text>
                <Text style={[styles.statHint, { color: colors.muted }]}>
                  {percent(report.change.expenses_percent)} vs last month
                </Text>
              </View>
            </View>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.muted }]}>
                  NET
                </Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {formatMoney(report.net, currency)}
                </Text>
                <Text style={[styles.statHint, { color: colors.muted }]}>
                  {report.transaction_count} transaction(s)
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.muted }]}>
                  SAVINGS RATE
                </Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {report.savings_rate === null
                    ? '—'
                    : `${report.savings_rate.toFixed(1)}%`}
                </Text>
                <Text style={[styles.statHint, { color: colors.muted }]}>
                  Net income ÷ income
                </Text>
              </View>
            </View>
          </Card>

          <Card>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Spending by category
            </Text>
            {report.category_breakdown.length === 0 ? (
              <Text style={[styles.emptyCopy, { color: colors.muted }]}>
                No transactions were recorded in this month.
              </Text>
            ) : (
              report.category_breakdown.map((row) => (
                <View
                  key={row.category}
                  style={[styles.row, { borderColor: colors.border }]}
                >
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>
                      {row.category}
                    </Text>
                    <Text style={[styles.rowSub, { color: colors.muted }]}>
                      {row.share_percent}% of this month's expenses
                    </Text>
                  </View>
                  <Text style={[styles.rowAmount, { color: colors.danger }]}>
                    {formatMoney(row.expenses, currency)}
                  </Text>
                </View>
              ))
            )}
          </Card>

          <Card>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Budget performance
            </Text>
            {report.budgets.length === 0 ? (
              <Text style={[styles.emptyCopy, { color: colors.muted }]}>
                No active budget covers this month.
              </Text>
            ) : (
              report.budgets.map((budget) => (
                <View
                  key={budget.budget_id}
                  style={[styles.row, { borderColor: colors.border }]}
                >
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>
                      {budget.name}
                    </Text>
                    <Text style={[styles.rowSub, { color: colors.muted }]}>
                      {formatMoney(budget.spent, budget.currency)} of{' '}
                      {formatMoney(budget.amount, budget.currency)} ·{' '}
                      {budget.percent_used}% used
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.rowAmount,
                      {
                        color: budget.overspending ? colors.danger : colors.success,
                      },
                    ]}
                  >
                    {budget.overspending ? 'Overspent' : 'On track'}
                  </Text>
                </View>
              ))
            )}
          </Card>

          <Card>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Largest payees
            </Text>
            {report.top_merchants.length === 0 ? (
              <Text style={[styles.emptyCopy, { color: colors.muted }]}>
                No expenses this month.
              </Text>
            ) : (
              report.top_merchants.map((merchant) => (
                <View
                  key={merchant.name}
                  style={[styles.row, { borderColor: colors.border }]}
                >
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>
                      {merchant.name}
                    </Text>
                    <Text style={[styles.rowSub, { color: colors.muted }]}>
                      {merchant.count} payment(s)
                    </Text>
                  </View>
                  <Text style={[styles.rowAmount, { color: colors.text }]}>
                    {formatMoney(merchant.amount, currency)}
                  </Text>
                </View>
              ))
            )}
          </Card>

          <Card>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Compared with {monthLabel(
                report.previous_period.year,
                report.previous_period.month,
              )}
            </Text>
            {[
              ['Income', report.previous_period.income],
              ['Expenses', report.previous_period.expenses],
              ['Net', report.previous_period.net],
            ].map(([label, value]) => (
              <View
                key={label}
                style={[styles.row, { borderColor: colors.border }]}
              >
                <Text style={[styles.rowSub, { color: colors.muted }]}>
                  {label}
                </Text>
                <Text style={[styles.rowAmount, { color: colors.text }]}>
                  {formatMoney(value, currency)}
                </Text>
              </View>
            ))}
          </Card>

          <Card>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Savings goals
            </Text>
            <Text style={[styles.rowSub, { color: colors.muted }]}>
              {report.savings.goal_count} active goal(s) in{' '}
              {report.savings.currency ?? currency} · saved{' '}
              {formatMoney(
                report.savings.total_saved,
                report.savings.currency ?? currency,
              )}{' '}
              of{' '}
              {formatMoney(
                report.savings.total_target,
                report.savings.currency ?? currency,
              )}
            </Text>
          </Card>

          {otherCurrencies.length > 0 ? (
            <Card muted>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Other currencies
              </Text>
              {otherCurrencies.map((code) => {
                const totals = report.currency_breakdown[code]
                return (
                  <Text
                    key={code}
                    style={[styles.rowSub, { color: colors.muted }]}
                  >
                    {code} · income {formatMoney(totals.income, code)} · expenses{' '}
                    {formatMoney(totals.expenses, code)}
                  </Text>
                )
              })}
            </Card>
          ) : null}

          <Card muted>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Report notes
            </Text>
            {report.notes.map((note) => (
              <Text key={note} style={[styles.rowSub, { color: colors.muted }]}>
                • {note}
              </Text>
            ))}
          </Card>
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  heading: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  monthButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  placeholder: {
    fontSize: 13,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statItem: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statHint: {
    fontSize: 11,
    lineHeight: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
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
  rowAmount: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyCopy: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
})
