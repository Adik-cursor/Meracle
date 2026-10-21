import {
  addCatalogProduct,
  addImplantPackage,
  addSupplyCategory,
  assert,
  assertPdfLayout,
  IMPLANTS_BANNED,
  setupInvoiceOrg,
} from './supply-contract.verify-support'
import {
  buildSupplyContractDocumentForUser,
  createSupplyContractForUser,
  resolveSupplyContractProfile,
  saleHasSupplyContractDebt,
} from './supply-contracts'
import { createSaleForUser } from './sales'
import { checkoutOnCreditForUser } from './checkout-on-credit'
import { renderSupplyContractPdfWithLayout } from '../pdf/supply-contract-pdf'

export async function runSupplyContractImplantsChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-sc-impl', 'ТОО Импланты', '000000000003')
  const saleSeed = ctx.persistence.sales.getById(ctx.saleId)
  assert(saleSeed?.customerId, 'customer')
  const categoryId = addSupplyCategory(
    ctx.persistence,
    ctx.orgId,
    ctx.owner.id,
    'Импланты',
    'implants',
  )
  const first = addCatalogProduct(
    ctx.persistence,
    ctx.orgId,
    'Имплант A',
    categoryId,
    120,
    ctx.warehouseId,
  )
  const second = addCatalogProduct(
    ctx.persistence,
    ctx.orgId,
    'Имплант B',
    categoryId,
    80,
    ctx.warehouseId,
  )
  const packageId = addImplantPackage(
    ctx.persistence,
    ctx.orgId,
    saleSeed.customerId,
    'Пакет имплантов',
    200,
  )
  const sale = createSaleForUser(ctx.persistence, ctx.owner, ctx.orgId, 'KZT', {
    warehouseId: ctx.warehouseId,
    discount: 0,
    customerId: saleSeed.customerId,
    packageId,
    items: [
      { productId: first, quantity: 1, unitPrice: 120, discount: 0 },
      { productId: second, quantity: 1, unitPrice: 80, discount: 0 },
    ],
  })
  assert(sale.ok, 'implant sale')
  const credited = checkoutOnCreditForUser(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    sale.value.sale.id,
  )
  assert(credited.ok, 'implant credit')
  assert(
    saleHasSupplyContractDebt(ctx.persistence, sale.value.sale.id, ctx.orgId),
    'debt available',
  )
  assert(
    resolveSupplyContractProfile(ctx.persistence, sale.value.sale) === 'implants',
    'profile from package and category',
  )
  const created = createSupplyContractForUser(ctx.persistence, ctx.owner, {
    saleId: sale.value.sale.id,
    advanceAmount: 0,
    schedule: [{ dueDate: '2026-10-21', plannedAmount: 200 }],
  })
  assert(created.ok, 'contract created')
  assert(created.value.profile === 'implants', 'stored profile implants')
  assert(created.value.total === 200, 'total from sale')
  assert(created.value.remainingAmount === 200, 'remaining')
  const document = buildSupplyContractDocumentForUser(
    ctx.persistence,
    ctx.owner,
    created.value.id,
  )
  assert(document.ok, 'document')
  assert(document.value.profile === 'implants', 'document profile')
  assert(document.value.items.length === 2, 'both sale items')
  assert(
    document.value.items.some((item) => item.name === 'Имплант A') &&
      document.value.items.some((item) => item.name === 'Имплант B'),
    'spec names',
  )
  const layout = await renderSupplyContractPdfWithLayout(document.value)
  assertPdfLayout(layout)
  const texts = layout.boxes.map((box) => box.text).join('\n')
  assert(texts.includes('УСЛОВИЯ ПОСТАВКИ.'), 'general delivery heading')
  assert(texts.includes('Имплант A') && texts.includes('Имплант B'), 'items in spec')
  assert(texts.includes('гарантирует качество товара'), 'quality warranty')
  assert(!IMPLANTS_BANNED.test(texts), 'no equipment montage clauses')
  assert(!texts.includes('УСЛОВИЯ ПОСТАВКИ И МОНТАЖА'), 'no montage heading')
  console.log('supply-contract-implants.verify: ok')
}

void runSupplyContractImplantsChecks()
