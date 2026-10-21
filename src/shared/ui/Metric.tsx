import type { ReactNode } from 'react'

type MetricProps = {
  label: string
  value: string
  featured?: boolean
}

export function Metric({ label, value, featured = false }: MetricProps) {
  return (
    <div className={featured ? 'ds-metric ds-metric--featured' : 'ds-metric'}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

type SectionHeaderProps = {
  title: string
  action?: ReactNode
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="ds-section__head">
      <h3 className="ds-section__title">{title}</h3>
      {action}
    </div>
  )
}
