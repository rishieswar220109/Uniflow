import { useState } from 'react'
import { Link } from 'react-router-dom'

import {
  ArrowRightIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  LandmarkIcon,
  LockIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrendIcon,
  WalletIcon,
} from '../components/icons'
import { useAuth } from '../features/auth/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { firstName } from '../utils/format'

const setupSteps = [
  {
    title: 'Create your secure account',
    description: 'Your identity and encrypted credentials are ready.',
    state: 'Done',
    status: 'done' as const,
    icon: CheckIcon,
  },
  {
    title: 'Connect a financial account',
    description:
      'Consent-based bank connections arrive in Phase 2. No banking PINs or OTPs are ever collected.',
    state: 'Next',
    status: 'next' as const,
    icon: LandmarkIcon,
  },
  {
    title: 'Let Guardian forecast ahead',
    description:
      'Balance projections and payment insights are built in Phase 3.',
    state: 'Later',
    status: 'pending' as const,
    icon: TrendIcon,
  },
]

export function DashboardPage() {
  useDocumentTitle('Dashboard')
  const { user } = useAuth()
  const [today] = useState(() =>
    new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date()),
  )

  if (!user) return null

  return (
    <>
      <header className="page-header">
        <div className="page-header-copy">
          <span className="page-kicker">{today}</span>
          <h1 className="page-title">
            Welcome back, {firstName(user.full_name)}
          </h1>
          <p className="page-subtitle">
            Your secure account is ready. Guardian will build on this foundation
            as financial connections and intelligence arrive in the next phases.
          </p>
        </div>
        <span className="badge badge-success">Account secured</span>
      </header>

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="card" aria-labelledby="setup-title">
            <div className="card-header">
              <div>
                <h2 className="card-title" id="setup-title">
                  Account setup
                </h2>
                <p className="card-subtitle">
                  One of three steps complete. Each phase unlocks the next.
                </p>
              </div>
              <span className="badge badge-primary badge-plain">In progress</span>
            </div>

            <div
              className="progress"
              role="progressbar"
              aria-valuenow={33}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Account setup progress"
            >
              <div className="progress-bar" style={{ width: '33%' }} />
            </div>
            <div className="setup-progress">
              <span>Foundation complete</span>
              <span>1 / 3</span>
            </div>

            <ul className="setup-list">
              {setupSteps.map(({ title, description, state, status, icon: Icon }) => (
                <li className="setup-step" key={title}>
                  <span className={`setup-step-icon ${status}`}>
                    <Icon size={15} />
                  </span>
                  <span className="setup-step-copy">
                    <span className="setup-step-title">{title}</span>
                    <span className="setup-step-desc">{description}</span>
                  </span>
                  <span className="setup-step-state">{state}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card" aria-labelledby="finance-title">
            <div className="card-header">
              <div>
                <h2 className="card-title" id="finance-title">
                  Balances &amp; activity
                </h2>
                <p className="card-subtitle">
                  Real financial data will appear only after an authorised
                  connection is made.
                </p>
              </div>
              <span className="badge badge-neutral badge-plain">
                Not connected
              </span>
            </div>

            <div className="empty-finance">
              <span className="empty-art">
                <WalletIcon size={30} />
              </span>
              <h3>No financial accounts yet</h3>
              <p>
                Guardian does not display placeholder balances. When bank-data
                connections arrive in Phase 2, your authorised accounts,
                transactions and upcoming payments will appear here.
              </p>
              <span className="badge badge-warning badge-plain">
                <LockIcon size={12} /> No financial data stored
              </span>
            </div>
          </section>
        </div>

        <aside className="dashboard-side" aria-label="Guardian status">
          <section className="card" aria-labelledby="guardian-title">
            <div className="card-header">
              <div>
                <h2 className="card-title" id="guardian-title">
                  Guardian
                </h2>
                <p className="card-subtitle">Your AI financial assistant</p>
              </div>
              <SparklesIcon size={19} className="text-muted" />
            </div>

            <div className="guardian-status">
              <span className="guardian-orb">
                <SparklesIcon size={20} />
              </span>
              <span className="guardian-copy">
                <strong>Standing by</strong>
                <span>Waiting for authorised financial data.</span>
              </span>
            </div>

            <ul className="detail-list" style={{ marginTop: 8 }}>
              <li className="detail-row">
                <span className="detail-label">Spending analysis</span>
                <span className="detail-value text-muted">Phase 3</span>
              </li>
              <li className="detail-row">
                <span className="detail-label">Plain-language answers</span>
                <span className="detail-value text-muted">Phase 4</span>
              </li>
              <li className="detail-row">
                <span className="detail-label">Approval-based actions</span>
                <span className="detail-value text-muted">Phase 5</span>
              </li>
            </ul>
          </section>

          <section className="card" aria-labelledby="next-title">
            <div className="card-header">
              <div>
                <h2 className="card-title" id="next-title">
                  Next steps
                </h2>
                <p className="card-subtitle">Make the foundation yours.</p>
              </div>
            </div>

            <div className="next-steps">
              <Link className="next-step" to="/profile">
                Complete your profile
                <ChevronRightIcon size={16} />
              </Link>
              <Link className="next-step" to="/settings">
                Review your preferences
                <ChevronRightIcon size={16} />
              </Link>
              <Link className="next-step" to="/">
                Revisit the product overview
                <ArrowRightIcon size={16} />
              </Link>
            </div>
          </section>

          <section className="card card-muted" aria-labelledby="protection-title">
            <div className="inline" style={{ marginBottom: 10 }}>
              <ShieldCheckIcon size={18} />
              <h2 className="card-title" id="protection-title">
                Protection active
              </h2>
            </div>
            <ul className="stack-sm" style={{ margin: 0, paddingLeft: 18 }}>
              <li className="muted-note">Argon2id password hashing</li>
              <li className="muted-note">Short-lived, revocable sessions</li>
              <li className="muted-note">Protected API endpoints</li>
              <li className="muted-note">Preferences synced across devices</li>
            </ul>
            <div className="inline" style={{ marginTop: 14 }}>
              <ClockIcon size={14} className="text-muted" />
              <span className="muted-note">
                Access tokens expire automatically.
              </span>
            </div>
          </section>
        </aside>
      </div>
    </>
  )
}
