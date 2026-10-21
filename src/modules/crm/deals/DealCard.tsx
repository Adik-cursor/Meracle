import type { Deal, DealStatus } from '../../../core/types'
import type { TranslationKey } from '../../../core/localization/translations'
import { useLocalization } from '../../../app/context/localization-context'
import { useTasks } from '../../../app/context/task-context'
import { Badge } from '../../../shared/ui'

type DealCardProps = {
  deal: Deal
  companyName?: string
  contactName?: string
  assigneeName?: string
  onOpen?: (deal: Deal) => void
  onStatusChange?: (deal: Deal, status: DealStatus) => void
}

const STATUS_TONE: Record<DealStatus, 'info' | 'warning' | 'success' | 'danger'> =
  {
    new: 'info',
    in_progress: 'warning',
    won: 'success',
    lost: 'danger',
  }

const STATUS_LABEL: Record<DealStatus, TranslationKey> = {
  new: 'dealStatusNew',
  in_progress: 'dealStatusInProgress',
  won: 'dealStatusWon',
  lost: 'dealStatusLost',
}

const STATUSES: DealStatus[] = ['new', 'in_progress', 'won', 'lost']

export function DealCard({
  deal,
  companyName,
  contactName,
  assigneeName,
  onOpen,
  onStatusChange,
}: DealCardProps) {
  const { locale, t } = useLocalization()
  const { getTasksByDeal } = useTasks()
  const numberLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU'
  const title = deal.title.trim() || deal.id
  const party = [companyName, contactName].filter(Boolean).join(' · ')
  const taskCount = getTasksByDeal(deal.id).length

  return (
    <article className="kanban-card kanban-card--deal">
      <button
        type="button"
        className="kanban-card__open"
        onClick={() => onOpen?.(deal)}
      >
        <div className="kanban-card__top">
          <strong className="kanban-card__name">{title}</strong>
          <Badge tone={STATUS_TONE[deal.status]}>{t(STATUS_LABEL[deal.status])}</Badge>
        </div>
        {party ? <p className="kanban-card__meta">{party}</p> : null}
        {deal.amount !== null ? (
          <p className="kanban-card__amount">
            {deal.amount.toLocaleString(numberLocale)} {deal.currency}
          </p>
        ) : null}
        <p className="kanban-card__date">
          {new Date(deal.createdAt).toLocaleDateString(numberLocale)}
        </p>
        <p className="kanban-card__meta">
          {t('dealAssignee')}: {assigneeName ?? t('dealUnassigned')}
        </p>
        <p className="kanban-card__meta">
          {t('dealTaskCount')}: {taskCount}
        </p>
      </button>
      {onStatusChange ? (
        <select
          className="warehouse-input"
          aria-label={t('changeDealStatus')}
          value={deal.status}
          onChange={(event) =>
            onStatusChange(deal, event.target.value as DealStatus)
          }
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(STATUS_LABEL[status])}
            </option>
          ))}
        </select>
      ) : null}
    </article>
  )
}
