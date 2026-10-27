import { useAuth } from '../context/auth-context'
import { useLocalization } from '../context/localization-context'
import type { AppRoute } from '../routes/route.types'
import { isWorkspaceTabActive } from '../navigation/workspace-nav'
import { NavItem } from '../../shared/components/NavItem'
import { userDisplayName } from '../../modules/crm/users/user-name'
import { USER_ROLE_LABEL_KEY } from '../../modules/crm/users/user-role-label'
import { isPlatformOwner } from '../../core/services'
import { Button } from '../../shared/ui'

type WorkspaceChromeProps = {
  moduleTitle: string
  pathname: string
  onNavigate: (path: string) => void
  tabs?: AppRoute[]
}

export function WorkspaceChrome({
  moduleTitle,
  pathname,
  onNavigate,
  tabs = [],
}: WorkspaceChromeProps) {
  const { locale, setLocale, t } = useLocalization()
  const { currentUser, isAuthenticated, logout } = useAuth()
  const hasSalesTabs = tabs.some((route) => route.path === '/sales/returns')

  return (
    <header className={`workspace-chrome${hasSalesTabs ? ' workspace-chrome--sales' : ''}`}>
      <div className="workspace-chrome__bar">
        <div className="app-header__actions">
          <div className="lang-switch" role="group" aria-label={t('interfaceLanguage')}>
            <button
              type="button"
              className={
                locale === 'ru'
                  ? 'lang-switch__btn lang-switch__btn--active'
                  : 'lang-switch__btn'
              }
              onClick={() => setLocale('ru')}
            >
              RU
            </button>
            <span className="lang-switch__sep" aria-hidden="true">
              |
            </span>
            <button
              type="button"
              className={
                locale === 'kk'
                  ? 'lang-switch__btn lang-switch__btn--active'
                  : 'lang-switch__btn'
              }
              onClick={() => setLocale('kk')}
            >
              KZ
            </button>
          </div>
          {isAuthenticated && currentUser ? (
            <div className="app-header__user">
              <span className="app-header__avatar" aria-hidden="true">
                {currentUser.firstName.charAt(0)}
              </span>
              <div className="app-header__user-meta">
                <span className="app-header__user-name">
                  {userDisplayName(currentUser)}
                </span>
                <span className="app-header__user-role">
                  {isPlatformOwner(currentUser)
                    ? t('platformOwnerRole')
                    : t(USER_ROLE_LABEL_KEY[currentUser.role])}
                </span>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  logout()
                  onNavigate('/login')
                }}
              >
                {t('signOut')}
              </Button>
            </div>
          ) : pathname === '/login' || pathname === '/setup' ? null : (
            <Button variant="primary" onClick={() => onNavigate('/login')}>
              {t('signIn')}
            </Button>
          )}
        </div>
      </div>
      {tabs.length > 0 ? (
        <nav className="workspace-tabs" aria-label={moduleTitle}>
          {tabs.map((route) => (
            <div key={route.path} className="workspace-tabs__cluster">
              {route.groupLabelKey ? (
                <span className="workspace-tabs__group">{t(route.groupLabelKey)}</span>
              ) : null}
              <NavItem
                variant="tab"
                href={route.path}
                label={t(route.labelKey)}
                isActive={isWorkspaceTabActive(route.path, pathname)}
                onSelect={() => onNavigate(route.path)}
              />
            </div>
          ))}
        </nav>
      ) : null}
    </header>
  )
}
