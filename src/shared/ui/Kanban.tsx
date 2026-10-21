import type { ReactNode } from 'react'

type KanbanColumn = {
  id: string
  title: string
  count: number
  total?: string
  children: ReactNode
}

export function Kanban({ columns }: { columns: KanbanColumn[] }) {
  return (
    <div className="kanban">
      {columns.map((column) => (
        <section key={column.id} className="kanban__column">
          <header className="kanban__head">
            <div className="kanban__head-text">
              <h3 className="kanban__title">{column.title}</h3>
              {column.total ? (
                <p className="kanban__total">{column.total}</p>
              ) : null}
            </div>
            <span className="kanban__count">{column.count}</span>
          </header>
          <div className="kanban__list">{column.children}</div>
        </section>
      ))}
    </div>
  )
}
