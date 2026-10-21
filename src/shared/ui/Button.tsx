import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
  children: ReactNode
}

export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  const variantClass =
    variant === 'secondary' ? 'btn' : `btn btn--${variant}`

  return (
    <button type={type} className={`${variantClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}
