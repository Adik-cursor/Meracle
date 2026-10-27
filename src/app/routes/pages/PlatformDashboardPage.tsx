import { useLocalization } from '../../context/localization-context'
import { usePlatform } from '../../context/platform-context'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { PagePlaceholder } from '../../../shared/components/PagePlaceholder'
import { Button, Table } from '../../../shared/ui'
import { useAppPath } from '../useAppPath'
import { businessTypeLabelKey } from '../../../modules/platform/business-type-label'
import { PLATFORM_MODULE_LABEL_KEY } from '../../../modules/platform/platform-module-label'
import { organizationStatusLabelKey } from '../../../modules/platform/organization-status-label'
import { isSuspendedOrganizationStatus } from '../../../modules/platform/organization-status-label'
import { isPlatformModuleKey } from '../../../core/types'
import type { TranslationKey } from '../../../core/localization/translations'
import type { CompanyLifecycleAction } from '../../../core/services'

const LIFECYCLE_LABEL: Record<CompanyLifecycleAction, TranslationKey> = {
  COMPANY_SUSPENDED: 'COMPANY_SUSPENDED',
  COMPANY_REACTIVATED: 'COMPANY_REACTIVATED',
  COMPANY_ARCHIVED: 'COMPANY_ARCHIVED',
  COMPANY_RESTORED: 'COMPANY_RESTORED',
}

export function PlatformDashboardPage() {
  const { t, locale } = useLocalization()
  const { navigate } = useAppPath()
  const {
    organizations,
    logs,
    denied,
    actorName,
    organizationName,
    businessTypes,
  } = usePlatform()
  const numberLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU'

  if (denied) {
    return (
      <PagePlaceholder title={t('ACCESS_DENIED')} description={t('ACCESS_DENIED')} />
    )
  }

  if (!organizations) {
    return <AuthRequiredState />
  }

  const active = organizations.filter((item) => item.organization.status === 'active')
  const suspended = organizations.filter((item) =>
    isSuspendedOrganizationStatus(item.organization.status),
  )
  const archived = organizations.filter((item) => item.organization.status === 'archived')
  const recent = organizations
    .slice()
    .sort((a, b) => b.organization.createdAt.localeCompare(a.organization.createdAt))
    .slice(0, 6)
  const recentLogs = (logs ?? [])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)

  const modelLabel = (businessTypeId?: string) => {
    if (!businessTypeId) {
      return '—'
    }
    const key = businessTypeLabelKey(businessTypeId)
    if (key) {
      return t(key)
    }
    return businessTypes.find((item) => item.id === businessTypeId)?.name ?? businessTypeId
  }

  return (
    <section className="workspace-page ds-page platform-dashboard">
      <header className="ds-context platform-dashboard__hero">
        <div className="platform-dashboard__hero-copy">
          <p className="ds-context__kicker">{t('navPlatform')}</p>
          <h2 className="ds-context__title">{t('platformStatusTitle')}</h2>
        </div>
        <div className="platform-dashboard__hero-mark" aria-hidden="true">
          <span>{organizations.length.toLocaleString(numberLocale)}</span>
          <small>{t('platformCompaniesCount')}</small>
        </div>
      </header>

      <section className="platform-dashboard__stats" aria-label={t('platformStatusTitle')}>
        <dl className="dash-kpi-strip">
          <div>
            <dt>{t('platformCompaniesCount')}</dt>
            <dd>{organizations.length}</dd>
          </div>
          <div>
            <dt>{t('platformActiveCompanies')}</dt>
            <dd>{active.length}</dd>
          </div>
          <div>
            <dt>{t('platformSuspendedCompanies')}</dt>
            <dd>{suspended.length}</dd>
          </div>
          <div>
            <dt>{t('platformArchivedCompanies')}</dt>
            <dd>{archived.length}</dd>
          </div>
        </dl>
      </section>

      <article className="dash-card dash-span-12">
        <div className="dash-card__head">
          <h3 className="dash-card__title">{t('platformRecentCompanies')}</h3>
          <Button variant="ghost" onClick={() => navigate('/platform/organizations')}>
            {t('platformAllCompanies')}
          </Button>
        </div>
        {recent.length === 0 ? (
          <p className="workspace-muted">{t('platformCompaniesCount')}: 0</p>
        ) : (
          <Table className="data-table--stacked platform-recent-companies-table">
            <thead>
              <tr>
                <th>{t('navPlatformCompanies')}</th>
                <th>{t('platformCompanyModel')}</th>
                <th>{t('status')}</th>
                <th>{t('platformCreatedAt')}</th>
                <th>{t('platformActionColumn')}</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((item) => (
                <tr key={item.organization.id}>
                  <td>{item.organization.name}</td>
                  <td data-label={t('platformCompanyModel')}>
                    {modelLabel(item.organization.businessTypeId)}
                  </td>
                  <td data-label={t('status')}>
                    {t(organizationStatusLabelKey(item.organization.status))}
                  </td>
                  <td data-label={t('platformCreatedAt')}>
                    {new Date(item.organization.createdAt).toLocaleDateString(numberLocale)}
                  </td>
                  <td>
                    <div className="warehouse-card__actions">
                      <Button
                        variant="ghost"
                        onClick={() =>
                          navigate(`/platform/organizations/${item.organization.id}`)
                        }
                      >
                        {item.organization.status === 'archived'
                          ? t('platformPreviewCompany')
                          : t('platformViewCompany')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </article>

      {logs ? (
        <article className="dash-card dash-span-12">
          <div className="dash-card__head">
            <h3 className="dash-card__title">{t('platformRecentActions')}</h3>
            <Button variant="ghost" onClick={() => navigate('/platform/log')}>
              {t('platformOpenJournal')}
            </Button>
          </div>
          {recentLogs.length === 0 ? (
            <p className="workspace-muted">{t('accessLogEmpty')}</p>
          ) : (
            <Table mobileLayout="cards">
              <thead>
                <tr>
                  <th>{t('platformActionColumn')}</th>
                  <th>{t('platformJournalObject')}</th>
                  <th>{t('accessLogActor')}</th>
                  <th>{t('movementDate')}</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((entry) => {
                  const lifecycle = entry.field?.startsWith('lifecycle.')
                    ? (entry.field.slice('lifecycle.'.length) as CompanyLifecycleAction)
                    : null
                  const moduleLabel = isPlatformModuleKey(entry.moduleKey)
                    ? t(PLATFORM_MODULE_LABEL_KEY[entry.moduleKey])
                    : entry.moduleKey
                  const action = lifecycle
                    ? t(LIFECYCLE_LABEL[lifecycle])
                    : `${
                        entry.nextValue === 'enabled'
                          ? t('platformActionEnableModule')
                          : t('platformActionDisableModule')
                      }: ${moduleLabel}`
                  return (
                    <tr key={entry.id}>
                      <td>{action}</td>
                      <td>{organizationName(entry.organizationId)}</td>
                      <td>{actorName(entry.actorUserId)}</td>
                      <td>{new Date(entry.createdAt).toLocaleString(numberLocale)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          )}
        </article>
      ) : null}
    </section>
  )
}
