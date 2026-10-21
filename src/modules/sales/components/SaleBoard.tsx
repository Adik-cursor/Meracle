import type { TranslationKey } from '../../../core/localization/translations'
import type { SaleRecord } from '../../../app/context/sales-context'
import type { SaleStatus } from '../../../core/types'
import { useLocalization } from '../../../app/context/localization-context'
import { Kanban } from '../../../shared/ui'
import { SaleBoardCard } from './SaleBoardCard'

type SaleBoardProps = {
  records: SaleRecord[]
  warehouseNameById: Record<string, string>
  customerNameById: Record<string, string>
  onConfirm: (id: string) => void
  onComplete: (id: string) => void
  onCancel: (id: string) => void
  actionErrorById: Record<string, string>
}

const STATUS_LABEL: Record<SaleStatus, TranslationKey> = {
  draft: 'saleStatusDraft',
  confirmed: 'saleStatusConfirmed',
  completed: 'saleStatusCompleted',
  cancelled: 'saleStatusCancelled',
}

const SALE_BOARD_COLUMNS: SaleStatus[] = [
  'draft',
  'confirmed',
  'completed',
  'cancelled',
]

export function SaleBoard({
  records,
  warehouseNameById,
  customerNameById,
  onConfirm,
  onComplete,
  onCancel,
  actionErrorById,
}: SaleBoardProps) {
  const { t } = useLocalization()

  return (
    <Kanban
      columns={SALE_BOARD_COLUMNS.map((status) => {
        const items = records.filter((record) => record.sale.status === status)

        return {
          id: status,
          title: t(STATUS_LABEL[status]),
          count: items.length,
          children:
            items.length === 0 ? (
              <p className="kanban__empty">{t('kanbanEmpty')}</p>
            ) : (
              items.map((record) => (
                <SaleBoardCard
                  key={record.sale.id}
                  record={record}
                  warehouseName={
                    record.sale.warehouseId
                      ? (warehouseNameById[record.sale.warehouseId] ??
                        record.sale.warehouseId)
                      : ''
                  }
                  customerName={
                    record.sale.customerId
                      ? (customerNameById[record.sale.customerId] ??
                        record.sale.customerId)
                      : t('customerNotSelected')
                  }
                  onConfirm={onConfirm}
                  onComplete={onComplete}
                  onCancel={onCancel}
                  actionError={actionErrorById[record.sale.id] ?? null}
                />
              ))
            ),
        }
      })}
    />
  )
}
