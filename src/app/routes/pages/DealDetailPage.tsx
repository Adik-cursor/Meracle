import { useState, type FormEvent } from 'react'
import { useAccess } from '../../context/access-context'
import { useCare } from '../../context/care-context'
import { useCompanies } from '../../context/company-context'
import { useContacts } from '../../context/contact-context'
import { useDeals } from '../../context/deal-context'
import type { DealDraft } from '../../context/deal-context'
import { useLocalization } from '../../context/localization-context'
import { useOrganization } from '../../context/organization-context'
import { useTasks } from '../../context/task-context'
import { useUsers } from '../../context/user-context'
import { useAppPath } from '../useAppPath'
import { getDealIdFromPath, usesCareCrmComposition } from '../app.routes'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { contactDisplayName } from '../../../modules/crm/customers/customer-name'
import { inquiryDisplayTitle } from '../../../modules/crm/deals/inquiry-types'
import { userDisplayName } from '../../../modules/crm/users/user-name'
import { DealForm } from '../../../modules/crm/deals/DealForm'
import type { TranslationKey } from '../../../core/localization/translations'
import type { DealStatus } from '../../../core/types'
import { ActionRow, Button, EmptyState, KpiStrip, PageHeader, RowMenu, StatusBadge } from '../../../shared/ui'
import { PagePlaceholder } from '../../../shared/components/PagePlaceholder'

const DEAL_STATUS_LABEL: Record<DealStatus, TranslationKey> = {
  new: 'dealStatusNew',
  in_progress: 'dealStatusInProgress',
  won: 'dealStatusWon',
  lost: 'dealStatusLost',
}

function dealStatusTone(status: DealStatus): 'info' | 'warning' | 'success' | 'danger' {
  if (status === 'won') {
    return 'success'
  }
  if (status === 'lost') {
    return 'danger'
  }
  if (status === 'in_progress') {
    return 'warning'
  }
  return 'info'
}

