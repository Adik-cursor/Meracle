import { resolvePackageReturnPath } from '../../app/routes/package-form-draft'
import { isKnownAppPathname } from '../../app/routes/app.routes'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runPackageCustomerNavigationChecks(): void {
  assert(isKnownAppPathname('/packages'), 'packages list')
  assert(isKnownAppPathname('/packages/pkg-1'), 'package detail stays in package context')
  assert(isKnownAppPathname('/customers'), 'customers')
  assert(resolvePackageReturnPath('/packages') === '/packages', 'list return')
  assert(resolvePackageReturnPath('/packages/pkg-1') === '/packages/pkg-1', 'edit return')
  assert(resolvePackageReturnPath('/packages/active') === '/packages/active', 'active return')
  assert(resolvePackageReturnPath('/dashboard') === '/packages', 'never dashboard')
  assert(resolvePackageReturnPath('/') === '/packages', 'never root')
  assert(resolvePackageReturnPath('/finance') === '/packages', 'fallback packages')
  console.log('package-customer-navigation.verify: ok')
}

runPackageCustomerNavigationChecks()
