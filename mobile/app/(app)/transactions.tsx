import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  Alert as NativeAlert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { Chip } from '../../src/components/finance/Chip'
import { StatusBadge } from '../../src/components/finance/StatusBadge'
import { Alert } from '../../src/components/ui/Alert'
import { Button } from '../../src/components/ui/Button'
import { Card } from '../../src/components/ui/Card'
import { Screen } from '../../src/components/ui/Screen'
import { TextField } from '../../src/components/ui/TextField'
import { financeApi } from '../../src/services/financeApi'
import type {
  Category,
  FinancialAccount,
  ProactiveAwareness,
  Transaction,
  TransactionPage,
} from '../../src/services/types'
import { radius, spacing } from '../../src/theme'
import { useAppTheme } from '../../src/theme/useAppTheme'
import { extractApiError } from '../../src/utils/errors'
import {
  formatMoney,
  formatShortDate,
  formatSignedMoney,
  todayInputValue,
} from '../../src/utils/format'

const PAGE_SIZE = 25

interface Filters {
  accountId: string
  direction: string
  source: string
  search: string
}

const EMPTY_FILTERS: Filters = {
  accountId: '',
  direction: '',
  source: '',
  search: '',
}

interface FormState {
  accountId: string
  direction: 'expense' | 'income'
  amount: string
  description: string
  merchant: string
  occurredOn: string
  categoryId: string
  notes: string
  allowDuplicate: boolean
}

function emptyForm(): FormState {
  return {
    accountId: '',
    direction: 'expense',
    amount: '',
    description: '',
    merchant: '',
    occurredOn: todayInputValue(),
    categoryId: '',
    notes: '',
    allowDuplicate: false,
  }
}

