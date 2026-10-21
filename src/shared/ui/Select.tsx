import type { SelectHTMLAttributes } from 'react'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export function Select({ className = '', children, ...props }: SelectProps) {
  return (
    <select className={`select ${className}`.trim()} {...props}>
      {children}
    </select>
  )
}
