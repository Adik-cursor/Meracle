import { useLocalization } from '../../app/context/localization-context'
import { useOrganization } from '../../app/context/organization-context'
import { getRoleScopeFlags } from './permission-ui'
import type { UserRole } from '../../core/types'

type AccessScopeLegendProps = {
  role: UserRole
}

export function AccessScopeLegend({ role }: AccessScopeLegendProps) {
  const { t } = useLocalization()
  const { modules } = useOrganization()
  const flags = getRoleScopeFlags(role, modules)

  return (
    <section className="settings-section">
      <h3 className="access-card__title">{t('accessScopeTitle')}</h3>
      <p className="access-hint">{t('accessScopeHint')}</p>
      <div className="access-scope" role="group" aria-label={t('accessScopeTitle')}>
        {flags.map((flag) => (
          <span
            key={flag.id}
            className={
              flag.included
                ? 'access-scope__chip access-scope__chip--on'
                : 'access-scope__chip'
            }
            aria-disabled="true"
          >
            {flag.included ? '✓ ' : ''}
            {t(flag.labelKey)}
          </span>
        ))}
      </div>
    </section>
  )
}
