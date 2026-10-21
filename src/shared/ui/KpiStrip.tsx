type KpiStripItem = {
  id: string
  label: string
  value: string
  hint?: string
}

type KpiStripProps = {
  items: KpiStripItem[]
  variant?: 'primary' | 'secondary' | 'inline'
}

export function KpiStrip({ items, variant = 'secondary' }: KpiStripProps) {
  return (
    <dl className={variant === 'secondary' ? 'kpi-strip' : `kpi-strip kpi-strip--${variant}`}>
      {items.map((item) => (
        <div key={item.id} className="kpi-strip__item">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          {item.hint ? <p className="kpi-strip__hint">{item.hint}</p> : null}
        </div>
      ))}
    </dl>
  )
}
