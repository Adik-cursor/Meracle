import { assert, creditSale, setupInvoiceOrg } from './supply-contract.verify-support'
import { createSupplyContractForUser } from './supply-contracts'

export function runSupplyContractNoDuplicateChecks(): void {
  const ctx = setupInvoiceOrg('org-sc-dup', 'ТОО Дубликат', '000000000003')
  creditSale(ctx)
  const first = createSupplyContractForUser(ctx.persistence, ctx.owner, {
    saleId: ctx.saleId,
    number: '1',
  })
  assert(first.ok, 'first contract')
  const second = createSupplyContractForUser(ctx.persistence, ctx.owner, {
    saleId: ctx.saleId,
    number: '999',
  })
  assert(second.ok && second.value.id === first.value.id, 'returns existing')
  assert(second.value.number === first.value.number, 'number not replaced')
  const listed = ctx.persistence.supplyContracts
    .list(ctx.orgId)
    .filter((item) => item.saleId === ctx.saleId && item.status !== 'cancelled')
  assert(listed.length === 1, 'single contract')
  console.log('supply-contract-no-duplicate.verify: ok')
}

runSupplyContractNoDuplicateChecks()
