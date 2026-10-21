import { useMemo, useState, type FormEvent } from 'react'
import { useLocalization } from '../../context/localization-context'
import { usePlatform } from '../../context/platform-context'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { PagePlaceholder } from '../../../shared/components/PagePlaceholder'
import { Badge, Button, Modal, Table } from '../../../shared/ui'
import { useAppPath } from '../useAppPath'
import { PLATFORM_MODULE_KEYS } from '../../../core/types'
import type { PlatformModuleKey } from '../../../core/types'
import { PLATFORM_MODULE_LABEL_KEY } from '../../../modules/platform/platform-module-label'
import { businessTypeLabelKey } from '../../../modules/platform/business-type-label'
import { UNIVERSAL_BUSINESS_TYPE_ID } from '../../../core/services'
import { PLATFORM_ORGANIZATION_ID } from '../../../core/config/platform'
import {
  isSuspendedOrganizationStatus,
  organizationStatusLabelKey,
} from '../../../modules/platform/organization-status-label'
import type { OrganizationStatus } from '../../../core/types'

function enabledFromModules(
  moduleIds: readonly string[],
): Record<PlatformModuleKey, boolean> {
  const recommended = new Set(moduleIds)
  return Object.fromEntries(
    PLATFORM_MODULE_KEYS.map((key) => [key, recommended.has(key)]),
  ) as Record<PlatformModuleKey, boolean>
}

