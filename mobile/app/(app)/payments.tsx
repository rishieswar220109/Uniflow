import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
  Alert as NativeAlert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { Chip } from '../../src/components/finance/Chip'
import { MockBadge, StatusBadge } from '../../src/components/finance/StatusBadge'
import { Alert } from '../../src/components/ui/Alert'
import { Button } from '../../src/components/ui/Button'
import { Card } from '../../src/components/ui/Card'
import { Screen } from '../../src/components/ui/Screen'
import { TextField } from '../../src/components/ui/TextField'
import { financeApi } from '../../src/services/financeApi'
import type {
  BillingCycle,
  Bill,
  BillRecurrence,
  Payment,
  RecurringSuggestion,
  Subscription,
  Summary,
  UpcomingPayment,
} from '../../src/services/types'
import { radius, spacing } from '../../src/theme'
import { useAppTheme } from '../../src/theme/useAppTheme'
import { extractApiError } from '../../src/utils/errors'
import {
  describeDueDate,
  formatMoney,
  formatShortDate,
  todayInputValue,
} from '../../src/utils/format'

type Segment = 'upcoming' | 'bills' | 'subscriptions'
type FormMode = 'create' | 'edit' | null
type HistoryTarget = { kind: 'bill' | 'subscription'; id: string } | null

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'bills', label: 'Bills' },
  { value: 'subscriptions', label: 'Subscriptions' },
]

const WINDOWS = [7, 30, 60, 90]

const BILL_STATES = [
  { value: '', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
]

const SUB_STATUSES = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
]