export function DealDetailPage() {
  const { t, locale } = useLocalization()
  const { pathname, navigate } = useAppPath()
  const { currentUser } = useAccess()
  const { modules, settings } = useOrganization()
  const inquiryMode = usesCareCrmComposition(modules)
  const { getDealAccess, deleteDeal, updateDeal } = useDeals()
  const { companies, getCompany } = useCompanies()
  const { contacts, getContact } = useContacts()
  const { users, getUser } = useUsers()
  const { getTasksByDeal, createTask } = useTasks()
  const care = useCare()
  const numberLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU'
  const dealId = getDealIdFromPath(pathname)
  const [comment, setComment] = useState('')
  const [editing, setEditing] = useState(false)

  if (!currentUser) {
    return <AuthRequiredState />
  }

  if (!dealId) {
    return (
      <PagePlaceholder
        title={t('dealNotFound')}
        description={t('pageNotFoundDescription')}
      />
    )
  }

  const access = getDealAccess(dealId)
  if (!access.ok) {
    if (access.code === 'DEAL_NOT_FOUND') {
      return (
        <PagePlaceholder
          title={t('dealNotFound')}
          description={t('pageNotFoundDescription')}
        />
      )
    }

    if (access.code === 'MODULE_NOT_ENABLED') {
      return (
        <PagePlaceholder
          title={t('MODULE_NOT_ENABLED')}
          description={t('MODULE_NOT_ENABLED')}
        />
      )
    }

    return (
      <PagePlaceholder title={t('ACCESS_DENIED')} description={t('ACCESS_DENIED')} />
    )
  }

  const deal = access.deal
  const company = deal.companyId ? getCompany(deal.companyId) : undefined
  const contact = deal.contactId ? getContact(deal.contactId) : undefined
  const owner = deal.ownerUserId
    ? getUser(deal.ownerUserId)
    : deal.assignedUserId
      ? getUser(deal.assignedUserId)
      : undefined
  const history = getTasksByDeal(deal.id)
  const linkedChildren =
    inquiryMode && contact
      ? care.childrenList.filter((child) => child.parentContactId === contact.id)
      : []
  const amountLabel =
    deal.amount === null
      ? '—'
      : `${deal.amount.toLocaleString(numberLocale)} ${deal.currency || settings.currency}`
  const createdLabel = new Date(deal.createdAt).toLocaleString(numberLocale)

  const addComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!comment.trim()) {
      return
    }
    const saved = createTask({
      title: comment.trim().slice(0, 80),
      description: comment.trim(),
      priority: 'medium',
      dealId: deal.id,
    })
    if (saved) {
      setComment('')
    }
  }

  const handleUpdate = (draft: DealDraft) => {
    const saved = updateDeal(deal.id, draft)
    if (saved) {
      setEditing(false)
    }
    return saved
  }

  if (editing) {
    return (
      <section className="workspace-page deal-detail">
        <DealForm
          deal={deal}
          contacts={contacts}
          companies={companies}
          users={users}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(false)}
        />
      </section>
    )
  }

  return (
    <section className="workspace-page deal-detail">
      <PageHeader
        title={
          inquiryMode
            ? inquiryDisplayTitle(deal.title, t)
            : deal.title.trim() || t('dealTitle')
        }
        actions={
          <ActionRow>
            <Button variant="ghost" onClick={() => navigate('/deals')}>
              ← {inquiryMode ? t('backToInquiries') : t('backToDeals')}
            </Button>
            <Button variant="primary" onClick={() => setEditing(true)}>
              {t('edit')}
            </Button>
            <RowMenu
              label={t('moreActions')}
              items={[
                {
                  id: 'delete',
                  label: inquiryMode ? t('deleteInquiry') : t('deleteDeal'),
                  danger: true,
                  onSelect: () => {
                    if (deleteDeal(deal.id)) {
                      navigate('/deals')
                    }
                  },
                },
              ]}
            />
          </ActionRow>
        }
      />

      <div className="deal-detail__summary">
        <StatusBadge tone={dealStatusTone(deal.status)}>
          {t(DEAL_STATUS_LABEL[deal.status])}
        </StatusBadge>
        <p className="deal-detail__id" aria-hidden="true">{deal.id}</p>
      </div>
      <KpiStrip
        items={[
          {
            id: 'party',
            label: inquiryMode ? t('inquiryParent') : t('dealContact'),
            value: contact ? contactDisplayName(contact) : '—',
          },
          {
            id: 'owner',
            label: t('dealAssignee'),
            value: owner ? userDisplayName(owner) : t('dealUnassigned'),
          },
          ...(inquiryMode
            ? []
            : [
                {
                  id: 'amount',
                  label: t('dealAmount'),
                  value: amountLabel,
                },
              ]),
          {
            id: 'created',
            label: t('createdAt'),
            value: createdLabel,
          },
        ]}
      />

      <div className="deal-detail__grid">
        <section className="deal-detail__col">
          <h3>{t('dealMainInfo')}</h3>
          {inquiryMode ? (
            <>
              <p>
                {t('inquiryPhone')}: {contact?.phone?.trim() || '—'}
              </p>
              <p>
                {t('inquiryChild')}:{' '}
                {linkedChildren.length === 0
                  ? '—'
                  : linkedChildren.map((child) => (
                      <Button
                        key={child.id}
                        variant="ghost"
                        onClick={() => navigate(`/children/${child.id}`)}
                      >
                        {`${child.firstName} ${child.lastName}`.trim()}
                      </Button>
                    ))}
              </p>
            </>
          ) : (
            <>
              <p>
                {t('dealTitle')}: {deal.title.trim() || '—'}
              </p>
              <p>
                {t('dealCompany')}: {company?.name ?? '—'}
              </p>
            </>
          )}
        </section>

        <section className="deal-detail__col">
          <h3>{t('dealActivity')}</h3>
          {history.length === 0 ? (
            <EmptyState title={t('noTasks')} />
          ) : (
            <ul className="employee-activity-list">
              {history
                .slice()
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((task) => (
                  <li key={task.id}>
                    {task.title}
                    {task.description ? ` — ${task.description}` : ''}
                    {' · '}
                    {new Date(task.createdAt).toLocaleString(numberLocale)}
                  </li>
                ))}
            </ul>
          )}
          {inquiryMode ? (
            <form className="warehouse-form" onSubmit={addComment}>
              <label className="warehouse-field">
                <span className="settings-field__label">{t('inquiryComment')}</span>
                <textarea
                  className="warehouse-input"
                  rows={3}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                />
              </label>
              <Button type="submit" variant="primary">
                {t('saveInquiryComment')}
              </Button>
            </form>
          ) : null}
        </section>
      </div>
    </section>
  )
}