export default function TransactionsScreen() {
  const { colors } = useAppTheme()
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [page, setPage] = useState<TransactionPage | null>(null)
  const [offset, setOffset] = useState(0)
  const [reloadToken, setReloadToken] = useState(0)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [searchDraft, setSearchDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [checkingAwareness, setCheckingAwareness] = useState(false)
  const [awareness, setAwareness] = useState<ProactiveAwareness | null>(null)

  const [editing, setEditing] = useState<Transaction | null>(null)
  const [editCategory, setEditCategory] = useState('')
  const [editMerchant, setEditMerchant] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const reload = useCallback(() => {
    setReloadToken((current) => current + 1)
  }, [])

  useFocusEffect(
    useCallback(() => {
      let active = true
      async function run() {
        setLoading(true)
        try {
          const [accountList, categoryList, result] = await Promise.all([
            financeApi.getAccounts(),
            financeApi.getCategories(),
            financeApi.getTransactions({
              account_id: filters.accountId || undefined,
              transaction_type: filters.direction || undefined,
              source: filters.source || undefined,
              search: filters.search || undefined,
              limit: PAGE_SIZE,
              offset,
            }),
          ])
          if (!active) return
          setAccounts(accountList)
          setCategories(categoryList)
          setPage(result)
          setError(null)
        } catch (caught) {
          if (active) {
            setError(
              extractApiError(caught, 'Unable to load your transactions.'),
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
    }, [filters, offset, reloadToken]),
  )

  function openForm() {
    setForm({
      ...emptyForm(),
      accountId: accounts[0]?.id ?? '',
    })
    setShowForm(true)
    setAwareness(null)
    setError(null)
    setSuccess(null)
  }

  async function handleCreate() {
    if (saving || checkingAwareness) return
    const amountValue = Number(form.amount)
    if (!form.description.trim() || !Number.isFinite(amountValue) || amountValue <= 0) {
      setError('Enter a description and an amount greater than zero.')
      return
    }
    const accountId = form.accountId || accounts[0]?.id
    if (!accountId) {
      setError('Connect an account before recording a transaction.')
      return
    }
    if (form.direction === 'expense') {
      setCheckingAwareness(true)
      setError(null)
      try {
        const categorySlug = form.categoryId
          ? categories.find((category) => category.id === form.categoryId)
              ?.slug ?? null
          : null
        const result = await financeApi.checkProactiveAwareness({
          transaction_amount: amountValue.toFixed(2),
          transaction_category: categorySlug,
        })
        if (result) {
          setAwareness(result)
          setCheckingAwareness(false)
          return
        }
      } catch {
        // Awareness is advisory; never block the transaction on its failure.
      }
      setCheckingAwareness(false)
    }
    await submitTransaction(accountId, amountValue)
  }

  async function submitTransaction(accountId: string, amountValue: number) {
    if (saving) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const signed = form.direction === 'expense' ? -amountValue : amountValue
      const created = await financeApi.createTransaction({
        account_id: accountId,
        amount: signed.toFixed(2),
        description: form.description.trim(),
        merchant: form.merchant.trim() || null,
        occurred_on: form.occurredOn,
        category_id: form.categoryId || null,
        notes: form.notes.trim() || null,
        allow_duplicate: form.allowDuplicate,
      })
      const alerts = created.alerts ?? []
      setSuccess(
        alerts.length > 0
          ? `Transaction recorded. UniFlow stored ${alerts.length} insight(s) for review: ${alerts
              .map((alert) => alert.title)
              .join('; ')}. No push, email or SMS notification is sent.`
          : 'Transaction recorded. Income and expenses update from the sign of the amount.',
      )
      setAwareness(null)
      setShowForm(false)
      setForm(emptyForm())
      reload()
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to record the transaction.'))
    } finally {
      setSaving(false)
    }
  }

  function startEditing(transaction: Transaction) {
    setEditing(transaction)
    setEditCategory(transaction.category?.id ?? '')
    setEditMerchant(transaction.merchant ?? '')
    setEditNotes(transaction.notes ?? '')
    setError(null)
    setSuccess(null)
  }

  async function saveEditing() {
    if (!editing || editSaving) return
    setEditSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await financeApi.updateTransaction(editing.id, {
        category_id: editCategory || null,
        merchant: editMerchant.trim() || null,
        notes: editNotes.trim() || null,
      })
      setSuccess('Transaction updated.')
      setEditing(null)
      reload()
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to update the transaction.'))
    } finally {
      setEditSaving(false)
    }
  }

  function confirmDelete(transaction: Transaction) {
    NativeAlert.alert(
      'Delete transaction?',
      `Delete “${transaction.description}”? Only manual transactions can be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void remove(transaction),
        },
      ],
    )
  }

  async function remove(transaction: Transaction) {
    setError(null)
    setSuccess(null)
    try {
      await financeApi.deleteTransaction(transaction.id)
      setSuccess('Manual transaction deleted.')
      setEditing(null)
      reload()
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to delete the transaction.'))
    }
  }

  function applySearch() {
    setOffset(0)
    setFilters((current) => ({ ...current, search: searchDraft.trim() }))
  }

  function changeFilter(patch: Partial<Filters>) {
    setOffset(0)
    setFilters((current) => ({ ...current, ...patch }))
  }

  function clearFilters() {
    setSearchDraft('')
    setOffset(0)
    setFilters(EMPTY_FILTERS)
  }

  const total = page?.total ?? 0
  const items = page?.items ?? []
  const from = total === 0 ? 0 : offset + 1
  const to = offset + items.length
  const accountsById = new Map(accounts.map((account) => [account.id, account]))

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: colors.text }]}>Transactions</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Provider-synced and manually recorded activity in one place. Positive
          amounts are income; negative amounts are expenses. Synced records stay
          read-only except for categories and notes.
        </Text>
      </View>

      {error ? <Alert message={error} tone="error" /> : null}
      {success ? <Alert message={success} tone="success" /> : null}

      <Button
        label={showForm ? 'Close form' : 'Add transaction'}
        variant={showForm ? 'secondary' : 'primary'}
        onPress={() => (showForm ? setShowForm(false) : openForm())}
      />

      {showForm ? (
        <Card>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Record a manual transaction
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
            Choose spending or income, then enter a positive amount. UniFlow
            prompts before storing an exact duplicate.
          </Text>

          {accounts.length === 0 ? (
            <Alert
              message="Connect an account first so the transaction has an owner."
              tone="warning"
            />
          ) : (
            <>
              <Text style={[styles.groupLabel, { color: colors.subtle }]}>
                ACCOUNT
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {accounts.map((account) => (
                  <Chip
                    key={account.id}
                    label={account.name}
                    active={form.accountId === account.id}
                    onPress={() =>
                      setForm((current) => ({
                        ...current,
                        accountId: account.id,
                      }))
                    }
                  />
                ))}
              </ScrollView>

              <View style={styles.chipRow}>
                <Chip
                  label="Expense"
                  active={form.direction === 'expense'}
                  onPress={() =>
                    setForm((current) => ({ ...current, direction: 'expense' }))
                  }
                />
                <Chip
                  label="Income"
                  active={form.direction === 'income'}
                  onPress={() =>
                    setForm((current) => ({ ...current, direction: 'income' }))
                  }
                />
              </View>

              <TextField
                label="Amount"
                value={form.amount}
                onChangeText={(value) =>
                  setForm((current) => ({ ...current, amount: value }))
                }
                keyboardType="decimal-pad"
                placeholder="250.00"
              />
              <TextField
                label="Description"
                value={form.description}
                onChangeText={(value) =>
                  setForm((current) => ({ ...current, description: value }))
                }
                placeholder="Local grocery store"
              />
              <TextField
                label="Merchant (optional)"
                value={form.merchant}
                onChangeText={(value) =>
                  setForm((current) => ({ ...current, merchant: value }))
                }
                placeholder="Corner Shop"
              />
              <TextField
                label="Date"
                value={form.occurredOn}
                onChangeText={(value) =>
                  setForm((current) => ({ ...current, occurredOn: value }))
                }
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
                hint="Use the ISO format, for example 2026-11-18."
              />
              <TextField
                label="Notes (optional)"
                value={form.notes}
                onChangeText={(value) =>
                  setForm((current) => ({ ...current, notes: value }))
                }
                placeholder="Optional context"
              />

              <Text style={[styles.groupLabel, { color: colors.subtle }]}>
                CATEGORY
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                <Chip
                  label="Automatic"
                  active={form.categoryId === ''}
                  onPress={() =>
                    setForm((current) => ({ ...current, categoryId: '' }))
                  }
                />
                {categories.map((category) => (
                  <Chip
                    key={category.id}
                    label={category.name}
                    active={form.categoryId === category.id}
                    onPress={() =>
                      setForm((current) => ({
                        ...current,
                        categoryId: category.id,
                      }))
                    }
                  />
                ))}
              </ScrollView>

              <PressableRow
                label="Allow an exact duplicate if one is reported"
                selected={form.allowDuplicate}
                onPress={() =>
                  setForm((current) => ({
                    ...current,
                    allowDuplicate: !current.allowDuplicate,
                  }))
                }
                colors={colors}
              />

              {awareness ? (
                <Card>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    Spending awareness
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
                    {awareness.advice}
                  </Text>
                  {awareness.insufficient_after_spending ? (
                    <Alert
                      message="After this spending you may not cover your upcoming obligations."
                      tone="warning"
                    />
                  ) : null}
                  {awareness.upcoming_dues.map((due) => (
                    <View
                      key={`${due.kind}-${due.id}`}
                      style={[styles.txRow, { borderColor: colors.border }]}
                    >
                      <View style={styles.rowCopy}>
                        <Text style={[styles.rowTitle, { color: colors.text }]}>
                          {due.name}
                        </Text>
                        <Text style={[styles.rowSub, { color: colors.muted }]}>
                          {formatShortDate(due.due_date)}
                        </Text>
                      </View>
                      <Text style={[styles.rowAmount, { color: colors.text }]}>
                        {formatMoney(due.amount, due.currency)}
                      </Text>
                    </View>
                  ))}
                  <Text style={[styles.rowSub, { color: colors.muted }]}>
                    UniFlow is showing stored information for your review. It
                    does not block the transaction and sends no notification.
                  </Text>
                  <Button
                    label={saving ? 'Saving…' : 'Record anyway'}
                    loading={saving}
                    onPress={() =>
                      void submitTransaction(
                        form.accountId || accounts[0]?.id || '',
                        Number(form.amount),
                      )
                    }
                  />
                  <Button
                    label="Cancel"
                    variant="ghost"
                    onPress={() => setAwareness(null)}
                  />
                </Card>
              ) : null}

              <Button
                label={
                  checkingAwareness
                    ? 'Checking…'
                    : saving
                      ? 'Saving…'
                      : 'Record transaction'
                }
                loading={saving || checkingAwareness}
                onPress={() => void handleCreate()}
              />
            </>
          )}
        </Card>
      ) : null}

      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Filter and search
        </Text>
        <TextField
          label="Search"
          value={searchDraft}
          onChangeText={setSearchDraft}
          onSubmitEditing={applySearch}
          placeholder="Description or merchant"
          returnKeyType="search"
        />

        <Text style={[styles.groupLabel, { color: colors.subtle }]}>
          ACCOUNT
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip
            label="All accounts"
            active={filters.accountId === ''}
            onPress={() => changeFilter({ accountId: '' })}
          />
          {accounts.map((account) => (
            <Chip
              key={account.id}
              label={account.name}
              active={filters.accountId === account.id}
              onPress={() => changeFilter({ accountId: account.id })}
            />
          ))}
        </ScrollView>

        <Text style={[styles.groupLabel, { color: colors.subtle }]}>
          DIRECTION
        </Text>
        <View style={styles.chipRow}>
          <Chip
            label="All"
            active={filters.direction === ''}
            onPress={() => changeFilter({ direction: '' })}
          />
          <Chip
            label="Income"
            active={filters.direction === 'income'}
            onPress={() => changeFilter({ direction: 'income' })}
          />
          <Chip
            label="Expenses"
            active={filters.direction === 'expense'}
            onPress={() => changeFilter({ direction: 'expense' })}
          />
        </View>

        <Text style={[styles.groupLabel, { color: colors.subtle }]}>
          SOURCE
        </Text>
        <View style={styles.chipRow}>
          <Chip
            label="All sources"
            active={filters.source === ''}
            onPress={() => changeFilter({ source: '' })}
          />
          <Chip
            label="Bank synced"
            active={filters.source === 'provider'}
            onPress={() => changeFilter({ source: 'provider' })}
          />
          <Chip
            label="Manual"
            active={filters.source === 'manual'}
            onPress={() => changeFilter({ source: 'manual' })}
          />
        </View>

        <View style={styles.filterActions}>
          <View style={styles.filterAction}>
            <Button label="Apply search" compact onPress={applySearch} />
          </View>
          <View style={styles.filterAction}>
            <Button
              label="Clear"
              compact
              variant="ghost"
              onPress={clearFilters}
            />
          </View>
        </View>
      </Card>

      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>History</Text>
        <Text style={[styles.sectionSub, { color: colors.muted }]}>
          {total === 0
            ? 'No transactions match these filters.'
            : `Showing ${from}–${to} of ${total} transaction${
                total === 1 ? '' : 's'
              }.`}
        </Text>
      </View>

      {loading ? (
        <Text style={[styles.placeholder, { color: colors.muted }]}>
          Loading transactions…
        </Text>
      ) : items.length === 0 ? (
        <Card>
          <View style={styles.emptyState}>
            <View
              style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}
            >
              <Ionicons name="wallet-outline" size={26} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No transactions to show
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.muted }]}>
              Connect an account to sync activity, or record a manual
              transaction to start your history.
            </Text>
          </View>
        </Card>
      ) : (
        <Card>
          {items.map((transaction) => {
            const negative = Number(transaction.amount) < 0
            const accountName =
              transaction.account?.name ??
              accountsById.get(transaction.account_id)?.name ??
              'Account'
            return (
              <View
                key={transaction.id}
                style={[styles.txRow, { borderColor: colors.border }]}
              >
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>
                    {transaction.description}
                  </Text>
                  <Text style={[styles.rowSub, { color: colors.muted }]}>
                    {formatShortDate(transaction.occurred_on)} · {accountName}
                    {transaction.category
                      ? ` · ${transaction.category.name}`
                      : ' · Uncategorised'}
                  </Text>
                  {transaction.merchant ? (
                    <Text style={[styles.rowSub, { color: colors.muted }]}>
                      {transaction.merchant}
                    </Text>
                  ) : null}
                  <View style={styles.rowBadges}>
                    <StatusBadge
                      status={transaction.source}
                      label={
                        transaction.source === 'provider' ? 'Synced' : 'Manual'
                      }
                    />
                    {transaction.is_pending ? (
                      <BadgeLabel text="Pending" colors={colors} />
                    ) : null}
                  </View>
                  <View style={styles.rowActions}>
                    <Button
                      label="Edit"
                      compact
                      variant="ghost"
                      onPress={() => startEditing(transaction)}
                    />
                    {transaction.source === 'manual' ? (
                      <Button
                        label="Delete"
                        compact
                        variant="danger"
                        onPress={() => confirmDelete(transaction)}
                      />
                    ) : null}
                  </View>
                </View>
                <Text
                  style={[
                    styles.rowAmount,
                    { color: negative ? colors.danger : colors.success },
                  ]}
                >
                  {formatSignedMoney(transaction.amount, transaction.currency)}
                </Text>
              </View>
            )
          })}
        </Card>
      )}

      <View style={styles.pagination}>
        <View style={styles.pageButton}>
          <Button
            label="Previous"
            compact
            variant="secondary"
            disabled={offset === 0 || loading}
            onPress={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          />
        </View>
        <Text style={[styles.pageText, { color: colors.muted }]}>
          Page {Math.floor(offset / PAGE_SIZE) + 1}
        </Text>
        <View style={styles.pageButton}>
          <Button
            label="Next"
            compact
            variant="secondary"
            disabled={to >= total || loading}
            onPress={() => setOffset(offset + PAGE_SIZE)}
          />
        </View>
      </View>

      {editing ? (
        <Card>
          <View style={styles.editHead}>
            <View style={styles.rowCopy}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Edit “{editing.description}”
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
                Categories, merchant and notes can be changed. Amount and date
                are provider-owned for synced transactions.
              </Text>
            </View>
            <Button
              label="Close"
              compact
              variant="ghost"
              onPress={() => setEditing(null)}
            />
          </View>

          <Text style={[styles.groupLabel, { color: colors.subtle }]}>
            CATEGORY
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Chip
              label="Uncategorised"
              active={editCategory === ''}
              onPress={() => setEditCategory('')}
            />
            {categories.map((category) => (
              <Chip
                key={category.id}
                label={category.name}
                active={editCategory === category.id}
                onPress={() => setEditCategory(category.id)}
              />
            ))}
          </ScrollView>

          <TextField
            label="Merchant"
            value={editMerchant}
            onChangeText={setEditMerchant}
          />
          <TextField label="Notes" value={editNotes} onChangeText={setEditNotes} />

          <Button
            label={editSaving ? 'Saving…' : 'Save changes'}
            loading={editSaving}
            onPress={() => void saveEditing()}
          />
        </Card>
      ) : null}

      <View style={styles.noteRow}>
        <Ionicons
          name="information-circle-outline"
          size={15}
          color={colors.muted}
        />
        <Text style={[styles.note, { color: colors.muted }]}>
          UniFlow stores only transaction details returned under consent. Bank
          passwords, UPI PINs, OTPs and CVVs are never requested or stored.
        </Text>
      </View>
    </Screen>
  )
}

function BadgeLabel({
  text,
  colors,
}: {
  text: string
  colors: ReturnType<typeof useAppTheme>['colors']
}) {
  return (
    <View
      style={[
        styles.pendingBadge,
        { backgroundColor: colors.surfaceMuted },
      ]}
    >
      <Text style={[styles.pendingText, { color: colors.muted }]}>{text}</Text>
    </View>
  )
}

function PressableRow({
  label,
  selected,
  onPress,
  colors,
}: {
  label: string
  selected: boolean
  onPress: () => void
  colors: ReturnType<typeof useAppTheme>['colors']
}) {
  return (
    <Text
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.checkboxRow, { color: colors.text }]}
    >
      <Ionicons
        name={selected ? 'checkbox' : 'square-outline'}
        size={18}
        color={selected ? colors.primary : colors.subtle}
      />{' '}
      {label}
    </Text>
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  filterActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterAction: {
    flex: 1,
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
  txRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  rowSub: {
    fontSize: 11,
    lineHeight: 16,
  },
  rowBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 2,
  },
  rowAmount: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pendingBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  pendingText: {
    fontSize: 10,
    fontWeight: '700',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pageButton: {
    flex: 1,
  },
  pageText: {
    fontSize: 12,
    fontWeight: '600',
  },
  editHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  checkboxRow: {
    fontSize: 13,
    lineHeight: 20,
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
})
