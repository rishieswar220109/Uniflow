import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../features/auth/AuthContext'
import { PageLoader } from './ui/PageLoader'

export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <PageLoader label="Checking your session…" />
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

export function PublicOnlyRoute() {
  const { status } = useAuth()

  if (status === 'loading') {
    return <PageLoader label="Checking your session…" />
  }

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
