import { useMemo, useState } from 'react'
import { useAccess } from '../../context/access-context'
import { useBranches } from '../../context/branch-context'
import { useDepartments } from '../../context/department-context'
import type { DepartmentDraft } from '../../context/department-context'
import { useLocalization } from '../../context/localization-context'
import { useUsers } from '../../context/user-context'
import type { Department } from '../../../core/types'
import { DepartmentForm } from '../../../modules/crm/departments/DepartmentForm'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { Badge, Button, EmptyState, Table } from '../../../shared/ui'

export function DepartmentsPage() {
  const { t } = useLocalization()
  const { currentUser } = useAccess()
  const { branches } = useBranches()
  const { departments, createDepartment, updateDepartment, setDepartmentStatus } =
    useDepartments()
  const { users } = useUsers()
  const [branchFilter, setBranchFilter] = useState('')
  const [formMode, setFormMode] = useState<'closed' | 'create' | 'edit'>(
    'closed',
  )
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(
    null,
  )

  const closeForm = () => {
    setFormMode('closed')
    setEditingDepartment(null)
  }

  const selectedDepartment =
    formMode === 'edit' && editingDepartment
      ? departments.find((department) => department.id === editingDepartment.id)
      : undefined

  const branchNameById = useMemo(
    () => Object.fromEntries(branches.map((branch) => [branch.id, branch.name])),
    [branches],
  )
  const userCountByDepartmentId = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const user of users) {
      if (!user.departmentId) {
        continue
      }
      counts[user.departmentId] = (counts[user.departmentId] ?? 0) + 1
    }
    return counts
  }, [users])

  const visibleDepartments = branchFilter
    ? departments.filter((department) => department.branchId === branchFilter)
    : departments

  const handleCreate = (draft: DepartmentDraft) => createDepartment(draft)
  const handleUpdate = (draft: DepartmentDraft) =>
    selectedDepartment
      ? updateDepartment(selectedDepartment.id, draft)
      : false

  if (!currentUser) {
    return <AuthRequiredState />
  }

  return (
    <section className="workspace-page">
      <div className="workspace-toolbar workspace-toolbar--pipeline">
        <h2 className="workspace-toolbar__title">{t('navDepartments')}</h2>
        <select
          className="warehouse-input"
          aria-label={t('navBranches')}
          value={branchFilter}
          onChange={(event) => setBranchFilter(event.target.value)}
        >
          <option value="">{t('allBranches')}</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
        {formMode === 'closed' ? (
          <Button variant="primary" onClick={() => setFormMode('create')}>
            {t('addDepartment')}
          </Button>
        ) : null}
      </div>

      {formMode === 'create' ? (
        <DepartmentForm
          branches={branches}
          onSubmit={handleCreate}
          onCancel={closeForm}
        />
      ) : null}

      {formMode === 'edit' && selectedDepartment ? (
        <DepartmentForm
          key={`${selectedDepartment.id}-${selectedDepartment.updatedAt}`}
          department={selectedDepartment}
          branches={branches}
          onSubmit={handleUpdate}
          onCancel={closeForm}
        />
      ) : null}

      {visibleDepartments.length === 0 && formMode === 'closed' ? (
        <EmptyState
          title={t('noDepartments')}
          action={
            <Button variant="primary" onClick={() => setFormMode('create')}>
              {t('addDepartment')}
            </Button>
          }
        />
      ) : null}

      {visibleDepartments.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <th>{t('name')}</th>
              <th>{t('code')}</th>
              <th>{t('navBranches')}</th>
              <th>{t('branchManager')}</th>
              <th>{t('status')}</th>
              <th>{t('employeeCount')}</th>
              <th>{t('transferActions')}</th>
            </tr>
          </thead>
          <tbody>
            {visibleDepartments.map((department) => {
              const isActive = department.status === 'active'

              return (
                <tr key={department.id}>
                  <td>{department.name}</td>
                  <td>{department.code ?? t('dealPartyNone')}</td>
                  <td>
                    {branchNameById[department.branchId] ?? t('dealPartyNone')}
                  </td>
                  <td>—</td>
                  <td>
                    <Badge tone={isActive ? 'success' : 'neutral'}>
                      {isActive ? t('active') : t('inactive')}
                    </Badge>
                  </td>
                  <td>{userCountByDepartmentId[department.id] ?? 0}</td>
                  <td>
                    <div className="warehouse-card__actions">
                      <Button
                        onClick={() => {
                          setEditingDepartment(department)
                          setFormMode('edit')
                        }}
                      >
                        {t('edit')}
                      </Button>
                      <Button
                        variant={isActive ? 'danger' : 'secondary'}
                        onClick={() =>
                          setDepartmentStatus(
                            department.id,
                            isActive ? 'inactive' : 'active',
                          )
                        }
                      >
                        {isActive ? t('turnOff') : t('turnOn')}
                      </Button>
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
