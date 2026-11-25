import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Alert as NativeAlert, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Chip } from '../../src/components/finance/Chip'
import { MockBadge, StatusBadge } from '../../src/components/finance/StatusBadge'
import { Alert } from '../../src/components/ui/Alert'
import { Button } from '../../src/components/ui/Button'
import { Card } from '../../src/components/ui/Card'
import { Screen } from '../../src/components/ui/Screen'
import { financeApi } from '../../src/services/financeApi'
import type {
  BankConnection,
  BankProvider,
  FinancialAccount,
  SyncJob,
} from '../../src/services/types'
import { radius, spacing } from '../../src/theme'
import { useAppTheme } from '../../src/theme/useAppTheme'
import { extractApiError } from '../../src/utils/errors'
import { formatDateTime, formatMoney } from '../../src/utils/format'

const ACCOUNT_TYPES: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit card',
  loan: 'Loan',
  wallet: 'Wallet',
}

function syncMessage(job: SyncJob | null): string {
  if (!job) return 'Connection created.'
  if (job.status === 'failed') {
    return job.error_message ?? 'The initial synchronisation failed.'
  }
  return (
    `Synchronised ${job.accounts_synced} account(s): ` +
    `${job.transactions_created} new, ${job.transactions_skipped} already known.`
  )
}

