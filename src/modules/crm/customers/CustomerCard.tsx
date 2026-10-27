import { useLocalization } from '../../../app/context/localization-context'
import type { Customer } from '../../../core/types'
import type { CustomerDebtView } from '../../../core/services/customer-debts'
import { ActionRow, Button, RowMenu, StatusBadge } from '../../../shared/ui'
import { formatMoney } from '../../sales/pos-format'

type CustomerCardProps = {
  customer: Customer
  name: string
  phone?: string
  email?: string
  finance?: CustomerDebtView
  currency?: string
  locale?: 'ru' | 'kk'
  onEdit: (customer: Customer) => void
  onSetStatus: (customer: Customer) => void
  onReconciliation?: (customer: Customer) => void
}

export function CustomerCard({
  customer,
  name,
  phone = '',
  email = '',
  finance,
  currency = 'KZT',
  locale = 'ru',
  onEdit,
  onSetStatus,
  onReconciliation,
}: CustomerCardProps) {
  const { t } = useLocalization()
  const isActive = customer.status === 'active'

  return (
    <tr>
      <td data-label={t('customerType')}>
        {customer.type === 'contact'
          ? t('customerPerson')
          : t('customerCompany')}
      </td>
      <td data-label={t('customerName')}>{name}</td>
      <td data-label={t('phone')}>{phone || '—'}</td>
      <td data-label={t('email')}>{email || '—'}</td>
      <td data-label={t('taxId')}>
        {customer.type === 'company' ? t('bin') : t('iin')}:{' '}
        {customer.taxId?.trim() ? customer.taxId : t('taxIdNotSet')}
      </td>
      {finance ? (
        <>
          <td data-label={t('customerSalesTotal')}>{formatMoney(finance.totalDebt, locale, currency)}</td>
          <td data-label={t('customerPaidTotal')}>{formatMoney(finance.paidAmount, locale, currency)}</td>
          <td data-label={t('debtAmount')}>{formatMoney(finance.remainingDebt, locale, currency)}</td>
        </>
      ) : null}
      <td data-label={t('status')}>
        <StatusBadge tone={isActive ? 'success' : 'neutral'}>
          {isActive ? t('active') : t('inactive')}
        </StatusBadge>
      </td>
      <td data-label={t('transferActions')}>
        <ActionRow>
          {onReconciliation ? (
            <Button type="button" onClick={() => onReconciliation(customer)}>
              {t('reconciliationStatement')}
            </Button>
          ) : (
            <Button type="button" onClick={() => onEdit(customer)}>
              {t('edit')}
            </Button>
          )}
          <RowMenu
            label={t('moreActions')}
            items={[
              ...(onReconciliation
                ? [
                    {
                      id: 'edit',
                      label: t('edit'),
                      onSelect: () => onEdit(customer),
                    },
                  ]
                : []),
              {
                id: 'status',
                label: isActive ? t('turnOff') : t('turnOn'),
                danger: isActive,
                onSelect: () => onSetStatus(customer),
              },
            ]}
          />
        </ActionRow>
      </td>
    </tr>
  )
}
