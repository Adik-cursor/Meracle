import { useState, type FormEvent } from 'react'
import { useAccess } from '../../app/context/access-context'
import { useCare } from '../../app/context/care-context'
import { useLocalization } from '../../app/context/localization-context'
import { useOrganization } from '../../app/context/organization-context'
import { AuthRequiredState } from '../../app/components/AuthRequiredState'
import { useAppPath } from '../../app/routes/useAppPath'
import {
  childAgeYears,
  childDisplayName,
  currentCareChargePeriod,
  formatCareChargePeriod,
  tallyAttendanceRecords,
  todayExpenseDateInput,
} from '../../core/services'
import type { TranslationKey } from '../../core/localization/translations'
import type { ServiceResult } from '../../core/types/domain-error'
import { Button, EmptyState, Input, Modal } from '../../shared/ui'
import { ChildForm } from './ChildForm'
import { childStatusLabelKey } from './child-status-label'

export function ChildDetailPage({ childId }: { childId: string }) {
  const { t, locale } = useLocalization()
  const { navigate } = useAppPath()
  const { currentUser, hasCareAccess } = useAccess()
  const { modules, settings } = useOrganization()
  const {
    getChild,
    getGroup,
    listChildAttendance,
    updateChild,
    groups,
    getChildParent,
    listSiblings,
    getChildFinance,
    createCareCharge,
    createCarePayment,
  } = useCare()
  const [editing, setEditing] = useState(false)
  const [chargeOpen, setChargeOpen] = useState(false)
  const [payChargeId, setPayChargeId] = useState<string | null>(null)

  if (!currentUser) {
    return <AuthRequiredState />
  }

  const child = getChild(childId)
  if (!child) {
    return <EmptyState title={t('CHILD_NOT_FOUND')} />
  }

  const group = child.groupId ? getGroup(child.groupId) : undefined
  const parent = getChildParent(child.id)
  const siblings = parent.customerId
    ? listSiblings(parent.customerId).filter((item) => item.id !== child.id)
    : []
  const finance = getChildFinance(child.id)
  const age = childAgeYears(child.birthDate)
  const history = listChildAttendance(child.id)
  const today = todayExpenseDateInput()
  const todayRecord = history.find((item) => item.date === today)
  const tally = tallyAttendanceRecords(history)
  const canManage = hasCareAccess('children.manage')
  const canOpenContact =
    Boolean(parent.contactId) && (modules.crm === true || modules.contacts === true)
  const attendanceHref = child.groupId
    ? `/attendance?group=${encodeURIComponent(child.groupId)}`
    : '/attendance'
  const money = (value: number, currency = finance?.currency ?? settings.currency) =>
    `${value.toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-RU')} ${currency}`
  const payLine = finance?.lines.find((line) => line.chargeId === payChargeId)

  return (
    <section className="workspace-page care-page">
      <Button onClick={() => navigate('/children')}>{t('careBack')}</Button>
      <header className="care-page__header">
        <div>
          <h2 className="care-page__title">{childDisplayName(child)}</h2>
          <p className="care-page__meta">
            {child.birthDate}
            {age !== undefined ? ` · ${age}` : ''}
            {group ? ` · ${group.name}` : ''}
            {` · ${t(childStatusLabelKey(child.status))}`}
          </p>
        </div>
        <div className="care-page__actions">
          {canManage ? (
            <Button onClick={() => setEditing(true)}>{t('edit')}</Button>
          ) : null}
          <Button variant="primary" onClick={() => navigate(attendanceHref)}>
            {t('careOpenAttendance')}
          </Button>
        </div>
      </header>
      <div className="care-child-grid">
        <article>
          <h3>{t('careProfile')}</h3>
          <dl className="care-dl">
            <div>
              <dt>{t('careBirthDate')}</dt>
              <dd>{child.birthDate}</dd>
            </div>
            <div>
              <dt>{t('careGroup')}</dt>
              <dd>{group?.name ?? t('careNoGroup')}</dd>
            </div>
            <div>
              <dt>{t('status')}</dt>
              <dd>{t(childStatusLabelKey(child.status))}</dd>
            </div>
          </dl>
        </article>
        <article>
          <h3>{t('careParentLegal')}</h3>
          {parent.fullName || parent.phone ? (
            <>
              <dl className="care-dl">
                <div>
                  <dt>{t('careParentName')}</dt>
                  <dd>{parent.fullName ?? '—'}</dd>
                </div>
                <div>
                  <dt>{t('phone')}</dt>
                  <dd>{parent.phone ?? '—'}</dd>
                </div>
              </dl>
              {canOpenContact ? (
                <div className="care-page__actions">
                  <Button
                    onClick={() =>
                      navigate(modules.contacts === true ? '/contacts' : '/customers')
                    }
                  >
                    {t('careOpenContact')}
                  </Button>
                </div>
              ) : null}
              {siblings.length > 0 ? (
                <div>
                  <p className="care-page__meta">{t('careSiblings')}</p>
                  <ul className="care-history">
                    {siblings.map((item) => (
                      <li key={item.id}>
                        <Button onClick={() => navigate(`/children/${item.id}`)}>
                          {childDisplayName(item)}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="care-dashboard__muted">{t('careParentUnset')}</p>
          )}
        </article>
        <article>
          <h3>{t('careFinance')}</h3>
          {!parent.customerId ? (
            <p className="care-dashboard__muted">{t('careFinanceNeedParent')}</p>
          ) : finance ? (
            <>
              <p className="care-page__meta">{t('careFinanceTotal')}</p>
              <dl className="care-dl">
                <div>
                  <dt>{t('careCharged')}</dt>
                  <dd>{money(finance.charged)}</dd>
                </div>
                <div>
                  <dt>{t('carePaid')}</dt>
                  <dd>{money(finance.paid)}</dd>
                </div>
                <div>
                  <dt>{t('careDue')}</dt>
                  <dd>{money(finance.due)}</dd>
                </div>
              </dl>
              {finance.lines.length === 0 ? (
                <p className="care-dashboard__muted">{t('careFinanceEmpty')}</p>
              ) : (
                <>
                  <p className="care-page__meta">{t('careChargeHistory')}</p>
                  <ul className="care-charge-list">
                    {finance.lines.map((line) => (
                      <li key={line.chargeId}>
                        <h4>
                          {line.period
                            ? formatCareChargePeriod(line.period, locale)
                            : t('careChargeHistory')}
                        </h4>
                        <dl className="care-dl">
                          <div>
                            <dt>{t('careCharged')}</dt>
                            <dd>{money(line.charged, line.currency)}</dd>
                          </div>
                          <div>
                            <dt>{t('carePaid')}</dt>
                            <dd>{money(line.paid, line.currency)}</dd>
                          </div>
                          <div>
                            <dt>{t('careDue')}</dt>
                            <dd>{money(line.due, line.currency)}</dd>
                          </div>
                        </dl>
                        {canManage && line.due > 0 ? (
                          <div className="care-page__actions">
                            <Button onClick={() => setPayChargeId(line.chargeId)}>
                              {t('carePayCharge')}
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {canManage ? (
                <div className="care-page__actions">
                  <Button onClick={() => setChargeOpen(true)}>{t('careAddCharge')}</Button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="care-dashboard__muted">{t('careFinanceNeedParent')}</p>
          )}
        </article>
        <article>
          <h3>{t('navAttendance')}</h3>
          <dl className="care-dl">
            <div>
              <dt>{t('careTodayAttendance')}</dt>
              <dd>
                {todayRecord
                  ? todayRecord.status === 'present'
                    ? t('carePresent')
                    : t('careAbsent')
                  : t('careUnmarked')}
              </dd>
            </div>
            <div>
              <dt>{t('carePresent')}</dt>
              <dd>{tally.present}</dd>
            </div>
            <div>
              <dt>{t('careAbsent')}</dt>
              <dd>{tally.absent}</dd>
            </div>
            <div>
              <dt>{t('careUnmarked')}</dt>
              <dd>{todayRecord ? 0 : 1}</dd>
            </div>
            <div>
              <dt>{t('careAttendanceRate')}</dt>
              <dd>{tally.attendancePercent}%</dd>
            </div>
          </dl>
          {history.length === 0 ? (
            <p className="care-dashboard__muted">{t('careAttendanceEmpty')}</p>
          ) : (
            <ul className="care-history">
              {history.slice(0, 14).map((item) => (
                <li key={item.id}>
                  {item.date} ·{' '}
                  {item.status === 'present' ? t('carePresent') : t('careAbsent')}
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
      {editing ? (
        <ChildForm
          initial={child}
          groups={groups}
          onClose={() => setEditing(false)}
          onSave={(draft) => updateChild(child.id, draft)}
        />
      ) : null}
      {chargeOpen ? (
        <CareChargeForm
          currency={settings.currency}
          onClose={() => setChargeOpen(false)}
          onSave={(draft) =>
            createCareCharge({
              ...draft,
              childId: child.id,
              currency: settings.currency,
            })
          }
        />
      ) : null}
      {payLine && payLine.due > 0 ? (
        <CarePaymentForm
          remaining={payLine.due}
          currency={payLine.currency}
          onClose={() => setPayChargeId(null)}
          onSave={(draft) =>
            createCarePayment({
              ...draft,
              childId: child.id,
              careChargeId: payLine.chargeId,
            })
          }
        />
      ) : null}
    </section>
  )
}

function CareChargeForm({
  currency,
  onClose,
  onSave,
}: {
  currency: string
  onClose: () => void
  onSave: (draft: {
    amount: number
    period: string
    description?: string
    dueDate?: string
  }) => ServiceResult<unknown>
}) {
  const { t } = useLocalization()
  const [period, setPeriod] = useState(currentCareChargePeriod())
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState<TranslationKey | null>(null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const result = onSave({
      amount: Number(amount),
      period,
      description: description.trim() || undefined,
      dueDate: dueDate.trim() || undefined,
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
          <span>{t('careChargePeriod')}</span>
          <Input
            type="month"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            required
          />
        </label>
        <label>
          <span>{t('careChargeAmount')} ({currency})</span>
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
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label>
          <span>{t('careChargeDueDate')}</span>
          <Input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
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

function CarePaymentForm({
  remaining,
  currency,
  onClose,
  onSave,
}: {
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
        <label>
          <span>{t('careChargeAmount')} ({currency})</span>
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
        <p className="care-page__meta">
          {t('careDue')}: {remaining.toLocaleString()} {currency}
        </p>
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
            {t('carePayCharge')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
