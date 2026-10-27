import { Fragment, useMemo, useState } from 'react'
import type { DomainErrorCode, Id } from '../../../core/types'
import type { TranslationKey } from '../../../core/localization/translations'
import { useAuth } from '../../context/auth-context'
import { useLocalization } from '../../context/localization-context'
import {
  isPlatformOwner,
  listLoginUserRows,
} from '../../../core/services'
import { usePersistence, usePersistenceVersion } from '../../context/persistence-context'
import { userDisplayName } from '../../../modules/crm/users/user-name'
import { USER_ROLE_LABEL_KEY } from '../../../modules/crm/users/user-role-label'
import { useAppPath } from '../useAppPath'
import { Logo } from '../../../shared/components/Logo'
import { Badge, Button, EmptyState, Table } from '../../../shared/ui'

function loginErrorKey(code: DomainErrorCode): TranslationKey {
  if (code === 'USER_NOT_FOUND') {
    return 'loginUserNotFound'
  }
  if (code === 'USER_INACTIVE') {
    return 'loginUserInactive'
  }
  if (code === 'ORGANIZATION_SUSPENDED') {
    return 'ORGANIZATION_SUSPENDED'
  }
  if (code === 'ORGANIZATION_ARCHIVED') {
    return 'ORGANIZATION_ARCHIVED'
  }
  return 'loginFailed'
}

export function LoginPage() {
  const { t } = useLocalization()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const { login, isAuthenticated, isInitializing } = useAuth()
  const { navigate } = useAppPath()
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null)
  const [companyFilter, setCompanyFilter] = useState<'all' | Id>('all')

  const rows = useMemo(() => {
    void version
    return listLoginUserRows(persistence)
  }, [persistence, version])

  const companies = useMemo(() => {
    const seen = new Map<Id, string>()
    for (const row of rows) {
      if (!row.isPlatform && !seen.has(row.organizationId)) {
        seen.set(row.organizationId, row.organizationName)
      }
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], 'ru'))
  }, [rows])

  const visible = useMemo(
    () =>
      rows.filter(
        (row) => companyFilter === 'all' || row.organizationId === companyFilter,
      ),
    [companyFilter, rows],
  )

  if (isInitializing) {
    return null
  }

  if (isAuthenticated) {
    return null
  }

  const handleLogin = (userId: string) => {
    const result = login(userId)
    if (!result.ok) {
      setErrorKey(loginErrorKey(result.error.code))
      return
    }

    const user = result.value
    setErrorKey(null)
    navigate(isPlatformOwner(user) ? '/platform/dashboard' : '/dashboard')
  }

  const companyLabel = (row: (typeof rows)[number]) =>
    row.isPlatform ? t('platformWorkspaceCompany') : row.organizationName

  return (
    <section className="login-page">
      <div className="login-card">
        <Logo />
        <p className="login-card__tagline">{t('loginProductTagline')}</p>
        <h2 className="login-card__title">{t('signIn')}</h2>
        <p className="workspace-muted">{t('selectUserToLogin')}</p>
        {errorKey ? <p className="empty-state__text">{t(errorKey)}</p> : null}

        {rows.length === 0 ? (
          <EmptyState
            title={t('setupNoUsers')}
            action={
              <Button variant="primary" onClick={() => navigate('/setup')}>
                {t('setupConfigureSystem')}
              </Button>
            }
          />
        ) : (
          <>
            <label className="login-filter">
              <span>{t('loginCompanyColumn')}</span>
              <select
                className="warehouse-input"
                value={companyFilter}
                onChange={(event) =>
                  setCompanyFilter(
                    event.target.value === 'all' ? 'all' : event.target.value,
                  )
                }
              >
                <option value="all">{t('loginAllCompanies')}</option>
                {companies.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <div className="login-user-cards" aria-label={t('selectUserToLogin')}>
              {visible.map((row) => {
                const user = row.user
                const isActive = user.status === 'active'
                return (
                  <article className="login-user-card" key={user.id}>
                    <strong className="login-user-card__name">{userDisplayName(user)}</strong>
                    {user.email ? <span className="login-user-card__email">{user.email}</span> : null}
                    {companyFilter === 'all' ? (
                      <span className="login-user-card__company">{companyLabel(row)}</span>
                    ) : null}
                    <div className="login-user-card__meta">
                      <span>
                        <span className="login-user-card__label">{t('userRole')}: </span>
                        {isPlatformOwner(user)
                          ? t('platformOwnerRole')
                          : t(USER_ROLE_LABEL_KEY[user.role])}
                      </span>
                      <span className="login-user-card__status">
                        <span className="login-user-card__label">{t('status')}: </span>
                        <Badge tone={isActive ? 'success' : 'neutral'}>
                          {isActive ? t('active') : t('inactive')}
                        </Badge>
                      </span>
                    </div>
                    <Button variant="primary" onClick={() => handleLogin(user.id)}>
                      {t('signIn')}
                    </Button>
                  </article>
                )
              })}
            </div>
            <div className="login-user-table">
              <Table>
                <thead>
                  <tr>
                    <th>{t('loginEmployeeColumn')}</th>
                    <th>{t('email')}</th>
                    {companyFilter !== 'all' ? (
                      <th>{t('loginCompanyColumn')}</th>
                    ) : null}
                    <th>{t('userRole')}</th>
                    <th>{t('status')}</th>
                    <th>{t('transferActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row, index) => {
                    const user = row.user
                    const isActive = user.status === 'active'
                    const previous = visible[index - 1]
                    const showGroup =
                      companyFilter === 'all' &&
                      (!previous || previous.organizationId !== row.organizationId)
                    return (
                      <Fragment key={user.id}>
                        {showGroup ? (
                          <tr className="login-group">
                            <td colSpan={companyFilter === 'all' ? 5 : 6}>
                              {companyLabel(row)}
                            </td>
                          </tr>
                        ) : null}
                        <tr>
                          <td>{userDisplayName(user)}</td>
                          <td>{user.email}</td>
                          {companyFilter !== 'all' ? (
                            <td>{companyLabel(row)}</td>
                          ) : null}
                          <td>
                            {isPlatformOwner(user)
                              ? t('platformOwnerRole')
                              : t(USER_ROLE_LABEL_KEY[user.role])}
                          </td>
                          <td>
                            <Badge tone={isActive ? 'success' : 'neutral'}>
                              {isActive ? t('active') : t('inactive')}
                            </Badge>
                          </td>
                          <td>
                            <Button variant="primary" onClick={() => handleLogin(user.id)}>
                              {t('signIn')}
                            </Button>
                          </td>
                        </tr>
                      </Fragment>
                    )
                  })}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
