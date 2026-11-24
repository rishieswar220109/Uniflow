import { Link } from 'react-router-dom'

const CURRENT_YEAR = new Date().getFullYear()

import { useAuth } from '../features/auth/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrendIcon,
  WalletIcon,
} from '../components/icons'
import { Logo } from '../components/ui/Logo'

const previewRows = [
  {
    icon: WalletIcon,
    title: 'Account balances',
    sub: 'See your money in one calm overview',
    state: 'Phase 2',
  },
  {
    icon: CalendarIcon,
    title: 'Upcoming payments',
    sub: 'Know what is due before it arrives',
    state: 'Phase 2',
  },
  {
    icon: TrendIcon,
    title: 'Projected balance',
    sub: 'Deterministic forecasts, clearly explained',
    state: 'Phase 3',
  },
  {
    icon: SparklesIcon,
    title: 'Ask UniFlow',
    sub: 'Answers grounded in your verified data',
    state: 'Phase 4',
  },
]

export function WelcomePage() {
  useDocumentTitle('Welcome')
  const { status } = useAuth()
  const isAuthenticated = status === 'authenticated'

  return (
    <div className="welcome-page">
      <header className="site-header">
        <div className="container site-header-inner">
          <Logo />

          <nav className="site-nav" aria-label="Primary">
            <a className="site-nav-link" href="#how-it-works">
              How it works
            </a>
            {isAuthenticated ? (
              <Link className="btn btn-primary" to="/dashboard">
                Open dashboard <ArrowRightIcon size={16} />
              </Link>
            ) : (
              <>
                <Link className="site-nav-link" to="/login">
                  Sign in
                </Link>
                <Link className="btn btn-primary" to="/register">
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section className="container hero">
          <div className="hero-copy">
            <span className="eyebrow">AI-powered financial intelligence</span>
            <h1 className="hero-title">
              Know what&apos;s coming.{' '}
              <span className="accent">Stay in control.</span>
            </h1>
            <p className="hero-lede">
              UniFlow turns authorised financial data into clear
              answers about your balance, upcoming payments and the decisions
              ahead — so you can act with confidence, never guesswork.
            </p>

            <div className="hero-actions">
              {isAuthenticated ? (
                <Link className="btn btn-primary btn-lg" to="/dashboard">
                  Go to your dashboard <ArrowRightIcon size={18} />
                </Link>
              ) : (
                <>
                  <Link className="btn btn-primary btn-lg" to="/register">
                    Get started <ArrowRightIcon size={18} />
                  </Link>
                  <Link className="btn btn-secondary btn-lg" to="/login">
                    Sign in
                  </Link>
                </>
              )}
            </div>

            <div className="hero-trust">
              <span className="trust-item">
                <CheckIcon size={15} /> Consent-based bank access
              </span>
              <span className="trust-item">
                <CheckIcon size={15} /> You approve every action
              </span>
              <span className="trust-item">
                <CheckIcon size={15} /> No PINs, OTPs or card details
              </span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="preview-card">
              <div className="preview-head">
                <div className="preview-brand">
                  <span className="preview-brand-mark">
                    <ShieldCheckIcon size={18} />
                  </span>
                  UniFlow workspace
                </div>
                <span className="preview-label">Preview</span>
              </div>

              <h2 className="preview-title">Your financial picture, in one place</h2>
              <p className="preview-caption">
                Illustrative layout only — no financial data is shown here.
              </p>

              <div className="preview-list">
                {previewRows.map(({ icon: Icon, title, sub, state }) => (
                  <div className="preview-row" key={title}>
                    <span className="preview-row-icon">
                      <Icon size={17} />
                    </span>
                    <span className="preview-row-copy">
                      <span className="preview-row-title">{title}</span>
                      <span className="preview-row-sub">{sub}</span>
                    </span>
                    <span className="preview-row-state">{state}</span>
                  </div>
                ))}
              </div>

              <div className="preview-foot">
                <LockIcon size={15} />
                Financial connections will use an authorised, consent-based
                provider. This preview is not a bank statement.
              </div>
            </div>
          </div>
        </section>

        <section
          className="container feature-strip"
          id="how-it-works"
          aria-label="How UniFlow works"
        >
          <article className="feature-cell">
            <span className="feature-icon">
              <LockIcon size={18} />
            </span>
            <h3>Secure by foundation</h3>
            <p>
              Passwords are protected with Argon2id, sessions are short-lived
              and revocable, and private endpoints require authentication.
            </p>
          </article>
          <article className="feature-cell">
            <span className="feature-icon">
              <ShieldCheckIcon size={18} />
            </span>
            <h3>Consent comes first</h3>
            <p>
              UniFlow will only use financial data you explicitly authorise
              through a bank-data provider. Revoking consent stops access.
            </p>
          </article>
          <article className="feature-cell">
            <span className="feature-icon">
              <ClockIcon size={18} />
            </span>
            <h3>Built for the long view</h3>
            <p>
              Payment forecasts and recommendations will be computed by
              deterministic backend services — never guessed by an AI model.
            </p>
          </article>
        </section>
      </main>

      <footer className="welcome-footer">
        <div className="container welcome-footer-inner">
          <span>© {CURRENT_YEAR} UniFlow</span>
          <span>Phase 1 · Secure account foundation</span>
        </div>
      </footer>
    </div>
  )
}
