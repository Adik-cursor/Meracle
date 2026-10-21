import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hasEffectiveFinancialPermission } from './access'
import { PERMISSION_CAPABILITIES } from '../../modules/company/permission-ui'
import { getFinancialPermissions } from '../types/financial-permission'
import { addRoleUser, setupSalesOrg, assert } from './sales-debt.fixture'
import { createPaymentForUser } from './create-payment'
import { createReturnForUser } from './sale-returns'
import { createPaymentRefundForUser } from './create-payment-refund'
import { createReconciliationStatementForUser } from './reconciliation-statements'
import { checkoutOnCreditForUser } from './checkout-on-credit'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

export function runSalesDocumentPermissionChecks(): void {
  const capability = PERMISSION_CAPABILITIES.find(
    (item) => item.domain === 'financial' && item.permission === 'sales.documents.create',
  )
  assert(capability?.labelKey === 'permSalesDocumentsCreate', 'capability label key')
  assert(capability?.group === 'sales', 'sales group')
  const translations = readFileSync(join(root, 'src/core/localization/translations.ts'), 'utf8')
  assert(translations.includes("ru: 'Формирование документов продажи'"), 'user label ru')
  assert(!translations.includes("ru: 'sales.documents.create'"), 'no technical name in UI')

  const withDocs = [
    'owner',
    'commercial_director',
    'branch_director',
    'sales_manager',
    'sales_employee',
  ] as const
  for (const role of withDocs) {
    assert(
      getFinancialPermissions(role).includes('sales.documents.create'),
      `${role} has sales.documents.create`,
    )
  }
  const withoutDocs = [
    'accountant',
    'office_employee',
    'warehouse_manager',
    'kindergarten_admin',
  ] as const
  for (const role of withoutDocs) {
    assert(
      !getFinancialPermissions(role).includes('sales.documents.create'),
      `${role} has no sales.documents.create`,
    )
  }

  const employeePerms = getFinancialPermissions('sales_employee')
  assert(!employeePerms.includes('returns.create'), 'docs ≠ return')
  assert(!employeePerms.includes('refunds.create'), 'docs ≠ refund')
  assert(!employeePerms.includes('financial_documents.manage'), 'docs ≠ finance manage')

  const ctx = setupSalesOrg('org-doc-perm', 'Docs Perm')
  const employee = addRoleUser(ctx.persistence, ctx.orgId, 'sales_employee', ctx.warehouseId)
  const accountant = addRoleUser(ctx.persistence, ctx.orgId, 'accountant', ctx.warehouseId)
  assert(hasEffectiveFinancialPermission(ctx.owner, 'sales.documents.create'), 'owner effective')
  assert(hasEffectiveFinancialPermission(employee, 'sales.documents.create'), 'employee effective')
  assert(
    !hasEffectiveFinancialPermission(accountant, 'sales.documents.create'),
    'accountant no docs from role',
  )

  const credited = checkoutOnCreditForUser(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    ctx.saleId,
  )
  assert(credited.ok, 'complete for return check')
  const saleItem = ctx.persistence.saleItems.listBySaleId(ctx.saleId)[0]
  assert(saleItem, 'sale item')
  const returned = createReturnForUser(ctx.persistence, employee, ctx.orgId, {
    saleId: ctx.saleId,
    reason: 'Проверка права',
    items: [{ saleItemId: saleItem.id, quantity: 1 }],
  })
  assert(!returned.ok, 'document permission does not grant return')
  const paid = createPaymentForUser(ctx.persistence, ctx.owner, {
    organizationId: ctx.orgId,
    createdBy: ctx.owner.id,
    saleId: ctx.saleId,
    amount: 10,
    method: 'cash',
  })
  assert(paid.ok, 'owner payment for refund check')
  const refunded = createPaymentRefundForUser(ctx.persistence, employee, {
    organizationId: ctx.orgId,
    createdBy: employee.id,
    paymentId: paid.value.id,
    amount: 1,
  })
  assert(!refunded.ok, 'document permission does not grant refund')
  const recon = createReconciliationStatementForUser(ctx.persistence, employee, {
    customerId: ctx.customerId,
    dateFrom: '2020-01-01',
    dateTo: '2030-01-01',
  })
  assert(!recon.ok && recon.error.code === 'FORBIDDEN', 'recon stays manage')
  console.log('sales-document-permission.verify: ok')
}

runSalesDocumentPermissionChecks()
