import { createSaleForUser } from './sales'
import { checkoutOnCreditForUser } from './checkout-on-credit'
import { setStock } from './inventory'
import {
  createReconciliationStatementForUser,
  generateReconciliationStatementPdfForUser,
} from './reconciliation-statements'
import { completeSeededSale, readPdfMeta, setupInvoiceOrg } from './delivery-documents.verify-support'

export async function runReconciliationMultipageChecks(): Promise<void> {
  const ctx = completeSeededSale(setupInvoiceOrg('org-rec-multi', 'ТОО RecMulti', '000000000003'))
  setStock(ctx.persistence, ctx.orgId, ctx.warehouseId, ctx.productId, 200)
  for (let i = 0; i < 40; i += 1) {
    const sale = createSaleForUser(ctx.persistence, ctx.owner, ctx.orgId, 'KZT', {
      warehouseId: ctx.warehouseId,
      discount: 0,
      customerId: ctx.customerId,
      items: [{ productId: ctx.productId, quantity: 1, unitPrice: 10 + i, discount: 0 }],
    })
    if (!sale.ok) {
      throw new Error('sale')
    }
    const credited = checkoutOnCreditForUser(ctx.persistence, ctx.owner, ctx.orgId, sale.value.sale.id)
    if (!credited.ok) {
      throw new Error('credit')
    }
  }
  const created = createReconciliationStatementForUser(ctx.persistence, ctx.owner, {
    customerId: ctx.customerId,
    dateFrom: '2020-01-01',
    dateTo: '2030-12-31',
    documentDate: '2026-08-27',
  })
  if (!created.ok) {
    throw new Error(created.error.code)
  }
  const pdf = await generateReconciliationStatementPdfForUser(
    ctx.persistence,
    ctx.owner,
    created.value.id,
  )
  if (!pdf.ok) {
    throw new Error('pdf')
  }
  const meta = await readPdfMeta(pdf.value.bytes)
  if (meta.pageCount < 2) {
    throw new Error('pages')
  }
  console.log('reconciliation-multipage.verify: ok')
}

void runReconciliationMultipageChecks()
