import { useState } from 'react'
import { useAccess } from '../../context/access-context'
import { useLocalization } from '../../context/localization-context'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { usePaymentRefunds } from '../../context/payment-refund-context'
import { usePayments } from '../../context/payment-context'
import { useSaleReturns } from '../../context/sale-return-context'
import { PaymentRefundForm } from '../../../modules/sales/components/PaymentRefundForm'
import { PaymentRefundList } from '../../../modules/sales/components/PaymentRefundList'
import { EmptyState } from '../../../shared/ui'

export function PaymentRefundsPage() {
  const { t } = useLocalization()
  const { currentUser, hasFinancialAccess } = useAccess()
  const { payments } = usePayments()
  const { returns } = useSaleReturns()
  const {
    refunds,
    createRefund,
    cancelRefund,
    getRefundedAmount,
    getRefundableAmount,
    getReturnRefundableAmount,
  } = usePaymentRefunds()
  const [selectedPaymentId, setSelectedPaymentId] = useState('')

  if (!currentUser) {
    return <AuthRequiredState />
  }

  const completedPayments = payments.filter(
    (payment) => payment.status === 'completed',
  )

  return (
    <section className="workspace-page">
      <div className="workspace-toolbar">
        <h2 className="workspace-toolbar__title">{t('navPaymentRefunds')}</h2>
      </div>

      {payments.length === 0 ? (
        <EmptyState title={t('noPaymentRefunds')} />
      ) : (
        <PaymentRefundList
          payments={payments}
          refunds={refunds}
          getRefundedAmount={getRefundedAmount}
          getRefundableAmount={getRefundableAmount}
          onRefundPayment={setSelectedPaymentId}
          onCancelRefund={cancelRefund}
        />
      )}

      {hasFinancialAccess('refunds.create') ? (
        <PaymentRefundForm
          key={`${selectedPaymentId}-${refunds.length}`}
          payments={completedPayments}
          returns={returns}
          selectedPaymentId={selectedPaymentId}
          getRefundableAmount={getRefundableAmount}
          getReturnRefundableAmount={getReturnRefundableAmount}
          onPaymentChange={setSelectedPaymentId}
          onSubmit={(draft) => {
            const created = createRefund(draft)
            return created
          }}
        />
      ) : null}
    </section>
  )
}
