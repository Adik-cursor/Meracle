import {
  addCatalogProduct,
  addSupplyCategory,
  assert,
  assertPdfLayout,
  EQUIPMENT_CLAUSE_MARKERS,
  setupInvoiceOrg,
} from './supply-contract.verify-support'
import {
  buildSupplyContractDocumentForUser,
  createSupplyContractForUser,
  resolveSupplyContractProfile,
} from './supply-contracts'
import { createSaleForUser } from './sales'
import { checkoutOnCreditForUser } from './checkout-on-credit'
import { renderSupplyContractPdfWithLayout } from '../pdf/supply-contract-pdf'

export async function runSupplyContractEquipmentChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-sc-eq', 'ТОО Оборудование', '000000000003')
  const saleSeed = ctx.persistence.sales.getById(ctx.saleId)
  assert(saleSeed?.customerId, 'customer')
  const categoryId = addSupplyCategory(
    ctx.persistence,
    ctx.orgId,
    ctx.owner.id,
    'Оборудование',
    'equipment',
  )
  const productId = addCatalogProduct(
    ctx.persistence,
    ctx.orgId,
    'Стоматологическая установка',
    categoryId,
    500,
    ctx.warehouseId,
  )
  const sale = createSaleForUser(ctx.persistence, ctx.owner, ctx.orgId, 'KZT', {
    warehouseId: ctx.warehouseId,
    discount: 0,
    customerId: saleSeed.customerId,
    items: [{ productId, quantity: 1, unitPrice: 500, discount: 0 }],
  })
  assert(sale.ok, 'equipment sale')
  const credited = checkoutOnCreditForUser(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    sale.value.sale.id,
  )
  assert(credited.ok, 'equipment credit')
  assert(
    resolveSupplyContractProfile(ctx.persistence, sale.value.sale) === 'equipment',
    'profile equipment from category',
  )
  const created = createSupplyContractForUser(ctx.persistence, ctx.owner, {
    saleId: sale.value.sale.id,
  })
  assert(created.ok && created.value.profile === 'equipment', 'stored equipment')
  const document = buildSupplyContractDocumentForUser(
    ctx.persistence,
    ctx.owner,
    created.value.id,
  )
  assert(document.ok && document.value.profile === 'equipment', 'document equipment')
  const layout = await renderSupplyContractPdfWithLayout(document.value)
  assertPdfLayout(layout)
  const texts = layout.boxes.map((box) => box.text).join(' ')
  for (const marker of EQUIPMENT_CLAUSE_MARKERS) {
    assert(texts.includes(marker), `equipment clause: ${marker}`)
  }
  assert(texts.includes('Стоматологическая установка'), 'spec item')
  console.log('supply-contract-equipment.verify: ok')
}

void runSupplyContractEquipmentChecks()
