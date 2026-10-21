import { addRoleUser, setupSalesOrg, assert } from './sales-debt.fixture'
import { checkoutOnCreditForUser } from './checkout-on-credit'
import { createSaleInvoiceForUser, listSaleInvoicesForUser } from './sales-invoices'
import { createDeliveryNoteForUser, listDeliveryNotesForUser } from './delivery-notes'

export function runSalesDocumentNoDuplicateChecks(): void {
  const ctx = setupSalesOrg('org-doc-nodup', 'No Dup Docs')
  const employee = addRoleUser(ctx.persistence, ctx.orgId, 'sales_employee', ctx.warehouseId)
  const firstInvoice = createSaleInvoiceForUser(ctx.persistence, employee, {
    saleId: ctx.saleId,
  })
  assert(firstInvoice.ok, 'first invoice')
  const secondInvoice = createSaleInvoiceForUser(ctx.persistence, employee, {
    saleId: ctx.saleId,
  })
  assert(
    secondInvoice.ok && secondInvoice.value.id === firstInvoice.value.id,
    'repeat invoice returns same',
  )
  assert(secondInvoice.value.invoiceNumber === firstInvoice.value.invoiceNumber, 'same number')
  const invoices = listSaleInvoicesForUser(ctx.persistence, employee, ctx.saleId)
  assert(
    invoices.ok && invoices.value.filter((item) => item.status !== 'cancelled').length === 1,
    'one invoice',
  )

  const credited = checkoutOnCreditForUser(ctx.persistence, ctx.owner, ctx.orgId, ctx.saleId)
  assert(credited.ok, 'completed')
  const firstNote = createDeliveryNoteForUser(ctx.persistence, employee, { saleId: ctx.saleId })
  assert(firstNote.ok, 'first note')
  const secondNote = createDeliveryNoteForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(secondNote.ok && secondNote.value.id === firstNote.value.id, 'repeat note returns same')
  const notes = listDeliveryNotesForUser(ctx.persistence, employee, ctx.saleId)
  assert(notes.ok && notes.value.length === 1, 'one delivery note')
  console.log('sales-document-no-duplicate.verify: ok')
}

runSalesDocumentNoDuplicateChecks()
