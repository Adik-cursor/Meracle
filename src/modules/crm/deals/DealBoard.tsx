import type { Deal, DealStatus } from '../../../core/types'
import type { TranslationKey } from '../../../core/localization/translations'
import { useLocalization } from '../../../app/context/localization-context'
import { Kanban } from '../../../shared/ui'
import { DealCard } from './DealCard'

type DealBoardProps = {
  deals: Deal[]
  companyNameById: Record<string, string>
  contactNameById: Record<string, string>
  userNameById: Record<string, string>
  onOpenDeal?: (deal: Deal) => void
  onStatusChange?: (deal: Deal, status: DealStatus) => void
}

const DEAL_BOARD_COLUMNS: DealStatus[] = [
  'new',
  'in_progress',
  'won',
  'lost',
]

const STATUS_LABEL: Record<DealStatus, TranslationKey> = {
  new: 'dealStatusNew',
  in_progress: 'dealStatusInProgress',
  won: 'dealStatusWon',
  lost: 'dealStatusLost',
}

export function DealBoard({
  deals,
  companyNameById,
  contactNameById,
  userNameById,
  onOpenDeal,
  onStatusChange,
}: DealBoardProps) {
  const { locale, t } = useLocalization()
  const numberLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU'

  return (
    <Kanban
      columns={DEAL_BOARD_COLUMNS.map((status) => {
        const items = deals.filter((deal) => deal.status === status)
        const total = items.reduce(
          (sum, deal) => sum + (deal.amount ?? 0),
          0,
        )
        const currency = items.find((deal) => deal.currency)?.currency

        return {
          id: status,
          title: t(STATUS_LABEL[status]),
          count: items.length,
          total: currency
            ? `${total.toLocaleString(numberLocale)} ${currency}`
            : total.toLocaleString(numberLocale),
          children:
            items.length === 0 ? (
              <p className="kanban__empty">{t('dealEmptyColumn')}</p>
            ) : (
              items.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  companyName={
                    deal.companyId
                      ? companyNameById[deal.companyId]
                      : undefined
                  }
                  contactName={
                    deal.contactId
                      ? contactNameById[deal.contactId]
                      : undefined
                  }
                  assigneeName={
                    deal.assignedUserId
                      ? userNameById[deal.assignedUserId]
                      : undefined
                  }
                  onOpen={onOpenDeal}
                  onStatusChange={onStatusChange}
                />
              ))
            ),
        }
      })}
    />
  )
}
