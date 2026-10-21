import { defaultModules } from '../../core/config/default-organization'
import {
  CRM_NAV_PATHS,
  getVisibleCrmRoutes,
  isKindergartenCrmHiddenPath,
  usesCareCrmComposition,
} from '../routes/app.routes'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runCrmCompositionChecks(): void {
  const dental = getVisibleCrmRoutes(defaultModules).map((route) => route.path)
  assert(
    JSON.stringify(dental) === JSON.stringify([...CRM_NAV_PATHS]),
    'dental CRM keeps B2B navigation',
  )
  assert(
    dental.includes('/contacts') &&
      dental.includes('/companies') &&
      dental.includes('/activities') &&
      dental.includes('/reports'),
    'dental CRM still has contacts/companies/activities/reports',
  )
  assert(!usesCareCrmComposition(defaultModules), 'dental children off is not care CRM')

  const kinderModules = {
    ...defaultModules,
    children: true,
    attendance: true,
    sales: false,
    warehouses: false,
  }
  const kinder = getVisibleCrmRoutes(kinderModules)
  const kinderPaths = kinder.map((route) => route.path)
  assert(
    JSON.stringify(kinderPaths) === JSON.stringify(['/deals', '/customers', '/tasks']),
    'kindergarten CRM is inquiries/parents/tasks',
  )
  assert(kinder.find((route) => route.path === '/deals')?.labelKey === 'crmInquiries', 'deals labeled inquiries')
  assert(kinder.find((route) => route.path === '/customers')?.labelKey === 'crmParents', 'customers labeled parents')
  assert(!kinderPaths.includes('/contacts'), 'contacts are not a top-level kindergarten CRM item')
  assert(!kinderPaths.includes('/companies'), 'companies hidden in kindergarten CRM')
  assert(!kinderPaths.includes('/activities'), 'activities hidden in kindergarten CRM')
  assert(!kinderPaths.includes('/reports'), 'reports hidden in kindergarten CRM')
  assert(isKindergartenCrmHiddenPath('/contacts', kinderModules), 'contacts path is redirected for kindergarten')
  assert(!isKindergartenCrmHiddenPath('/contacts', defaultModules), 'dental contacts stay reachable')

  const namedKinder = {
    ...defaultModules,
    children: false,
  }
  assert(
    JSON.stringify(getVisibleCrmRoutes(namedKinder).map((route) => route.path)) ===
      JSON.stringify([...CRM_NAV_PATHS]),
    'CRM composition follows children module, not company naming',
  )

  console.log('crm-composition.verify: ok')
}

runCrmCompositionChecks()
