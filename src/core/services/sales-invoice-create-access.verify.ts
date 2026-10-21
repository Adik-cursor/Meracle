import { addOrg, addUser } from './sales-invoice.verify'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { addRoleUser, setupRentalOrg, assert } from './sales-debt.fixture'
import { checkoutOnCreditForUser } from './checkout-on-credit'
import {
  createSaleInvoiceForUser,
  generateSaleInvoicePdfForUser,
} from './sales-invoices'
import { issueInternalSaleReceiptForUser } from './internal-receipts'
import { isPdfBytes, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runSalesInvoiceCreateAccessChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-inv-access', 'ТОО Invoice Access', '000000000003')
  const ownerInvoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, {
    saleId: ctx.saleId,
  })
  assert(ownerInvoice.ok, 'owner can create invoice')
  const opened = await generateSaleInvoicePdfForUser(
    ctx.persistence,
    ctx.owner,
    ownerInvoice.value.id,
  )
  assert(opened.ok && isPdfBytes(opened.value.bytes), 'existing invoice opens')
  const downloaded = await generateSaleInvoicePdfForUser(
    ctx.persistence,
    ctx.owner,
    ownerInvoice.value.id,
  )
  assert(downloaded.ok && isPdfBytes(downloaded.value.bytes), 'existing invoice downloads')

  const employeeOrg = setupInvoiceOrg('org-inv-emp', 'ТОО Invoice Employee', '000000000005')
  const employee = addRoleUser(
    employeeOrg.persistence,
    employeeOrg.orgId,
    'sales_employee',
    employeeOrg.warehouseId,
  )
  const employeeInvoice = createSaleInvoiceForUser(employeeOrg.persistence, employee, {
    saleId: employeeOrg.saleId,
  })
  assert(employeeInvoice.ok, 'sales employee can create invoice')
  const employeePdf = await generateSaleInvoicePdfForUser(
    employeeOrg.persistence,
    employee,
    employeeInvoice.value.id,
  )
  assert(employeePdf.ok && isPdfBytes(employeePdf.value.bytes), 'employee can open pdf')

  const credited = checkoutOnCreditForUser(
    employeeOrg.persistence,
    employeeOrg.owner,
    employeeOrg.orgId,
    employeeOrg.saleId,
  )
  assert(credited.ok, 'complete sale for receipt')
  const receipt = issueInternalSaleReceiptForUser(
    employeeOrg.persistence,
    employee,
    employeeOrg.saleId,
  )
  assert(receipt.ok, 'existing receipt path still works')
  const receiptAgain = issueInternalSaleReceiptForUser(
    employeeOrg.persistence,
    employee,
    employeeOrg.saleId,
  )
  assert(receiptAgain.ok && receiptAgain.value.id === receipt.value.id, 'receipt stays separate')

  const accountant = addRoleUser(
    employeeOrg.persistence,
    employeeOrg.orgId,
    'accountant',
    employeeOrg.warehouseId,
  )
  const accountantDenied = createSaleInvoiceForUser(employeeOrg.persistence, accountant, {
    saleId: employeeOrg.saleId,
  })
  assert(
    !accountantDenied.ok && accountantDenied.error.code === 'FORBIDDEN',
    'accountant without sales docs cannot create',
  )

  const noAccount = addRoleUser(
    employeeOrg.persistence,
    employeeOrg.orgId,
    'sales_employee',
    employeeOrg.warehouseId,
  )
  employeeOrg.persistence.users.update(noAccount.id, { accountEnabled: false })
  const disabled = employeeOrg.persistence.users.getById(noAccount.id)
  const noAccountDenied = createSaleInvoiceForUser(employeeOrg.persistence, disabled, {
    saleId: employeeOrg.saleId,
  })
  assert(!noAccountDenied.ok, 'employee without account cannot create')

  const rental = setupRentalOrg()
  const rentalDenied = createSaleInvoiceForUser(rental.persistence, rental.owner, {
    saleId: 'x',
  })
  assert(
    !rentalDenied.ok && rentalDenied.error.code === 'MODULE_NOT_ENABLED',
    'sales module gating',
  )

  const persistence = createInMemoryPersistence()
  addOrg(persistence, 'org-inv-kg', 'Kindergarten')
  seedEnabledBusinessModules(persistence, 'org-inv-kg', 'seed', ['crm', 'children'])
  const kgOwner = addUser(persistence, 'org-inv-kg', 'owner')
  const kgDenied = createSaleInvoiceForUser(persistence, kgOwner, { saleId: 'x' })
  assert(!kgDenied.ok && kgDenied.error.code === 'MODULE_NOT_ENABLED', 'kindergarten gated')
  console.log('sales-invoice-create-access.verify: ok')
}

void runSalesInvoiceCreateAccessChecks()
