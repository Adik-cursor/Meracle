import { useState, type FormEvent } from 'react'
import { useOrganization } from '../../context/organization-context'
import { useAccess } from '../../context/access-context'
import { useBranches } from '../../context/branch-context'
import { useDepartments } from '../../context/department-context'
import { useLocalization } from '../../context/localization-context'
import { useUsers } from '../../context/user-context'
import { usePersistence } from '../../context/persistence-context'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { Button, FormField, Input, Modal, Select, useToast } from '../../../shared/ui'
import {
  COMPANY_ORGANIZATION_CURRENCIES,
  COMPANY_ORGANIZATION_TIMEZONES,
  canUpdateCompanyOrganization,
  updateCompanyOrganizationForUser,
} from '../../../core/services'
import type { OrganizationStatus } from '../../../core/types'
import type { TranslationKey } from '../../../core/localization/translations'

function saveErrorKey(code: string): TranslationKey {
  if (code === 'INVALID_INPUT') {
    return 'INVALID_INPUT'
  }
  return 'ACCESS_DENIED'
}

function statusLabelKey(status: OrganizationStatus): TranslationKey {
  if (status === 'archived') {
    return 'organizationStatusArchived'
  }
  if (status === 'inactive') {
    return 'inactive'
  }
  if (status === 'suspended') {
    return 'organizationStatusSuspended'
  }
  return 'active'
}

