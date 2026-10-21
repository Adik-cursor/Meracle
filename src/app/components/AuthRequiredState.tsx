import { EmptyState, Button } from '../../shared/ui'
import { useLocalization } from '../context/localization-context'
import { useAppPath } from '../routes/useAppPath'

export function AuthRequiredState() {
  const { t } = useLocalization()
  const { navigate } = useAppPath()

  return (
    <section className="workspace-page">
      <EmptyState
        title={t('pleaseSignIn')}
        action={
          <Button variant="primary" onClick={() => navigate('/login')}>
            {t('signIn')}
          </Button>
        }
      />
    </section>
  )
}
