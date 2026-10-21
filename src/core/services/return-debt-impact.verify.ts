import { checkoutOnCreditForUser } from './checkout-on-credit'
import { checkoutSaleForUser } from './checkout-sale'
import { completeReturnForUser } from './complete-return'
import { createPaymentRefundForUser } from './create-payment-refund'
import {
  getCustomerDebtForUser,
  listCustomerDebtGroupsForUser,
} from './customer-debts'
import { createSaleForUser } from './sales'
import { setStock } from './inventory'
import { createReturnForUser } from './sale-returns'
import { getSaleSettlement } from './sale-settlement'
import { calculateReconciliationForCustomer } from './reconciliation-statements'
import { newId, nowIso } from './primitives'
import { setupSalesOrg, assert } from './sales-debt.fixture'
import type { Id, User } from '../types'
import type { Persistence } from '../repositories/persistence'

function restock(ctx: { persistence: Persistence; orgId: Id; warehouseId: Id; productId: Id }) {
  setStock(ctx.persistence, ctx.orgId, ctx.warehouseId, ctx.productId, 50)
}

function makeSale(
  persistence: Persistence,
  owner: User,
  orgId: Id,
  warehouseId: Id,
  productId: Id,
  customerId: Id,
  quantity: number,
  unitPrice: number,
) {
  restock({ persistence, orgId, warehouseId, productId })
  const created = createSaleForUser(persistence, owner, orgId, 'KZT', {
    warehouseId,
    discount: 0,
    customerId,
    items: [{ productId, quantity, unitPrice, discount: 0 }],
  })
  assert(created.ok, 'create sale')
  return created.value
}

function completeReturnQty(
  persistence: Persistence,
  owner: User,
  orgId: Id,
  saleId: Id,
  quantity: number,
  reason = 'Возврат товара',
) {
  const item = persistence.saleItems.listBySaleId(saleId)[0]
  assert(item, 'sale item')
  const created = createReturnForUser(persistence, owner, orgId, {
    saleId,
    reason,
    items: [{ saleItemId: item.id, quantity }],
  })
  assert(created.ok, 'create return')
  const completed = completeReturnForUser(persistence, owner, orgId, created.value.id)
  assert(completed.ok, 'complete return')
  return created.value
}

