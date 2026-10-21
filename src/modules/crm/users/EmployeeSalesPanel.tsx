import { listSalesForManagedEmployeeForUser } from '../../../core/services'
import type { PaymentMethod, SaleStatus, User } from '../../../core/types'
import { useAccess } from '../../../app/context/access-context'
import { useLocalization } from '../../../app/context/localization-context'
import { usePayments } from '../../../app/context/payment-context'
import { usePersistence, usePersistenceVersion } from '../../../app/context/persistence-context'
import { useWarehouses } from '../../../app/context/warehouse-context'
import { useBranches } from '../../../app/context/branch-context'
import { useAppPath } from '../../../app/routes/useAppPath'
import { Button, EmptyState, Table } from '../../../shared/ui'
import { EmployeeKpiBlock } from './EmployeeKpiBlock'
import { formatMoney } from '../../sales/pos-format'
import type { TranslationKey } from '../../../core/localization/translations'

type EmployeeSalesPanelProps = {
  user: User
}

const STATUS_LABEL: Record<SaleStatus, TranslationKey> = {
  draft: 'saleStatusDraft',
  confirmed: 'saleStatusConfirmed',
  completed: 'saleStatusCompleted',
  cancelled: 'saleStatusCancelled',
}

const METHOD_LABEL: Record<PaymentMethod, TranslationKey> = {
  cash: 'paymentCash',
  card: 'paymentCard',
  bank_transfer: 'paymentBankTransfer',
  invoice: 'paymentInvoice',
  on_credit: 'paymentOnCredit',
  other: 'paymentOther',
}

export function EmployeeSalesPanel({ user }: EmployeeSalesPanelProps) {
  const { t, locale } = useLocalization()
  const { navigate } = useAppPath()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const { getSalePayments } = usePayments()
  const { warehouses } = useWarehouses()
  const { branches } = useBranches()
  void version

  const listed = listSalesForManagedEmployeeForUser(persistence, currentUser, user.id)
  const sales = listed.ok ? listed.value.slice(0, 20) : []
  const warehouseName = (id?: string) =>
    warehouses.find((warehouse) => warehouse.id === id)?.name ?? '—'
  const branchNameForWarehouse = (warehouseId?: string) => {
    const warehouse = warehouses.find((item) => item.id === warehouseId)
    return warehouse
      ? branches.find((branch) => branch.id === warehouse.branchId)?.name ?? '—'
      : '—'
  }

  if (!listed.ok) {
    return (
      <div className="settings-section">
        <h3>{t('employeeTabSales')}</h3>
        <p className="workspace-muted">{t('ACCESS_DENIED')}</p>
      </div>
    )
  }

  return (
    <div className="settings-section">
      <h3>{t('employeeTabSales')}</h3>
      <EmployeeKpiBlock user={user} />
      {sales.length === 0 ? (
        <EmptyState title={t('employeeNoSales')} />
      ) : (
      <div className="employee-table-wrap">
        <Table>
          <thead>
            <tr>
              <th>{t('posSaleNumber')}</th>
              <th>{t('movementDate')}</th>
              <th>{t('saleTotal')}</th>
              <th>{t('payment')}</th>
              <th>{t('status')}</th>
              <th>{t('navBranches')}</th>
              <th>{t('navWarehouses')}</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => {
              const payment = getSalePayments(sale.id)[0]
              const numberLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU'

              return (
                <tr key={sale.id}>
                  <td>
                    <Button onClick={() => navigate(`/sales/${sale.id}`)}>
                      {sale.id.slice(-4).toUpperCase()}
                    </Button>
                  </td>
                  <td>{new Date(sale.createdAt).toLocaleString(numberLocale)}</td>
                  <td className="is-num">
                    {formatMoney(sale.total, locale, sale.currency)}
                  </td>
                  <td>{payment ? t(METHOD_LABEL[payment.method]) : '—'}</td>
                  <td>{t(STATUS_LABEL[sale.status])}</td>
                  <td>{branchNameForWarehouse(sale.warehouseId)}</td>
                  <td>{warehouseName(sale.warehouseId)}</td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </div>
      )}
    </div>
  )
}