export function CompanyOrganizationPage() {
  const { t } = useLocalization()
  const { organization, settings } = useOrganization()
  const { currentUser } = useAccess()
  const { branches } = useBranches()
  const { departments } = useDepartments()
  const { users } = useUsers()
  const persistence = usePersistence()
  const { showToast } = useToast()
  const canEdit = canUpdateCompanyOrganization(currentUser)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(organization.name)
  const [bin, setBin] = useState(organization.bin ?? '')
  const [currency, setCurrency] = useState(settings.currency)
  const [timezone, setTimezone] = useState(settings.timezone)
  const [legalName, setLegalName] = useState(organization.legalName ?? '')
  const [taxId, setTaxId] = useState(organization.taxId ?? organization.bin ?? '')
  const [legalAddress, setLegalAddress] = useState(organization.legalAddress ?? '')
  const [bankName, setBankName] = useState(organization.bankName ?? '')
  const [iban, setIban] = useState(organization.iban ?? '')
  const [bik, setBik] = useState(organization.bik ?? '')
  const [kbe, setKbe] = useState(organization.kbe ?? '')
  const [knp, setKnp] = useState(organization.knp ?? '')
  const [vatStatus, setVatStatus] = useState(organization.vatStatus ?? 'no_vat')
  const [invoiceFooterNote, setInvoiceFooterNote] = useState(
    organization.invoiceFooterNote ?? '',
  )
  const [invoiceWarningNote, setInvoiceWarningNote] = useState(
    organization.invoiceWarningNote ?? '',
  )
  const [error, setError] = useState<string | null>(null)

  if (!currentUser) {
    return <AuthRequiredState />
  }

  const openEdit = () => {
    setName(organization.name)
    setBin(organization.bin ?? '')
    setCurrency(settings.currency)
    setTimezone(settings.timezone)
    setLegalName(organization.legalName ?? '')
    setTaxId(organization.taxId ?? organization.bin ?? '')
    setLegalAddress(organization.legalAddress ?? '')
    setBankName(organization.bankName ?? '')
    setIban(organization.iban ?? '')
    setBik(organization.bik ?? '')
    setKbe(organization.kbe ?? '')
    setKnp(organization.knp ?? '')
    setVatStatus(organization.vatStatus ?? 'no_vat')
    setInvoiceFooterNote(organization.invoiceFooterNote ?? '')
    setInvoiceWarningNote(organization.invoiceWarningNote ?? '')
    setError(null)
    setEditing(true)
  }

  const handleSave = (event: FormEvent) => {
    event.preventDefault()
    const result = updateCompanyOrganizationForUser(
      persistence,
      currentUser,
      organization.id,
      {
        name,
        bin,
        currency,
        timezone,
        legalName,
        taxId,
        legalAddress,
        bankName,
        iban,
        bik,
        kbe,
        knp,
        vatStatus,
        invoiceFooterNote,
        invoiceWarningNote,
      },
    )
    if (!result.ok) {
      setError(t(saveErrorKey(result.error.code)))
      return
    }
    setError(null)
    setEditing(false)
    showToast(t('savedToast'))
  }

  const fields = [
    { label: t('organizationName'), value: organization.name },
    { label: t('organizationBin'), value: organization.bin?.trim() || '—' },
    { label: t('status'), value: t(statusLabelKey(organization.status)) },
    { label: t('currency'), value: settings.currency },
    { label: t('timezone'), value: settings.timezone },
    { label: t('legalName'), value: organization.legalName?.trim() || '—' },
    { label: t('taxId'), value: organization.taxId?.trim() || organization.bin?.trim() || '—' },
    { label: t('legalAddress'), value: organization.legalAddress?.trim() || '—' },
    { label: t('bankName'), value: organization.bankName?.trim() || '—' },
    { label: t('iban'), value: organization.iban?.trim() || '—' },
    { label: t('bik'), value: organization.bik?.trim() || '—' },
    { label: t('kbe'), value: organization.kbe?.trim() || '—' },
    { label: t('knp'), value: organization.knp?.trim() || '—' },
    { label: t('navBranches'), value: String(branches.length) },
    { label: t('navDepartments'), value: String(departments.length) },
    { label: t('navEmployees'), value: String(users.length) },
  ]

  return (
    <section className="workspace-page">
      <article className="dash-card org-profile">
        <div className="org-profile__head">
          <h2 className="dash-card__title">{t('navCompanySection')}</h2>
          {canEdit ? (
            <Button variant="primary" onClick={openEdit}>
              {t('edit')}
            </Button>
          ) : null}
        </div>
        <dl className="org-profile__grid">
          {fields.map((field) => (
            <div key={field.label} className="org-profile__item">
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      </article>

      {editing && canEdit ? (
        <Modal title={t('editOrganization')} onClose={() => setEditing(false)}>
          <form className="org-profile__form" onSubmit={handleSave}>
            <FormField label={t('organizationName')}>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </FormField>
            <FormField label={t('organizationBin')}>
              <Input
                value={bin}
                onChange={(event) => setBin(event.target.value)}
                maxLength={12}
              />
            </FormField>
            <FormField label={t('currency')}>
              <Select
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              >
                {COMPANY_ORGANIZATION_CURRENCIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={t('timezone')}>
              <Select
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              >
                {COMPANY_ORGANIZATION_TIMEZONES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={t('legalName')}>
              <Input value={legalName} onChange={(event) => setLegalName(event.target.value)} />
            </FormField>
            <FormField label={t('taxId')}>
              <Input value={taxId} onChange={(event) => setTaxId(event.target.value)} />
            </FormField>
            <FormField label={t('legalAddress')}>
              <Input value={legalAddress} onChange={(event) => setLegalAddress(event.target.value)} />
            </FormField>
            <FormField label={t('bankName')}>
              <Input value={bankName} onChange={(event) => setBankName(event.target.value)} />
            </FormField>
            <FormField label={t('iban')}>
              <Input value={iban} onChange={(event) => setIban(event.target.value)} />
            </FormField>
            <FormField label={t('bik')}>
              <Input
                name="bik"
                value={bik}
                onChange={(event) => setBik(event.target.value)}
              />
            </FormField>
            <FormField label={t('kbe')}>
              <Input
                name="kbe"
                value={kbe}
                autoComplete="off"
                onChange={(event) => setKbe(event.target.value)}
              />
            </FormField>
            <FormField label={t('knp')}>
              <Input
                name="knp"
                value={knp}
                autoComplete="off"
                onChange={(event) => setKnp(event.target.value)}
              />
            </FormField>
            <FormField label={t('vatStatus')}>
              <Select
                value={vatStatus}
                onChange={(event) =>
                  setVatStatus(event.target.value === 'vat' ? 'vat' : 'no_vat')
                }
              >
                <option value="no_vat">{t('vatNo')}</option>
                <option value="vat">{t('vatYes')}</option>
              </Select>
            </FormField>
            <FormField label={t('invoiceWarningNote')}>
              <Input
                value={invoiceWarningNote}
                onChange={(event) => setInvoiceWarningNote(event.target.value)}
              />
            </FormField>
            <FormField label={t('invoiceFooterNote')}>
              <Input
                value={invoiceFooterNote}
                onChange={(event) => setInvoiceFooterNote(event.target.value)}
              />
            </FormField>
            {error ? <p className="field__error">{error}</p> : null}
            <div className="modal__actions">
              <Button type="button" onClick={() => setEditing(false)}>
                {t('cancel')}
              </Button>
              <Button variant="primary" type="submit">
                {t('save')}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  )
}
