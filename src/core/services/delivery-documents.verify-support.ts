import { checkoutOnCreditForUser } from './checkout-on-credit'
import { createSaleForUser } from './sales'
import { setStock } from './inventory'
import { assert, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'
import type { Id, User } from '../types'
import type { Persistence } from '../repositories/persistence'

export { assert, isPdfBytes, readPdfMeta, setupInvoiceOrg, addManySaleItems } from './sale-invoice-pdf.verify-support'

export function completeSeededSale(ctx: ReturnType<typeof setupInvoiceOrg>) {
  const credited = checkoutOnCreditForUser(ctx.persistence, ctx.owner, ctx.orgId, ctx.saleId)
  assert(credited.ok, 'complete sale on credit')
  const sale = ctx.persistence.sales.getById(ctx.saleId)
  assert(sale?.customerId, 'customer after complete')
  return { ...ctx, customerId: sale.customerId }
}

export function stampDay(persistence: Persistence, id: Id, collection: 'sales' | 'payments', day: string) {
  const entity =
    collection === 'sales' ? persistence.sales.getById(id) : persistence.payments.getById(id)
  assert(entity, 'stamp entity')
  const iso = `${day}T12:00:00.000Z`
  if (collection === 'sales') {
    persistence.sales.update(id, { createdAt: iso, updatedAt: iso })
    return
  }
  persistence.payments.update(id, { createdAt: iso })
}

export function addSaleOnDay(
  persistence: Persistence,
  owner: User,
  organizationId: Id,
  warehouseId: Id,
  productId: Id,
  customerId: Id,
  amount: number,
  day: string,
) {
  setStock(persistence, organizationId, warehouseId, productId, 100)
  const created = createSaleForUser(persistence, owner, organizationId, 'KZT', {
    warehouseId,
    discount: 0,
    customerId,
    items: [{ productId, quantity: 1, unitPrice: amount, discount: 0 }],
  })
  assert(created.ok, 'sale')
  const credited = checkoutOnCreditForUser(persistence, owner, organizationId, created.value.sale.id)
  assert(credited.ok, 'credit checkout')
  stampDay(persistence, created.value.sale.id, 'sales', day)
  return created.value.sale.id
}

export function firstY(boxes: { block: string; y: number }[], block: string): number {
  const ys = boxes.filter((box) => box.block === block).map((box) => box.y)
  return ys.length > 0 ? Math.max(...ys) : 0
}

export function texts(boxes: { block: string; text: string }[], block?: string): string[] {
  return boxes.filter((box) => (block ? box.block === block : true)).map((box) => box.text)
}
