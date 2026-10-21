import { checkoutOnCreditForUser } from './checkout-on-credit'
import { checkoutSaleForUser } from './checkout-sale'
import { createSaleInvoiceForUser } from './sales-invoices'
import { getCustomerDebtForUser } from './customer-debts'
import { createSaleForUser } from './sales'
import { assert, setupSalesOrg } from './sales-debt.fixture'

export function runSalesDebtPaymentChecks(): void {
  const ctx = setupSalesOrg('org-dsk-debt-pay', 'DSK')
  const { persistence, orgId, owner, saleId, customerId, warehouseId, productId, stockBefore } =
    ctx

  const missingCustomer = createSaleForUser(persistence, owner, orgId, 'KZT', {
    warehouseId,
    discount: 0,
    items: [{ productId, quantity: 1, unitPrice: 50, discount: 0 }],
  })
  assert(missingCustomer.ok, 'anonymous draft')
  const rejected = checkoutOnCreditForUser(
    persistence,
    owner,
    orgId,
    missingCustomer.value.sale.id,
  )
  assert(
    !rejected.ok && rejected.error.code === 'CUSTOMER_INVALID',
    'customer required',
  )

  const credited = checkoutOnCreditForUser(persistence, owner, orgId, saleId)
  assert(credited.ok, 'on credit checkout')
  assert(credited.value.customerId === customerId, 'customer on debt')
  assert(credited.value.paidAmount === 0, 'received 0')
  assert(credited.value.remainingAmount === 100, 'debt = sale total')
  const sale = persistence.sales.getById(saleId)
  assert(sale?.status === 'completed', 'sale completed')
  assert(sale.settlementMethod === 'on_credit', 'settlement method')
  assert(
    persistence.payments.listBySaleId(orgId, saleId).length === 0,
    'no zero payment',
  )
  const stock = persistence.inventory.getByWarehouseAndProduct(
    orgId,
    warehouseId,
    productId,
  )
  assert(stock?.quantity === stockBefore - 1, 'warehouse shipped')

  const debt = getCustomerDebtForUser(persistence, owner, customerId)
  assert(debt.ok && debt.value.remainingDebt === 100, 'customer debt')

  const invoice = createSaleInvoiceForUser(persistence, owner, {
    saleId,
  })
  assert(invoice.ok || invoice.error.code === 'INVOICE_ALREADY_ISSUED', 'invoice optional')

  const cashSale = createSaleForUser(persistence, owner, orgId, 'KZT', {
    warehouseId,
    discount: 0,
    customerId,
    items: [{ productId, quantity: 1, unitPrice: 40, discount: 0 }],
  })
  assert(cashSale.ok, 'cash sale')
  const paid = checkoutSaleForUser(persistence, owner, orgId, cashSale.value.sale.id, {
    amount: 40,
    method: 'cash',
  })
  assert(paid.ok, 'cash checkout still works')
  assert(
    persistence.payments.listBySaleId(orgId, cashSale.value.sale.id).length === 1,
    'cash creates payment',
  )

  console.log('sales-debt-payment.verify: ok')
}

runSalesDebtPaymentChecks()
