import { useMemo, useState } from 'react'
import { useAccess } from '../../context/access-context'
import { useBranches } from '../../context/branch-context'
import type { BranchDraft } from '../../context/branch-context'
import { useDepartments } from '../../context/department-context'
import { useLocalization } from '../../context/localization-context'
import { useUsers } from '../../context/user-context'
import type { Branch } from '../../../core/types'
import { BranchForm } from '../../../modules/crm/branches/BranchForm'
import { userDisplayName } from '../../../modules/crm/users/user-name'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { Badge, Button, EmptyState, KpiStrip, PageHeader, RowMenu, Table } from '../../../shared/ui'
import { useAppPath } from '../useAppPath'

export function BranchesPage() {
  const { t } = useLocalization()
  const { currentUser } = useAccess()
  const { navigate } = useAppPath()
  const { branches, createBranch, updateBranch, setBranchStatus } = useBranches()
  const { departments } = useDepartments()
  const { users } = useUsers()
  const [formMode, setFormMode] = useState<'closed' | 'create' | 'edit'>(
    'closed',
  )
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)

  const closeForm = () => {
    setFormMode('closed')
    setEditingBranch(null)
  }

  const selectedBranch =
    formMode === 'edit' && editingBranch
      ? branches.find((branch) => branch.id === editingBranch.id)
      : undefined

  const departmentCountByBranchId = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const department of departments) {
      counts[department.branchId] = (counts[department.branchId] ?? 0) + 1
    }
    return counts
  }, [departments])
  const employeeCountByBranchId = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const user of users) {
      if (!user.branchId) {
        continue
      }
      counts[user.branchId] = (counts[user.branchId] ?? 0) + 1
    }
    return counts
  }, [users])
  const directorByBranchId = useMemo(() => {
    const map: Record<string, string> = {}
    for (const user of users) {
      if (user.branchId && user.role === 'branch_director') {
        map[user.branchId] = userDisplayName(user)
      }
    }
    return map
  }, [users])

  const handleCreate = (draft: BranchDraft) => createBranch(draft)
  const handleUpdate = (draft: BranchDraft) =>
    selectedBranch ? updateBranch(selectedBranch.id, draft) : false

  if (!currentUser) {
    return <AuthRequiredState />
  }

  return (
    <section className="workspace-page">
      <PageHeader
        eyebrow={t('navCompanySection')}
        title={t('navBranches')}
        description={t('branchesLead')}
        actions={
          formMode === 'closed' ? (
            <Button variant="primary" onClick={() => setFormMode('create')}>
              {t('addBranch')}
            </Button>
          ) : null
        }
      />

      {branches.length > 0 ? (
        <KpiStrip
          items={[
            { id: 'branches', label: t('navBranches'), value: String(branches.length) },
            {
              id: 'active',
              label: t('active'),
              value: String(branches.filter((branch) => branch.status === 'active').length),
            },
            { id: 'employees', label: t('navEmployees'), value: String(users.length) },
          ]}
        />
      ) : null}

      {formMode === 'create' ? (
        <BranchForm onSubmit={handleCreate} onCancel={closeForm} />
      ) : null}

      {formMode === 'edit' && selectedBranch ? (
        <BranchForm
          key={`${selectedBranch.id}-${selectedBranch.updatedAt}`}
          branch={selectedBranch}
          onSubmit={handleUpdate}
          onCancel={closeForm}
        />
      ) : null}

      {branches.length === 0 && formMode === 'closed' ? (
        <EmptyState
          title={t('noBranches')}
          action={
            <Button variant="primary" onClick={() => setFormMode('create')}>
              {t('addBranch')}
            </Button>
          }
        />
      ) : null}

      {branches.length > 0 ? (
        <Table className="entity-table" mobileLayout="cards">
          <thead>
            <tr>
              <th>{t('name')}</th>
              <th>{t('branchAddress')}</th>
              <th>{t('branchManager')}</th>
              <th className="is-num">{t('navEmployees')}</th>
              <th className="is-num">{t('departmentCount')}</th>
              <th>{t('status')}</th>
              <th>{t('transferActions')}</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((branch) => {
              const isActive = branch.status === 'active'

              return (
                <tr key={branch.id}>
                  <td>
                    <div className="entity-cell">
                      <span className="entity-cell__title">{branch.name}</span>
                      <span className="entity-cell__meta">
                        {t('code')} {branch.code ?? t('dealPartyNone')}
                      </span>
                    </div>
                  </td>
                  <td className="entity-cell__meta">—</td>
                  <td>{directorByBranchId[branch.id] ?? '—'}</td>
                  <td className="is-num">
                    <span className="entity-metric__value">
                      {employeeCountByBranchId[branch.id] ?? 0}
                    </span>
                  </td>
                  <td className="is-num">{departmentCountByBranchId[branch.id] ?? 0}</td>
                  <td>
                    <Badge tone={isActive ? 'success' : 'neutral'}>
                      {isActive ? t('active') : t('inactive')}
                    </Badge>
                  </td>
                  <td>
                    <div className="action-row">
                      <Button onClick={() => navigate(`/company/branches/${branch.id}`)}>
                        {t('openDeal')}
                      </Button>
                      <RowMenu
                        label={t('moreActions')}
                        items={[
                          {
                            id: 'edit',
                            label: t('edit'),
                            onSelect: () => {
                              setEditingBranch(branch)
                              setFormMode('edit')
                            },
                          },
                          {
                            id: 'status',
                            label: isActive ? t('turnOff') : t('turnOn'),
                            danger: isActive,
                            onSelect: () =>
                              setBranchStatus(branch.id, isActive ? 'inactive' : 'active'),
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      ) : null}
    </section>
  )
}
