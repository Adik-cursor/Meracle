import { useMemo, useState, type FormEvent } from 'react'
import { useAccess } from '../../context/access-context'
import { useBranches } from '../../context/branch-context'
import { useExpenses } from '../../context/expense-context'
import { useLocalization } from '../../context/localization-context'
import { useOrganization } from '../../context/organization-context'
import { useUsers } from '../../context/user-context'
import { PagePlaceholder } from '../../../shared/components/PagePlaceholder'
import { WorkbookExportButton } from '../../../shared/components/WorkbookExportButton'
import { Button, Input, Modal, Select, Table } from '../../../shared/ui'
import {
  EXPENSE_CATEGORIES,
  type DomainErrorCode,
  type ExpenseCategory,
} from '../../../core/types'
import { todayExpenseDateInput } from '../../../core/services'
import {
  buildFinanceExpensesSheet,
  filterExpensesForFinanceExport,
} from '../../../core/services'
import type { TranslationKey } from '../../../core/localization/translations'
import { userDisplayName } from '../../../modules/crm/users/user-name'
import { formatMoney } from '../../../modules/sales/pos-format'
import { formatYearMonth } from '../../../shared/format-period'

const EXPENSE_LABEL: Record<ExpenseCategory, TranslationKey> = {
  rent: 'expenseCategory_rent',
  salary: 'expenseCategory_salary',
  marketing: 'expenseCategory_marketing',
  delivery: 'expenseCategory_delivery',
  procurement: 'expenseCategory_procurement',
  utilities: 'expenseCategory_utilities',
  tax: 'expenseCategory_tax',
  bank_commission: 'expenseCategory_bank_commission',
  other: 'expenseCategory_other',
}

function expenseErrorKey(code: DomainErrorCode): TranslationKey {
  if (code === 'ACCESS_DENIED' || code === 'MODULE_NOT_ENABLED' || code === 'INVALID_INPUT') {
    return code
  }
  return 'INVALID_INPUT'
}