const RECURRENCES: { value: BillRecurrence; label: string }[] = [
  { value: 'none', label: 'One-off' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

const CYCLES: { value: BillingCycle; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

interface BillFormState {
  name: string
  payee: string
  amount: string
  dueDate: string
  recurrence: BillRecurrence
  autopay: boolean
  reminderDays: string
  notes: string
}

interface SubscriptionFormState {
  name: string
  provider: string
  amount: string
  cycle: BillingCycle
  nextDate: string
  reminderDays: string
  notes: string
}

function emptyBillForm(): BillFormState {
  return {
    name: '',
    payee: '',
    amount: '',
    dueDate: todayInputValue(),
    recurrence: 'none',
    autopay: false,
    reminderDays: '3',
    notes: '',
  }
}

function billFormFrom(bill: Bill): BillFormState {
  return {
    name: bill.name,
    payee: bill.payee ?? '',
    amount: bill.amount,
    dueDate: bill.due_date,
    recurrence: (RECURRENCES.some((item) => item.value === bill.recurrence)
      ? bill.recurrence
      : 'none') as BillRecurrence,
    autopay: bill.autopay,
    reminderDays: String(bill.reminder_days_before),
    notes: bill.notes ?? '',
  }
}

function emptySubscriptionForm(): SubscriptionFormState {
  return {
    name: '',
    provider: '',
    amount: '',
    cycle: 'monthly',
    nextDate: todayInputValue(),
    reminderDays: '3',
    notes: '',
  }
}

function subscriptionFormFrom(subscription: Subscription): SubscriptionFormState {
  return {
    name: subscription.name,
    provider: subscription.provider ?? '',
    amount: subscription.amount,
    cycle: (CYCLES.some((item) => item.value === subscription.billing_cycle)
      ? subscription.billing_cycle
      : 'monthly') as BillingCycle,
    nextDate: subscription.next_payment_date,
    reminderDays: String(subscription.reminder_days_before),
    notes: subscription.notes ?? '',
  }
}

export default function PaymentsScreen() {
  const { colors } = useAppTheme()
  const [segment, setSegment] = useState<Segment>('upcoming')
  const [windowDays, setWindowDays] = useState(30)
  const [billState, setBillState] = useState('')
  const [subStatus, setSubStatus] = useState('')

  const [summary, setSummary] = useState<Summary | null>(null)
  const [suggestions, setSuggestions] = useState<RecurringSuggestion[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [billsTotal, setBillsTotal] = useState(0)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [subscriptionsTotal, setSubscriptionsTotal] = useState(0)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [billFormMode, setBillFormMode] = useState<FormMode>(null)
  const [editingBillId, setEditingBillId] = useState<string | null>(null)
  const [billForm, setBillForm] = useState<BillFormState>(emptyBillForm)
  const [billSaving, setBillSaving] = useState(false)

  const [subFormMode, setSubFormMode] = useState<FormMode>(null)
  const [editingSubId, setEditingSubId] = useState<string | null>(null)
  const [subForm, setSubForm] = useState<SubscriptionFormState>(
    emptySubscriptionForm,
  )
  const [subSaving, setSubSaving] = useState(false)

  const [history, setHistory] = useState<HistoryTarget>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const reload = useCallback(() => {
    setReloadToken((current) => current + 1)
  }, [])

  useFocusEffect(
    useCallback(() => {
      let active = true
      async function run() {
        setLoading(true)
        try {
          if (segment === 'upcoming') {
            const [summaryData, suggestionData] = await Promise.all([
              financeApi.getSummary(windowDays),
              financeApi.getRecurringSuggestions(),
            ])
            if (!active) return
            setSummary(summaryData)
            setSuggestions(suggestionData)
          } else if (segment === 'bills') {
            const result = await financeApi.getBills({
              state: billState || undefined,
              days: 365,
            })
            if (!active) return
            setBills(result.items)
            setBillsTotal(result.total)
          } else {
            const result = await financeApi.getSubscriptions({
              status: subStatus || undefined,
            })
            if (!active) return
            setSubscriptions(result.items)
            setSubscriptionsTotal(result.total)
          }
          setError(null)
        } catch (caught) {
          if (active) {
            setError(
              extractApiError(caught, 'Unable to load your payment data.'),
            )
          }
        } finally {
          if (active) setLoading(false)
        }
      }
      void run()
      return () => {
        active = false
      }
    }, [segment, windowDays, billState, subStatus, reloadToken]),
  )

  const groupedUpcoming = useMemo(() => {
    const map = new Map<string, UpcomingPayment[]>()
    for (const item of summary?.upcoming_payments ?? []) {
      const list = map.get(item.due_date) ?? []
      list.push(item)
      map.set(item.due_date, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [summary])

  function openBillCreate() {
    setBillForm(emptyBillForm())
    setEditingBillId(null)
    setBillFormMode('create')
    setError(null)
    setSuccess(null)
  }

  function openBillEdit(bill: Bill) {
    setBillForm(billFormFrom(bill))
    setEditingBillId(bill.id)
    setBillFormMode('edit')
    setError(null)
    setSuccess(null)
  }

  async function saveBill() {
    if (billSaving) return
    const amount = Number(billForm.amount)
    if (!billForm.name.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Enter a bill name and an amount greater than zero.')
      return
    }
    setBillSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const payload = {
        name: billForm.name.trim(),
        payee: billForm.payee.trim() || null,
        amount: amount.toFixed(2),
        due_date: billForm.dueDate,
        recurrence: billForm.recurrence,
        autopay: billForm.autopay,
        reminder_days_before: Number(billForm.reminderDays) || 0,
        notes: billForm.notes.trim() || null,
      }
      if (billFormMode === 'edit' && editingBillId) {
        await financeApi.updateBill(editingBillId, payload)
        setSuccess('Bill updated.')
      } else {
        await financeApi.createBill(payload)
        setSuccess('Bill created.')
      }
      setBillFormMode(null)
      setEditingBillId(null)
      reload()
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to save the bill.'))
    } finally {
      setBillSaving(false)
    }
  }

  function confirmPayBill(bill: Bill) {
    NativeAlert.alert(
      'Record payment?',
      `Record a payment of ${formatMoney(bill.amount, bill.currency)} for “${bill.name}” today? UniFlow does not move money.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Record', onPress: () => void payBill(bill) },
      ],
    )
  }

  async function payBill(bill: Bill) {
    setBusyId(bill.id)
    setError(null)
    setSuccess(null)
    try {
      const result = await financeApi.payBill(bill.id, {
        paid_on: todayInputValue(),
      })
      setSuccess(
        result.recurrence === 'none'
          ? `“${bill.name}” marked as paid.`
          : `Payment recorded. The next “${bill.name}” occurrence is due ${formatShortDate(result.due_date)}.`,
      )
      reload()
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to record the payment.'))
    } finally {
      setBusyId(null)
    }
  }

  function confirmDeleteBill(bill: Bill) {
    NativeAlert.alert(
      'Delete bill?',
      `Delete “${bill.name}”? Its recorded payment history will also be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void deleteBill(bill),
        },
      ],
    )
  }

  async function deleteBill(bill: Bill) {
    setBusyId(bill.id)
    setError(null)
    setSuccess(null)
    try {
      await financeApi.deleteBill(bill.id)
      setSuccess('Bill deleted.')
      if (history?.kind === 'bill' && history.id === bill.id) {
        setHistory(null)
        setPayments([])
      }
      reload()
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to delete the bill.'))
    } finally {
      setBusyId(null)
    }
  }

  function openSubCreate() {
    setSubForm(emptySubscriptionForm())
    setEditingSubId(null)
    setSubFormMode('create')
    setError(null)
    setSuccess(null)
  }

  function openSubEdit(subscription: Subscription) {
    setSubForm(subscriptionFormFrom(subscription))
    setEditingSubId(subscription.id)
    setSubFormMode('edit')
    setError(null)
    setSuccess(null)
  }

  async function saveSubscription() {
    if (subSaving) return
    const amount = Number(subForm.amount)
    if (!subForm.name.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Enter a subscription name and an amount greater than zero.')
      return
    }
    setSubSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const payload = {
        name: subForm.name.trim(),
        provider: subForm.provider.trim() || null,
        amount: amount.toFixed(2),
        billing_cycle: subForm.cycle,
        next_payment_date: subForm.nextDate,
        reminder_days_before: Number(subForm.reminderDays) || 0,
        notes: subForm.notes.trim() || null,
      }
      if (subFormMode === 'edit' && editingSubId) {
        await financeApi.updateSubscription(editingSubId, payload)
        setSuccess('Subscription updated.')
      } else {
        await financeApi.createSubscription(payload)
        setSuccess('Subscription created.')
      }
      setSubFormMode(null)
      setEditingSubId(null)
      reload()
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to save the subscription.'))
    } finally {
      setSubSaving(false)
    }
  }

  function confirmPaySubscription(subscription: Subscription) {
    NativeAlert.alert(
      'Record payment?',
      `Record a payment of ${formatMoney(subscription.amount, subscription.currency)} for “${subscription.name}” today? The next charge date will advance.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Record',
          onPress: () => void paySubscription(subscription),
        },
      ],
    )
  }

  async function paySubscription(subscription: Subscription) {
    setBusyId(subscription.id)
    setError(null)
    setSuccess(null)
    try {
      const result = await financeApi.paySubscription(subscription.id, {
        paid_on: todayInputValue(),
      })
      setSuccess(
        `Payment recorded. The next “${subscription.name}” charge is expected on ${formatShortDate(result.next_payment_date)}.`,
      )
      reload()
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to record the payment.'))
    } finally {
      setBusyId(null)
    }
  }

  async function changeSubscriptionStatus(
    subscription: Subscription,
    status: 'active' | 'paused',
  ) {
    setBusyId(subscription.id)
    setError(null)
    setSuccess(null)
    try {
      await financeApi.updateSubscription(subscription.id, { status })
      setSuccess(
        status === 'paused'
          ? `“${subscription.name}” paused.`
          : `“${subscription.name}” resumed.`,
      )
      reload()
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to change the subscription.'))
    } finally {
      setBusyId(null)
    }
  }

  function confirmDeleteSubscription(subscription: Subscription) {
    NativeAlert.alert(
      'Delete subscription?',
      `Delete “${subscription.name}”? Its recorded payment history will also be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void deleteSubscription(subscription),
        },
      ],
    )
  }

  async function deleteSubscription(subscription: Subscription) {
    setBusyId(subscription.id)
    setError(null)
    setSuccess(null)
    try {
      await financeApi.deleteSubscription(subscription.id)
      setSuccess('Subscription deleted.')
      if (history?.kind === 'subscription' && history.id === subscription.id) {
        setHistory(null)
        setPayments([])
      }
      reload()
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to delete the subscription.'))
    } finally {
      setBusyId(null)
    }
  }

  async function toggleHistory(target: HistoryTarget) {
    if (!target) return
    if (history?.kind === target.kind && history.id === target.id) {
      setHistory(null)
      setPayments([])
      return
    }
    setHistory(target)
    setPayments([])
    setHistoryLoading(true)
    try {
      const result =
        target.kind === 'bill'
          ? await financeApi.getBillPayments(target.id)
          : await financeApi.getSubscriptionPayments(target.id)
      setPayments(result)
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to load payment history.'))
    } finally {
      setHistoryLoading(false)
    }
  }

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: colors.text }]}>Payments</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Bills, subscriptions and the upcoming calendar in one place. UniFlow
          records payments you confirm and never moves money in this phase.
        </Text>
        {summary?.is_mock_data ? <MockBadge /> : null}
      </View>

      {error ? <Alert message={error} tone="error" /> : null}
      {success ? <Alert message={success} tone="success" /> : null}

      <View style={styles.segmentRow}>
        {SEGMENTS.map((item) => (
          <View key={item.value} style={styles.segmentItem}>
            <Chip
              label={item.label}
              active={segment === item.value}
              onPress={() => setSegment(item.value)}
            />
          </View>
        ))}
      </View>

      {segment === 'upcoming' ? (
        <>
          <Card>
            <View style={styles.cardHead}>
              <View style={styles.cardHeadCopy}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Calendar window
                </Text>
                <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
                  Overdue unpaid bills stay visible so nothing is silently
                  missed.
                </Text>
              </View>
            </View>
            <View style={styles.chipWrap}>
              {WINDOWS.map((window) => (
                <Chip
                  key={window}
                  label={`${window} days`}
                  active={windowDays === window}
                  onPress={() => setWindowDays(window)}
                />
              ))}
            </View>

            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.subtle }]}>
                  DUE IN WINDOW
                </Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {formatMoney(
                    summary?.upcoming_total ?? '0.00',
                    summary?.currency ?? 'INR',
                  )}
                </Text>
                <Text style={[styles.statHint, { color: colors.muted }]}>
                  {summary?.upcoming_bills_count ?? 0} bills ·{' '}
                  {summary?.upcoming_subscriptions_count ?? 0} subscriptions
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.subtle }]}>
                  ACTIVE ACCOUNTS
                </Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {summary?.accounts_count ?? 0}
                </Text>
                <Text style={[styles.statHint, { color: colors.muted }]}>
                  {summary?.connected_accounts_count ?? 0} connection(s)
                </Text>
              </View>
            </View>
          </Card>

          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Due soon
            </Text>
            <Text style={[styles.sectionSub, { color: colors.muted }]}>
              {groupedUpcoming.length === 0
                ? 'Nothing is due in this window.'
                : `${summary?.upcoming_payments.length ?? 0} payment(s) in the next ${windowDays} days.`}
            </Text>
          </View>

          {loading ? (
            <Text style={[styles.placeholder, { color: colors.muted }]}>
              Loading your payment calendar…
            </Text>
          ) : groupedUpcoming.length === 0 ? (
            <Card>
              <View style={styles.emptyState}>
                <View
                  style={[
                    styles.emptyIcon,
                    { backgroundColor: colors.primarySoft },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={26}
                    color={colors.primary}
                  />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No upcoming payments
                </Text>
                <Text style={[styles.emptyCopy, { color: colors.muted }]}>
                  Add a bill or subscription, or widen the calendar window.
                  Manual entries are included without a bank connection.
                </Text>
              </View>
            </Card>
          ) : (
            <Card>
              {groupedUpcoming.map(([dueDate, items]) => (
                <View key={dueDate} style={styles.dateGroup}>
                  <View style={styles.dateHead}>
                    <Text style={[styles.dateLabel, { color: colors.text }]}>
                      {formatShortDate(dueDate)}
                    </Text>
                    <Text style={[styles.dateRelative, { color: colors.muted }]}>
                      {describeDueDate(dueDate)}
                    </Text>
                  </View>
                  {items.map((item) => (
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
                          {item.kind === 'bill' ? 'Bill' : 'Subscription'}
                          {item.is_recurring ? ' · recurring' : ''}
                          {item.autopay ? ' · autopay label' : ''}
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
              ))}
            </Card>
          )}

          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Recurring candidates
            </Text>
            <Text style={[styles.sectionSub, { color: colors.muted }]}>
              Deterministic suggestions from synced history. Review them before
              creating a subscription.
            </Text>
          </View>

          {suggestions.length === 0 ? (
            <Card>
              <Text style={[styles.placeholder, { color: colors.muted }]}>
                No recurring patterns yet. UniFlow needs at least two similar
                transactions at a stable interval.
              </Text>
            </Card>
          ) : (
            <Card>
              {suggestions.slice(0, 8).map((suggestion) => (
                <View
                  key={`${suggestion.merchant}-${suggestion.cadence}`}
                  style={[styles.suggestionRow, { borderColor: colors.border }]}
                >
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>
                      {suggestion.merchant}
                    </Text>
                    <Text style={[styles.rowSub, { color: colors.muted }]}>
                      {suggestion.cadence} · {suggestion.occurrences}{' '}
                      occurrence(s) · next{' '}
                      {formatShortDate(suggestion.next_expected_on)}
                    </Text>
                    <View
                      style={[
                        styles.confidenceTrack,
                        { backgroundColor: colors.surfaceMuted },
                      ]}
                    >
                      <View
                        style={[
                          styles.confidenceBar,
                          {
                            backgroundColor: colors.primary,
                            width: `${Math.round(suggestion.confidence * 100)}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.rowEnd}>
                    <Text style={[styles.rowAmount, { color: colors.text }]}>
                      {formatMoney(
                        suggestion.average_amount,
                        suggestion.currency,
                      )}
                    </Text>
                    <Text style={[styles.rowSub, { color: colors.muted }]}>
                      {Math.round(suggestion.confidence * 100)}% confidence
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          )}

          <View style={styles.noteRow}>
            <Ionicons
              name="information-circle-outline"
              size={15}
              color={colors.muted}
            />
            <Text style={[styles.note, { color: colors.muted }]}>
              Suggestions are generated with fixed rules from stored
              transactions. They are not predictions and create nothing
              automatically.
            </Text>
          </View>
        </>
      ) : null}

      {segment === 'bills' ? (
        <>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadCopy}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Your bills
              </Text>
              <Text style={[styles.sectionSub, { color: colors.muted }]}>
                {billsTotal} bill(s). Recording a recurring payment advances its
                schedule.
              </Text>
            </View>
            <Button
              label={billFormMode ? 'Close' : 'New bill'}
              compact
              variant={billFormMode ? 'secondary' : 'primary'}
              onPress={() => {
                if (billFormMode) {
                  setBillFormMode(null)
                  setEditingBillId(null)
                } else {
                  openBillCreate()
                }
              }}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {BILL_STATES.map((item) => (
              <Chip
                key={item.value || 'all'}
                label={item.label}
                active={billState === item.value}
                onPress={() => setBillState(item.value)}
              />
            ))}
          </ScrollView>

          {billFormMode ? (
            <Card>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {billFormMode === 'edit' ? 'Edit bill' : 'Create a bill'}
              </Text>
              <TextField
                label="Bill name"
                value={billForm.name}
                onChangeText={(value) =>
                  setBillForm((current) => ({ ...current, name: value }))
                }
                placeholder="Electricity bill"
              />
              <TextField
                label="Payee (optional)"
                value={billForm.payee}
                onChangeText={(value) =>
                  setBillForm((current) => ({ ...current, payee: value }))
                }
                placeholder="State Power"
              />
              <TextField
                label="Amount"
                value={billForm.amount}
                onChangeText={(value) =>
                  setBillForm((current) => ({ ...current, amount: value }))
                }
                keyboardType="decimal-pad"
                placeholder="1450.00"
              />
              <TextField
                label="Due date"
                value={billForm.dueDate}
                onChangeText={(value) =>
                  setBillForm((current) => ({ ...current, dueDate: value }))
                }
                autoCapitalize="none"
                placeholder="YYYY-MM-DD"
              />
              <Text style={[styles.groupLabel, { color: colors.subtle }]}>
                RECURRENCE
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {RECURRENCES.map((item) => (
                  <Chip
                    key={item.value}
                    label={item.label}
                    active={billForm.recurrence === item.value}
                    onPress={() =>
                      setBillForm((current) => ({
                        ...current,
                        recurrence: item.value,
                      }))
                    }
                  />
                ))}
              </ScrollView>
              <View style={styles.chipWrap}>
                <Chip
                  label={
                    billForm.autopay ? 'Autopay label: on' : 'Mark as autopay'
                  }
                  active={billForm.autopay}
                  onPress={() =>
                    setBillForm((current) => ({
                      ...current,
                      autopay: !current.autopay,
                    }))
                  }
                />
              </View>
              <TextField
                label="Reminder days before"
                value={billForm.reminderDays}
                onChangeText={(value) =>
                  setBillForm((current) => ({
                    ...current,
                    reminderDays: value,
                  }))
                }
                keyboardType="number-pad"
                hint="Reminders are delivered in a later phase."
              />
              <TextField
                label="Notes (optional)"
                value={billForm.notes}
                onChangeText={(value) =>
                  setBillForm((current) => ({ ...current, notes: value }))
                }
              />
              <Button
                label={billSaving ? 'Saving…' : 'Save bill'}
                loading={billSaving}
                onPress={() => void saveBill()}
              />
            </Card>
          ) : null}

          {loading ? (
            <Text style={[styles.placeholder, { color: colors.muted }]}>
              Loading bills…
            </Text>
          ) : bills.length === 0 ? (
            <Card>
              <View style={styles.emptyState}>
                <View
                  style={[
                    styles.emptyIcon,
                    { backgroundColor: colors.primarySoft },
                  ]}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={26}
                    color={colors.primary}
                  />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No bills here
                </Text>
                <Text style={[styles.emptyCopy, { color: colors.muted }]}>
                  Create a bill to track its due date, recurrence and payment
                  history. UniFlow never pays a bill without your approval.
                </Text>
              </View>
            </Card>
          ) : (
            bills.map((bill) => {
              const busy = busyId === bill.id
              const historyOpen =
                history?.kind === 'bill' && history.id === bill.id
              return (
                <Card key={bill.id}>
                  <View style={styles.obligationHead}>
                    <View
                      style={[
                        styles.obligationIcon,
                        { backgroundColor: colors.primarySoft },
                      ]}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={[styles.rowTitle, { color: colors.text }]}>
                        {bill.name}
                      </Text>
                      <Text style={[styles.rowSub, { color: colors.muted }]}>
                        {bill.payee ? `${bill.payee} · ` : ''}
                        Due {formatShortDate(bill.due_date)} ·{' '}
                        {describeDueDate(bill.due_date)}
                        {bill.recurrence !== 'none'
                          ? ` · ${bill.recurrence}`
                          : ' · one-off'}
                      </Text>
                    </View>
                    <View style={styles.rowEnd}>
                      <Text style={[styles.obligationAmount, { color: colors.text }]}>
                        {formatMoney(bill.amount, bill.currency)}
                      </Text>
                      <StatusBadge status={bill.state} />
                    </View>
                  </View>

                  {bill.notes ? (
                    <Text style={[styles.rowSub, { color: colors.muted }]}>
                      {bill.notes}
                    </Text>
                  ) : null}

                  <View style={styles.actionWrap}>
                    <Button
                      label="Record payment"
                      compact
                      loading={busy}
                      disabled={
                        busyId !== null ||
                        ['paid', 'cancelled', 'skipped'].includes(bill.status)
                      }
                      onPress={() => confirmPayBill(bill)}
                    />
                    <Button
                      label="Edit"
                      compact
                      variant="secondary"
                      disabled={busyId !== null}
                      onPress={() => openBillEdit(bill)}
                    />
                    <Button
                      label={historyOpen ? 'Hide history' : 'History'}
                      compact
                      variant="ghost"
                      disabled={busyId !== null}
                      onPress={() =>
                        void toggleHistory({ kind: 'bill', id: bill.id })
                      }
                    />
                    <Button
                      label="Delete"
                      compact
                      variant="danger"
                      disabled={busyId !== null}
                      onPress={() => confirmDeleteBill(bill)}
                    />
                  </View>

                  {historyOpen ? (
                    <PaymentHistory
                      loading={historyLoading}
                      payments={payments}
                      colors={colors}
                    />
                  ) : null}
                </Card>
              )
            })
          )}
        </>
      ) : null}

      {segment === 'subscriptions' ? (
        <>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadCopy}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Your subscriptions
              </Text>
              <Text style={[styles.sectionSub, { color: colors.muted }]}>
                {subscriptionsTotal} subscription(s). Monthly equivalent is
                shown for comparison, not as a charge.
              </Text>
            </View>
            <Button
              label={subFormMode ? 'Close' : 'New plan'}
              compact
              variant={subFormMode ? 'secondary' : 'primary'}
              onPress={() => {
                if (subFormMode) {
                  setSubFormMode(null)
                  setEditingSubId(null)
                } else {
                  openSubCreate()
                }
              }}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {SUB_STATUSES.map((item) => (
              <Chip
                key={item.value || 'all'}
                label={item.label}
                active={subStatus === item.value}
                onPress={() => setSubStatus(item.value)}
              />
            ))}
          </ScrollView>

          {subFormMode ? (
            <Card>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {subFormMode === 'edit'
                  ? 'Edit subscription'
                  : 'Create a subscription'}
              </Text>
              <TextField
                label="Subscription name"
                value={subForm.name}
                onChangeText={(value) =>
                  setSubForm((current) => ({ ...current, name: value }))
                }
                placeholder="Netflix"
              />
              <TextField
                label="Provider (optional)"
                value={subForm.provider}
                onChangeText={(value) =>
                  setSubForm((current) => ({ ...current, provider: value }))
                }
                placeholder="Netflix India"
              />
              <TextField
                label="Amount per cycle"
                value={subForm.amount}
                onChangeText={(value) =>
                  setSubForm((current) => ({ ...current, amount: value }))
                }
                keyboardType="decimal-pad"
                placeholder="649.00"
              />
              <Text style={[styles.groupLabel, { color: colors.subtle }]}>
                BILLING CYCLE
              </Text>
              <View style={styles.chipWrap}>
                {CYCLES.map((item) => (
                  <Chip
                    key={item.value}
                    label={item.label}
                    active={subForm.cycle === item.value}
                    onPress={() =>
                      setSubForm((current) => ({
                        ...current,
                        cycle: item.value,
                      }))
                    }
                  />
                ))}
              </View>
              <TextField
                label="Next payment date"
                value={subForm.nextDate}
                onChangeText={(value) =>
                  setSubForm((current) => ({ ...current, nextDate: value }))
                }
                autoCapitalize="none"
                placeholder="YYYY-MM-DD"
              />
              <TextField
                label="Reminder days before"
                value={subForm.reminderDays}
                onChangeText={(value) =>
                  setSubForm((current) => ({
                    ...current,
                    reminderDays: value,
                  }))
                }
                keyboardType="number-pad"
                hint="Reminders are delivered in a later phase."
              />
              <TextField
                label="Notes (optional)"
                value={subForm.notes}
                onChangeText={(value) =>
                  setSubForm((current) => ({ ...current, notes: value }))
                }
                placeholder="Plan, seats or cancellation terms"
              />
              <Button
                label={subSaving ? 'Saving…' : 'Save subscription'}
                loading={subSaving}
                onPress={() => void saveSubscription()}
              />
            </Card>
          ) : null}

          {loading ? (
            <Text style={[styles.placeholder, { color: colors.muted }]}>
              Loading subscriptions…
            </Text>
          ) : subscriptions.length === 0 ? (
            <Card>
              <View style={styles.emptyState}>
                <View
                  style={[
                    styles.emptyIcon,
                    { backgroundColor: colors.primarySoft },
                  ]}
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={26}
                    color={colors.primary}
                  />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No subscriptions here
                </Text>
                <Text style={[styles.emptyCopy, { color: colors.muted }]}>
                  Add a recurring service to track charges and reminders, or
                  review recurring candidates from synced transactions.
                </Text>
              </View>
            </Card>
          ) : (
            subscriptions.map((subscription) => {
              const busy = busyId === subscription.id
              const historyOpen =
                history?.kind === 'subscription' &&
                history.id === subscription.id
              return (
                <Card key={subscription.id}>
                  <View style={styles.obligationHead}>
                    <View
                      style={[
                        styles.obligationIcon,
                        { backgroundColor: colors.primarySoft },
                      ]}
                    >
                      <Ionicons
                        name="sparkles-outline"
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={[styles.rowTitle, { color: colors.text }]}>
                        {subscription.name}
                      </Text>
                      <Text style={[styles.rowSub, { color: colors.muted }]}>
                        {subscription.provider
                          ? `${subscription.provider} · `
                          : ''}
                        Next charge{' '}
                        {formatShortDate(subscription.next_payment_date)} ·{' '}
                        {describeDueDate(subscription.next_payment_date)}
                      </Text>
                    </View>
                    <View style={styles.rowEnd}>
                      <Text
                        style={[styles.obligationAmount, { color: colors.text }]}
                      >
                        {formatMoney(
                          subscription.amount,
                          subscription.currency,
                        )}
                      </Text>
                      <StatusBadge status={subscription.status} />
                    </View>
                  </View>

                  <Text style={[styles.rowSub, { color: colors.muted }]}>
                    {formatMoney(
                      subscription.monthly_equivalent,
                      subscription.currency,
                    )}{' '}
                    / month · {subscription.billing_cycle}
                  </Text>

                  {subscription.notes ? (
                    <Text style={[styles.rowSub, { color: colors.muted }]}>
                      {subscription.notes}
                    </Text>
                  ) : null}

                  <View style={styles.actionWrap}>
                    <Button
                      label="Record payment"
                      compact
                      loading={busy}
                      disabled={
                        busyId !== null || subscription.status !== 'active'
                      }
                      onPress={() => confirmPaySubscription(subscription)}
                    />
                    <Button
                      label="Edit"
                      compact
                      variant="secondary"
                      disabled={busyId !== null}
                      onPress={() => openSubEdit(subscription)}
                    />
                    {subscription.status === 'active' ? (
                      <Button
                        label="Pause"
                        compact
                        variant="ghost"
                        disabled={busyId !== null}
                        onPress={() =>
                          void changeSubscriptionStatus(subscription, 'paused')
                        }
                      />
                    ) : subscription.status === 'paused' ? (
                      <Button
                        label="Resume"
                        compact
                        variant="ghost"
                        disabled={busyId !== null}
                        onPress={() =>
                          void changeSubscriptionStatus(subscription, 'active')
                        }
                      />
                    ) : null}
                    <Button
                      label={historyOpen ? 'Hide history' : 'History'}
                      compact
                      variant="ghost"
                      disabled={busyId !== null}
                      onPress={() =>
                        void toggleHistory({
                          kind: 'subscription',
                          id: subscription.id,
                        })
                      }
                    />
                    <Button
                      label="Delete"
                      compact
                      variant="danger"
                      disabled={busyId !== null}
                      onPress={() => confirmDeleteSubscription(subscription)}
                    />
                  </View>

                  {historyOpen ? (
                    <PaymentHistory
                      loading={historyLoading}
                      payments={payments}
                      colors={colors}
                    />
                  ) : null}
                </Card>
              )
            })
          )}
        </>
      ) : null}

      <View style={styles.noteRow}>
        <Ionicons name="shield-checkmark-outline" size={15} color={colors.muted} />
        <Text style={[styles.note, { color: colors.muted }]}>
          Payments are recorded only after your confirmation. UniFlow never
          initiates a bank transfer in this phase.
        </Text>
      </View>
    </Screen>
  )
}

function PaymentHistory({
  loading,
  payments,
  colors,
}: {
  loading: boolean
  payments: Payment[]
  colors: ReturnType<typeof useAppTheme>['colors']
}) {
  return (
    <View
      style={[
        styles.historyPanel,
        { backgroundColor: colors.surfaceInset, borderColor: colors.border },
      ]}
    >
      {loading ? (
        <Text style={[styles.rowSub, { color: colors.muted }]}>
          Loading history…
        </Text>
      ) : payments.length === 0 ? (
        <Text style={[styles.rowSub, { color: colors.muted }]}>
          No payments recorded yet.
        </Text>
      ) : (
        payments.map((payment) => (
          <View key={payment.id} style={styles.historyRow}>
            <Text style={[styles.rowSub, { color: colors.muted }]}>
              {formatShortDate(payment.paid_on)}
              {payment.note ? ` · ${payment.note}` : ''}
            </Text>
            <Text style={[styles.rowAmount, { color: colors.text }]}>
              {formatMoney(payment.amount, payment.currency)}
            </Text>
          </View>
        ))
      )}
    </View>
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
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segmentItem: {
    flex: 1,
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
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  sectionHead: {
    gap: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSub: {
    fontSize: 12,
    lineHeight: 17,
  },
  placeholder: {
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
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
  dateGroup: {
    gap: spacing.xs,
  },
  dateHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  dateRelative: {
    fontSize: 11,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
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
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  confidenceTrack: {
    height: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginTop: 4,
  },
  confidenceBar: {
    height: '100%',
    borderRadius: radius.pill,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  note: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
  },
  obligationHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  obligationIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  obligationAmount: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  actionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  historyPanel: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
})
