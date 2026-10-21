import { assert, paySaleInFull, setupInvoiceOrg } from './supply-contract.verify-support'
import { createSupplyContractForUser, saleHasSupplyContractDebt } from './supply-contracts'

export function runSupplyContractFullyPaidChecks(): void {
  const ctx = setupInvoiceOrg('org-sc-paid2', 'ТОО Полная оплата', '000000000003')
  paySaleInFull(ctx)
  assert(
    !saleHasSupplyContractDebt(ctx.persistence, ctx.saleId, ctx.orgId),
    'no debt after full payment',
  )
  const denied = createSupplyContractForUser(ctx.persistence, ctx.owner, {
    saleId: ctx.saleId,
  })
  assert(
    !denied.ok && denied.error.code === 'SUPPLY_CONTRACT_NOT_AVAILABLE',
    'fully paid sale has no contract',
  )
  console.log('supply-contract-fully-paid.verify: ok')
}

runSupplyContractFullyPaidChecks()
