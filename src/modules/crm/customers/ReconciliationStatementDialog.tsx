import { useState, type FormEvent } from 'react'
import {
  createReconciliationStatementForUser,
  generateReconciliationStatementPdfForUser,
} from '../../../core/services'
import { downloadSaleInvoicePdf, openSaleInvoicePdf } from '../../../core/pdf/sale-invoice-pdf'
import { useAccess } from '../../../app/context/access-context'
import { useLocalization } from '../../../app/context/localization-context'
import { usePersistence } from '../../../app/context/persistence-context'
import { Button, Modal } from '../../../shared/ui'
import type { TranslationKey } from '../../../core/localization/translations'
import type { ReconciliationStatement } from '../../../core/types'

type ReconciliationStatementDialogProps = {
  customerId: string
  customerName: string
  onClose: () => void
}

function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function monthStartIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${month}-01`
}

export function ReconciliationStatementDialog({
  customerId,
  customerName,
  onClose,
}: ReconciliationStatementDialogProps) {
  const { t } = useLocalization()
  const { currentUser, hasFinancialAccess } = useAccess()
  const persistence = usePersistence()
  const [dateFrom, setDateFrom] = useState(monthStartIso)
  const [dateTo, setDateTo] = useState(todayIso)
  const [documentDate, setDocumentDate] = useState(todayIso)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<ReconciliationStatement | null>(null)
  const canManage = hasFinancialAccess('financial_documents.manage')

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canManage) {
      setError('ACCESS_DENIED')
      return
    }
    const result = createReconciliationStatementForUser(persistence, currentUser, {
      customerId,
      dateFrom,
      dateTo,
      documentDate,
    })
    if (!result.ok) {
      setError(result.error.code)
      return
    }
    setError(null)
    setCreated(result.value)
  }

  const openPdf = (statementId: string, mode: 'open' | 'download') => {
    void generateReconciliationStatementPdfForUser(persistence, currentUser, statementId)
      .then((pdf) => {
        if (!pdf.ok) {
          setError(pdf.error.code)
          return
        }
        if (mode === 'download') {
          downloadSaleInvoicePdf(pdf.value.filename, pdf.value.bytes)
          return
        }
        openSaleInvoicePdf(pdf.value.bytes)
      })
      .catch(() => setError('RECONCILIATION_PDF_FAILED'))
  }

  return (
    <Modal title={t('reconciliationStatement')} onClose={onClose}>
      <p>{customerName}</p>
      {canManage ? (
        <form className="settings-section" onSubmit={handleCreate}>
          <label className="warehouse-field">
            <span className="settings-field__label">{t('reconciliationPeriodFrom')}</span>
            <input
              className="warehouse-input"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              required
            />
          </label>
          <label className="warehouse-field">
            <span className="settings-field__label">{t('reconciliationPeriodTo')}</span>
            <input
              className="warehouse-input"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              required
            />
          </label>
          <label className="warehouse-field">
            <span className="settings-field__label">{t('reconciliationDocumentDate')}</span>
            <input
              className="warehouse-input"
              type="date"
              value={documentDate}
              onChange={(event) => setDocumentDate(event.target.value)}
              required
            />
          </label>
          <Button type="submit" variant="primary">
            {t('createReconciliation')}
          </Button>
        </form>
      ) : null}
      {created ? (
        <div className="org-profile__item">
          <p>
            {t('reconciliationStatement')} №{created.documentNumber}
          </p>
          <div className="warehouse-card__actions">
            <Button type="button" onClick={() => openPdf(created.id, 'open')}>
              {t('openReconciliationPdf')}
            </Button>
            <Button type="button" onClick={() => openPdf(created.id, 'download')}>
              {t('downloadReconciliationPdf')}
            </Button>
          </div>
        </div>
      ) : null}
      {error ? <p className="pos-ticket__error">{t(error as TranslationKey)}</p> : null}
    </Modal>
  )
}
