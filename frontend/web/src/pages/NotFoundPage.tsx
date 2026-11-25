import { Link } from 'react-router-dom'

import { ArrowRightIcon } from '../components/icons'
import { Logo } from '../components/ui/Logo'
import { useAuth } from '../features/auth/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Page not found')
  const { status } = useAuth()

  return (
    <div className="notfound-page">
      <div className="card notfound-card">
        <Logo to="/" />
        <span className="notfound-code">404</span>
        <h1 className="page-title">This page isn&apos;t here</h1>
        <p className="page-subtitle">
          The page you followed may have moved, or it belongs to a later phase
          that has not been built yet.
        </p>
        <Link
          className="btn btn-primary"
          to={status === 'authenticated' ? '/dashboard' : '/'}
        >
          {status === 'authenticated' ? 'Back to dashboard' : 'Back to welcome'}
          <ArrowRightIcon size={16} />
        </Link>
      </div>
    </div>
  )
}
