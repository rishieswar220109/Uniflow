import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  Alert as NativeAlert,
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
import type {
  SavingsGoal,
  SavingsGoalCreate,
  SavingsGoalsSummary,
} from '../../src/services/types'
import { radius, spacing } from '../../src/theme'
import { useAppTheme } from '../../src/theme/useAppTheme'
import { extractApiError } from '../../src/utils/errors'
import { formatMoney, formatShortDate } from '../../src/utils/format'

type GoalForm = {
  name: string
  target_amount: string
  current_amount: string
  currency: string
  target_date: string
}

function emptyForm(currency: string): GoalForm {
  return {
    name: '',
    target_amount: '',
    current_amount: '0',
    currency,
    target_date: '',
  }
}

export default function SavingsGoalsScreen() {
  const { colors } = useAppTheme()
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [summary, setSummary] = useState<SavingsGoalsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<GoalForm>(() => emptyForm('INR'))
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [page, totals] = await Promise.all([
        financeApi.getSavingsGoals({ limit: 100 }),
        financeApi.getSavingsGoalsSummary(),
      ])
      setGoals(page.items)
      setSummary(totals)
      setError(null)
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to load your savings goals.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  function openCreate() {
    setForm(emptyForm(goals[0]?.currency ?? 'INR'))
    setEditingId(null)
    setFormMode('create')
    setError(null)
    setSuccess(null)
  }

  function openEdit(goal: SavingsGoal) {
    setForm({
      name: goal.name,
      target_amount: goal.target_amount,
      current_amount: goal.current_amount,
      currency: goal.currency,
      target_date: goal.target_date ?? '',
    })
    setEditingId(goal.id)
    setFormMode('edit')
    setError(null)
    setSuccess(null)
  }

  async function handleSubmit() {
    if (saving) return
    if (!form.name.trim()) {
      setError('Enter a name for the savings goal.')
      return
    }
    const target = Number(form.target_amount)
    if (!Number.isFinite(target) || target <= 0) {
      setError('Enter a target amount greater than zero.')
      return
    }
    const saved = Number(form.current_amount)
    if (!Number.isFinite(saved) || saved < 0) {
      setError('The amount saved cannot be negative.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      if (formMode === 'edit' && editingId) {
        await financeApi.updateSavingsGoal(editingId, {
          name: form.name.trim(),
          target_amount: target.toFixed(2),
          current_amount: saved.toFixed(2),
          currency: form.currency,
          target_date: form.target_date || null,
        })
        setSuccess('Savings goal updated.')
      } else {
        const payload: SavingsGoalCreate = {
          name: form.name.trim(),
          target_amount: target.toFixed(2),
          currency: form.currency,
          target_date: form.target_date || null,
        }
        await financeApi.createSavingsGoal(payload)
        setSuccess('Savings goal created.')
      }
      setFormMode(null)
      setEditingId(null)
      void load()
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to save the savings goal.'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(goal: SavingsGoal) {
    setError(null)
    setSuccess(null)
    try {
      await financeApi.updateSavingsGoal(goal.id, {
        name: goal.name,
        target_amount: goal.target_amount,
        current_amount: goal.current_amount,
        currency: goal.currency,
        target_date: goal.target_date,
        is_active: !goal.is_active,
      })
      setSuccess(goal.is_active ? 'Goal archived.' : 'Goal reactivated.')
      void load()
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to update the goal.'))
    }
  }

  function confirmDelete(goal: SavingsGoal) {
    NativeAlert.alert(
      'Delete savings goal?',
      `Delete “${goal.name}”?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setError(null)
            setSuccess(null)
            try {
              await financeApi.deleteSavingsGoal(goal.id)
              setSuccess('Savings goal deleted.')
              if (editingId === goal.id) {
                setFormMode(null)
                setEditingId(null)
              }
              void load()
            } catch (caught) {
              setError(extractApiError(caught, 'Unable to delete the goal.'))
            }
          },
        },
      ],
    )
  }

  const summaryCurrency = summary?.currency ?? goals[0]?.currency ?? 'INR'

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: colors.text }]}>Savings goals</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Set a target, record how much you have saved, and track progress.
          UniFlow never moves money between accounts.
        </Text>
      </View>

      {error ? <Alert message={error} tone="error" /> : null}
      {success ? <Alert message={success} tone="success" /> : null}

      <Button
        label={formMode ? 'Close' : 'New goal'}
        compact
        variant={formMode ? 'secondary' : 'primary'}
        onPress={() => (formMode ? setFormMode(null) : openCreate())}
      />

      {summary ? (
        <Card>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>
                GOALS
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {summary.goal_count}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>
                SAVED
              </Text>
              <Text style={[styles.statValue, { color: colors.success }]}>
                {formatMoney(summary.total_saved, summaryCurrency)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>
                REMAINING
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatMoney(summary.remaining, summaryCurrency)}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {summary?.currency_breakdown &&
      Object.keys(summary.currency_breakdown).length > 1 ? (
        <Card muted>
          <Text style={[styles.rowSub, { color: colors.muted }]}>
            Totals above cover only {summary.currency}.{' '}
            {Object.entries(summary.currency_breakdown)
              .filter(([code]) => code !== summary.currency)
              .map(
                ([code, totals]) =>
                  `${code} ${formatMoney(totals.total_saved, code)} saved of ${formatMoney(
                    totals.total_target,
                    code,
                  )}`,
              )
              .join(' · ')}
            . Goals in different currencies are never added together.
          </Text>
        </Card>
      ) : null}

      {loading ? (
        <Text style={[styles.placeholder, { color: colors.muted }]}>
          Loading your savings goals…
        </Text>
      ) : goals.length === 0 ? (
        <Card>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No savings goals yet
          </Text>
          <Text style={[styles.emptyCopy, { color: colors.muted }]}>
            Create a goal to track progress towards a target amount.
          </Text>
        </Card>
      ) : (
        goals.map((goal) => {
          const percent = Math.max(0, Math.min(100, goal.percent_funded))
          return (
            <Card key={goal.id}>
              <View style={styles.goalHead}>
                <View
                  style={[styles.goalIcon, { backgroundColor: colors.primarySoft }]}
                >
                  <Ionicons name="flag-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>
                    {goal.name}
                  </Text>
                  <Text style={[styles.rowSub, { color: colors.muted }]}>
                    {formatMoney(goal.current_amount, goal.currency)} of{' '}
                    {formatMoney(goal.target_amount, goal.currency)}
                    {goal.target_date
                      ? ` · target ${formatShortDate(goal.target_date)}`
                      : ''}
                  </Text>
                </View>
                <Text style={[styles.percent, { color: colors.text }]}>
                  {goal.percent_funded.toFixed(1)}%
                </Text>
              </View>

              <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
                <View
                  style={[
                    styles.bar,
                    {
                      width: `${percent}%`,
                      backgroundColor:
                        percent >= 100 ? colors.success : colors.primary,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.rowSub, { color: colors.muted }]}>
                {percent >= 100
                  ? 'Goal reached'
                  : `${formatMoney(goal.remaining, goal.currency)} remaining`}
                {goal.is_active ? '' : ' · archived'}
              </Text>

              <View style={styles.actionWrap}>
                <Button
                  label={goal.is_active ? 'Archive' : 'Reactivate'}
                  compact
                  variant="secondary"
                  onPress={() => void toggleActive(goal)}
                />
                <Button
                  label="Edit"
                  compact
                  variant="ghost"
                  onPress={() => openEdit(goal)}
                />
                <Button
                  label="Delete"
                  compact
                  variant="danger"
                  onPress={() => confirmDelete(goal)}
                />
              </View>
            </Card>
          )
        })
      )}

      {formMode ? (
        <Card>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {formMode === 'edit' ? 'Edit savings goal' : 'Create a savings goal'}
          </Text>
          <TextField
            label="Goal name"
            value={form.name}
            onChangeText={(value) =>
              setForm((current) => ({ ...current, name: value }))
            }
            placeholder="Emergency fund"
          />
          <TextField
            label="Target amount"
            value={form.target_amount}
            onChangeText={(value) =>
              setForm((current) => ({ ...current, target_amount: value }))
            }
            keyboardType="decimal-pad"
            placeholder="100000.00"
          />
          {formMode === 'edit' ? (
            <TextField
              label="Amount saved"
              value={form.current_amount}
              onChangeText={(value) =>
                setForm((current) => ({ ...current, current_amount: value }))
              }
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
          ) : (
            <Text style={[styles.rowSub, { color: colors.muted }]}>
              New goals start at zero; add the amount saved after your first
              deposit.
            </Text>
          )}
          <TextField
            label="Target date (optional)"
            value={form.target_date}
            onChangeText={(value) =>
              setForm((current) => ({ ...current, target_date: value }))
            }
            autoCapitalize="none"
            placeholder="YYYY-MM-DD"
          />
          <Button
            label={saving ? 'Saving…' : 'Save goal'}
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
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  goalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  goalIcon: {
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
  percent: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  bar: {
    height: 6,
    borderRadius: 3,
  },
  actionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
})
