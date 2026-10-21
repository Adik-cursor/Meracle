import { useEffect, useMemo, useState } from 'react'
import { listCustomerDebtsForUser } from '../../../core/services'
import { useAccess } from '../../context/access-context'
import { useCare } from '../../context/care-context'
import { useCompanies } from '../../context/company-context'
import { useContacts } from '../../context/contact-context'
import { useCustomers } from '../../context/customer-context'
import { useDeals } from '../../context/deal-context'
import { useLocalization } from '../../context/localization-context'
import { useOrganization } from '../../context/organization-context'
import { usePersistence, usePersistenceVersion } from '../../context/persistence-context'
import { getCustomerDisplayName } from '../../../modules/crm/customers/customer-name'
import { CustomerForm } from '../../../modules/crm/customers/CustomerForm'
import { CustomerList } from '../../../modules/crm/customers/CustomerList'
import { ReconciliationStatementDialog } from '../../../modules/crm/customers/ReconciliationStatementDialog'
import { ParentList } from '../../../modules/crm/customers/ParentList'
import { RentalCustomerHistory } from '../../../modules/rental/RentalCustomerHistory'
import type { Customer } from '../../../core/types'
import type { CustomerDraft } from '../../context/customer-context'
import { Button, EmptyState, PageHeader } from '../../../shared/ui'
import { ExcelExportButton } from '../../../shared/components/ExcelExportButton'
import { usesCareCrmComposition } from '../app.routes'
import { useAppPath } from '../useAppPath'
import {
  readPackageFormDraft,
  resolvePackageReturnPath,
  savePackageFormDraft,
} from '../package-form-draft'
import {
  readSalesWorkspaceDraft,
  saveSalesWorkspaceDraft,
} from '../sales-workspace-draft'

type CustomersPageProps = {
  onNavigate: (path: string) => void
}

