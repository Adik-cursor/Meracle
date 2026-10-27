import { useState } from 'react'
import { useAccess } from '../../context/access-context'
import { useLocalization } from '../../context/localization-context'
import { usePersistence } from '../../context/persistence-context'
import { usePlatform } from '../../context/platform-context'
import type { UserDraft } from '../../context/user-context'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { PagePlaceholder } from '../../../shared/components/PagePlaceholder'
import { Badge, Button, EmptyState, Modal, Table } from '../../../shared/ui'
import { PLATFORM_MODULE_KEYS, USER_ROLES } from '../../../core/types'
import type { User, UserStatus } from '../../../core/types'
import {
  PLATFORM_MODULE_DESCRIPTION_KEY,
  PLATFORM_MODULE_LABEL_KEY,
} from '../../../modules/platform/platform-module-label'
import { UserForm } from '../../../modules/crm/users/UserForm'
import { userDisplayName } from '../../../modules/crm/users/user-name'
import { USER_ROLE_LABEL_KEY } from '../../../modules/crm/users/user-role-label'
import { USER_STATUS_LABEL_KEY } from '../../../modules/crm/users/employee-status-label'
import {
  canAssignCompanyRoleForPlatformUser,
  isPlatformOwner,
} from '../../../core/services'
import { businessTypeLabelKey } from '../../../modules/platform/business-type-label'
import { organizationStatusLabelKey } from '../../../modules/platform/organization-status-label'
import { getPlatformOrganizationIdFromPath } from '../app.routes'
import { useAppPath } from '../useAppPath'

function statusTone(status: UserStatus) {
  return status === 'active' ? 'success' : status === 'invited' ? 'info' : 'neutral'
}

