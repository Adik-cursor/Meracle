import { useMemo, useState } from 'react'
import { useAuth } from '../../context/auth-context'
import { useCompanies } from '../../context/company-context'
import { useContacts } from '../../context/contact-context'
import { useDeals } from '../../context/deal-context'
import type { DealDraft } from '../../context/deal-context'
import { useLocalization } from '../../context/localization-context'
import { useOrganization } from '../../context/organization-context'
import { useTasks } from '../../context/task-context'
import { useUsers } from '../../context/user-context'
import type { Deal } from '../../../core/types'
import { contactDisplayName } from '../../../modules/crm/customers/customer-name'
import { userDisplayName } from '../../../modules/crm/users/user-name'
import { DealBoard } from '../../../modules/crm/deals/DealBoard'
import { DealForm } from '../../../modules/crm/deals/DealForm'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { Button, Input } from '../../../shared/ui'
import { getAccessScope } from '../../../core/types'
import { useAppPath } from '../useAppPath'

export function DashboardPage() {
  const { t, locale } = useLocalization()
  const { currentUser } = useAuth()
  const { settings } = useOrganization()
  const { companies } = useCompanies()
  const { contacts } = useContacts()
  const { deals, createDeal, updateDeal, setDealStatus, searchDeals } = useDeals()
  const { navigate } = useAppPath()
  const { users } = useUsers()
  const { tasks } = useTasks()
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'mine' | 'team'>('team')
  const [formMode, setFormMode] = useState<'closed' | 'create' | 'edit'>(
    'closed',
  )
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)
  const numberLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU'

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
  const currentUserId = currentUser?.id ?? null
  const canUseTeamView =
    currentUser !== null && getAccessScope(currentUser.role) !== 'own'
  const viewScope = canUseTeamView ? scope : 'mine'
  const today = useMemo(() => {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${now.getFullYear()}-${month}-${day}`
  }, [])
  const tasksDueToday = useMemo(
    () => tasks.filter((task) => task.dueDate === today),
    [tasks, today],
  )

  const visibleDeals = useMemo(() => {
    const scoped = searchDeals(query)
    if (viewScope === 'mine' && currentUserId) {
      return scoped.filter((deal) => deal.assignedUserId === currentUserId)
    }
    return scoped
  }, [currentUserId, query, searchDeals, viewScope])

  const openDeals = visibleDeals.filter((deal) => deal.status === 'in_progress')
  const newDeals = visibleDeals.filter((deal) => deal.status === 'new')
  const openAmount = openDeals.reduce((sum, deal) => sum + (deal.amount ?? 0), 0)

  const stats = [
    {
      label: t('pipelineTotalDeals'),
      value: visibleDeals.length.toLocaleString(numberLocale),
    },
    {
      label: t('pipelineOpenDeals'),
      value: openDeals.length.toLocaleString(numberLocale),
    },
    {
      label: t('pipelineOpenAmount'),
      value: `${openAmount.toLocaleString(numberLocale)} ${settings.currency}`,
    },
    {
      label: t('pipelineNewDeals'),
      value: newDeals.length.toLocaleString(numberLocale),
    },
  ]

  const handleCreate = (draft: DealDraft) => Boolean(createDeal(draft))
  const handleUpdate = (draft: DealDraft) =>
    selectedDeal ? updateDeal(selectedDeal.id, draft) : false

  if (!currentUser) {
    return <AuthRequiredState />
  }

  return (
    <section className="workspace-page pipeline-page">
      <div className="workspace-toolbar workspace-toolbar--pipeline">
        <h2 className="workspace-toolbar__title">{t('myDeals')}</h2>
        <div className="scope-switch" role="group" aria-label={t('myDeals')}>
          <button
            type="button"
            className={
              viewScope === 'mine'
                ? 'scope-switch__btn scope-switch__btn--active'
                : 'scope-switch__btn'
            }
            onClick={() => setScope('mine')}
          >
            {t('myDeals')}
          </button>
          <button
            type="button"
            className={
              viewScope === 'team'
                ? 'scope-switch__btn scope-switch__btn--active'
                : 'scope-switch__btn'
            }
            disabled={!canUseTeamView}
            title={
              !canUseTeamView ? t('teamViewUnavailable') : undefined
            }
            onClick={() => {
              if (canUseTeamView) {
                setScope('team')
              }
            }}
          >
            {t('allTeam')}
          </button>
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t('searchDeal')}
          placeholder={t('searchPlaceholder')}
        />
        {formMode === 'closed' ? (
          <Button variant="primary" onClick={() => setFormMode('create')}>
            {t('newDeal')}
          </Button>
        ) : null}
      </div>

      <div className="pipeline-stats">
        {stats.map((card) => (
          <article key={card.label} className="pipeline-stat">
            <p className="pipeline-stat__label">{card.label}</p>
            <p className="pipeline-stat__value">{card.value}</p>
          </article>
        ))}
      </div>

      <div className="pipeline-stats">
        <article className="pipeline-stat">
          <p className="pipeline-stat__label">{t('myTasks')}</p>
          <p className="pipeline-stat__value">
            {tasks
              .filter((task) => task.assignedUserId === currentUser.id)
              .length.toLocaleString(numberLocale)}
          </p>
        </article>
        <article className="pipeline-stat">
          <p className="pipeline-stat__label">{t('tasksDueToday')}</p>
          <p className="pipeline-stat__value">
            {tasksDueToday.length.toLocaleString(numberLocale)}
          </p>
          {tasksDueToday.length === 0 ? (
            <p className="workspace-muted">{t('noTasksDueToday')}</p>
          ) : (
            <p className="workspace-muted">
              {tasksDueToday.map((task) => task.title).join(', ')}
            </p>
          )}
        </article>
      </div>

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

      <DealBoard
        deals={visibleDeals}
        companyNameById={companyNameById}
        contactNameById={contactNameById}
        userNameById={userNameById}
        onOpenDeal={(deal) => navigate(`/deals/${deal.id}`)}
        onStatusChange={(deal, status) => setDealStatus(deal.id, status)}
      />
    </section>
  )
}
