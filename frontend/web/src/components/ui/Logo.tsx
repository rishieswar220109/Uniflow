import { Link } from 'react-router-dom'

import { cx } from '../../utils/cx'
import { ShieldCheckIcon } from '../icons'

export function Logo({
  to = '/',
  showTag = true,
  className,
}: {
  to?: string
  showTag?: boolean
  className?: string
}) {
  return (
    <Link to={to} className={cx('logo', className)} aria-label="AI Payment Guardian home">
      <span className="logo-mark">
        <ShieldCheckIcon size={21} />
      </span>
      <span className="logo-text">
        <span className="logo-name">AI Payment Guardian</span>
        {showTag ? <span className="logo-tag">Personal finance, safeguarded</span> : null}
      </span>
    </Link>
  )
}
