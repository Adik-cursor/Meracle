import { useEffect, useRef, useState } from 'react'
import { useOrganization } from '../context/organization-context'
import { useAccess } from '../context/access-context'
import { useAuth } from '../context/auth-context'
import { useLocalization } from '../context/localization-context'
import {
  getSidebarItems,
  isSidebarItemActive,
  type SidebarItem,
} from '../navigation/workspace-nav'
import { Logo } from '../../shared/components/Logo'
import { NavItem } from '../../shared/components/NavItem'
import { userDisplayName } from '../../modules/crm/users/user-name'
import { USER_ROLE_LABEL_KEY } from '../../modules/crm/users/user-role-label'
import { isPlatformOwner } from '../../core/services'

type SidebarProps = {
  pathname: string
  onNavigate: (path: string) => void
  mobileContextLabel: string
}

const WORKSPACE_IDS = new Set([
  'dashboard',
  'crm',
  'sales',
  'rental',
  'children',
  'warehouse',
  'attendance',
  'finance',
  'platform-dashboard',
  'platform-companies',
  'platform-log',
])

export function Sidebar({ pathname, onNavigate, mobileContextLabel }: SidebarProps) {
  const { modules, organization } = useOrganization()
  const { hasFinancialAccess, hasWarehouseAccess, hasCareAccess, currentUser } = useAccess()
  const { logout } = useAuth()
  const { locale, setLocale, t } = useLocalization()
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileToggleRef = useRef<HTMLButtonElement>(null)
  const items = getSidebarItems({
    currentUser,
    modules,
    hasFinancialAccess,
    hasWarehouseAccess,
    hasCareAccess,
  })
  const workspace = items.filter((item) => WORKSPACE_IDS.has(item.id))
  const org = items.filter((item) => !WORKSPACE_IDS.has(item.id))

  useEffect(() => {
    if (!mobileOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
        mobileToggleRef.current?.focus()
      }
    }
    const closeOnDesktop = () => {
      if (window.matchMedia('(min-width: 769px)').matches) setMobileOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', closeOnDesktop)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', closeOnDesktop)
    }
  }, [mobileOpen])

  const navigate = (path: string) => {
    setMobileOpen(false)
    mobileToggleRef.current?.focus()
    onNavigate(path)
  }

  const contextLabel = organization?.name ?? (isPlatformOwner(currentUser) ? mobileContextLabel : '')

  return (
    <>
    <div className="rapport-mobile-bar">
      <button
        ref={mobileToggleRef}
        type="button"
        className="sidebar__mobile-toggle"
        aria-label={t(mobileOpen ? 'collapseSidebar' : 'expandSidebar')}
        aria-expanded={mobileOpen}
        aria-controls="primary-sidebar-navigation"
        onClick={() => setMobileOpen((open) => !open)}
      >
        <span aria-hidden="true">☰</span>
      </button>
      <div className="rapport-mobile-bar__brand">
        <Logo />
        {contextLabel ? <span className="sidebar__org" title={contextLabel}>{contextLabel}</span> : null}
      </div>
      <div className="lang-switch rapport-mobile-bar__locale" role="group" aria-label={t('interfaceLanguage')}>
        <button
          type="button"
          className={locale === 'ru' ? 'lang-switch__btn lang-switch__btn--active' : 'lang-switch__btn'}
          onClick={() => setLocale('ru')}
        >RU</button>
        <span className="lang-switch__sep" aria-hidden="true">|</span>
        <button
          type="button"
          className={locale === 'kk' ? 'lang-switch__btn lang-switch__btn--active' : 'lang-switch__btn'}
          onClick={() => setLocale('kk')}
        >KZ</button>
      </div>
    </div>
    <button
      type="button"
      className={`sidebar__mobile-backdrop${mobileOpen ? ' sidebar__mobile-backdrop--open' : ''}`}
      aria-label={t('collapseSidebar')}
      tabIndex={mobileOpen ? 0 : -1}
      onClick={() => {
        setMobileOpen(false)
        mobileToggleRef.current?.focus()
      }}
    />
    <aside className={`sidebar sidebar--rapport-nav${mobileOpen ? ' sidebar--mobile-open' : ''}`}>
      <div className="sidebar__brand">
        <Logo />
        {organization ? (
          <span className="sidebar__org">{organization.name}</span>
        ) : isPlatformOwner(currentUser) ? (
          <span className="sidebar__org">
            {mobileContextLabel}
          </span>
        ) : null}
      </div>
      <nav
        id="primary-sidebar-navigation"
        className="sidebar__nav"
        aria-label={t('mainNav')}
      >
        <SidebarGroup
          collapsed={false}
          label={t('navWorkspaceGroup')}
          items={workspace}
          pathname={pathname}
          onNavigate={navigate}
        />
        {org.length > 0 ? (
          <SidebarGroup
            collapsed={false}
            label={
              isPlatformOwner(currentUser) ? t('navSystemGroup') : t('navOrgGroup')
            }
            items={org}
            pathname={pathname}
          onNavigate={navigate}
          />
        ) : null}
      </nav>
      <div className="sidebar__toolbar">
        <div className="lang-switch" role="group" aria-label={t('interfaceLanguage')}>
          <button
            type="button"
            className={locale === 'ru' ? 'lang-switch__btn lang-switch__btn--active' : 'lang-switch__btn'}
            onClick={() => setLocale('ru')}
          >
            RU
          </button>
          <span className="lang-switch__sep" aria-hidden="true">|</span>
          <button
            type="button"
            className={locale === 'kk' ? 'lang-switch__btn lang-switch__btn--active' : 'lang-switch__btn'}
            onClick={() => setLocale('kk')}
          >
            KZ
          </button>
        </div>
        {currentUser ? <div className="sidebar__account">
          <span className="app-header__avatar" aria-hidden="true">
            {currentUser.firstName.charAt(0)}
          </span>
          <div className="sidebar__account-meta">
            <span className="sidebar__account-name">{userDisplayName(currentUser)}</span>
            <span className="sidebar__account-role">
              {isPlatformOwner(currentUser)
                ? t('platformOwnerRole')
                : t(USER_ROLE_LABEL_KEY[currentUser.role])}
            </span>
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            aria-label={t('signOut')}
            title={t('signOut')}
            onClick={() => {
              logout()
              onNavigate('/login')
            }}
          >
            <span className="sidebar__signout-label">{t('signOut')}</span>
          </button>
        </div> : null}
      </div>
    </aside>
    </>
  )
}

