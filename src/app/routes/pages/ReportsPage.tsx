import { PagePlaceholder } from '../../../shared/components/PagePlaceholder'
import { useLocalization } from '../../context/localization-context'

export function ReportsPage() {
  const { t } = useLocalization()

  return (
    <PagePlaceholder
      title={t('navReports')}
      description={t('comingSoon')}
    />
  )
}
