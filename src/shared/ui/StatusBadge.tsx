import type { ReactNode } from 'react'
import { Badge } from './Badge'

type StatusBadgeProps = {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
  children: ReactNode
}

export function StatusBadge({ tone = 'neutral', children }: StatusBadgeProps) {
  return <Badge tone={tone}>{children}</Badge>
}