export function PlatformOrganizationModulesPage() {
  const { t } = useLocalization()
  const { pathname } = useAppPath()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const organizationId = getPlatformOrganizationIdFromPath(pathname)
  const {
    getOrganization,
    getCompanyPeople,
    createCompanyUser,
    getCompanyUser,
    denied,
    setModuleEnabled,
    businessTypes,
  } = usePlatform()
  const [creating, setCreating] = useState(false)
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)

  if (denied) {
    return (
      <PagePlaceholder title={t('ACCESS_DENIED')} description={t('ACCESS_DENIED')} />
    )
  }

  if (!organizationId) {
    return (
      <PagePlaceholder
        title={t('pageNotFound')}
        description={t('pageNotFoundDescription')}
      />
    )
  }

  const view = getOrganization(organizationId)
  const people = getCompanyPeople(organizationId)
  if (!view || !people) {
    return <AuthRequiredState />
  }

  const canAdd = isPlatformOwner(currentUser)
  const assignableRoles = USER_ROLES.filter((role) =>
    canAssignCompanyRoleForPlatformUser(
      persistence,
      currentUser,
      organizationId,
      role,
    ),
  )
  const viewingUser = viewingUserId
    ? getCompanyUser(organizationId, viewingUserId)
    : undefined
  const statusByKey = Object.fromEntries(
    view.modules.map((module) => [module.moduleKey, module.status]),
  )
  const branchName = (id?: string) =>
    people.branches.find((branch) => branch.id === id)?.name ?? '—'
  const departmentName = (id?: string) =>
    people.departments.find((department) => department.id === id)?.name ?? '—'
  const typeId = view.organization.businessTypeId
  const typeLabelKey = typeId ? businessTypeLabelKey(typeId) : undefined
  const typeRecord = businessTypes.find((item) => item.id === typeId)
  const typeLabel = typeLabelKey ? t(typeLabelKey) : typeRecord?.name ?? '—'

  const handleCreate = (draft: UserDraft) =>
    createCompanyUser(organizationId, draft)

  const renderIdentity = (user: User) => (
    <dl className="platform-company-meta">
      <div>
        <dt>{t('employeeFullName')}</dt>
        <dd>{userDisplayName(user)}</dd>
      </div>
      <div>
        <dt>{t('email')}</dt>
        <dd>{user.email}</dd>
      </div>
      <div>
        <dt>{t('employeePhone')}</dt>
        <dd>{user.phone ?? '—'}</dd>
      </div>
      <div>
        <dt>{t('employeeJobTitle')}</dt>
        <dd>{user.jobTitle ?? '—'}</dd>
      </div>
      <div>
        <dt>{t('userRole')}</dt>
        <dd>{t(USER_ROLE_LABEL_KEY[user.role])}</dd>
      </div>
      <div>
        <dt>{t('navBranches')}</dt>
        <dd>{branchName(user.branchId)}</dd>
      </div>
      <div>
        <dt>{t('navDepartments')}</dt>
        <dd>{departmentName(user.departmentId)}</dd>
      </div>
      <div>
        <dt>{t('status')}</dt>
        <dd>{t(USER_STATUS_LABEL_KEY[user.status])}</dd>
      </div>
    </dl>
  )

  return (
    <section className="workspace-page platform-company-stack">
      <div className="workspace-toolbar">
        <h2 className="workspace-toolbar__title">{view.organization.name}</h2>
      </div>

      <div className="settings-section">
        <h3>{t('platformCompanyInfo')}</h3>
        <dl className="platform-company-meta">
          <div className="platform-company-meta__organization">
            <dt>{t('organizationName')}</dt>
            <dd>{view.organization.name}</dd>
          </div>
          <div>
            <dt>{t('status')}</dt>
            <dd>{t(organizationStatusLabelKey(view.organization.status))}</dd>
          </div>
          <div>
            <dt>{t('platformBusinessType')}</dt>
            <dd>{typeLabel}</dd>
          </div>
          <div>
            <dt>{t('platformOwnerName')}</dt>
            <dd>{view.owner ? userDisplayName(view.owner) : '—'}</dd>
          </div>
          {view.owner ? (
            <div className="platform-company-meta__owner-email">
              <dt>{t('ownerEmail')}</dt>
              <dd>{view.owner.email}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="settings-section">
        <div className="platform-people-head">
          <div>
            <h3>{t('navEmployees')}</h3>
            <p className="platform-people-count">
              {t('navEmployees')}: {people.users.length}
            </p>
          </div>
          {canAdd ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              {t('addUser')}
            </Button>
          ) : null}
        </div>

        {people.users.length === 0 ? (
          <EmptyState title={t('noUsers')} />
        ) : (
          <Table mobileLayout="cards">
            <thead>
              <tr>
                <th>{t('employeeFullName')}</th>
                <th>{t('employeeJobTitle')}</th>
                <th>{t('userRole')}</th>
                <th>{t('navBranches')}</th>
                <th>{t('navDepartments')}</th>
                <th>{t('status')}</th>
                <th>{t('transferActions')}</th>
              </tr>
            </thead>
            <tbody>
              {people.users.map((user) => (
                <tr key={user.id}>
                  <td>{userDisplayName(user)}</td>
                  <td>{user.jobTitle ?? '—'}</td>
                  <td>{t(USER_ROLE_LABEL_KEY[user.role])}</td>
                  <td>{branchName(user.branchId)}</td>
                  <td>{departmentName(user.departmentId)}</td>
                  <td>
                    <Badge tone={statusTone(user.status)}>
                      {t(USER_STATUS_LABEL_KEY[user.status])}
                    </Badge>
                  </td>
                  <td>
                    <Button onClick={() => setViewingUserId(user.id)}>
                      {t('platformViewEmployee')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <div className="settings-section">
        <h3>{t('platformCompanyModules')}</h3>
        <div className="module-list">
          {PLATFORM_MODULE_KEYS.map((moduleKey) => {
            const enabled = statusByKey[moduleKey] === 'enabled'
            const title = t(PLATFORM_MODULE_LABEL_KEY[moduleKey])
            return (
              <div key={moduleKey} className="module-row">
                <div className="module-row__info">
                  <p className="module-row__title">{title}</p>
                  <p className="module-row__description">
                    {t(PLATFORM_MODULE_DESCRIPTION_KEY[moduleKey])}
                  </p>
                </div>
                <button
                  type="button"
                  className={
                    enabled ? 'module-switch module-switch--on' : 'module-switch'
                  }
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${title}: ${enabled ? t('enabled') : t('disabled')}`}
                  onClick={() =>
                    setModuleEnabled(view.organization.id, moduleKey, !enabled)
                  }
                >
                  {enabled ? t('enabled') : t('disabled')}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {creating ? (
        <Modal title={t('addUser')} onClose={() => setCreating(false)}>
          <UserForm
            hideHeading
            allowSalary={false}
            assignableRoles={assignableRoles}
            directory={{
              branches: people.branches,
              departments: people.departments,
              warehouses: people.warehouses,
              users: people.users,
            }}
            onSubmit={handleCreate}
            onCancel={() => setCreating(false)}
          />
        </Modal>
      ) : null}

      {viewingUser ? (
        <Modal
          title={t('platformEmployeeCard')}
          onClose={() => setViewingUserId(null)}
        >
          {renderIdentity(viewingUser)}
          <div className="modal__actions">
            <Button onClick={() => setViewingUserId(null)}>{t('cancel')}</Button>
          </div>
        </Modal>
      ) : null}
    </section>
  )
}
