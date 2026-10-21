import { useLocalization } from '../context/localization-context'

export function AuthInitializingState() {
  const { t } = useLocalization()

  return (
    <section className="workspace-page auth-loading">
      <p className="empty-state__text">{t('authInitializing')}</p>
    </section>
  )
}
