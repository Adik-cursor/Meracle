import { isKnownAppPathname } from '../../app/routes/app.routes'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runInventoryAuditNavigationChecks(): void {
  assert(isKnownAppPathname('/inventory/audits'), 'audits list is a known path')
  assert(
    isKnownAppPathname('/inventory/audits/audit-1'),
    'created audit detail must stay in warehouse, not fall through to /',
  )
  assert(!isKnownAppPathname('/inventory/audits/audit-1/extra'), 'unknown nested audit path')
  assert(!isKnownAppPathname('/not-an-app-route'), 'unknown path is not accepted')
  console.log('inventory-audit-navigation.verify: ok')
}

runInventoryAuditNavigationChecks()