export function ExpensesPage({ embedded = false }: { embedded?: boolean }) {
  const { t, locale } = useLocalization()
  const { modules, settings } = useOrganization()
  const { hasFinancialAccess } = useAccess()
  const { branches } = useBranches()
  const { expenses, createExpense } = useExpenses()
  const { getUser } = useUsers()
  const [showForm, setShowForm] = useState(false)
  const [category, setCategory] = useState<ExpenseCategory>('salary')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayExpenseDateInput)
  const [branchId, setBranchId] = useState('')
  const [formError, setFormError] = useState<TranslationKey | null>(null)
  const [filterCategory, setFilterCategory] = useState('')
  const [query, setQuery] = useState('')
  const currentMonth = todayExpenseDateInput().slice(0, 7)
  const [period, setPeriod] = useState(currentMonth)
  const filtered = useMemo(() => {
    return filterExpensesForFinanceExport(expenses, {
      monthKey: period,
      category: filterCategory,
      query,
    })
  }, [expenses, filterCategory, query, period])

  if (modules.expenses !== true) {
    return (
      <PagePlaceholder
        title={t('MODULE_NOT_ENABLED')}
        description={t('MODULE_NOT_ENABLED')}
      />
    )
  }

  if (!hasFinancialAccess('expenses.read')) {
    return (
      <PagePlaceholder title={t('ACCESS_DENIED')} description={t('ACCESS_DENIED')} />
    )
  }

  const canCreate = hasFinancialAccess('expenses.create')
  const money = (value: number) => formatMoney(value, locale, settings.currency)

  const total = filtered.reduce((sum, expense) => sum + expense.amount, 0)
  const byCategory = EXPENSE_CATEGORIES.map((item) => ({
    item,
    amount: filtered
      .filter((expense) => expense.category === item)
      .reduce((sum, expense) => sum + expense.amount, 0),
  })).filter((row) => row.amount > 0)

  const resetForm = () => {
    setDescription('')
    setAmount('')
    setDate(todayExpenseDateInput())
    setCategory('salary')
    setBranchId('')
    setFormError(null)
  }

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = Number(amount)
    const name = description.trim()
    if (!name || !date || !Number.isFinite(parsed) || parsed <= 0) {
      setFormError('INVALID_INPUT')
      return
    }

    const created = createExpense({
      category,
      description: name,
      amount: parsed,
      date,
      branchId: branchId || undefined,
    })
    if (created.ok) {
      resetForm()
      setShowForm(false)
      return
    }

    setFormError(expenseErrorKey(created.error.code))
  }

  const expenseSheet = buildFinanceExpensesSheet(
    filtered,
    {
      currency: settings.currency,
      responsible: (user, createdByUserId) =>
        user ? userDisplayName(user) : createdByUserId.slice(-6),
    },
    getUser,
  )

  return (
    <section className={embedded ? 'finance-page' : 'workspace-page finance-page'}>
      {embedded ? (
        <div className="finance-page__header">
          <WorkbookExportButton filename="finance-expenses.xlsx" sheets={[expenseSheet]} />
          {canCreate ? (
            <Button
              variant="primary"
              onClick={() => {
                resetForm()
                setShowForm(true)
              }}
            >
              {t('quickNewExpense')}
            </Button>
          ) : null}
        </div>
      ) : (
      <header className="finance-page__header">
        <div>
          <h2 className="finance-page__title">{t('navFinanceSection')}</h2>
          <p className="finance-page__period">
            {t('expenseDate')}: {formatYearMonth(period, locale)}
          </p>
        </div>
        <WorkbookExportButton filename="finance-expenses.xlsx" sheets={[expenseSheet]} />
        {canCreate ? (
          <Button
            variant="primary"
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
          >
            {t('quickNewExpense')}
          </Button>
        ) : null}
      </header>
      )}

      <div className="finance-summary">
        <article className="finance-summary__total">
          <p className="care-dashboard__label">{t('careExpenses')}</p>
          <p className="finance-summary__value">{money(total)}</p>
        </article>
        <article className="finance-summary__cats">
          <p className="care-dashboard__label">{t('financeByCategory')}</p>
          {byCategory.length === 0 ? (
            <p className="finance-empty">{t('financeEmpty')}</p>
          ) : (
            byCategory.map((row) => (
              <div key={row.item} className="finance-cat-row">
                <span>{t(EXPENSE_LABEL[row.item])}</span>
                <span>{money(row.amount)}</span>
              </div>
            ))
          )}
        </article>
      </div>

      <h3 className="care-dashboard__section-title">{t('financeExpenseList')}</h3>
      <div className="finance-filters">
        <label className="finance-period-control">
          <span>{t('dashboardFinancialPeriod')}</span>
          <Input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
        </label>
        <Select
          value={filterCategory}
          onChange={(event) => setFilterCategory(event.target.value)}
        >
          <option value="">{t('expenseCategory')}</option>
          {EXPENSE_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {t(EXPENSE_LABEL[item])}
            </option>
          ))}
        </Select>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('searchPlaceholder')}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="finance-empty">{t('financeEmpty')}</p>
      ) : (
        <div className="finance-table-wrap">
          <Table mobileLayout="cards">
            <thead>
              <tr>
                <th>{t('expenseDate')}</th>
                <th>{t('expenseCategory')}</th>
                <th>{t('description')}</th>
                <th>{t('expenseAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((expense) => (
                <tr key={expense.id}>
                  <td>{expense.date.slice(8, 10)}.{expense.date.slice(5, 7)}</td>
                  <td>{t(EXPENSE_LABEL[expense.category])}</td>
                  <td>{expense.description}</td>
                  <td>{money(expense.amount)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {showForm && canCreate ? (
        <Modal title={t('quickNewExpense')} onClose={() => setShowForm(false)}>
          <form className="finance-form" onSubmit={handleCreate}>
            <label>
              <span className="settings-field__label">{t('expenseAmount')}</span>
              <Input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </label>
            <label>
              <span className="settings-field__label">{t('expenseDate')}</span>
              <Input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </label>
            <label>
              <span className="settings-field__label">{t('expenseCategory')}</span>
              <Select
                value={category}
                onChange={(event) => setCategory(event.target.value as ExpenseCategory)}
              >
                {EXPENSE_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {t(EXPENSE_LABEL[item])}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span className="settings-field__label">{t('description')}</span>
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
              />
            </label>
            {branches.length > 0 ? (
              <label>
                <span className="settings-field__label">{t('navBranches')}</span>
                <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                  <option value="">{t('allBranches')}</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}
            {formError ? <p className="field__error">{t(formError)}</p> : null}
            <div className="finance-form__actions">
              <Button type="button" onClick={() => setShowForm(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" variant="primary">
                {t('financeSaveExpense')}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  )
}
