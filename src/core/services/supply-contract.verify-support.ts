import { checkoutOnCreditForUser } from './checkout-on-credit'
import { checkoutSaleForUser } from './checkout-sale'
import {
  assert,
  setupInvoiceOrg,
} from './sale-invoice-pdf.verify-support'
import { createSaleForUser } from './sales'
import { setStock } from './inventory'
import { getSaleSettlement } from './sale-settlement'
import { newId, nowIso } from './primitives'
import type { Persistence } from '../repositories/persistence'
import type { SupplyContractPdfLayout } from '../pdf/supply-contract-pdf'
import type { SupplyContractProfile } from '../types'
import type { Id, User } from '../types'

export { assert, isPdfBytes, readPdfMeta, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export const EQUIPMENT_CLAUSE_MARKERS = [
  'монтаж товара/оборудования',
  'УСЛОВИЯ ПОСТАВКИ И МОНТАЖА',
  'вода, электричество, воздух и канализация',
  'пуско-наладке',
  'обучение персонала',
  'Акт выполненных работ монтажа оборудования',
  'кабелегоном',
]

export const IMPLANTS_BANNED = /монтаж|пуско-налад|обучен|кабел|канализац|электричеств|воздух|плевательн|заземлен|акт выполненных|подводк коммуник|подготовк/i

export function creditSale(ctx: ReturnType<typeof setupInvoiceOrg>) {
  const credited = checkoutOnCreditForUser(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    ctx.saleId,
  )
  assert(credited.ok, 'credit sale')
  return credited
}

export function paySaleInFull(ctx: ReturnType<typeof setupInvoiceOrg>) {
  const sale = ctx.persistence.sales.getById(ctx.saleId)
  assert(sale, 'sale for full pay')
  const paid = checkoutSaleForUser(ctx.persistence, ctx.owner, ctx.orgId, ctx.saleId, {
    amount: sale.total,
    method: 'cash',
  })
  assert(paid.ok, 'full payment')
  return paid
}

export function addSupplyCategory(
  persistence: Persistence,
  organizationId: string,
  createdBy: string,
  name: string,
  supplyProfile: SupplyContractProfile,
) {
  const now = nowIso()
  const id = newId()
  persistence.productCategories.create({
    id,
    organizationId,
    name,
    status: 'active',
    createdBy,
    supplyProfile,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export function addCatalogProduct(
  persistence: Persistence,
  organizationId: string,
  name: string,
  categoryId: string,
  price: number,
  warehouseId: string,
) {
  const now = nowIso()
  const id = newId()
  persistence.products.create({
    id,
    organizationId,
    name,
    sku: id.slice(-8),
    unit: 'шт',
    itemType: 'product',
    basePrice: price,
    costPrice: 1,
    status: 'active',
    categoryId,
    createdAt: now,
    updatedAt: now,
  })
  setStock(persistence, organizationId, warehouseId, id, 50)
  return id
}

export function createCreditSaleWithItems(
  persistence: Persistence,
  owner: User,
  organizationId: Id,
  warehouseId: Id,
  customerId: Id,
  items: { productId: Id; quantity: number; unitPrice: number }[],
  packageId?: Id,
) {
  const sale = createSaleForUser(persistence, owner, organizationId, 'KZT', {
    warehouseId,
    discount: 0,
    customerId,
    packageId,
    items: items.map((item) => ({ ...item, discount: 0 })),
  })
  assert(sale.ok, 'create sale with items')
  const credited = checkoutOnCreditForUser(
    persistence,
    owner,
    organizationId,
    sale.value.sale.id,
  )
  assert(credited.ok, 'credit created sale')
  return sale.value.sale
}

export function financeSnapshot(persistence: Persistence, organizationId: Id, saleId: Id) {
  const sale = persistence.sales.getById(saleId)
  return {
    sale: sale
      ? {
          total: sale.total,
          status: sale.status,
          updatedAt: sale.updatedAt,
          currency: sale.currency,
        }
      : null,
    payments: persistence.payments.list(organizationId).map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      status: payment.status,
      saleId: 'saleId' in payment ? payment.saleId : undefined,
    })),
    debtPayments: persistence.customerDebtPayments.list(organizationId).map((item) => item.id),
    expenses: persistence.expenses.list(organizationId).map((item) => item.id),
    movements: persistence.stockMovements.list(organizationId).map((item) => item.id),
    packageMoves: persistence.implantPackageMovements.list(organizationId).map((item) => item.id),
    packageContracts: persistence.packageContracts.list(organizationId).map((item) => item.id),
    inventory: persistence.inventory.list(organizationId).map((item) => ({
      id: item.id,
      quantity: item.quantity,
    })),
    settlement: sale ? getSaleSettlement(persistence, sale) : null,
  }
}

export function assertPdfLayout(layout: SupplyContractPdfLayout) {
  assert(layout.width === 595.28 && layout.height === 841.89, 'A4 portrait')
  for (const box of layout.boxes) {
    assert(box.x >= 0, `box x ${box.block}`)
    assert(box.y >= 0, `box y ${box.block}`)
    assert(box.x + box.width <= layout.width + 0.8, `overflow x ${box.block} ${box.text}`)
    assert(box.y + box.height <= layout.height + 0.8, `overflow y ${box.block}`)
  }
}

export function addImplantPackage(
  persistence: Persistence,
  organizationId: Id,
  customerId: Id,
  name: string,
  price: number,
) {
  const now = nowIso()
  const id = newId()
  persistence.implantPackages.create({
    id,
    organizationId,
    customerId,
    name,
    price,
    currency: 'KZT',
    totalImplants: 2,
    status: 'active',
    startDate: now.slice(0, 10),
    createdAt: now,
    updatedAt: now,
  })
  return id
}
