import { checkoutSaleForUser } from './checkout-sale'
import { createPaymentForUser } from './create-payment'
import { listInternalReceiptsForUser } from './internal-receipts'
import { checkoutOnCreditForUser } from './checkout-on-credit'
import {
  addRoleUser,
  setupKindergartenOrg,
  setupRentalOrg,
  setupSalesOrg,
  assert,
} from './sales-debt.fixture'

export function runReceiptRbacChecks(): void {
  const ctx = setupSalesOrg('org-receipt-rbac', 'DSK')
  const accountant = addRoleUser(
    ctx.persistence,
    ctx.orgId,
    'accountant',
    ctx.warehouseId,
  )
  const deniedPay = createPaymentForUser(ctx.persistence, accountant, {
    organizationId: ctx.orgId,
    createdBy: accountant.id,
    saleId: ctx.saleId,
    amount: 10,
    method: 'cash',
  })
  assert(
    !deniedPay.ok && deniedPay.error.code === 'ACCESS_DENIED',
    'receipt cannot bypass payment permission',
  )
  assert(
    ctx.persistence.internalReceipts.listBySaleId(ctx.orgId, ctx.saleId).length === 0,
    'no receipt without payment',
  )

  const paid = checkoutSaleForUser(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    ctx.saleId,
    { amount: 100, method: 'cash' },
  )
  assert(paid.ok, 'owner checkout')

  const listed = listInternalReceiptsForUser(ctx.persistence, accountant)
  assert(listed.ok, 'accountant can read receipts if sales read')

  const rental = setupRentalOrg()
  const rentalList = listInternalReceiptsForUser(rental.persistence, rental.owner)
  assert(
    !rentalList.ok && rentalList.error.code === 'MODULE_NOT_ENABLED',
    'rental sales off',
  )
  const rentalCheckout = checkoutSaleForUser(
    rental.persistence,
    rental.owner,
    rental.owner.organizationId,
    'x',
    { amount: 10, method: 'cash' },
  )
  assert(
    !rentalCheckout.ok && rentalCheckout.error.code === 'MODULE_NOT_ENABLED',
    'rental checkout off',
  )

  const kg = setupKindergartenOrg()
  const kgList = listInternalReceiptsForUser(kg.persistence, kg.owner)
  assert(!kgList.ok && kgList.error.code === 'MODULE_NOT_ENABLED', 'kindergarten sales off')

  const creditCtx = setupSalesOrg('org-receipt-rbac-credit', 'DSK')
  const credited = checkoutOnCreditForUser(
    creditCtx.persistence,
    creditCtx.owner,
    creditCtx.orgId,
    creditCtx.saleId,
  )
  assert(credited.ok, 'on credit')
  assert(
    creditCtx.persistence.internalReceipts.listBySaleId(creditCtx.orgId, creditCtx.saleId)
      .length === 0,
    'debt has no receipt',
  )
  console.log('receipt-rbac.verify: ok')
}

runReceiptRbacChecks()
