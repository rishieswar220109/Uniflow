import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  InfoIcon,
  LandmarkIcon,
  ShieldCheckIcon,
  WalletIcon,
} from '../components/icons'
import { MockBadge, StatusBadge } from '../components/finance/StatusBadge'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { financeApi } from '../services/financeApi'
import type {
  BankConnection,
  BankProvider,
  FinancialAccount,
  SyncJob,
} from '../services/types'
import { extractApiError } from '../utils/errors'
import { formatDateTime, formatMoney } from '../utils/format'

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
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
    `${job.transactions_created} new transaction(s), ` +
    `${job.transactions_skipped} already known.`
  )
}

export function AccountsPage() {
  useDocumentTitle('Accounts')

  const [providers, setProviders] = useState<BankProvider[]>([])
  const [connections, setConnections] = useState<BankConnection[]>([])
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [providerSlug, setProviderSlug] = useState('')
  const [institutionId, setInstitutionId] = useState('')
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

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        await load()
      } catch (loadError) {
        if (!cancelled) {
          setError(
            extractApiError(
              loadError,
              'Unable to load your financial accounts.',
            ),
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [load])

  const activeProvider = useMemo(() => {
    return (
      providers.find((provider) => provider.slug === providerSlug) ??
      providers[0] ??
      null
    )
  }, [providers, providerSlug])

  // Derive the selected institution so a provider change never needs a
  // state-syncing effect: fall back to the provider's first institution when
  // the current selection does not belong to it.
  const resolvedInstitutionId = useMemo(() => {
    if (!activeProvider) return ''
    const belongs = activeProvider.institutions.some(
      (institution) => institution.id === institutionId,
    )
    return belongs
      ? institutionId
      : (activeProvider.institutions[0]?.id ?? '')
  }, [activeProvider, institutionId])

  const hasMockData = connections.some((connection) => connection.is_mock)

  async function handleConnect() {
    if (!activeProvider || !resolvedInstitutionId || connecting) return
    setConnecting(true)
    setError('')
    setSuccess('')
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
    } catch (connectError) {
      setError(
        extractApiError(connectError, 'Unable to create the connection.'),
      )
    } finally {
      setConnecting(false)
    }
  }

  async function handleSync(connectionId: string) {
    setBusyId(connectionId)
    setError('')
    setSuccess('')
    try {
      const job = await financeApi.syncConnection(connectionId)
      setSuccess(syncMessage(job))
      await load()
    } catch (syncError) {
      setError(extractApiError(syncError, 'Unable to synchronise right now.'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleRevoke(connection: BankConnection) {
    if (
      !window.confirm(
        `Revoke consent for ${connection.institution_name}? ` +
          'Its accounts will be deactivated and synchronisation will stop.',
      )
    ) {
      return
    }
    setBusyId(connection.id)
    setError('')
    setSuccess('')
    try {
      await financeApi.revokeConnection(connection.id)
      setSuccess(
        `Consent for ${connection.institution_name} has been revoked. ` +
          'You can reconnect at any time.',
      )
      await load()
    } catch (revokeError) {
      setError(extractApiError(revokeError, 'Unable to revoke consent.'))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return <div className="page-loader">Loading your accounts…</div>
  }

  return (
    <>
      <header className="page-header">
        <div className="page-header-copy">
          <span className="page-kicker">Financial data</span>
          <h1 className="page-title">Accounts &amp; connections</h1>
          <p className="page-subtitle">
            Balances and transactions come only from authorised, consent-based
            connections. UniFlow never asks for banking passwords, PINs, OTPs
            or card security codes.
          </p>
        </div>
        <div className="inline">
          {hasMockData ? <MockBadge /> : null}
          <span className="badge badge-success badge-plain">
            <ShieldCheckIcon size={13} /> Consent based
          </span>
        </div>
      </header>

      <div className="stack-lg">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}

        <section className="card" aria-labelledby="connect-title">
          <div className="card-header">
            <div>
              <h2 className="card-title" id="connect-title">
                Connect a financial account
              </h2>
              <p className="card-subtitle">
                Choose a supported provider and institution. In development the
                mock provider supplies clearly labelled demo data.
              </p>
            </div>
            <span className="badge badge-neutral badge-plain">
              {connections.length} connection
              {connections.length === 1 ? '' : 's'}
            </span>
          </div>

          {providers.length === 0 ? (
            <Alert variant="warning">
              No financial data providers are configured on this server.
            </Alert>
          ) : (
            <>
              <div className="form-row">
                <div className="field">
                  <label className="field-label" htmlFor="provider">
                    Provider
                  </label>
                  <select
                    id="provider"
                    className="select"
                    value={activeProvider?.slug ?? ''}
                    onChange={(event) => setProviderSlug(event.target.value)}
                  >
                    {providers.map((provider) => (
                      <option value={provider.slug} key={provider.slug}>
                        {provider.display_name}
                        {provider.is_mock ? ' — mock' : ''}
                      </option>
                    ))}
                  </select>
                  <span className="field-hint">
                    Providers are consent-based data aggregators, not banking
                    logins.
                  </span>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="institution">
                    Institution
                  </label>
                  <select
                    id="institution"
                    className="select"
                    value={resolvedInstitutionId}
                    onChange={(event) => setInstitutionId(event.target.value)}
                  >
                    {(activeProvider?.institutions ?? []).map((institution) => (
                      <option value={institution.id} key={institution.id}>
                        {institution.name}
                      </option>
                    ))}
                  </select>
                  <span className="field-hint">
                    Only accounts visible under your consent are retrieved.
                  </span>
                </div>
              </div>

              <div className="connect-actions">
                <Button
                  onClick={() => void handleConnect()}
                  loading={connecting}
                  disabled={!resolvedInstitutionId}
                >
                  <LandmarkIcon size={16} />
                  {connecting ? 'Connecting…' : 'Connect and sync'}
                </Button>
                <span className="mock-note">
                  <InfoIcon size={14} />
                  Demo connections are flagged mock everywhere in the app.
                </span>
              </div>
            </>
          )}
        </section>

        <section aria-labelledby="connections-title">
          <div className="section-heading">
            <h2 id="connections-title">Connections</h2>
            <p>
              Revoking consent deactivates the related accounts and stops all
              future synchronisation.
            </p>
          </div>

          {connections.length === 0 ? (
            <div className="card empty-finance">
              <span className="empty-art">
                <LandmarkIcon size={30} />
              </span>
              <h3>No connections yet</h3>
              <p>
                Connect an institution above to retrieve accounts and
                transactions. Until then, you can still track bills and
                subscriptions manually.
              </p>
            </div>
          ) : (
            <div className="stack">
              {connections.map((connection) => {
                const consent = connection.consents[0]
                return (
                  <article className="card connection-card" key={connection.id}>
                    <div className="card-header">
                      <div>
                        <div className="inline">
                          <h3 className="card-title">
                            {connection.institution_name}
                          </h3>
                          <StatusBadge status={connection.status} />
                          {connection.is_mock ? <MockBadge /> : null}
                        </div>
                        <p className="card-subtitle">
                          {connection.provider} · Connected{' '}
                          {formatDateTime(connection.created_at)}
                        </p>
                      </div>
                      <div className="row-actions">
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busyId === connection.id}
                          disabled={busyId !== null}
                          onClick={() => void handleSync(connection.id)}
                        >
                          Sync now
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busyId !== null}
                          onClick={() => void handleRevoke(connection)}
                        >
                          Revoke consent
                        </Button>
                      </div>
                    </div>

                    <div className="connection-meta">
                      <span>
                        Last synced{' '}
                        <strong>
                          {formatDateTime(connection.last_synced_at)}
                        </strong>
                      </span>
                      {consent ? (
                        <span>
                          Consent expires{' '}
                          <strong>{formatDateTime(consent.expires_at)}</strong>
                        </span>
                      ) : null}
                    </div>

                    {connection.last_error ? (
                      <Alert variant="warning">{connection.last_error}</Alert>
                    ) : null}

                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th scope="col">Account</th>
                            <th scope="col">Type</th>
                            <th scope="col" className="align-right">
                              Balance
                            </th>
                            <th scope="col" className="align-right">
                              Available
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {connection.accounts.map((account) => (
                            <tr key={account.id}>
                              <td>
                                <span className="cell-primary">
                                  {account.name}
                                </span>
                                <span className="cell-sub">
                                  {account.currency}
                                  {account.is_active ? '' : ' · inactive'}
                                </span>
                              </td>
                              <td>
                                {ACCOUNT_TYPE_LABELS[account.account_type] ??
                                  account.account_type}
                              </td>
                              <td
                                className={
                                  Number(account.balance) < 0
                                    ? 'align-right money money-negative'
                                    : 'align-right money'
                                }
                              >
                                {formatMoney(account.balance, account.currency)}
                              </td>
                              <td className="align-right money">
                                {formatMoney(
                                  account.available_balance,
                                  account.currency,
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="balances-title">
          <div className="section-heading">
            <h2 id="balances-title">All active accounts</h2>
            <p>Balances are the latest values returned under your consent.</p>
          </div>

          {accounts.length === 0 ? (
            <div className="card empty-finance">
              <span className="empty-art">
                <WalletIcon size={30} />
              </span>
              <h3>No active accounts</h3>
              <p>
                Accounts appear here after a successful connection or when a
                revoked connection is re-authorised.
              </p>
            </div>
          ) : (
            <div className="card card-flush">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Account</th>
                      <th scope="col">Institution</th>
                      <th scope="col" className="align-right">
                        Balance
                      </th>
                      <th scope="col" className="align-right">
                        Available
                      </th>
                      <th scope="col">Synced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => {
                      const connection = connections.find(
                        (item) => item.id === account.connection_id,
                      )
                      return (
                        <tr key={account.id}>
                          <td>
                            <span className="cell-primary">{account.name}</span>
                            <span className="cell-sub">
                              {ACCOUNT_TYPE_LABELS[account.account_type] ??
                                account.account_type}
                            </span>
                          </td>
                          <td>
                            {connection?.institution_name ?? 'Manual'}
                            {account.is_mock ? (
                              <span className="cell-sub">Mock</span>
                            ) : null}
                          </td>
                          <td
                            className={
                              Number(account.balance) < 0
                                ? 'align-right money money-negative'
                                : 'align-right money'
                            }
                          >
                            {formatMoney(account.balance, account.currency)}
                          </td>
                          <td className="align-right money">
                            {formatMoney(
                              account.available_balance,
                              account.currency,
                            )}
                          </td>
                          <td>{formatDateTime(account.last_synced_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
