import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Chip } from '../../src/components/finance/Chip'
import { Alert } from '../../src/components/ui/Alert'
import { Button } from '../../src/components/ui/Button'
import { Card } from '../../src/components/ui/Card'
import { Screen } from '../../src/components/ui/Screen'
import { SwitchField } from '../../src/components/ui/SwitchField'
import { TextField } from '../../src/components/ui/TextField'
import { financeApi } from '../../src/services/financeApi'
import type {
  SpendingPreferences,
  SpendingPreferencesUpdate,
} from '../../src/services/types'
import { spacing } from '../../src/theme'
import { useAppTheme } from '../../src/theme/useAppTheme'
import { extractApiError } from '../../src/utils/errors'

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'none', label: 'Never repeat' },
]

type FormState = {
  proactive_awareness_enabled: boolean
  significant_spending_threshold: string
  reminder_advance_days: string
  enable_due_reminders: boolean
  enable_post_payment_reminders: boolean
  enable_entertainment_alerts: boolean
  entertainment_categories: string
  reminder_frequency: string
  currency: string
}

function formFrom(preferences: SpendingPreferences): FormState {
  return {
    proactive_awareness_enabled: preferences.proactive_awareness_enabled,
    significant_spending_threshold: preferences.significant_spending_threshold,
    reminder_advance_days: String(preferences.reminder_advance_days),
    enable_due_reminders: preferences.enable_due_reminders,
    enable_post_payment_reminders: preferences.enable_post_payment_reminders,
    enable_entertainment_alerts: preferences.enable_entertainment_alerts,
    entertainment_categories: preferences.entertainment_categories,
    reminder_frequency: preferences.reminder_frequency,
    currency: preferences.currency,
  }
}

export default function SpendingPreferencesScreen() {
  const { colors } = useAppTheme()
  const [form, setForm] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const preferences = await financeApi.getSpendingPreferences()
      setForm(formFrom(preferences))
      setError(null)
    } catch (caught) {
      setError(
        extractApiError(caught, 'Unable to load your spending preferences.'),
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current))
    setSuccess(null)
    setError(null)
  }

  async function handleSave() {
    if (!form || saving) return
    const threshold = Number(form.significant_spending_threshold)
    if (!Number.isFinite(threshold) || threshold <= 0) {
      setError('Enter a significant spending threshold greater than zero.')
      return
    }
    const advance = Number(form.reminder_advance_days)
    if (!Number.isInteger(advance) || advance < 0 || advance > 30) {
      setError('Advance reminder days must be a whole number between 0 and 30.')
      return
    }
    if (form.entertainment_categories.trim().length > 200) {
      setError('Enter at most 200 characters of entertainment categories.')
      return
    }
    if (!/^[A-Za-z]{3}$/.test(form.currency)) {
      setError('Enter a three-letter currency code, such as INR.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const payload: SpendingPreferencesUpdate = {
        proactive_awareness_enabled: form.proactive_awareness_enabled,
        significant_spending_threshold: threshold.toFixed(2),
        reminder_advance_days: advance,
        enable_due_reminders: form.enable_due_reminders,
        enable_post_payment_reminders: form.enable_post_payment_reminders,
        enable_entertainment_alerts: form.enable_entertainment_alerts,
        entertainment_categories: form.entertainment_categories.trim(),
        reminder_frequency: form.reminder_frequency,
        currency: form.currency.toUpperCase(),
      }
      const updated = await financeApi.updateSpendingPreferences(payload)
      setForm(formFrom(updated))
      setSuccess('Spending preferences saved.')
    } catch (caught) {
      setError(
        extractApiError(caught, 'Unable to save your spending preferences.'),
      )
    } finally {
      setSaving(false)
    }
  }

  const frequencyOptions = form
    ? FREQUENCIES.some((item) => item.value === form.reminder_frequency)
      ? FREQUENCIES
      : [
          ...FREQUENCIES,
          { value: form.reminder_frequency, label: form.reminder_frequency },
        ]
    : FREQUENCIES

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: colors.text }]}>
          Spending preferences
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Choose how UniFlow warns you before and after significant spending.
          These preferences sync with your web account.
        </Text>
      </View>

      {error ? <Alert message={error} tone="error" /> : null}
      {success ? <Alert message={success} tone="success" /> : null}

      {loading ? (
        <Text style={[styles.placeholder, { color: colors.muted }]}>
          Loading spending preferences…
        </Text>
      ) : !form ? (
        <Button label="Try again" compact onPress={() => void load()} />
      ) : (
        <>
          <Card>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Awareness
            </Text>
            <SwitchField
              label="Proactive awareness"
              description="Surface upcoming dues before a significant transaction is recorded."
              value={form.proactive_awareness_enabled}
              onValueChange={(value) =>
                update('proactive_awareness_enabled', value)
              }
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <SwitchField
              label="Due-date reminders"
              description="Remind me about bills and subscriptions approaching their due date."
              value={form.enable_due_reminders}
              onValueChange={(value) => update('enable_due_reminders', value)}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <SwitchField
              label="Post-payment reminders"
              description="Follow up after a recorded payment changes your balance materially."
              value={form.enable_post_payment_reminders}
              onValueChange={(value) =>
                update('enable_post_payment_reminders', value)
              }
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <SwitchField
              label="Entertainment alerts"
              description="Warn about large spends in the categories below."
              value={form.enable_entertainment_alerts}
              onValueChange={(value) =>
                update('enable_entertainment_alerts', value)
              }
            />
          </Card>

          <Card>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Thresholds & timing
            </Text>
            <TextField
              label="Significant spending threshold"
              value={form.significant_spending_threshold}
              onChangeText={(value) =>
                update('significant_spending_threshold', value)
              }
              keyboardType="decimal-pad"
              placeholder="5000.00"
            />
            <TextField
              label="Advance reminder days"
              value={form.reminder_advance_days}
              onChangeText={(value) => update('reminder_advance_days', value)}
              keyboardType="number-pad"
              hint="How many days before a due date to raise it (0–30)."
            />
            <TextField
              label="Currency"
              value={form.currency}
              onChangeText={(value) => update('currency', value)}
              autoCapitalize="characters"
              maxLength={3}
              placeholder="INR"
            />
            <Text style={[styles.groupLabel, { color: colors.subtle }]}>
              REMINDER FREQUENCY
            </Text>
            <View style={styles.chipWrap}>
              {frequencyOptions.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  active={form.reminder_frequency === option.value}
                  onPress={() => update('reminder_frequency', option.value)}
                />
              ))}
            </View>
            <TextField
              label="Entertainment categories"
              value={form.entertainment_categories}
              onChangeText={(value) =>
                update('entertainment_categories', value)
              }
              placeholder="Entertainment, Dining"
              hint="Comma-separated category names, up to 200 characters."
            />
            <Button
              label={saving ? 'Saving…' : 'Save preferences'}
              loading={saving}
              onPress={() => void handleSave()}
            />
          </Card>

          <Card muted>
            <View style={styles.noteRow}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={colors.muted}
              />
              <Text style={[styles.note, { color: colors.muted }]}>
                Awareness checks are advisory. UniFlow never blocks or
                intercepts a payment, and notification delivery arrives in a
                later phase.
              </Text>
            </View>
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
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  note: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
})
