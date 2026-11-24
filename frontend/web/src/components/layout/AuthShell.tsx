import type { ReactNode } from 'react'

import { ArrowRightIcon, LockIcon, ShieldCheckIcon, SparklesIcon } from '../icons'
import { Logo } from '../ui/Logo'

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="auth-page">
      <aside className="auth-brand-panel" aria-hidden="true">
        <Logo to="/" />

        <div className="auth-brand-content">
          <h2>Your finances, watched over — not taken over.</h2>
          <p>
            UniFlow helps you understand what is coming, what is
            safe to spend, and which payments deserve attention. You stay in
            control of every decision.
          </p>
          <ul className="auth-value-list">
            <li>
              <span className="auth-value-icon">
                <ShieldCheckIcon size={15} />
              </span>
              Consent-based access. No banking passwords, PINs or OTPs.
            </li>
            <li>
              <span className="auth-value-icon">
                <SparklesIcon size={15} />
              </span>
              Clear explanations instead of confusing dashboards.
            </li>
            <li>
              <span className="auth-value-icon">
                <LockIcon size={15} />
              </span>
              Every consequential action needs your explicit approval.
            </li>
          </ul>
        </div>

        <p className="auth-brand-foot">
          Phase 1 · Secure account foundation. Bank connections and AI insights
          arrive in later phases.
        </p>
      </aside>

      <div className="auth-form-panel">
        <div className="auth-mobile-head">
          <Logo to="/" showTag={false} />
          <a className="btn btn-ghost btn-sm" href="/">
            Back to home <ArrowRightIcon size={15} />
          </a>
        </div>

        <div className="auth-form-wrap">
          <header className="auth-header">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </header>

          {children}

          {footer}

          <div className="auth-footer-links">
            <a href="/">UniFlow</a>
            <span>Phase 1 · Secure foundation</span>
          </div>
        </div>
      </div>
    </div>
  )
}
