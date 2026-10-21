import { useEffect } from 'react'
import { useAccess } from '../../context/access-context'
import { useInternalReceipts } from '../../context/internal-receipt-context'
import { useLocalization } from '../../context/localization-context'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { PagePlaceholder } from '../../../shared/components/PagePlaceholder'
import { getReceiptIdFromPath } from '../app.routes'
import { useAppPath } from '../useAppPath'

export function InternalReceiptDetailPage() {
  const { t } = useLocalization()
  const { pathname, navigate } = useAppPath()
  const { currentUser } = useAccess()
  const { getReceiptAccess } = useInternalReceipts()
  const receiptId = getReceiptIdFromPath(pathname)

  useEffect(() => {
    if (!receiptId) {
      return
    }
    const result = getReceiptAccess(receiptId)
    if (result.ok) {
      navigate(`/sales/${result.receipt.saleId}?receipt=1`, { replace: true })
    }
  }, [getReceiptAccess, navigate, receiptId])

  if (!currentUser) {
    return <AuthRequiredState />
  }

  if (!receiptId) {
    return (
      <PagePlaceholder
        title={t('pageNotFound')}
        description={t('pageNotFoundDescription')}
      />
    )
  }

  const access = getReceiptAccess(receiptId)
  if (!access.ok) {
    return (
      <PagePlaceholder title={t('ACCESS_DENIED')} description={t('ACCESS_DENIED')} />
    )
  }

  return null
}
