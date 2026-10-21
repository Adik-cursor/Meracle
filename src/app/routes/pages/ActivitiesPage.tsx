import { PagePlaceholder } from '../../../shared/components/PagePlaceholder'
import { useLocalization } from '../../context/localization-context'

export function ActivitiesPage() {
  const { t } = useLocalization()

  return (
    <PagePlaceholder
      title={t('navActivities')}
      description={t('comingSoon')}
    />
  )
}
