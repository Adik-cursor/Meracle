import { createSaleInvoiceForUser, generateSaleInvoicePdfForUser } from './sales-invoices'
import { createSaleForUser } from './sales'
import { setStock } from './inventory'
import { newId, nowIso } from './primitives'
import { assert, isPdfBytes, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runSaleInvoicePdfRuntimeChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-pdf-runtime', 'ТОО Runtime', '000000000003')
  const now = nowIso()
  const shanghaiId = newId()
  ctx.persistence.products.create({
    id: shanghaiId,
    organizationId: ctx.orgId,
    name: 'Пакет тур Шанхай',
    sku: 'PKG-SH',
    unit: 'шт',
    itemType: 'product',
    basePrice: 44990,
    costPrice: 20000,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  setStock(ctx.persistence, ctx.orgId, ctx.warehouseId, shanghaiId, 10)
  const sale = ctx.persistence.sales.getById(ctx.saleId)
  assert(sale?.customerId, 'customer')
  const extra = createSaleForUser(ctx.persistence, ctx.owner, ctx.orgId, 'KZT', {
    warehouseId: ctx.warehouseId,
    discount: 0,
    customerId: sale.customerId,
    items: [
      { productId: ctx.productId, quantity: 1, unitPrice: 100, discount: 0 },
      { productId: shanghaiId, quantity: 1, unitPrice: 44990, discount: 0 },
    ],
  })
  assert(extra.ok, 'multi sale')
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, {
    saleId: extra.value.sale.id,
  })
  assert(invoice.ok, 'invoice')
  const pdf = await generateSaleInvoicePdfForUser(
    ctx.persistence,
    ctx.owner,
    invoice.value.id,
  )
  assert(pdf.ok, 'runtime generateSaleInvoicePdfForUser')
  assert(isPdfBytes(pdf.value.bytes), '%PDF-')
  console.log('sale-invoice-pdf-runtime.verify: ok')
}

void runSaleInvoicePdfRuntimeChecks()
