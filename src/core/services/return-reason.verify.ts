import { checkoutSaleForUser } from './checkout-sale'
import { createReturnForUser, getSaleReturnDetailForUser } from './sale-returns'
import { addOrg, addUser } from './sales-invoice.verify'
import { setupSalesOrg, assert } from './sales-debt.fixture'
import { seedEnabledBusinessModules } from './organization-modules'

export function runReturnReasonChecks(): void {
  const ctx = setupSalesOrg('org-return-reason', 'Org')
  const paid = checkoutSaleForUser(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    ctx.saleId,
    { amount: 100, method: 'cash' },
  )
  assert(paid.ok, 'pay sale')
  const sale = ctx.persistence.sales.getById(ctx.saleId)
  assert(sale, 'sale')
  const item = ctx.persistence.saleItems.listBySaleId(ctx.saleId)[0]
  assert(item, 'item')

  const missing = createReturnForUser(ctx.persistence, ctx.owner, ctx.orgId, {
    saleId: ctx.saleId,
    reason: '   ',
    items: [{ saleItemId: item.id, quantity: 1 }],
  })
  assert(!missing.ok && missing.error.code === 'INVALID_INPUT', 'reason required')

  const created = createReturnForUser(ctx.persistence, ctx.owner, ctx.orgId, {
    saleId: ctx.saleId,
    reason: 'Брак',
    note: 'Потрескалась упаковка',
    items: [{ saleItemId: item.id, quantity: 1 }],
  })
  assert(created.ok, 'create with reason')
  assert(created.value.reason === 'Брак', 'reason stored')
  assert(created.value.note === 'Потрескалась упаковка', 'comment stored')

  ctx.persistence.saleReturns.create({
    id: 'legacy-return',
    organizationId: ctx.orgId,
    saleId: ctx.saleId,
    status: 'completed',
    total: 0,
    createdAt: created.value.createdAt,
    updatedAt: created.value.updatedAt,
  })
  const legacy = getSaleReturnDetailForUser(ctx.persistence, ctx.owner, 'legacy-return')
  assert(legacy.ok, 'legacy detail')
  assert(!legacy.value.saleReturn.reason, 'old return has no invented reason')

  addOrg(ctx.persistence, 'org-return-reason-b', 'Other')
  seedEnabledBusinessModules(ctx.persistence, 'org-return-reason-b', 'seed', [
    'sales',
    'warehouse',
    'crm',
  ])
  const other = addUser(ctx.persistence, 'org-return-reason-b', 'owner')
  const isolated = getSaleReturnDetailForUser(
    ctx.persistence,
    other,
    created.value.id,
  )
  assert(
    !isolated.ok && isolated.error.code === 'ORGANIZATION_MISMATCH',
    'org isolation',
  )
  console.log('return-reason.verify: ok')
}

runReturnReasonChecks()
