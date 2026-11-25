import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthContext'
import { extractApiError } from '../../utils/errors'
import { initials } from '../../utils/format'
import {
  BellIcon,
  CalendarIcon,
  HomeIcon,
  LandmarkIcon,
  LogoutIcon,
  SettingsIcon,
  SparklesIcon,
  TargetIcon,
  TrendIcon,
  UserIcon,
  WalletIcon,
} from '../icons'
import { Alert } from '../ui/Alert'
import { Logo } from '../ui/Logo'

const primaryNav = [
  { to: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { to: '/accounts', label: 'Accounts', icon: LandmarkIcon },
  { to: '/transactions', label: 'Transactions', icon: WalletIcon },
  { to: '/bills', label: 'Bills', icon: BellIcon },
  { to: '/subscriptions', label: 'Subscriptions', icon: SparklesIcon },
  { to: '/upcoming', label: 'Upcoming', icon: CalendarIcon },
  { to: '/budgets', label: 'Budgets', icon: TargetIcon },
  { to: '/intelligence', label: 'Intelligence', icon: TrendIcon },
  { to: '/reports', label: 'Reports', icon: TrendIcon },
  { to: '/profile', label: 'Profile', icon: UserIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

const laterNav = [
  { label: 'Ask UniFlow', icon: SparklesIcon, phase: 'Phase 4' },
]

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  if (!user) return null

  const handleLogout = async () => {
    if (signingOut) return
    setSigningOut(true)
    setLogoutError('')
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      setLogoutError(
        'We could not confirm your sign-out. Your session may still be active. ' +
          extractApiError(error, 'Please try again.'),
      )
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo to="/dashboard" />
        </div>

        <p className="sidebar-label">Workspace</p>
        <ul className="sidebar-nav">
          {primaryNav.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  isActive ? 'nav-link active' : 'nav-link'
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            </li>
          ))}
          {laterNav.map(({ label, icon: Icon, phase }) => (
            <li key={label}>
              <span
                className="nav-link nav-link-disabled"
                aria-disabled="true"
                title={`Available in ${phase}`}
              >
                <Icon size={18} />
                {label}
                <span className="nav-soon">{phase}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="sidebar-spacer" />

        <div className="sidebar-account">
          <NavLink to="/profile" className="sidebar-user">
            <span className="avatar" aria-hidden="true">
              {initials(user.full_name)}
            </span>
            <span className="sidebar-user-copy">
              <span className="sidebar-user-name">{user.full_name}</span>
              <span className="sidebar-user-email">{user.email}</span>
            </span>
          </NavLink>
          <button
            type="button"
            className="sidebar-signout"
            onClick={handleLogout}
            disabled={signingOut}
            aria-busy={signingOut}
          >
            <LogoutIcon size={15} />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <Logo to="/dashboard" className="topbar-brand" showTag={false} />
          <div className="topbar-context">
            <strong>Workspace</strong>
            <span>/</span>
            <span>Phase 3 · Financial intelligence</span>
          </div>
          <div className="topbar-actions">
            <span className="badge badge-success">Session secured</span>
            <NavLink to="/profile" className="topbar-user">
              <span className="avatar" aria-hidden="true">
                {initials(user.full_name)}
              </span>
              {user.full_name.split(' ')[0]}
            </NavLink>
            <button
              type="button"
              className="icon-button topbar-signout"
              onClick={handleLogout}
              disabled={signingOut}
              aria-busy={signingOut}
              aria-label="Sign out"
            >
              <LogoutIcon size={17} />
            </button>
          </div>
        </header>

        <main id="main-content" className="page-content">
          {logoutError ? (
            <div style={{ marginBottom: 18 }}>
              <Alert variant="error">{logoutError}</Alert>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
