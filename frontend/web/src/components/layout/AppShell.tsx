import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthContext'
import { initials } from '../../utils/format'
import {
  CalendarIcon,
  HomeIcon,
  LogoutIcon,
  SettingsIcon,
  SparklesIcon,
  TrendIcon,
  UserIcon,
  WalletIcon,
} from '../icons'
import { Logo } from '../ui/Logo'

const primaryNav = [
  { to: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { to: '/profile', label: 'Profile', icon: UserIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

const upcomingNav = [
  { label: 'Transactions', icon: WalletIcon },
  { label: 'Payments', icon: CalendarIcon },
  { label: 'Insights', icon: TrendIcon },
  { label: 'Ask Guardian', icon: SparklesIcon },
]

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
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
          {upcomingNav.map(({ label, icon: Icon }) => (
            <li key={label}>
              <span
                className="nav-link nav-link-disabled"
                aria-disabled="true"
                title="Available in a later phase"
              >
                <Icon size={18} />
                {label}
                <span className="nav-soon">Soon</span>
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
          >
            <LogoutIcon size={15} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <Logo to="/dashboard" className="topbar-brand" showTag={false} />
          <div className="topbar-context">
            <strong>Workspace</strong>
            <span>/</span>
            <span>Phase 1 · Secure foundation</span>
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
              aria-label="Sign out"
            >
              <LogoutIcon size={17} />
            </button>
          </div>
        </header>

        <main id="main-content" className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
