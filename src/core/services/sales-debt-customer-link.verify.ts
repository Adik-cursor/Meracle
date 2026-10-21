import { checkoutOnCreditForUser } from './checkout-on-credit'
import { getCustomerDebtForUser, listSaleDebtRowsForUser } from './customer-debts'
import { assert, setupSalesOrg } from './sales-debt.fixture'

export function runSalesDebtCustomerLinkChecks(): void {
  const ctx = setupSalesOrg('org-dsk-debt-link', 'DSK')
  const credited = checkoutOnCreditForUser(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    ctx.saleId,
  )
  assert(credited.ok, 'credit')
  const rows = listSaleDebtRowsForUser(ctx.persistence, ctx.owner)
  assert(rows.ok, 'rows')
  const row = rows.value.find((item) => item.saleId === ctx.saleId)
  assert(row, 'sale debt row')
  assert(row.customerId === ctx.customerId, 'linked customer')
  assert(row.organizationId === ctx.orgId, 'linked org')
  const customer = getCustomerDebtForUser(ctx.persistence, ctx.owner, ctx.customerId)
  assert(customer.ok && customer.value.remainingDebt === 100, 'customer remaining')
  console.log('sales-debt-customer-link.verify: ok')
}

runSalesDebtCustomerLinkChecks()