export default function AccountsScreen() {
  const { colors } = useAppTheme()
  const [providers, setProviders] = useState<BankProvider[]>([])
  const [providerSlug, setProviderSlug] = useState('')
  const [institutionId, setInstitutionId] = useState('')
  const [connections, setConnections] = useState<BankConnection[]>([])
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [providerList, connectionList, accountList] = await Promise.all([
      financeApi.getProviders(),
      financeApi.getConnections(),
      financeApi.getAccounts(),
    ])
    setProviders(providerList)
    setConnections(connectionList)
    setAccounts(accountList)
  }, [])

  useFocusEffect(
    useCallback(() => {
      let active = true
      async function run() {
        try {
          await load()
          if (active) setError(null)
        } catch (caught) {
          if (active) {
            setError(
              extractApiError(
                caught,
                'Unable to load your financial accounts.',
              ),
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
    }, [load]),
  )

  const activeProvider = useMemo(() => {
    return (
      providers.find((provider) => provider.slug === providerSlug) ??
      providers[0] ??
      null
    )
  }, [providers, providerSlug])

  const resolvedInstitutionId = useMemo(() => {
    if (!activeProvider) return ''
    const belongs = activeProvider.institutions.some(
      (institution) => institution.id === institutionId,
    )
    return belongs ? institutionId : (activeProvider.institutions[0]?.id ?? '')
  }, [activeProvider, institutionId])

  const hasMockData = connections.some((connection) => connection.is_mock)

  async function handleConnect() {
    if (!activeProvider || !resolvedInstitutionId || connecting) return
    setConnecting(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await financeApi.createConnection({
        institution_id: resolvedInstitutionId,
        provider: activeProvider.slug,
      })
      setSuccess(
        `Connected to ${result.connection.institution_name}. ` +
          syncMessage(result.sync_job),
      )
      await load()
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to create the connection.'))
    } finally {
      setConnecting(false)
    }
  }

  async function handleSync(connectionId: string) {
    setBusyId(connectionId)
    setError(null)
    setSuccess(null)
    try {
      const job = await financeApi.syncConnection(connectionId)
      setSuccess(syncMessage(job))
      await load()
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to synchronise right now.'))
    } finally {
      setBusyId(null)
    }
  }

  function confirmRevoke(connection: BankConnection) {
    NativeAlert.alert(
      'Revoke consent?',
      `Accounts under ${connection.institution_name} will be deactivated and synchronisation will stop. You can reconnect at any time.`,
      [
        { text: 'Keep connection', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => void revoke(connection),
        },
      ],
    )
  }

  async function revoke(connection: BankConnection) {
    setBusyId(connection.id)
    setError(null)
    setSuccess(null)
    try {
      await financeApi.revokeConnection(connection.id)
      setSuccess(
        `Consent for ${connection.institution_name} has been revoked.`,
      )
      await load()
    } catch (caught) {
      setError(extractApiError(caught, 'Unable to revoke consent.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: colors.text }]}>
          Accounts &amp; connections
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Balances and transactions come only from authorised, consent-based
          connections. UniFlow never asks for banking passwords, PINs, OTPs or
          card security codes.
        </Text>
        {hasMockData ? (
          <View style={styles.badgeRow}>
            <MockBadge />
            <StatusBadge status="active" label="Consent based" />
          </View>
        ) : null}
      </View>

      {error ? <Alert message={error} tone="error" /> : null}
      {success ? <Alert message={success} tone="success" /> : null}

      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Connect a financial account
        </Text>
        <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
          Choose a provider and institution. In development the mock provider
          supplies clearly labelled demo data.
        </Text>

        {loading ? (
          <Text style={[styles.placeholder, { color: colors.muted }]}>
            Loading providers…
          </Text>
        ) : providers.length === 0 ? (
          <Alert
            message="No financial data providers are configured on this server."
            tone="warning"
          />
        ) : (
          <>
            {providers.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {providers.map((provider) => (
                  <Chip
                    key={provider.slug}
                    label={provider.display_name}
                    active={activeProvider?.slug === provider.slug}
                    onPress={() => setProviderSlug(provider.slug)}
                  />
                ))}
              </ScrollView>
            ) : null}

            <Text style={[styles.groupLabel, { color: colors.subtle }]}>
              INSTITUTION
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {(activeProvider?.institutions ?? []).map((institution) => (
                <Chip
                  key={institution.id}
                  label={institution.name}
                  active={resolvedInstitutionId === institution.id}
                  onPress={() => setInstitutionId(institution.id)}
                />
              ))}
            </ScrollView>

            <Button
              label={connecting ? 'Connecting…' : 'Connect and sync'}
              onPress={() => void handleConnect()}
              loading={connecting}
              disabled={!resolvedInstitutionId}
            />

            <View style={styles.noteRow}>
              <Ionicons
                name="information-circle-outline"
                size={15}
                color={colors.muted}
              />
              <Text style={[styles.note, { color: colors.muted }]}>
                Demo connections are flagged mock everywhere in the app. Only
                accounts visible under your consent are retrieved.
              </Text>
            </View>
          </>
        )}
      </Card>

      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Connections
        </Text>
        <Text style={[styles.sectionSub, { color: colors.muted }]}>
          Revoking consent deactivates the related accounts and stops future
          synchronisation.
        </Text>
      </View>

      {connections.length === 0 && !loading ? (
        <Card>
          <View style={styles.emptyState}>
            <View
              style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}
            >
              <Ionicons
                name="business-outline"
                size={26}
                color={colors.primary}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No connections yet
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.muted }]}>
              Connect an institution above to retrieve accounts and
              transactions. Bills and subscriptions can be tracked manually
              until then.
            </Text>
          </View>
        </Card>
      ) : (
        connections.map((connection) => {
          const consent = connection.consents[0]
          const busy = busyId === connection.id
          return (
            <Card key={connection.id}>
              <View style={styles.connectionHead}>
                <View style={styles.connectionTitleWrap}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {connection.institution_name}
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
                    {connection.provider} · Connected{' '}
                    {formatDateTime(connection.created_at)}
                  </Text>
                </View>
                <View style={styles.badgeRow}>
                  <StatusBadge status={connection.status} />
                  {connection.is_mock ? <MockBadge /> : null}
                </View>
              </View>

              <View
                style={[
                  styles.metaBox,
                  {
                    backgroundColor: colors.surfaceInset,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.metaText, { color: colors.muted }]}>
                  Last synced{' '}
                  <Text style={{ color: colors.text, fontWeight: '600' }}>
                    {formatDateTime(connection.last_synced_at)}
                  </Text>
                </Text>
                {consent ? (
                  <Text style={[styles.metaText, { color: colors.muted }]}>
                    Consent expires{' '}
                    <Text style={{ color: colors.text, fontWeight: '600' }}>
                      {formatDateTime(consent.expires_at)}
                    </Text>
                  </Text>
                ) : null}
              </View>

              {connection.last_error ? (
                <Alert message={connection.last_error} tone="warning" />
              ) : null}

              {connection.accounts.map((account) => (
                <View
                  key={account.id}
                  style={[styles.accountRow, { borderColor: colors.border }]}
                >
                  <View style={styles.accountCopy}>
                    <Text style={[styles.accountName, { color: colors.text }]}>
                      {account.name}
                    </Text>
                    <Text style={[styles.accountSub, { color: colors.muted }]}>
                      {ACCOUNT_TYPES[account.account_type] ??
                        account.account_type}{' '}
                      · {account.currency}
                      {account.is_active ? '' : ' · inactive'}
                    </Text>
                  </View>
                  <View style={styles.accountAmounts}>
                    <Text
                      style={[
                        styles.accountBalance,
                        {
                          color:
                            Number(account.balance) < 0
                              ? colors.danger
                              : colors.text,
                        },
                      ]}
                    >
                      {formatMoney(account.balance, account.currency)}
                    </Text>
                    <Text style={[styles.accountSub, { color: colors.muted }]}>
                      Available{' '}
                      {formatMoney(
                        account.available_balance,
                        account.currency,
                      )}
                    </Text>
                  </View>
                </View>
              ))}

              <View style={styles.actionRow}>
                <View style={styles.actionButton}>
                  <Button
                    label="Sync now"
                    compact
                    variant="secondary"
                    loading={busy}
                    disabled={busyId !== null}
                    onPress={() => void handleSync(connection.id)}
                  />
                </View>
                <View style={styles.actionButton}>
                  <Button
                    label="Revoke consent"
                    compact
                    variant="danger"
                    disabled={busyId !== null}
                    onPress={() => confirmRevoke(connection)}
                  />
                </View>
              </View>
            </Card>
          )
        })
      )}

      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          All active accounts
        </Text>
        <Text style={[styles.sectionSub, { color: colors.muted }]}>
          Balances are the latest values returned under your consent.
        </Text>
      </View>

      {accounts.length === 0 ? (
        <Card>
          <Text style={[styles.placeholder, { color: colors.muted }]}>
            No active accounts. Accounts appear after a successful connection.
          </Text>
        </Card>
      ) : (
        <Card>
          {accounts.map((account) => {
            const connection = connections.find(
              (item) => item.id === account.connection_id,
            )
            return (
              <View
                key={account.id}
                style={[styles.accountRow, { borderColor: colors.border }]}
              >
                <View style={styles.accountCopy}>
                  <Text style={[styles.accountName, { color: colors.text }]}>
                    {account.name}
                  </Text>
                  <Text style={[styles.accountSub, { color: colors.muted }]}>
                    {connection?.institution_name ?? 'Manual'}
                    {account.is_mock ? ' · mock' : ''}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.accountBalance,
                    {
                      color:
                        Number(account.balance) < 0
                          ? colors.danger
                          : colors.text,
                    },
                  ]}
                >
                  {formatMoney(account.balance, account.currency)}
                </Text>
              </View>
            )
          })}
        </Card>
      )}

      <View style={styles.noteRow}>
        <Ionicons name="lock-closed-outline" size={15} color={colors.muted} />
        <Text style={[styles.note, { color: colors.muted }]}>
          UniFlow stores only data returned under consent. Bank passwords, UPI
          PINs, OTPs and CVVs are never requested or stored.
        </Text>
      </View>
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
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  placeholder: {
    fontSize: 13,
  },
  chipRow: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
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
  connectionHead: {
    gap: spacing.sm,
  },
  connectionTitleWrap: {
    gap: 3,
  },
  metaBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    lineHeight: 16,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  accountCopy: {
    flex: 1,
    gap: 1,
  },
  accountName: {
    fontSize: 13,
    fontWeight: '600',
  },
  accountSub: {
    fontSize: 11,
    lineHeight: 16,
  },
  accountAmounts: {
    alignItems: 'flex-end',
    gap: 1,
  },
  accountBalance: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
})
