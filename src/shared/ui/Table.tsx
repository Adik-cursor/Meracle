import { Children, cloneElement, isValidElement } from 'react'
import type { ReactElement, ReactNode, TableHTMLAttributes } from 'react'

type TableProps = TableHTMLAttributes<HTMLTableElement> & {
  children: ReactNode
  mobileLayout?: 'scroll' | 'cards'
}

type HostElementProps = { children?: ReactNode; [key: string]: unknown }

function isHostElement(node: ReactNode, type: string): node is ReactElement<HostElementProps> {
  return isValidElement(node) && node.type === type
}

function readableText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') return String(child)
      if (isValidElement<HostElementProps>(child)) return readableText(child.props.children)
      return ''
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function addMobileLabels(children: ReactNode) {
  const sections = Children.toArray(children)
  const head = sections.find((child) => isHostElement(child, 'thead'))
  const firstHeaderRow = head && Children.toArray(head.props.children).find((child) => isHostElement(child, 'tr'))
  const labels = firstHeaderRow && Children.toArray(firstHeaderRow.props.children)
    .filter((cell) => isHostElement(cell, 'th'))
    .map((cell) => readableText(cell.props.children))

  if (!labels?.length) return children

  return Children.map(children, (section) => {
    if (!isHostElement(section, 'tbody')) return section
    const rows = Children.map(section.props.children, (row) => {
      if (!isHostElement(row, 'tr')) return row
      let cellIndex = 0
      const cells = Children.map(row.props.children, (cell) => {
        if (!isHostElement(cell, 'td')) return cell
        const label = labels[cellIndex++]
        if (!label || cell.props['data-label']) return cell
        return cloneElement(cell, { 'data-label': label })
      })
      return cloneElement(row, undefined, cells)
    })
    return cloneElement(section, undefined, rows)
  })
}

export function Table({ className = '', children, mobileLayout = 'scroll', ...props }: TableProps) {
  const tableClassName = [
    'data-table',
    mobileLayout === 'cards' ? 'data-table--mobile-cards' : '',
    className,
  ].filter(Boolean).join(' ')
  const tableChildren = mobileLayout === 'cards' ? addMobileLabels(children) : children

  return (
    <div className="table-wrap">
      <table className={tableClassName} {...props}>
        {tableChildren}
      </table>
    </div>
  )
}
