import type { ReactNode } from 'react'

type BadgeProps = {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
  children: ReactNode
}

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  const className = tone === 'neutral' ? 'badge' : `badge badge--${tone}`
  return <span className={className}>{children}</span>
}
