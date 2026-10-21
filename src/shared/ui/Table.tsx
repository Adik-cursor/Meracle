import type { ReactNode, TableHTMLAttributes } from 'react'

type TableProps = TableHTMLAttributes<HTMLTableElement> & {
  children: ReactNode
}

export function Table({ className = '', children, ...props }: TableProps) {
  return (
    <div className="table-wrap">
      <table className={`data-table ${className}`.trim()} {...props}>
        {children}
      </table>
    </div>
  )
}
