import { checkoutOnCreditForUser } from './checkout-on-credit'
import { createSaleForUser } from './sales'
import { setStock } from './inventory'
import {
  createCustomerDebtPaymentForUser,
  listCustomerDebtGroupsForUser,
} from './customer-debts'
import { assert, setupSalesOrg } from './sales-debt.fixture'

export function runCustomerDebtsGroupChecks(): void {
  const ctx = setupSalesOrg('org-debt-group', 'Live Shop')
  const first = checkoutOnCreditForUser(ctx.persistence, ctx.owner, ctx.orgId, ctx.saleId)
  assert(first.ok, 'first credit')
  setStock(ctx.persistence, ctx.orgId, ctx.warehouseId, ctx.productId, 20)
  const secondSale = createSaleForUser(ctx.persistence, ctx.owner, ctx.orgId, 'KZT', {
    warehouseId: ctx.warehouseId,
    discount: 0,
    customerId: ctx.customerId,
    items: [{ productId: ctx.productId, quantity: 1, unitPrice: 50, discount: 0 }],
  })
  assert(secondSale.ok, 'second sale')
  const second = checkoutOnCreditForUser(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    secondSale.value.sale.id,
  )
  assert(second.ok, 'second credit')
  const paid = createCustomerDebtPaymentForUser(ctx.persistence, ctx.owner, {
    customerId: ctx.customerId,
    saleId: ctx.saleId,
    amount: 40,
    method: 'cash',
  })
  assert(paid.ok, 'partial')
  const groups = listCustomerDebtGroupsForUser(ctx.persistence, ctx.owner)
  assert(groups.ok, 'groups')
  const forCustomer = groups.value.filter((item) => item.customerId === ctx.customerId)
  assert(forCustomer.length === 1, 'one customer row')
  const group = forCustomer[0]
  assert(group?.saleCount === 2, 'two sales inside')
  assert(group.charged === 150, 'charged 100+50')
  assert(group.paidAmount === 40, 'paid')
  assert(group.remainingAmount === 110, 'remaining = sales - payments')
  assert(group.sales.length === 2, 'detail rows')
  console.log('customer-debts-group.verify: ok')
}

runCustomerDebtsGroupChecks()