export function PlatformOrganizationsPage() {
  const { t, locale } = useLocalization()
  const { navigate } = useAppPath()
  const {
    organizations,
    denied,
    createCompany,
    suspendCompany,
    reactivateCompany,
    archiveCompany,
    restoreCompany,
    businessTypes,
    businessTemplates,
  } = usePlatform()
  const [openForm, setOpenForm] = useState(false)
  const [name, setName] = useState('')
  const [ownerFirstName, setOwnerFirstName] = useState('')
  const [ownerLastName, setOwnerLastName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [businessTypeId, setBusinessTypeId] = useState(UNIVERSAL_BUSINESS_TYPE_ID)
  const recommendedTemplate = useMemo(
    () =>
      businessTemplates.find(
        (template) =>
          template.businessTypeId === businessTypeId && template.active,
      ),
    [businessTemplates, businessTypeId],
  )
  const [enabled, setEnabled] = useState<Record<PlatformModuleKey, boolean>>(() =>
    enabledFromModules([]),
  )
  const [statusFilter, setStatusFilter] = useState<'all' | OrganizationStatus>('all')
  const [confirm, setConfirm] = useState<{
    id: string
    name: string
    action: 'suspend' | 'archive'
  } | null>(null)

  if (denied) {
    return (
      <PagePlaceholder title={t('ACCESS_DENIED')} description={t('ACCESS_DENIED')} />
    )
  }

  if (!organizations) {
    return <AuthRequiredState />
  }

  const applyType = (typeId: string) => {
    setBusinessTypeId(typeId)
    const template = businessTemplates.find(
      (item) => item.businessTypeId === typeId && item.active,
    )
    setEnabled(enabledFromModules(template?.moduleIds ?? []))
  }

  const openCreateForm = () => {
    const nextOpen = !openForm
    setOpenForm(nextOpen)
    if (nextOpen) {
      applyType(UNIVERSAL_BUSINESS_TYPE_ID)
    }
  }

  const resetForm = () => {
    setName('')
    setOwnerFirstName('')
    setOwnerLastName('')
    setOwnerEmail('')
    applyType(UNIVERSAL_BUSINESS_TYPE_ID)
    setOpenForm(false)
  }

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const created = createCompany({
      name,
      ownerFirstName,
      ownerLastName,
      ownerEmail,
      businessTypeId,
      enabledModules: PLATFORM_MODULE_KEYS.filter((key) => enabled[key]),
    })
    if (!created) {
      return
    }
    resetForm()
  }

  return (
    <section className="workspace-page platform-page">
      <div className="workspace-toolbar">
        <h2 className="workspace-toolbar__title">{t('navPlatformCompanies')}</h2>
        <Button variant="primary" onClick={openCreateForm}>
          {t('platformAddCompany')}
        </Button>
      </div>
      {openForm ? (
        <form className="settings-section platform-company-stack" onSubmit={handleCreate}>
          <h3>{t('platformCompanyData')}</h3>
          <label className="warehouse-field">
            <span className="settings-field__label">{t('organizationName')}</span>
            <input
              className="warehouse-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="warehouse-field">
            <span className="settings-field__label">{t('platformBusinessType')}</span>
            <select
              className="warehouse-input"
              value={businessTypeId}
              onChange={(event) => applyType(event.target.value)}
            >
              {businessTypes.map((type) => {
                const labelKey = businessTypeLabelKey(type.id)
                return (
                  <option key={type.id} value={type.id}>
                    {labelKey ? t(labelKey) : type.name}
                  </option>
                )
              })}
            </select>
          </label>
          <h3>{t('platformOwnerName')}</h3>
          <label className="warehouse-field">
            <span className="settings-field__label">{t('ownerFirstName')}</span>
            <input
              className="warehouse-input"
              value={ownerFirstName}
              onChange={(event) => setOwnerFirstName(event.target.value)}
            />
          </label>
          <label className="warehouse-field">
            <span className="settings-field__label">{t('ownerLastName')}</span>
            <input
              className="warehouse-input"
              value={ownerLastName}
              onChange={(event) => setOwnerLastName(event.target.value)}
            />
          </label>
          <label className="warehouse-field">
            <span className="settings-field__label">{t('ownerEmail')}</span>
            <input
              className="warehouse-input"
              type="email"
              value={ownerEmail}
              onChange={(event) => setOwnerEmail(event.target.value)}
            />
          </label>
          <h3>{t('platformRecommendedConfig')}</h3>
          {recommendedTemplate ? (
            <p className="workspace-muted">
              {recommendedTemplate.name}
              {recommendedTemplate.description
                ? ` — ${recommendedTemplate.description}`
                : ''}
            </p>
          ) : (
            <p className="workspace-muted">{t('noneAvailable')}</p>
          )}
          <h3>{t('platformCompanyModules')}</h3>
          <div className="module-list">
            {PLATFORM_MODULE_KEYS.map((moduleKey) => (
              <div key={moduleKey} className="module-row">
                <p className="module-row__title">
                  {t(PLATFORM_MODULE_LABEL_KEY[moduleKey])}
                </p>
                <button
                  type="button"
                  className={
                    enabled[moduleKey]
                      ? 'module-switch module-switch--on'
                      : 'module-switch'
                  }
                  role="switch"
                  aria-checked={enabled[moduleKey]}
                  onClick={() =>
                    setEnabled((current) => ({
                      ...current,
                      [moduleKey]: !current[moduleKey],
                    }))
                  }
                >
                  {enabled[moduleKey] ? t('enabled') : t('disabled')}
                </button>
              </div>
            ))}
          </div>
          <div className="warehouse-form__actions">
            <Button type="button" onClick={resetForm}>
              {t('cancel')}
            </Button>
            <Button type="submit" variant="primary">
              {t('createCompany')}
            </Button>
          </div>
        </form>
      ) : null}
      <div className="platform-status-filters">
        {(
          [
            ['all', 'platformFilterAll'],
            ['active', 'platformFilterActive'],
            ['suspended', 'platformFilterSuspended'],
            ['archived', 'platformFilterArchived'],
          ] as const
        ).map(([value, key]) => (
          <Button
            key={value}
            variant={statusFilter === value ? 'primary' : 'ghost'}
            onClick={() => setStatusFilter(value)}
          >
            {t(key)}
          </Button>
        ))}
      </div>
      {organizations.length === 0 ? (
        <p className="workspace-muted">—</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>{t('navPlatformCompanies')}</th>
              <th>{t('platformCompanyModel')}</th>
              <th>{t('status')}</th>
              <th>{t('platformCreatedAt')}</th>
              <th>{t('platformEmployeesCount')}</th>
              <th>{t('platformActionColumn')}</th>
            </tr>
          </thead>
          <tbody>
            {organizations
              .filter((item) => {
                const status = item.organization.status
                if (statusFilter === 'all') {
                  return true
                }
                if (statusFilter === 'suspended') {
                  return isSuspendedOrganizationStatus(status)
                }
                return status === statusFilter
              })
              .map((item) => {
                const type = businessTypes.find(
                  (entry) => entry.id === item.organization.businessTypeId,
                )
                const typeKey = item.organization.businessTypeId
                  ? businessTypeLabelKey(item.organization.businessTypeId)
                  : undefined
                const status = item.organization.status
                const canManageLifecycle =
                  item.organization.id !== PLATFORM_ORGANIZATION_ID
                return (
                  <tr key={item.organization.id}>
                    <td>{item.organization.name}</td>
                    <td>{typeKey ? t(typeKey) : type?.name ?? '—'}</td>
                    <td>
                      <Badge
                        tone={
                          status === 'active'
                            ? 'success'
                            : isSuspendedOrganizationStatus(status)
                              ? 'warning'
                              : 'neutral'
                        }
                      >
                        {t(organizationStatusLabelKey(status))}
                      </Badge>
                    </td>
                    <td>
                      {new Date(item.organization.createdAt).toLocaleDateString(
                        locale === 'kk' ? 'kk-KZ' : 'ru-RU',
                      )}
                    </td>
                    <td>{item.employeeCount}</td>
                    <td>
                      <div className="warehouse-card__actions">
                        <Button
                          variant="ghost"
                          onClick={() =>
                            navigate(`/platform/organizations/${item.organization.id}`)
                          }
                        >
                          {status === 'archived'
                            ? t('platformPreviewCompany')
                            : t('platformViewCompany')}
                        </Button>
                        {canManageLifecycle && status === 'active' ? (
                          <>
                            <Button
                              onClick={() =>
                                setConfirm({
                                  id: item.organization.id,
                                  name: item.organization.name,
                                  action: 'suspend',
                                })
                              }
                            >
                              {t('platformDeactivateCompany')}
                            </Button>
                            <Button
                              onClick={() =>
                                setConfirm({
                                  id: item.organization.id,
                                  name: item.organization.name,
                                  action: 'archive',
                                })
                              }
                            >
                              {t('platformArchiveCompany')}
                            </Button>
                          </>
                        ) : null}
                        {canManageLifecycle && isSuspendedOrganizationStatus(status) ? (
                          <>
                            <Button
                              variant="primary"
                              onClick={() => reactivateCompany(item.organization.id)}
                            >
                              {t('platformReactivateCompany')}
                            </Button>
                            <Button
                              onClick={() =>
                                setConfirm({
                                  id: item.organization.id,
                                  name: item.organization.name,
                                  action: 'archive',
                                })
                              }
                            >
                              {t('platformArchiveCompany')}
                            </Button>
                          </>
                        ) : null}
                        {canManageLifecycle && status === 'archived' ? (
                          <Button
                            variant="primary"
                            onClick={() => restoreCompany(item.organization.id)}
                          >
                            {t('platformRestoreCompany')}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </Table>
      )}
      {confirm ? (
        <Modal
          title={
            confirm.action === 'suspend'
              ? t('platformSuspendConfirmTitle')
              : t('platformArchiveConfirmTitle')
          }
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm.action === 'suspend'
              ? `${confirm.name}. ${t('platformSuspendConfirmText')}`
              : `${confirm.name}. ${t('platformArchiveConfirmText')}`}
          </p>
          <div className="modal__actions">
            <Button type="button" onClick={() => setConfirm(null)}>
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={() => {
                if (confirm.action === 'suspend') {
                  suspendCompany(confirm.id)
                } else {
                  archiveCompany(confirm.id)
                }
                setConfirm(null)
              }}
            >
              {confirm.action === 'suspend'
                ? t('platformDeactivateCompany')
                : t('platformArchiveCompany')}
            </Button>
          </div>
        </Modal>
      ) : null}
    </section>
  )
}
