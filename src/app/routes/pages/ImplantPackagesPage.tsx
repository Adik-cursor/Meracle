import { useEffect, useMemo, useState } from 'react'
import { useAccess } from '../../context/access-context'
import { useCustomers } from '../../context/customer-context'
import { useCompanies } from '../../context/company-context'
import { useContacts } from '../../context/contact-context'
import { useLocalization } from '../../context/localization-context'
import { usePersistence, usePersistenceVersion } from '../../context/persistence-context'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { Badge, Button, EmptyState, FormField, Input, Modal, Select } from '../../../shared/ui'
import { ExcelExportButton } from '../../../shared/components/ExcelExportButton'
import {
  createImplantPackageForUser,
  listImplantPackagesForUser,
} from '../../../core/services'
import { getCustomerDisplayName } from '../../../modules/crm/customers/customer-name'
import { useAppPath } from '../useAppPath'
import {
  clearPackageFormDraft,
  readPackageFormDraft,
  savePackageFormDraft,
} from '../package-form-draft'

export function ImplantPackagesPage() {
  const { t } = useLocalization()
  const { pathname, navigate } = useAppPath()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const { customers } = useCustomers()
  const { contacts } = useContacts()
  const { companies } = useCompanies()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [price, setPrice] = useState('0')
  const [totalImplants, setTotalImplants] = useState('1')

  useEffect(() => {
    const draft = readPackageFormDraft()
    if (!draft) {
      return
    }
    setName(draft.name)
    setPrice(draft.price)
    setTotalImplants(draft.totalImplants)
    if (draft.customerId) {
      setCustomerId(draft.customerId)
    }
    setCreating(true)
  }, [])

  const filter =
    pathname.endsWith('/active')
      ? 'active'
      : pathname.endsWith('/completed')
        ? 'completed'
        : undefined

  const rows = useMemo(() => {
    void version
    const listed = listImplantPackagesForUser(
      persistence,
      currentUser,
      filter ? { status: filter } : undefined,
    )
    return listed.ok ? listed.value : []
  }, [currentUser, filter, persistence, version])

  if (!currentUser) {
    return <AuthRequiredState />
  }

  return (
    <section className="workspace-page">
      <div className="workspace-toolbar">
        <h2 className="workspace-toolbar__title">{t('navPackages')}</h2>
        <Button onClick={() => navigate('/packages')}>{t('packagesAll')}</Button>
        <Button onClick={() => navigate('/packages/active')}>{t('packagesActive')}</Button>
        <Button onClick={() => navigate('/packages/completed')}>
          {t('packagesCompleted')}
        </Button>
        <Button onClick={() => navigate('/packages/contracts')}>
          {t('packagesContracts')}
        </Button>
        <ExcelExportButton dataset="implant_packages" />
        <Button variant="primary" onClick={() => setCreating(true)}>
          {t('createPackage')}
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={t('noPackages')} />
      ) : (
        <div className="inventory-table-wrap">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>{t('customer')}</th>
                <th>{t('packageName')}</th>
                <th>{t('price')}</th>
                <th>{t('totalImplants')}</th>
                <th>{t('issued')}</th>
                <th>{t('used')}</th>
                <th>{t('returned')}</th>
                <th>{t('remaining')}</th>
                <th>{t('paid')}</th>
                <th>{t('debt')}</th>
                <th>{t('status')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.pkg.id}>
                  <td>{row.customerName}</td>
                  <td>{row.pkg.name}</td>
                  <td>
                    {row.pkg.price} {row.pkg.currency}
                  </td>
                  <td>{row.balance.total}</td>
                  <td>{row.balance.issued}</td>
                  <td>{row.balance.used}</td>
                  <td>{row.balance.returned}</td>
                  <td>{row.balance.remaining}</td>
                  <td>{row.balance.paid}</td>
                  <td>{row.balance.debt}</td>
                  <td>
                    <Badge
                      tone={
                        row.pkg.status === 'active'
                          ? 'success'
                          : row.pkg.status === 'cancelled'
                            ? 'danger'
                            : row.pkg.status === 'completed'
                              ? 'info'
                              : 'neutral'
                      }
                    >
                      {t(
                        row.pkg.status === 'active'
                          ? 'active'
                          : row.pkg.status === 'completed'
                            ? 'transferStatusCompleted'
                            : row.pkg.status === 'cancelled'
                              ? 'transferStatusCancelled'
                              : 'transferStatusDraft',
                      )}
                    </Badge>
                  </td>
                  <td>
                    <Button onClick={() => navigate(`/packages/${row.pkg.id}`)}>
                      {t('open')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating ? (
        <Modal title={t('createPackage')} onClose={() => setCreating(false)}>
          <form
            className="org-profile__form"
            onSubmit={(event) => {
              event.preventDefault()
              const created = createImplantPackageForUser(persistence, currentUser, {
                customerId,
                name,
                price: Number(price),
                currency: 'KZT',
                totalImplants: Number(totalImplants),
                startDate: new Date().toISOString().slice(0, 10),
              })
              if (created.ok) {
                clearPackageFormDraft()
                setCreating(false)
                navigate(`/packages/${created.value.id}`)
              }
            }}
          >
            <FormField label={t('packageName')}>
              <Input value={name} onChange={(event) => setName(event.target.value)} required />
            </FormField>
            <FormField label={t('customer')}>
              <Select
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                required
              >
                <option value="">{t('selectCustomer')}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {getCustomerDisplayName(customer, contacts, companies)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={t('price')}>
              <Input value={price} onChange={(event) => setPrice(event.target.value)} />
            </FormField>
            <FormField label={t('totalImplants')}>
              <Input
                value={totalImplants}
                onChange={(event) => setTotalImplants(event.target.value)}
              />
            </FormField>
            <Button
              type="button"
              onClick={() => {
                savePackageFormDraft({
                  returnPath: pathname.startsWith('/packages') ? pathname : '/packages',
                  name,
                  price,
                  totalImplants,
                  customerId,
                })
                navigate(
                  `/customers?returnTo=${encodeURIComponent(
                    pathname.startsWith('/packages') ? pathname : '/packages',
                  )}`,
                )
              }}
            >
              {t('createCustomerFromPackage')}
            </Button>
            <Button variant="primary" type="submit">
              {t('save')}
            </Button>
          </form>
        </Modal>
      ) : null}
    </section>
  )
}
