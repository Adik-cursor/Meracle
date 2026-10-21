import { useMemo, useState } from 'react'
import { useLocalization } from '../../../app/context/localization-context'
import { Button, FormField, Input, Modal } from '../../../shared/ui'
import type { SupplyContractScheduleWrite, SupplyContractWrite } from '../../../core/services'

type SupplyContractFormModalProps = {
  saleTotal: number
  paidAmount: number
  remainingAmount: number
  defaultDate: string
  onClose: () => void
  onSubmit: (draft: Omit<SupplyContractWrite, 'saleId'>) => void
}

function emptyRow(): SupplyContractScheduleWrite {
  return { dueDate: '', plannedAmount: 0 }
}

export function SupplyContractFormModal({
  saleTotal,
  paidAmount,
  remainingAmount,
  defaultDate,
  onClose,
  onSubmit,
}: SupplyContractFormModalProps) {
  const { t } = useLocalization()
  const [number, setNumber] = useState('')
  const [contractDate, setContractDate] = useState(defaultDate)
  const [advance, setAdvance] = useState(String(paidAmount))
  const [fxRate, setFxRate] = useState('')
  const [fxRateDate, setFxRateDate] = useState('')
  const [coefficient, setCoefficient] = useState('')
  const [note, setNote] = useState('')
  const [schedule, setSchedule] = useState<SupplyContractScheduleWrite[]>([])
  const remainder = useMemo(() => {
    const parsed = Number(advance.replace(',', '.'))
    const safe = Number.isFinite(parsed) ? parsed : 0
    return Math.max(0, Math.round((saleTotal - safe) * 100) / 100)
  }, [advance, saleTotal])

  return (
    <Modal title={t('supplyContract')} onClose={onClose}>
      <form
        className="supply-contract-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit({
            number,
            contractDate,
            advanceAmount: Number(advance.replace(',', '.')) || 0,
            fxRate,
            fxRateDate,
            correctionCoefficient: coefficient,
            paymentTermsNote: note,
            schedule,
          })
        }}
      >
        <div className="supply-contract-form__grid">
          <FormField label={t('supplyContractNumber')}>
            <Input value={number} onChange={(event) => setNumber(event.target.value)} />
          </FormField>
          <FormField label={t('supplyContractDate')}>
            <Input
              type="date"
              value={contractDate}
              onChange={(event) => setContractDate(event.target.value)}
            />
          </FormField>
          <FormField label={t('supplyContractAdvance')}>
            <Input value={advance} onChange={(event) => setAdvance(event.target.value)} />
          </FormField>
          <FormField label={t('supplyContractRemainder')}>
            <Input value={String(remainder)} readOnly />
          </FormField>
          <FormField label={t('supplyContractFxRate')}>
            <Input value={fxRate} onChange={(event) => setFxRate(event.target.value)} />
          </FormField>
          <FormField label={t('supplyContractFxDate')}>
            <Input
              type="date"
              value={fxRateDate}
              onChange={(event) => setFxRateDate(event.target.value)}
            />
          </FormField>
          <FormField label={t('supplyContractCoefficient')}>
            <Input
              value={coefficient}
              onChange={(event) => setCoefficient(event.target.value)}
            />
          </FormField>
        </div>
        <FormField label={t('supplyContractTerms')}>
          <Input value={note} onChange={(event) => setNote(event.target.value)} />
        </FormField>
        <div className="supply-contract-form__schedule">
          <p className="sale-detail__doc-meta">{t('supplyContractSchedule')}</p>
          {schedule.map((row, index) => (
            <div key={index} className="supply-contract-form__row">
              <Input
                type="date"
                aria-label={t('supplyContractDueDate')}
                value={row.dueDate}
                onChange={(event) => {
                  const next = [...schedule]
                  next[index] = { ...row, dueDate: event.target.value }
                  setSchedule(next)
                }}
              />
              <Input
                aria-label={t('supplyContractPlannedAmount')}
                value={row.plannedAmount ? String(row.plannedAmount) : ''}
                onChange={(event) => {
                  const next = [...schedule]
                  next[index] = {
                    ...row,
                    plannedAmount: Number(event.target.value.replace(',', '.')) || 0,
                  }
                  setSchedule(next)
                }}
              />
            </div>
          ))}
          <Button type="button" onClick={() => setSchedule((current) => [...current, emptyRow()])}>
            {t('supplyContractAddSchedule')}
          </Button>
        </div>
        <p className="sale-detail__doc-meta">
          {t('saleTotal')}: {saleTotal} · {t('debtRemaining')}: {remainingAmount}
        </p>
        <div className="sale-detail__doc-actions">
          <Button type="submit" variant="primary">
            {t('createSupplyContract')}
          </Button>
          <Button type="button" onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
