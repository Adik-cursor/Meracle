import { useMemo, useState } from 'react'
import { useCompanies } from '../../context/company-context'
import { useContacts } from '../../context/contact-context'
import { useDeals } from '../../context/deal-context'
import type { DealDraft } from '../../context/deal-context'
import { useAccess } from '../../context/access-context'
import { useLocalization } from '../../context/localization-context'
import { useOrganization } from '../../context/organization-context'
import { useTasks } from '../../context/task-context'
import { useUsers } from '../../context/user-context'
import type { Deal } from '../../../core/types'
import { contactDisplayName } from '../../../modules/crm/customers/customer-name'
import { userDisplayName } from '../../../modules/crm/users/user-name'
import { DealForm } from '../../../modules/crm/deals/DealForm'
import { DealList } from '../../../modules/crm/deals/DealList'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { Button, EmptyState, FilterBar, Input, PageHeader } from '../../../shared/ui'
import { useAppPath } from '../useAppPath'
import { usesCareCrmComposition } from '../app.routes'

export function DealsPage() {
  const { t } = useLocalization()
  const { modules } = useOrganization()
  const inquiryMode = usesCareCrmComposition(modules)
  const { currentUser } = useAccess()
  const { companies } = useCompanies()
  const { contacts } = useContacts()
  const { deals, createDeal, updateDeal, setDealStatus, searchDeals } = useDeals()
  const { createTask } = useTasks()
  const { navigate } = useAppPath()
  const [query, setQuery] = useState('')
  const { users } = useUsers()
  const [formMode, setFormMode] = useState<'closed' | 'create' | 'edit'>(
    'closed',
  )
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)

  const closeForm = () => {
    setFormMode('closed')
    setEditingDeal(null)
  }

  const selectedDeal =
    formMode === 'edit' && editingDeal
      ? deals.find((deal) => deal.id === editingDeal.id)
      : undefined

  const companyNameById = useMemo(
    () =>
      Object.fromEntries(companies.map((company) => [company.id, company.name])),
    [companies],
  )
  const contactNameById = useMemo(
    () =>
      Object.fromEntries(
        contacts.map((contact) => [contact.id, contactDisplayName(contact)]),
      ),
    [contacts],
  )
  const userNameById = useMemo(
    () =>
      Object.fromEntries(users.map((user) => [user.id, userDisplayName(user)])),
    [users],
  )

  const visibleDeals = searchDeals(query)

  const handleCreate = (draft: DealDraft, extras?: { comment?: string }) => {
    const created = createDeal(draft)
    if (created && extras?.comment) {
      createTask({
        title: extras.comment.slice(0, 80),
        description: extras.comment,
        priority: 'medium',
        dealId: created.id,
      })
    }
    return Boolean(created)
  }
  const handleUpdate = (draft: DealDraft, extras?: { comment?: string }) => {
    if (!selectedDeal) {
      return false
    }
    const updated = updateDeal(selectedDeal.id, draft)
    if (updated && extras?.comment) {
      createTask({
        title: extras.comment.slice(0, 80),
        description: extras.comment,
        priority: 'medium',
        dealId: selectedDeal.id,
      })
    }
    return updated
  }

  if (!currentUser) {
    return <AuthRequiredState />
  }

  return (
    <section className="workspace-page">
      <PageHeader
        title={inquiryMode ? t('crmInquiries') : t('navDeals')}
        actions={
          formMode === 'closed' ? (
            <Button variant="primary" onClick={() => setFormMode('create')}>
              {inquiryMode ? t('newInquiry') : t('newDeal')}
            </Button>
          ) : null
        }
      />

      {formMode === 'closed' ? (
        <FilterBar
          search={
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={inquiryMode ? t('crmInquiries') : t('dealSearch')}
              placeholder={inquiryMode ? t('crmInquiries') : t('dealSearch')}
            />
          }
        />
      ) : null}

      {formMode === 'create' ? (
        <DealForm
          contacts={contacts}
          companies={companies}
          users={users}
          onSubmit={handleCreate}
          onCancel={closeForm}
        />
      ) : null}

      {formMode === 'edit' && selectedDeal ? (
        <DealForm
          key={`${selectedDeal.id}-${selectedDeal.updatedAt}`}
          deal={selectedDeal}
          contacts={contacts}
          companies={companies}
          users={users}
          onSubmit={handleUpdate}
          onCancel={closeForm}
        />
      ) : null}

      {deals.length === 0 && formMode === 'closed' ? (
        <EmptyState
          title={inquiryMode ? t('noInquiries') : t('noDeals')}
          action={
            <Button variant="primary" onClick={() => setFormMode('create')}>
              {inquiryMode ? t('newInquiry') : t('newDeal')}
            </Button>
          }
        />
      ) : null}

      {visibleDeals.length > 0 ? (
        <DealList
          deals={visibleDeals}
          companyNameById={companyNameById}
          contactNameById={contactNameById}
          userNameById={userNameById}
          onOpen={(deal) => navigate(`/deals/${deal.id}`)}
          onEdit={(deal) => {
            setEditingDeal(deal)
            setFormMode('edit')
          }}
          onStatusChange={(deal, status) => setDealStatus(deal.id, status)}
        />
      ) : null}
    </section>
  )
}
