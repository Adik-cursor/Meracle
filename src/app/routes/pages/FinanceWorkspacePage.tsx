import { useAccess } from '../../context/access-context'
import { useLocalization } from '../../context/localization-context'
import { useOrganization } from '../../context/organization-context'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { SectionTabs } from '../../../shared/ui'
import { useAppPath } from '../useAppPath'
import { AnalyticsPage } from './AnalyticsPage'
import { ExpensesPage } from './ExpensesPage'
import { CustomerDebtsPage } from './CustomerDebtsPage'
import { CustomerDebtJournalPage } from './CustomerDebtJournalPage'
import { KindergartenFinancePage } from '../../../modules/care/KindergartenFinancePage'
import { FinanceSalaryPage } from './FinanceSalaryPage'
import { RentalFinancePage } from './RentalFinancePage'
import {
  resolveFinanceNavGroups,
  resolveFinanceTabAlias,
  type FinanceWorkspaceTabId,
} from '../../../core/services'
import type { TranslationKey } from '../../../core/localization/translations'

const TAB_LABEL: Record<FinanceWorkspaceTabId, TranslationKey> = {
  overview: 'navAnalyticsSection',
  analytics: 'navAnalyticsSection',
  operations: 'navExpensesSection',
  payments: 'financeTabPayments',
  charges: 'financeTabPayments',
  salary: 'financeTabSalary',
  debts: 'financeTabDebts',
  expenses: 'navExpensesSection',
}

export function FinanceWorkspacePage() {
  const { t } = useLocalization()
  const { pathname, search, navigate } = useAppPath()
  const { currentUser } = useAccess()
  const { modules } = useOrganization()
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const requested = pathname === '/expenses' ? 'expenses' : params.get('tab')
  const groups = resolveFinanceNavGroups(modules)
  const active = resolveFinanceTabAlias(requested, modules)
  const children = modules.children === true
  const rental = modules.rental === true
  const sales = modules.sales === true

  if (!currentUser) {
    return <AuthRequiredState />
  }

  const tabs = groups.flatMap((group) =>
    group.tabs.map((id) => ({
      id,
      label: t(TAB_LABEL[id]),
    })),
  )

  return (
    <section className="workspace-page finance-workspace ds-page">
      <div className="finance-shell">
        <SectionTabs
          label={t('navFinanceSection')}
          tabs={tabs}
          activeId={active}
          onSelect={(id) => navigate(`/finance?tab=${id}`)}
        />
        <div className="finance-main">
          {active === 'analytics' ? <AnalyticsPage embedded /> : null}
          {active === 'payments' && children ? (
            <KindergartenFinancePage embedded initialPaymentStatus="all" />
          ) : null}
          {active === 'payments' && !children && rental ? (
            <RentalFinancePage />
          ) : null}
          {active === 'payments' && !children && !rental && sales ? (
            <CustomerDebtJournalPage embedded />
          ) : null}
          {active === 'debts' && sales ? <CustomerDebtsPage embedded /> : null}
          {active === 'debts' && !sales && children ? (
            <KindergartenFinancePage embedded initialPaymentStatus="unpaid" />
          ) : null}
          {active === 'debts' && !sales && !children && rental ? (
            <RentalFinancePage dueOnly />
          ) : null}
          {active === 'salary' ? <FinanceSalaryPage /> : null}
          {active === 'expenses' ? <ExpensesPage embedded /> : null}
        </div>
      </div>
    </section>
  )
}
