import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Alert } from '../../src/components/ui/Alert'
import { Button } from '../../src/components/ui/Button'
import { Card } from '../../src/components/ui/Card'
import { Screen } from '../../src/components/ui/Screen'
import { financeApi } from '../../src/services/financeApi'
import type {
  CashFlowForecast,
  FinancialInsight,
  FinancialRisk,
  MonthlySummary,
  SpendingTrend,
} from '../../src/services/types'
import { radius, spacing } from '../../src/theme'
import { useAppTheme } from '../../src/theme/useAppTheme'
import { extractApiError } from '../../src/utils/errors'
import { formatMoney, formatShortDate } from '../../src/utils/format'

export default function IntelligenceScreen() {
  const router = useRouter()
  const { colors } = useAppTheme()
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [forecast, setForecast] = useState<CashFlowForecast | null>(null)
  const [risks, setRisks] = useState<FinancialRisk[]>([])
  const [insights, setInsights] = useState<FinancialInsight[]>([])
  const [trends, setTrends] = useState<SpendingTrend | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    const today = new Date()
    try {
      const [summaryData, forecastData, risksData, trendsData] =
        await Promise.all([
          financeApi.getMonthlySummary({
            year: today.getFullYear(),
            month: today.getMonth() + 1,
          }),
          financeApi.getCashFlowForecast({ days: 30 }),
          financeApi.detectFinancialRisks(),
          financeApi.getSpendingTrends({ lookback_days: 90 }),
        ])
      setSummary(summaryData)
      setForecast(forecastData)
      setRisks(risksData)
      setTrends(trendsData)

      const insightData = await financeApi.listInsights({
        is_dismissed: false,
      })
      setInsights(insightData.items)
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to load financial intelligence.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, []),
  )

  async function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    setError(null)
    setSuccess(null)
    try {
      await financeApi.generateInsights()
      const insightData = await financeApi.listInsights({
        is_dismissed: false,
      })
      setInsights(insightData.items)
      setSuccess('Insights refreshed from your stored records.')
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to generate insights right now.'))
    } finally {
      setRefreshing(false)
    }
  }

  async function handleDismiss(insightId: string) {
    setError(null)
    setSuccess(null)
    try {
      await financeApi.dismissInsight(insightId)
      setInsights((current) => current.filter((item) => item.id !== insightId))
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to dismiss this insight.'))
    }
  }

  const criticalRisks = risks.filter((r) => r.severity === 'critical')
  const warningRisks = risks.filter((r) => r.severity === 'warning')

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: colors.text }]}>UniFlow</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Deterministic analysis of your stored financial records.
        </Text>
      </View>

      {error ? <Alert message={error} tone="error" /> : null}
      {success ? <Alert message={success} tone="success" /> : null}

      <View style={styles.actionRow}>
        <View style={styles.actionItem}>
          <Button
            label={refreshing ? 'Refreshing…' : 'Refresh insights'}
            compact
            loading={refreshing}
            onPress={() => void handleRefresh()}
          />
        </View>
        <View style={styles.actionItem}>
          <Button
            label="Spending preferences"
            compact
            variant="secondary"
            onPress={() => router.push('/spending-preferences')}
          />
        </View>
        <View style={styles.actionItem}>
          <Button
            label="Monthly report"
            compact
            variant="secondary"
            onPress={() => router.push('/reports')}
          />
        </View>
      </View>

      {loading ? (
        <Text style={[styles.placeholder, { color: colors.muted }]}>
          Loading intelligence…
        </Text>
      ) : null}

      {!loading && forecast && (
        <>
          <Card>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Cash-flow forecast (30 days)
            </Text>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.muted }]}>
                  Available
                </Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {formatMoney(
                    forecast.available_balance,
                    forecast.currency,
                  )}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.muted }]}>
                  Projected balance
                </Text>
                <Text
                  style={[
                    styles.statValue,
                    {
                      color:
                        Number(forecast.projected_balance) < 0
                          ? colors.danger
                          : colors.text,
                    },
                  ]}
                >
                  {formatMoney(forecast.projected_balance, forecast.currency)}
                </Text>
              </View>
            </View>
          </Card>

          <Card>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Risk detection
            </Text>
            {criticalRisks.length === 0 && warningRisks.length === 0 ? (
              <Text style={[styles.noRisks, { color: colors.muted }]}>
                No critical or warning risks detected.
              </Text>
            ) : (
              [...criticalRisks, ...warningRisks].map((risk) => (
                <View key={risk.title} style={styles.riskItem}>
                  <Text
                    style={[
                      styles.riskTitle,
                      {
                        color:
                          risk.severity === 'critical'
                            ? colors.danger
                            : '#ca8a04',
                      },
                    ]}
                  >
                    {risk.title}
                  </Text>
                  <Text style={[styles.riskDesc, { color: colors.muted }]}>
                    {risk.description}
                  </Text>
                </View>
              ))
            )}
          </Card>

          {summary && (
            <Card>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                This month
              </Text>
              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>
                    Income
                  </Text>
                  <Text style={[styles.statValue, { color: colors.success }]}>
                    {formatMoney(summary.income, summary.currency)}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>
                    Expenses
                  </Text>
                  <Text style={[styles.statValue, { color: colors.danger }]}>
                    {formatMoney(summary.expenses, summary.currency)}
                  </Text>
                </View>
              </View>
            </Card>
          )}

          <Card>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Insights
            </Text>
            {insights.length === 0 ? (
              <Text style={[styles.noRisks, { color: colors.muted }]}>
                No insights yet. Generate insights to see detected risks.
              </Text>
            ) : (
              insights.map((insight) => (
                <View key={insight.id} style={styles.insightItem}>
                  <View style={styles.insightHead}>
                    <Text
                      style={[styles.insightTitle, { color: colors.text }]}
                    >
                      {insight.title}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Dismiss ${insight.title}`}
                      onPress={() => void handleDismiss(insight.id)}
                    >
                      <Text
                        style={[
                          styles.dismiss,
                          { color: colors.primarySoftText },
                        ]}
                      >
                        Dismiss
                      </Text>
                    </Pressable>
                  </View>
                  <Text style={[styles.insightDesc, { color: colors.muted }]}>
                    {insight.description}
                  </Text>
                </View>
              ))
            )}
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
  placeholder: {
    fontSize: 13,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionItem: {
    flex: 1,
  },
  insightHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  dismiss: {
    fontSize: 12,
    fontWeight: '700',
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
  riskItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
  },
  riskTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  riskDesc: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  noRisks: {
    fontSize: 12,
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  insightItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  insightDesc: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
})
