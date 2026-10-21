import type { ReactNode } from 'react'

type NavItemProps = {
  label: string
  href?: string
  isActive?: boolean
  variant?: 'default' | 'child' | 'section' | 'tab' | 'rail' | 'sidebar'
  collapsed?: boolean
  icon?: ReactNode
  trailing?: string
  expanded?: boolean
  controlsId?: string
  onSelect?: () => void
}

export function NavItem({
  label,
  href,
  isActive = false,
  variant = 'default',
  icon,
  trailing,
  expanded,
  controlsId,
  collapsed = false,
  onSelect,
}: NavItemProps) {
  const className = [
    'nav-item',
    variant === 'child' ? 'nav-item--child' : '',
    variant === 'section' ? 'nav-item--section' : '',
    isActive && variant !== 'tab' ? 'nav-item--active' : '',
    variant === 'rail' ? 'nav-item--rail' : '',
    variant === 'sidebar' ? 'nav-item--sidebar' : '',
    variant === 'sidebar' && collapsed ? 'nav-item--sidebar-collapsed' : '',
    variant === 'tab' ? 'workspace-tab' : '',
    variant === 'tab' && isActive ? 'workspace-tab--active' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const showTooltip = variant === 'rail' || (variant === 'sidebar' && collapsed)

  if (href) {
    return (
      <a
        href={href}
        className={className}
        title={showTooltip ? label : undefined}
        aria-label={showTooltip ? label : undefined}
        aria-current={isActive ? 'page' : undefined}
        onClick={(event) => {
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.altKey ||
            event.ctrlKey ||
            event.shiftKey
          ) {
            return
          }

          event.preventDefault()
          onSelect?.()
        }}
      >
        <span className="nav-item__lead">
          {icon}
          <span className="nav-item__label">{label}</span>
        </span>
      </a>
    )
  }

  return (
    <button
      type="button"
      className={className}
      aria-current={isActive && variant !== 'section' ? 'page' : undefined}
      aria-expanded={variant === 'section' ? expanded : undefined}
      aria-controls={variant === 'section' ? controlsId : undefined}
      onClick={onSelect}
    >
      <span className="nav-item__lead">
        {icon}
        <span className="nav-item__label">{label}</span>
      </span>
      {trailing ? (
        <span className="nav-item__chevron" aria-hidden="true">
          {trailing}
        </span>
      ) : null}
    </button>
  )
}