export function CustomersPage({ onNavigate }: CustomersPageProps) {
  const { t, locale } = useLocalization()
  const { search, navigate } = useAppPath()
  const { modules, settings } = useOrganization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const parentMode = usesCareCrmComposition(modules)
  const { contacts } = useContacts()
  const { companies } = useCompanies()
  const { customers, createCustomer, updateCustomer, setCustomerStatus } =
    useCustomers()
  const { deals } = useDeals()
  const care = useCare()
  const [formMode, setFormMode] = useState<'closed' | 'create' | 'edit'>(
    'closed',
  )
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [reconciling, setReconciling] = useState<Customer | null>(null)
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const rawReturn = params.get('returnTo')
  const returnTo = resolvePackageReturnPath(rawReturn)
  const fromPackage = Boolean(
    rawReturn &&
      (rawReturn === '/packages' || rawReturn.startsWith('/packages/')),
  )
  const fromSales = Boolean(rawReturn && (rawReturn === '/sales' || rawReturn.startsWith('/sales/')))
  const editCustomerId = params.get('customerId')

  const debtsByCustomerId = useMemo(() => {
    void version
    if (modules.sales !== true) {
      return {}
    }
    const listed = listCustomerDebtsForUser(persistence, currentUser)
    if (!listed.ok) {
      return {}
    }
    return Object.fromEntries(listed.value.map((row) => [row.customerId, row]))
  }, [currentUser, modules.sales, persistence, version])

  useEffect(() => {
    if (fromPackage) {
      setFormMode('create')
      return
    }
    if (fromSales && editCustomerId) {
      const found = customers.find((customer) => customer.id === editCustomerId)
      if (found) {
        setEditingCustomer(found)
        setFormMode('edit')
      }
      return
    }
    if (fromSales) {
      setFormMode('create')
    }
  }, [customers, editCustomerId, fromPackage, fromSales])

  const closeForm = () => {
    setFormMode('closed')
    setEditingCustomer(null)
  }

  const selectedCustomer =
    formMode === 'edit' && editingCustomer
      ? customers.find((customer) => customer.id === editingCustomer.id)
      : undefined

  const handleCreate = (draft: CustomerDraft) => {
    const created = createCustomer(draft)

    if (created) {
      if (fromSales) {
        const draft = readSalesWorkspaceDraft() ?? {
          saleId: '',
          warehouseId: '',
          customerId: '',
        }
        saveSalesWorkspaceDraft({
          ...draft,
          customerId: created.id,
        })
        navigate('/sales')
        return true
      }
      if (fromPackage) {
        const draft = readPackageFormDraft() ?? {
          returnPath: returnTo,
          name: '',
          price: '',
          totalImplants: '',
          customerId: '',
        }
        savePackageFormDraft({
          ...draft,
          customerId: created.id,
          returnPath: returnTo,
        })
        navigate(returnTo)
        return true
      }
      closeForm()
    }

    return Boolean(created)
  }

  const handleUpdate = (draft: CustomerDraft) => {
    if (!selectedCustomer) {
      return false
    }

    const updated = updateCustomer(selectedCustomer.id, draft)

    if (updated) {
      if (fromSales) {
        const workspace = readSalesWorkspaceDraft() ?? {
          saleId: '',
          warehouseId: '',
          customerId: '',
        }
        saveSalesWorkspaceDraft({
          ...workspace,
          customerId: selectedCustomer.id,
        })
        navigate('/sales')
        return true
      }
      closeForm()
    }

    return updated
  }

  return (
    <section className="workspace-page">
      <PageHeader
        title={parentMode ? t('crmParents') : t('navCustomers')}
        actions={
          <>
            <ExcelExportButton dataset="customers" />
            {formMode === 'closed' && customers.length > 0 ? (
              <Button variant="primary" onClick={() => setFormMode('create')}>
                + {parentMode ? t('addParent') : t('addCustomer')}
              </Button>
            ) : null}
          </>
        }
      />

      {formMode === 'create' ? (
        <CustomerForm
          contacts={contacts}
          companies={companies}
          onSubmit={handleCreate}
          onCancel={closeForm}
          onGoToContacts={() => onNavigate('/contacts')}
          onGoToCompanies={() => onNavigate('/companies')}
        />
      ) : null}

      {formMode === 'edit' && selectedCustomer ? (
        <>
          <CustomerForm
            key={`${selectedCustomer.id}-${selectedCustomer.updatedAt}`}
            customer={selectedCustomer}
            contacts={contacts}
            companies={companies}
            onSubmit={handleUpdate}
            onCancel={closeForm}
            onGoToContacts={() => onNavigate('/contacts')}
            onGoToCompanies={() => onNavigate('/companies')}
          />
          {modules.rental ? (
            <RentalCustomerHistory customerId={selectedCustomer.id} />
          ) : null}
          {modules.sales === true ? (
            <div className="settings-section">
              <h3>{t('reconciliationStatement')}</h3>
              <Button type="button" onClick={() => setReconciling(selectedCustomer)}>
                {t('createReconciliation')}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      {customers.length === 0 && formMode === 'closed' ? (
        <EmptyState
          title={parentMode ? t('noParents') : t('noCustomers')}
          action={
            <Button variant="primary" onClick={() => setFormMode('create')}>
              + {parentMode ? t('addParent') : t('addCustomer')}
            </Button>
          }
        />
      ) : null}

      {customers.length > 0 ? (
        parentMode ? (
          <ParentList
            customers={customers}
            contacts={contacts}
            childrenList={care.childrenList}
            groups={care.groups}
            deals={deals}
            onEdit={(customer) => {
              setEditingCustomer(customer)
              setFormMode('edit')
            }}
            onOpenChild={(childId) => onNavigate(`/children/${childId}`)}
            onOpenInquiry={(dealId) => onNavigate(`/deals/${dealId}`)}
          />
        ) : (
        <CustomerList
          customers={customers}
          contacts={contacts}
          companies={companies}
          debtsByCustomerId={debtsByCustomerId}
          currency={settings.currency}
          locale={locale}
          showFinance={modules.sales === true}
          onEdit={(customer) => {
            setEditingCustomer(customer)
            setFormMode('edit')
          }}
          onSetStatus={(customer) =>
            setCustomerStatus(
              customer.id,
              customer.status === 'active' ? 'inactive' : 'active',
            )
          }
          onReconciliation={
            modules.sales === true ? (customer) => setReconciling(customer) : undefined
          }
        />
        )
      ) : null}

      {reconciling ? (
        <ReconciliationStatementDialog
          customerId={reconciling.id}
          customerName={getCustomerDisplayName(reconciling, contacts, companies)}
          onClose={() => setReconciling(null)}
        />
      ) : null}
    </section>
  )
}
