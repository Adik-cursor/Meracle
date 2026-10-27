import { useLocalization } from '../../context/localization-context'
import { usePlatform } from '../../context/platform-context'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { PagePlaceholder } from '../../../shared/components/PagePlaceholder'
import { Table } from '../../../shared/ui'
import { PLATFORM_MODULE_LABEL_KEY } from '../../../modules/platform/platform-module-label'
import { isPlatformModuleKey } from '../../../core/types'
import type { TranslationKey } from '../../../core/localization/translations'

export function PlatformModuleLogPage() {
  const { t, locale } = useLocalization()
  const { logs, denied, actorName, organizationName } = usePlatform()
  const numberLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU'

  if (denied) {
    return (
      <PagePlaceholder title={t('ACCESS_DENIED')} description={t('ACCESS_DENIED')} />
    )
  }

  if (!logs) {
    return <AuthRequiredState />
  }

  return (
    <section className="workspace-page">
      <div className="workspace-toolbar">
        <h2 className="workspace-toolbar__title">{t('navPlatformLog')}</h2>
      </div>
      {logs.length === 0 ? (
        <p>{t('accessLogEmpty')}</p>
      ) : (
        <Table mobileLayout="cards">
          <thead>
            <tr>
              <th>{t('movementDate')}</th>
              <th>{t('accessLogActor')}</th>
              <th>{t('navPlatformCompanies')}</th>
              <th>{t('navPlatformModules')}</th>
              <th>{t('accessLogPrevious')}</th>
              <th>{t('accessLogNext')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.createdAt).toLocaleString(numberLocale)}</td>
                <td>{actorName(entry.actorUserId)}</td>
                <td>{organizationName(entry.organizationId)}</td>
                <td>
                  {entry.field?.startsWith('lifecycle.')
                    ? t(
                        (entry.field.slice('lifecycle.'.length) ||
                          'platformActionColumn') as TranslationKey,
                      )
                    : isPlatformModuleKey(entry.moduleKey)
                      ? t(PLATFORM_MODULE_LABEL_KEY[entry.moduleKey])
                      : entry.moduleKey}
                </td>
                <td>
                  {entry.field?.startsWith('lifecycle.')
                    ? `${entry.previousValue} → ${entry.nextValue}`
                    : entry.previousValue === 'enabled'
                      ? t('enabled')
                      : t('disabled')}
                </td>
                <td>
                  {entry.field?.startsWith('lifecycle.')
                    ? ''
                    : entry.nextValue === 'enabled'
                      ? t('enabled')
                      : t('disabled')}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  )
}