function SidebarGroup({
  collapsed,
  label,
  items,
  pathname,
  onNavigate,
}: {
  collapsed: boolean
  label: string
  items: SidebarItem[]
  pathname: string
  onNavigate: (path: string) => void
}) {
  const { t } = useLocalization()
  const { modules } = useOrganization()
  if (items.length === 0) {
    return null
  }

  return (
    <div className="sidebar__group">
      {collapsed ? null : <p className="sidebar__group-label">{label}</p>}
      {items.map((item) => (
        <NavItem
          key={item.id}
          href={item.href}
          variant="sidebar"
          collapsed={collapsed}
          label={t(item.labelKey)}
          icon={sidebarIcon(item.id)}
          isActive={isSidebarItemActive(item, pathname, modules)}
          onSelect={() => onNavigate(item.href)}
        />
      ))}
    </div>
  )
}

function sidebarIcon(id: string) {
  switch (id) {
    case 'dashboard':
    case 'platform-dashboard':
      return <DashboardIcon />
    case 'crm':
      return <CrmIcon />
    case 'sales':
      return <SalesIcon />
    case 'warehouse':
      return <WarehouseIcon />
    case 'finance':
      return <ExpensesIcon />
    case 'analytics':
      return <AnalyticsIcon />
    case 'company':
    case 'platform-companies':
      return <CompanyIcon />
    case 'platform-log':
      return <LogIcon />
    case 'rental':
      return <RentalIcon />
    case 'children':
      return <ChildrenIcon />
    case 'attendance':
      return <AttendanceIcon />
    default:
      return <SettingsIcon />
  }
}

function iconProps() {
  return {
    className: 'nav-item__icon',
    viewBox: '0 0 16 16',
    width: 16,
    height: 16,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }
}

function DashboardIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="0.8" />
      <rect x="9" y="2.5" width="4.5" height="6.5" rx="0.8" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="0.8" />
      <rect x="9" y="11" width="4.5" height="2.5" rx="0.8" />
    </svg>
  )
}

function SalesIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3 4.5h10M3 8h7M3 11.5h10" />
    </svg>
  )
}

function AnalyticsIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3.5 12.5V8M8 12.5V3.5M12.5 12.5V6.5" />
    </svg>
  )
}

function ExpensesIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="3.5" width="10" height="9" rx="1.2" />
      <path d="M3 6.5h10" />
    </svg>
  )
}

function RentalIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M8 2.5 2.5 5.5v8h4.2V9.2h2.6v4.3h4.2v-8z" />
    </svg>
  )
}

function LogIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="2.5" width="10" height="11" rx="1.2" />
      <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" />
    </svg>
  )
}

function WarehouseIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M2.5 7.2 8 3.5l5.5 3.7v6.3H2.5z" />
      <path d="M8 13.5V8.2" />
    </svg>
  )
}

function CrmIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="8" cy="5.2" r="2.2" />
      <path d="M3.4 13c.4-2.2 2.2-3.4 4.6-3.4s4.2 1.2 4.6 3.4" />
    </svg>
  )
}

function AttendanceIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="3" width="10" height="10" rx="1.2" />
      <path d="M5.5 8.2 7.2 10l3.4-4" />
    </svg>
  )
}

function ChildrenIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="8" cy="5.2" r="2" />
      <path d="M3.6 13c.5-2 2.2-3.2 4.4-3.2S12 11 12.4 13" />
    </svg>
  )
}

function CompanyIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3.5 13.5V6.2L8 3.5l4.5 2.7v7.3H9.2V9H6.8v4.5z" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="8" cy="8" r="2.1" />
      <path d="M8 2.5v1.6M8 11.9v1.6M2.5 8h1.6M11.9 8h1.6M4.1 4.1l1.1 1.1M10.8 10.8l1.1 1.1M11.9 4.1 10.8 5.2M5.2 10.8 4.1 11.9" />
    </svg>
  )
}
