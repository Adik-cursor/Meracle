import type { Deal, DealStatus } from '../../../core/types'
import type { TranslationKey } from '../../../core/localization/translations'
import { useLocalization } from '../../../app/context/localization-context'
import { useOrganization } from '../../../app/context/organization-context'
import { usesCareCrmComposition } from '../../../app/routes/app.routes'
import { inquiryDisplayTitle } from './inquiry-types'
import { ActionRow, Button, Select, StatusBadge, Table } from '../../../shared/ui'

type DealListProps = {
  deals: Deal[]
  companyNameById: Record<string, string>
  contactNameById: Record<string, string>
  userNameById: Record<string, string>
  onEdit: (deal: Deal) => void
  onOpen: (deal: Deal) => void
  onStatusChange: (deal: Deal, status: DealStatus) => void
}

const STATUS_LABEL: Record<DealStatus, TranslationKey> = {
  new: 'dealStatusNew',
  in_progress: 'dealStatusInProgress',
  won: 'dealStatusWon',
  lost: 'dealStatusLost',
}

const STATUSES: DealStatus[] = ['new', 'in_progress', 'won', 'lost']

export function DealList({
  deals,
  companyNameById,
  contactNameById,
  userNameById,
  onEdit,
  onOpen,
  onStatusChange,
}: DealListProps) {
  const { locale, t } = useLocalization()
  const { modules } = useOrganization()
  const inquiryMode = usesCareCrmComposition(modules)
  const numberLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU'

  return (
    <Table>
      <thead>
        <tr>
          <th>{inquiryMode ? t('inquiryType') : t('dealTitle')}</th>
          {inquiryMode ? null : <th>{t('dealCompany')}</th>}
          <th>{inquiryMode ? t('inquiryParent') : t('dealContact')}</th>
          <th>{t('dealAssignee')}</th>
          {inquiryMode ? null : <th className="is-num">{t('dealAmount')}</th>}
          <th>{t('status')}</th>
          <th>{inquiryMode ? t('inquiryDate') : t('movementDate')}</th>
          <th>{t('transferActions')}</th>
        </tr>
      </thead>
      <tbody>
        {deals.map((deal) => {
          const partyCompany = deal.companyId
            ? companyNameById[deal.companyId]
            : undefined
          const partyContact = deal.contactId
            ? contactNameById[deal.contactId]
            : undefined

          return (
            <tr key={deal.id}>
              <td>
                <span className="entity-cell__title">{inquiryDisplayTitle(deal.title, t)}</span>
              </td>
              {inquiryMode ? null : <td>{partyCompany ?? '—'}</td>}
              <td>{partyContact ?? '—'}</td>
              <td>
                {deal.assignedUserId
                  ? (userNameById[deal.assignedUserId] ?? t('dealUnassigned'))
                  : t('dealUnassigned')}
              </td>
              {inquiryMode ? null : (
              <td className="is-num">
                {deal.amount === null
                  ? '—'
                  : `${deal.amount.toLocaleString(numberLocale)} ${deal.currency}`}
              </td>
              )}
              <td>
                <StatusBadge
                  tone={
                    deal.status === 'won'
                      ? 'success'
                      : deal.status === 'lost'
                        ? 'danger'
                        : deal.status === 'in_progress'
                          ? 'warning'
                          : 'info'
                  }
                >
                  {t(STATUS_LABEL[deal.status])}
                </StatusBadge>
              </td>
              <td>{new Date(deal.createdAt).toLocaleDateString(numberLocale)}</td>
              <td>
                <ActionRow>
                  <Select
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
                  </Select>
                  <Button onClick={() => onOpen(deal)}>
                    {inquiryMode ? t('openInquiry') : t('openDeal')}
                  </Button>
                  <Button onClick={() => onEdit(deal)}>{t('edit')}</Button>
                </ActionRow>
              </td>
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}
