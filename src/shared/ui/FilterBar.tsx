import type { ReactNode } from 'react'

type FilterBarProps = {
  search?: ReactNode
  filters?: ReactNode
  actions?: ReactNode
}

export function FilterBar({ search, filters, actions }: FilterBarProps) {
  return (
    <div className="ds-filter-bar">
      {search ? <div className="ds-filter-bar__search">{search}</div> : null}
      {filters ? <div className="ds-filter-bar__filters">{filters}</div> : null}
      {actions ? <div className="ds-filter-bar__actions">{actions}</div> : null}
    </div>
  )
}
