import { addRoleUser, setupSalesOrg, assert } from './sales-debt.fixture'
import { checkoutOnCreditForUser } from './checkout-on-credit'
import {
  createDeliveryNoteForUser,
  generateDeliveryNotePdfForUser,
} from './delivery-notes'
import { isPdfBytes } from './sale-invoice-pdf.verify-support'

export async function runSalesDeliveryNoteCreateAccessChecks(): Promise<void> {
  const ownerCtx = setupSalesOrg('org-dn-access-owner', 'DN Owner')
  const ownerComplete = checkoutOnCreditForUser(
    ownerCtx.persistence,
    ownerCtx.owner,
    ownerCtx.orgId,
    ownerCtx.saleId,
  )
  assert(ownerComplete.ok, 'owner sale completed')
  const ownerNote = createDeliveryNoteForUser(ownerCtx.persistence, ownerCtx.owner, {
    saleId: ownerCtx.saleId,
  })
  assert(ownerNote.ok, 'owner can create delivery note')
  const ownerPdf = await generateDeliveryNotePdfForUser(
    ownerCtx.persistence,
    ownerCtx.owner,
    ownerNote.value.id,
  )
  assert(ownerPdf.ok && isPdfBytes(ownerPdf.value.bytes), 'owner open/download pdf')

  const ctx = setupSalesOrg('org-dn-access-emp', 'DN Employee')
  const credited = checkoutOnCreditForUser(ctx.persistence, ctx.owner, ctx.orgId, ctx.saleId)
  assert(credited.ok, 'sale completed')
  const employee = addRoleUser(ctx.persistence, ctx.orgId, 'sales_employee', ctx.warehouseId)
  const created = createDeliveryNoteForUser(ctx.persistence, employee, { saleId: ctx.saleId })
  assert(created.ok, 'sales employee can create delivery note')
  const opened = await generateDeliveryNotePdfForUser(ctx.persistence, employee, created.value.id)
  assert(opened.ok && isPdfBytes(opened.value.bytes), 'existing delivery note opens')
  const downloaded = await generateDeliveryNotePdfForUser(
    ctx.persistence,
    employee,
    created.value.id,
  )
  assert(downloaded.ok && isPdfBytes(downloaded.value.bytes), 'existing delivery note downloads')

  const accountant = addRoleUser(ctx.persistence, ctx.orgId, 'accountant', ctx.warehouseId)
  const denied = createDeliveryNoteForUser(ctx.persistence, accountant, { saleId: ctx.saleId })
  assert(!denied.ok && denied.error.code === 'FORBIDDEN', 'accountant cannot create note')

  const noAccount = addRoleUser(ctx.persistence, ctx.orgId, 'sales_employee', ctx.warehouseId)
  ctx.persistence.users.update(noAccount.id, { accountEnabled: false })
  const disabled = ctx.persistence.users.getById(noAccount.id)
  const noAccountDenied = createDeliveryNoteForUser(ctx.persistence, disabled, {
    saleId: ctx.saleId,
  })
  assert(!noAccountDenied.ok, 'employee without account cannot create note')
  console.log('sales-delivery-note-create-access.verify: ok')
}

void runSalesDeliveryNoteCreateAccessChecks()