function addCustomer(persistence: Persistence, orgId: Id): Id {
  const now = nowIso()
  const contactId = newId()
  persistence.contacts.create({
    id: contactId,
    organizationId: orgId,
    firstName: 'Другой',
    lastName: 'Клиент',
    email: null,
    phone: null,
    companyId: null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const customerId = newId()
  persistence.customers.create({
    id: customerId,
    organizationId: orgId,
    type: 'contact',
    contactId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  return customerId
}

export function runReturnDebtImpactChecks(): void {
  const unpaid = setupSalesOrg('org-return-debt-a', 'Org')
  const unpaidSale = makeSale(
    unpaid.persistence,
    unpaid.owner,
    unpaid.orgId,
    unpaid.warehouseId,
    unpaid.productId,
    unpaid.customerId,
    2,
    2_500_000,
  )
  assert(
    checkoutOnCreditForUser(
      unpaid.persistence,
      unpaid.owner,
      unpaid.orgId,
      unpaidSale.sale.id,
    ).ok,
    'unpaid complete',
  )
  completeReturnQty(unpaid.persistence, unpaid.owner, unpaid.orgId, unpaidSale.sale.id, 1)
  const unpaidDebt = getCustomerDebtForUser(
    unpaid.persistence,
    unpaid.owner,
    unpaid.customerId,
  )
  assert(unpaidDebt.ok, 'unpaid debt')
  assert(unpaidDebt.value.remainingDebt === 2_500_000, 'A debt after goods return')
  const unpaidGroups = listCustomerDebtGroupsForUser(unpaid.persistence, unpaid.owner)
  assert(unpaidGroups.ok, 'unpaid groups')
  const unpaidGroup = unpaidGroups.value.find((row) => row.customerId === unpaid.customerId)
  assert(unpaidGroup, 'one customer group')
  assert(unpaidGroup.returnedAmount === 2_500_000, 'returned amount')
  assert(unpaidGroup.remainingAmount === 2_500_000, 'group remaining')
  assert(unpaidGroup.sales.every((row) => row.customerId === unpaid.customerId), 'grouped by customer')

  const paid = setupSalesOrg('org-return-debt-b', 'Org')
  const paidSale = makeSale(
    paid.persistence,
    paid.owner,
    paid.orgId,
    paid.warehouseId,
    paid.productId,
    paid.customerId,
    2,
    2_500_000,
  )
  const checkout = checkoutSaleForUser(
    paid.persistence,
    paid.owner,
    paid.orgId,
    paidSale.sale.id,
    { amount: 5_000_000, method: 'cash' },
  )
  assert(checkout.ok, 'full payment')
  const goods = completeReturnQty(
    paid.persistence,
    paid.owner,
    paid.orgId,
    paidSale.sale.id,
    1,
  )
  const payment = paid.persistence.payments.listBySaleId(paid.orgId, paidSale.sale.id)[0]
  assert(payment, 'payment')
  const refund = createPaymentRefundForUser(paid.persistence, paid.owner, {
    organizationId: paid.orgId,
    createdBy: paid.owner.id,
    paymentId: payment.id,
    amount: 2_500_000,
    returnId: goods.id,
  })
  assert(refund.ok, 'money refund')
  const paidDebt = getCustomerDebtForUser(paid.persistence, paid.owner, paid.customerId)
  assert(paidDebt.ok && paidDebt.value.remainingDebt === 0, 'B debt zero')
  const paidSettlement = getSaleSettlement(paid.persistence, paidSale.sale)
  assert(paidSettlement.remainingAmount === 0, 'no negative remaining')
  assert(paidSettlement.netSales === 2_500_000, 'net sales after return')
  assert(paidSettlement.netPaid === 2_500_000, 'net paid after refund')

  const partial = setupSalesOrg('org-return-debt-c', 'Org')
  const partialSale = makeSale(
    partial.persistence,
    partial.owner,
    partial.orgId,
    partial.warehouseId,
    partial.productId,
    partial.customerId,
    10,
    100_000,
  )
  assert(
    checkoutOnCreditForUser(
      partial.persistence,
      partial.owner,
      partial.orgId,
      partialSale.sale.id,
    ).ok,
    'partial sale',
  )
  completeReturnQty(partial.persistence, partial.owner, partial.orgId, partialSale.sale.id, 3)
  const partialSet = getSaleSettlement(partial.persistence, partialSale.sale)
  assert(partialSet.netSales === 700_000, 'partial net sales')
  assert(partialSet.remainingAmount === 700_000, 'partial remaining')

  const twice = setupSalesOrg('org-return-debt-d', 'Org')
  const twiceSale = makeSale(
    twice.persistence,
    twice.owner,
    twice.orgId,
    twice.warehouseId,
    twice.productId,
    twice.customerId,
    5,
    1_000_000,
  )
  assert(
    checkoutOnCreditForUser(
      twice.persistence,
      twice.owner,
      twice.orgId,
      twiceSale.sale.id,
    ).ok,
    'twice sale',
  )
  completeReturnQty(twice.persistence, twice.owner, twice.orgId, twiceSale.sale.id, 1)
  completeReturnQty(twice.persistence, twice.owner, twice.orgId, twiceSale.sale.id, 0.5)
  const twiceSet = getSaleSettlement(twice.persistence, twiceSale.sale)
  assert(twiceSet.returnedAmount === 1_500_000, 'two returns summed')
  assert(twiceSet.remainingAmount === 3_500_000, 'remaining after two returns')
  const again = getSaleSettlement(twice.persistence, twiceSale.sale)
  assert(again.returnedAmount === twiceSet.returnedAmount, 'no double subtract')

  const otherCustomerId = addCustomer(twice.persistence, twice.orgId)
  const otherSale = makeSale(
    twice.persistence,
    twice.owner,
    twice.orgId,
    twice.warehouseId,
    twice.productId,
    otherCustomerId,
    1,
    9_000_000,
  )
  assert(
    checkoutOnCreditForUser(
      twice.persistence,
      twice.owner,
      twice.orgId,
      otherSale.sale.id,
    ).ok,
    'other customer sale',
  )
  const firstCustomer = getCustomerDebtForUser(
    twice.persistence,
    twice.owner,
    twice.customerId,
  )
  assert(firstCustomer.ok && firstCustomer.value.remainingDebt === 3_500_000, 'other customer isolated')
  const otherDebt = getCustomerDebtForUser(twice.persistence, twice.owner, otherCustomerId)
  assert(otherDebt.ok && otherDebt.value.remainingDebt === 9_000_000, 'other customer untouched')

  const foreign = setupSalesOrg('org-return-debt-e', 'Other')
  const foreignGroups = listCustomerDebtGroupsForUser(foreign.persistence, foreign.owner)
  assert(foreignGroups.ok, 'foreign groups')
  assert(
    !foreignGroups.value.some((row) => row.customerId === twice.customerId),
    'org isolation',
  )

  const overpay = setupSalesOrg('org-return-debt-f', 'Org')
  const overSale = makeSale(
    overpay.persistence,
    overpay.owner,
    overpay.orgId,
    overpay.warehouseId,
    overpay.productId,
    overpay.customerId,
    2,
    2_500_000,
  )
  assert(
    checkoutSaleForUser(
      overpay.persistence,
      overpay.owner,
      overpay.orgId,
      overSale.sale.id,
      { amount: 5_000_000, method: 'cash' },
    ).ok,
    'paid in full',
  )
  completeReturnQty(overpay.persistence, overpay.owner, overpay.orgId, overSale.sale.id, 1)
  const overSet = getSaleSettlement(overpay.persistence, overSale.sale)
  assert(overSet.remainingAmount === 0, 'no negative debt')

  const recon = calculateReconciliationForCustomer(
    unpaid.persistence,
    unpaid.orgId,
    unpaid.customerId,
    '2000-01-01',
    '2099-12-31',
  )
  assert(recon.balanceAmount === 2_500_000, 'recon uses returns')
  assert(recon.lines.some((line) => line.document.startsWith('Возврат от')), 'return line')

  const legacy = setupSalesOrg('org-return-debt-g', 'Org')
  const legacySale = makeSale(
    legacy.persistence,
    legacy.owner,
    legacy.orgId,
    legacy.warehouseId,
    legacy.productId,
    legacy.customerId,
    1,
    400_000,
  )
  assert(
    checkoutOnCreditForUser(
      legacy.persistence,
      legacy.owner,
      legacy.orgId,
      legacySale.sale.id,
    ).ok,
    'legacy sale',
  )
  const now = nowIso()
  legacy.persistence.saleReturns.create({
    id: newId(),
    organizationId: legacy.orgId,
    saleId: legacySale.sale.id,
    status: 'completed',
    total: 150_000,
    createdAt: now,
    updatedAt: now,
  })
  const legacySet = getSaleSettlement(legacy.persistence, legacySale.sale)
  assert(legacySet.remainingAmount === 250_000, 'old return without reason still counts')
  console.log('return-debt-impact.verify: ok')
}

runReturnDebtImpactChecks()
