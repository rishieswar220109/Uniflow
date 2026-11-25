import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  Alert as NativeAlert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { Alert } from '../../src/components/ui/Alert'
import { Button } from '../../src/components/ui/Button'
import { Card } from '../../src/components/ui/Card'
import { Screen } from '../../src/components/ui/Screen'
import { TextField } from '../../src/components/ui/TextField'
import { financeApi } from '../../src/services/financeApi'
import type { Budget, BudgetCreate } from '../../src/services/types'
import { radius, spacing } from '../../src/theme'
import { useAppTheme } from '../../src/theme/useAppTheme'
import { extractApiError } from '../../src/utils/errors'
import { formatMoney, formatShortDate, todayInputValue } from '../../src/utils/format'

export default function BudgetsScreen() {
  const router = useRouter()
  const { colors } = useAppTheme()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<BudgetCreate>({
    name: '',
    period_start: todayInputValue(),
    period_end: todayInputValue(),
    amount: '',
    currency: 'INR',
    alert_threshold: 80,
    is_active: true,
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const result = await financeApi.getBudgets({ include_spending: true })
      if (result) {
        setBudgets(result.items)
      }
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to load your budgets.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, []),
  )

  function openCreate() {
    setForm({
      name: '',
      period_start: todayInputValue(),
      period_end: todayInputValue(),
      amount: '',
      currency: 'INR',
      alert_threshold: 80,
      is_active: true,
    })
    setEditingId(null)
    setFormMode('create')
    setError(null)
    setSuccess(null)
  }

  function openEdit(budget: Budget) {
    setForm({
      name: budget.name,
      period_start: budget.period_start,
      period_end: budget.period_end,
      amount: budget.amount,
      currency: budget.currency,
      alert_threshold: budget.alert_threshold,
      is_active: budget.is_active,
    })
    setEditingId(budget.id)
    setFormMode('edit')
    setError(null)
    setSuccess(null)
  }

  async function handleSubmit() {
    if (saving) return
    const amount = Number(form.amount)
    if (!form.name.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Enter a budget name and an amount greater than zero.')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      if (formMode === 'edit' && editingId) {
        await financeApi.updateBudget(editingId, {
          name: form.name,
          period_start: form.period_start,
          period_end: form.period_end,
          amount: form.amount,
          currency: form.currency,
          alert_threshold: form.alert_threshold,
          is_active: form.is_active,
        })
        setSuccess('Budget updated.')
      } else {
        await financeApi.createBudget({
          name: form.name,
          period_start: form.period_start,
          period_end: form.period_end,
          amount: form.amount,
          currency: form.currency,
          alert_threshold: form.alert_threshold,
          is_active: form.is_active,
        })
        setSuccess('Budget created.')
      }
      setFormMode(null)
      setEditingId(null)
      load()
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to save the budget.'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(budget: Budget) {
    try {
      await financeApi.updateBudget(budget.id, {
        name: budget.name,
        period_start: budget.period_start,
        period_end: budget.period_end,
        amount: budget.amount,
        currency: budget.currency,
        alert_threshold: budget.alert_threshold,
        is_active: !budget.is_active,
      })
      load()
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to update the budget.'))
    }
  }

  async function deleteBudget(budget: Budget) {
    NativeAlert.alert(
      'Delete budget?',
      `Delete “${budget.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await financeApi.deleteBudget(budget.id)
              setSuccess('Budget deleted.')
              load()
            } catch (caught) {
              setError(extractApiError(caught, 'Unable to delete the budget.'))
            }
          },
        },
      ],
    )
  }

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: colors.text }]}>Budgets</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Set monthly spending targets and track actual spending against them.
        </Text>
      </View>

      {error ? <Alert message={error} tone="error" /> : null}
      {success ? <Alert message={success} tone="success" /> : null}

      <View style={styles.actionWrap}>
        <Button
          label={formMode ? 'Close' : 'New budget'}
          compact
          variant={formMode ? 'secondary' : 'primary'}
          onPress={() => (formMode ? setFormMode(null) : openCreate())}
        />
        <Button
          label="Savings goals"
          compact
          variant="secondary"
          onPress={() => router.push('/savings-goals')}
        />
      </View>

      {loading ? (
        <Text style={[styles.placeholder, { color: colors.muted }]}>
          Loading your budgets…
        </Text>
      ) : budgets.length === 0 ? (
        <Card>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No budgets yet
          </Text>
          <Text style={[styles.emptyCopy, { color: colors.muted }]}>
            Create a budget to track spending against a target amount.
          </Text>
        </Card>
      ) : (
        budgets.map((budget) => {
          const spent = Number((budget as any).spent ?? 0)
          const amount = Number(budget.amount)
          const remaining = amount - spent
          const overspending = spent > amount
          return (
            <Card key={budget.id}>
              <View style={styles.obligationHead}>
                <View
                  style={[
                    styles.obligationIcon,
                    { backgroundColor: colors.primarySoft },
                  ]}
                >
                  <Ionicons name="wallet-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>
                    {budget.name}
                  </Text>
                  <Text style={[styles.rowSub, { color: colors.muted }]}>
                    {budget.period} · Alert at {budget.alert_threshold}%
                  </Text>
                </View>
                <View style={styles.rowEnd}>
                  <Text
                    style={[
                      styles.obligationAmount,
                      {
                        color: overspending ? colors.danger : colors.text,
                      },
                    ]}
                  >
                    {formatMoney(remaining.toFixed(2), budget.currency)}
                  </Text>
                </View>
              </View>

              <View style={styles.progressRow}>
                <Text style={[styles.progressLabel, { color: colors.muted }]}>
                  Spent
                </Text>
                <Text style={[styles.progressValue, { color: colors.text }]}>
                  {formatMoney(spent.toFixed(2), budget.currency)} of {formatMoney(
                    amount.toFixed(2),
                    budget.currency,
                  )}
                </Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.bar,
                    {
                      width: Math.min(100, (spent / amount) * 100) + '%',
                      backgroundColor: overspending
                        ? colors.danger
                        : spent / amount >= budget.alert_threshold / 100
                        ? '#ca8a04'
                        : colors.success,
                    },
                  ]}
                />
              </View>

              <View style={styles.actionWrap}>
                <Button
                  label={budget.is_active ? 'Archive' : 'Reactivate'}
                  compact
                  variant={budget.is_active ? 'secondary' : 'ghost'}
                  onPress={() => toggleActive(budget)}
                />
                <Button
                  label="Edit"
                  compact
                  variant="ghost"
                  onPress={() => openEdit(budget)}
                />
                <Button
                  label="Delete"
                  compact
                  variant="danger"
                  onPress={() => deleteBudget(budget)}
                />
              </View>
            </Card>
          )
        })
      )}

      {formMode ? (
        <Card>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {formMode === 'edit' ? 'Edit budget' : 'Create a budget'}
          </Text>
          <TextField
            label="Budget name"
            value={form.name}
            onChangeText={(value) =>
              setForm((current) => ({ ...current, name: value }))
            }
            placeholder="Groceries monthly"
          />
          <TextField
            label="Amount"
            value={form.amount}
            onChangeText={(value) =>
              setForm((current) => ({ ...current, amount: value }))
            }
            keyboardType="decimal-pad"
            placeholder="8000.00"
          />
          <View style={styles.dateRow}>
            <TextField
              label="Period start"
              value={form.period_start}
              onChangeText={(value) =>
                setForm((current) => ({
                  ...current,
                  period_start: value,
                }))
              }
              placeholder="YYYY-MM-DD"
            />
            <TextField
              label="Period end"
              value={form.period_end}
              onChangeText={(value) =>
                setForm((current) => ({
                  ...current,
                  period_end: value,
                }))
              }
              placeholder="YYYY-MM-DD"
            />
          </View>
          <TextField
            label="Alert threshold (%)"
            value={String(form.alert_threshold)}
            onChangeText={(value) =>
              setForm((current) => ({
                ...current,
                alert_threshold: Number(value),
              }))
            }
            keyboardType="numeric"
            placeholder="80"
          />
          <Button
            label={saving ? 'Saving…' : 'Save budget'}
            loading={saving}
            onPress={() => void handleSubmit()}
          />
        </Card>
      ) : null}
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
  obligationHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  obligationIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
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
  obligationAmount: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#666',
  },
  progressValue: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#666',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  bar: {
    height: 6,
    borderRadius: 3,
  },
  actionWrap: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
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
    color: '#666',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
})
