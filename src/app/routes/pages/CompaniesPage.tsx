import { useState } from 'react'
import { useCompanies } from '../../context/company-context'
import { useLocalization } from '../../context/localization-context'
import { CompanyForm } from '../../../modules/crm/companies/CompanyForm'
import type { Company } from '../../../core/types'
import type { CompanyDraft } from '../../context/company-context'

export function CompaniesPage() {
  const { t } = useLocalization()
  const { companies, createCompany, updateCompany, setCompanyStatus } =
    useCompanies()
  const [formMode, setFormMode] = useState<'closed' | 'create' | 'edit'>(
    'closed',
  )
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)

  const closeForm = () => {
    setFormMode('closed')
    setEditingCompany(null)
  }

  const selectedCompany =
    formMode === 'edit' && editingCompany
      ? companies.find((company) => company.id === editingCompany.id)
      : undefined

  const handleCreate = (draft: CompanyDraft) => {
    createCompany(draft)
    closeForm()
  }

  const handleUpdate = (draft: CompanyDraft) => {
    if (!selectedCompany) {
      return
    }

    updateCompany(selectedCompany.id, draft)
    closeForm()
  }

  return (
    <section className="workspace-page contacts-page entity-directory-page">
      <div className="workspace-toolbar">
        <h2 className="workspace-toolbar__title">{t('navCompanies')}</h2>
        {formMode === 'closed' && companies.length > 0 ? (
          <button
            type="button"
            className="module-switch module-switch--on"
            onClick={() => setFormMode('create')}
          >
            {t('addCompany')}
          </button>
        ) : null}
      </div>

      {formMode === 'create' ? (
        <CompanyForm onSubmit={handleCreate} onCancel={closeForm} />
      ) : null}

      {formMode === 'edit' && selectedCompany ? (
        <CompanyForm
          key={`${selectedCompany.id}-${selectedCompany.updatedAt}`}
          company={selectedCompany}
          onSubmit={handleUpdate}
          onCancel={closeForm}
        />
      ) : null}

      {companies.length === 0 && formMode === 'closed' ? (
        <div className="warehouse-empty settings-section">
          <p>{t('noCompanies')}</p>
          <button
            type="button"
            className="module-switch module-switch--on"
            onClick={() => setFormMode('create')}
          >
            {t('addCompany')}
          </button>
        </div>
      ) : null}

      {companies.length > 0 ? (
        <div className="inventory-table-wrap settings-section">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('status')}</th>
                <th>{t('transferActions')}</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => {
                const isActive = company.status === 'active'

                return (
                  <tr key={company.id}>
                    <td>{company.name}</td>
                    <td>{isActive ? t('active') : t('inactive')}</td>
                    <td>
                      <div className="warehouse-card__actions">
                        <button
                          type="button"
                          className="module-switch"
                          onClick={() => {
                            setEditingCompany(company)
                            setFormMode('edit')
                          }}
                        >
                          {t('edit')}
                        </button>
                        <button
                          type="button"
                          className={
                            isActive
                              ? 'module-switch'
                              : 'module-switch module-switch--on'
                          }
                          onClick={() =>
                            setCompanyStatus(
                              company.id,
                              isActive ? 'inactive' : 'active',
                            )
                          }
                        >
                          {isActive ? t('turnOff') : t('turnOn')}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
