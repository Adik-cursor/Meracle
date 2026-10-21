import { useEffect, useState, type FormEvent } from 'react'
import { useAccess } from '../../app/context/access-context'
import { useCare } from '../../app/context/care-context'
import { useLocalization } from '../../app/context/localization-context'
import { useOrganization } from '../../app/context/organization-context'
import { AuthRequiredState } from '../../app/components/AuthRequiredState'
import { useAppPath } from '../../app/routes/useAppPath'
import {
  childDisplayName,
  currentCareChargePeriod,
  formatCareChargePeriod,
  shiftCareChargePeriod,
  type CarePaymentStatus,
} from '../../core/services'
import type { TranslationKey } from '../../core/localization/translations'
import type { ServiceResult } from '../../core/types/domain-error'
import { formatMoney } from '../sales/pos-format'
import { Button, Input, Modal, Select, Table } from '../../shared/ui'
import { WorkbookExportButton } from '../../shared/components/WorkbookExportButton'

function statusLabel(status: CarePaymentStatus): TranslationKey {
  if (status === 'paid') return 'carePayStatusPaid'
  if (status === 'partial') return 'carePayStatusPartial'
  return 'carePayStatusUnpaid'
}

export function KindergartenFinancePage({
  embedded = false,
  initialPaymentStatus = 'all',
}: {
  embedded?: boolean
  initialPaymentStatus?: 'all' | CarePaymentStatus
}) {
  const { t, locale } = useLocalization()
  const { navigate } = useAppPath()
  const { currentUser, hasCareAccess } = useAccess()
  const { settings } = useOrganization()
  const { groups, childrenList, listPeriodFinance, createCareCharge, createCarePayment } = useCare()
  const canManage = hasCareAccess('children.manage')
  const [period, setPeriod] = useState(currentCareChargePeriod)
  const [query, setQuery] = useState('')
  const [groupId, setGroupId] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'all' | CarePaymentStatus>(
    initialPaymentStatus,
  )
  useEffect(() => {
    setPaymentStatus(initialPaymentStatus)
  }, [initialPaymentStatus])
  const [chargeOpen, setChargeOpen] = useState(false)
  const [payRowId, setPayRowId] = useState<string | null>(null)

  const finance = listPeriodFinance({
    period,
    query,
    groupId: groupId || undefined,
    paymentStatus,
  })
  const payRow = finance?.rows.find((row) => row.chargeId === payRowId)
  const money = (value: number, currency = finance?.currency ?? settings.currency) =>
    formatMoney(value, locale, currency)
  const summary = [
    { id: 'charged', label: t('careCharged'), value: money(finance?.charged ?? 0) },
    { id: 'paid', label: t('carePaid'), value: money(finance?.paid ?? 0) },
    { id: 'due', label: t('careDue'), value: money(finance?.due ?? 0) },
    {
      id: 'withCharge',
      label: t('careFinanceChildrenCharged'),
      value: String(finance?.childrenWithCharge ?? 0),
    },
    {
      id: 'withDebt',
      label: t('careFinanceChildrenDue'),
      value: String(finance?.childrenWithDebt ?? 0),
    },
  ]

  if (!currentUser) {
    return <AuthRequiredState />
  }

  return (
    <section className={embedded ? 'care-page' : 'workspace-page care-page'}>
      {embedded ? null : (
      <header className="care-page__header">
        <div>
          <h2 className="care-page__title">{t('navFinanceSection')}</h2>
          <p className="care-page__meta">{t('careFinanceSubtitle')}</p>
        </div>
        {canManage ? (
          <div className="care-page__actions">
            <Button variant="primary" onClick={() => setChargeOpen(true)}>
              {t('careAddCharge')}
            </Button>
          </div>
        ) : null}
      </header>
      )}

      {embedded && canManage ? (
        <div className="care-page__actions">
          <Button variant="primary" onClick={() => setChargeOpen(true)}>
            {t('careAddCharge')}
          </Button>
        </div>
      ) : null}

      <div className="care-attendance-date">
        <Button aria-label={t('carePrevPeriod')} onClick={() => setPeriod(shiftCareChargePeriod(period, -1))}>
          ←
        </Button>
        <time>{formatCareChargePeriod(period, locale)}</time>
        <Button aria-label={t('careNextPeriod')} onClick={() => setPeriod(shiftCareChargePeriod(period, 1))}>
          →
        </Button>
        <Button
          variant={period === currentCareChargePeriod() ? 'primary' : 'secondary'}
          onClick={() => setPeriod(currentCareChargePeriod())}
        >
          {t('careToday')}
        </Button>
      </div>

      <div className="care-finance-summary">
        {summary.map((item) => (
          <article key={item.id} className={item.id === 'due' ? 'care-finance-summary__anchor' : undefined}>
            <span>{item.label}</span>
            <p>{item.value}</p>
          </article>
        ))}
      </div>

      <div className="care-filters">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('careSearchChild')}
        />
        <Select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
          <option value="">{t('careAllGroups')}</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>
        <Select
          value={paymentStatus}
          onChange={(event) => setPaymentStatus(event.target.value as 'all' | CarePaymentStatus)}
        >
          <option value="all">{t('carePayStatusAll')}</option>
          <option value="paid">{t('carePayStatusPaid')}</option>
          <option value="partial">{t('carePayStatusPartial')}</option>
          <option value="unpaid">{t('carePayStatusUnpaid')}</option>
        </Select>
        <WorkbookExportButton
          filename={`finance-care-${period}.xlsx`}
          sheets={[
            {
              name: paymentStatus === 'unpaid' ? 'Задолженности' : 'Оплаты',
              headers:
                paymentStatus === 'unpaid'
                  ? [
                      'Клиент',
                      'Основание',
                      'Дата',
                      'Начислено',
                      'Оплачено',
                      'Задолженность',
                      'Срок оплаты',
                      'Статус',
                      'Ответственный',
                    ]
                  : [
                      'Дата',
                      'Номер операции',
                      'Клиент',
                      'Основание',
                      'Тип',
                      'Сумма',
                      'Валюта',
                      'Статус',
                      'Ответственный',
                    ],
              rows: (finance?.rows ?? []).map((row) =>
                paymentStatus === 'unpaid'
                  ? [
                      row.childName,
                      row.groupName ?? '',
                      row.period,
                      row.charged,
                      row.paid,
                      row.due,
                      '',
                      row.paymentStatus,
                      '',
                    ]
                  : [
                      row.period,
                      row.chargeId.slice(-8).toUpperCase(),
                      row.childName,
                      row.groupName ?? '',
                      row.paymentStatus,
                      row.paid,
                      row.currency,
                      row.paymentStatus,
                      '',
                    ],
              ),
            },
          ]}
        />
      </div>

      {!finance || finance.rows.length === 0 ? (
        <div className="care-empty">
          <p className="care-dashboard__empty">{t('careFinanceEmptyPeriod')}</p>
        </div>
      ) : (
        <>
          <div className="care-table">
            <Table>
              <thead>
                <tr>
                  <th>{t('careChildName')}</th>
                  <th>{t('careGroup')}</th>
                  <th>{t('careCharged')}</th>
                  <th>{t('carePaid')}</th>
                  <th>{t('careDue')}</th>
                  <th>{t('status')}</th>
                  <th>{t('careOpen')}</th>
                </tr>
              </thead>
              <tbody>
                {finance.rows.map((row) => (
                  <tr key={row.chargeId}>
                    <td>{row.childName}</td>
                    <td>{row.groupName ?? t('careNoGroup')}</td>
                    <td>{money(row.charged, row.currency)}</td>
                    <td>{money(row.paid, row.currency)}</td>
                    <td>{money(row.due, row.currency)}</td>
                    <td>{t(statusLabel(row.paymentStatus))}</td>
                    <td>
                      <div className="care-page__actions">
                        <Button onClick={() => navigate(`/children/${row.childId}`)}>
                          {t('careOpen')}
                        </Button>
                        {canManage && row.due > 0 ? (
                          <Button variant="primary" onClick={() => setPayRowId(row.chargeId)}>
                            {t('carePayCharge')}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <ul className="care-cards">
            {finance.rows.map((row) => (
              <li key={row.chargeId}>
                <article className="care-finance-card">
                  <strong>{row.childName}</strong>
                  <span>{row.groupName ?? t('careNoGroup')}</span>
                  <dl className="care-dl">
                    <div>
                      <dt>{t('careCharged')}</dt>
                      <dd>{money(row.charged, row.currency)}</dd>
                    </div>
                    <div>
                      <dt>{t('carePaid')}</dt>
                      <dd>{money(row.paid, row.currency)}</dd>
                    </div>
                    <div>
                      <dt>{t('careDue')}</dt>
                      <dd>{money(row.due, row.currency)}</dd>
                    </div>
                    <div>
                      <dt>{t('status')}</dt>
                      <dd>{t(statusLabel(row.paymentStatus))}</dd>
                    </div>
                  </dl>
                  <div className="care-page__actions">
                    <Button onClick={() => navigate(`/children/${row.childId}`)}>
                      {t('careOpen')}
                    </Button>
                    {canManage && row.due > 0 ? (
                      <Button variant="primary" onClick={() => setPayRowId(row.chargeId)}>
                        {t('carePayCharge')}
                      </Button>
                    ) : null}
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </>
      )}

      {chargeOpen ? (
        <FinanceChargeForm
          period={period}
          currency={settings.currency}
          childrenList={childrenList}
          groups={groups}
          onClose={() => setChargeOpen(false)}
          onSave={(draft) => createCareCharge(draft)}
        />
      ) : null}
      {payRow && payRow.due > 0 ? (
        <FinancePaymentForm
          childName={payRow.childName}
          remaining={payRow.due}
          currency={payRow.currency}
          onClose={() => setPayRowId(null)}
          onSave={(draft) =>
            createCarePayment({
              childId: payRow.childId,
              careChargeId: payRow.chargeId,
              amount: draft.amount,
              note: draft.note,
            })
          }
        />
      ) : null}
    </section>
  )
}

function FinanceChargeForm({
  period: initialPeriod,
  currency,
  childrenList,
  groups,
  onClose,
  onSave,
}: {
  period: string
  currency: string
  childrenList: { id: string; firstName: string; lastName: string; groupId?: string }[]
  groups: { id: string; name: string }[]
  onClose: () => void
  onSave: (draft: {
    childId: string
    amount: number
    period: string
    description?: string
    dueDate?: string
    currency: string
  }) => ServiceResult<unknown>
}) {
  const { t } = useLocalization()
  const [childId, setChildId] = useState(childrenList[0]?.id ?? '')
  const [period, setPeriod] = useState(initialPeriod)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState<TranslationKey | null>(null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const result = onSave({
      childId,
      amount: Number(amount),
      period,
      description: description.trim() || undefined,
      dueDate: dueDate.trim() || undefined,
      currency,
    })
    if (!result.ok) {
      setError(result.error.code as TranslationKey)
      return
    }
    onClose()
  }

  return (
    <Modal title={t('careAddCharge')} onClose={onClose}>
      <form className="care-form" onSubmit={handleSubmit}>
        <label>
          <span>{t('careChildName')}</span>
          <Select value={childId} onChange={(event) => setChildId(event.target.value)} required>
            {childrenList.map((child) => {
              const group = child.groupId
                ? groups.find((item) => item.id === child.groupId)
                : undefined
              return (
                <option key={child.id} value={child.id}>
                  {childDisplayName(child)}
                  {group ? ` · ${group.name}` : ''}
                </option>
              )
            })}
          </Select>
        </label>
        <label>
          <span>{t('careChargePeriod')}</span>
          <Input
            type="month"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            required
          />
        </label>
        <label>
          <span>
            {t('careChargeAmount')} ({currency})
          </span>
          <Input
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>
        <label>
          <span>{t('careChargeDescription')}</span>
          <Input value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label>
          <span>{t('careChargeDueDate')}</span>
          <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
        {error ? <p className="field__error">{t(error)}</p> : null}
        <div className="care-form__actions">
          <Button type="button" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" variant="primary">
            {t('careCreateCharge')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function FinancePaymentForm({
  childName,
  remaining,
  currency,
  onClose,
  onSave,
}: {
  childName: string
  remaining: number
  currency: string
  onClose: () => void
  onSave: (draft: { amount: number; note?: string }) => ServiceResult<unknown>
}) {
  const { t } = useLocalization()
  const [amount, setAmount] = useState(String(remaining))
  const [note, setNote] = useState('')
  const [error, setError] = useState<TranslationKey | null>(null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const result = onSave({
      amount: Number(amount),
      note: note.trim() || undefined,
    })
    if (!result.ok) {
      setError(result.error.code as TranslationKey)
      return
    }
    onClose()
  }

  return (
    <Modal title={t('carePayCharge')} onClose={onClose}>
      <form className="care-form" onSubmit={handleSubmit}>
        <p className="care-page__meta">
          {childName} · {t('careDue')}: {remaining.toLocaleString()} {currency}
        </p>
        <label>
          <span>
            {t('careChargeAmount')} ({currency})
          </span>
          <Input
            type="number"
            min="1"
            step="1"
            max={remaining}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>
        <label>
          <span>{t('paymentComment')}</span>
          <Input value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        {error ? <p className="field__error">{t(error)}</p> : null}
        <div className="care-form__actions">
          <Button type="button" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" variant="primary">
            {t('carePostPayment')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
