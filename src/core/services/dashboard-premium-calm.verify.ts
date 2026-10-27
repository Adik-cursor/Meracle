import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runDashboardPremiumCalmChecks(): void {
  const page = readFileSync(
    join(root, 'src/app/routes/pages/CompanyDashboardPage.tsx'),
    'utf8',
  )
  const css = readFileSync(join(root, 'src/styles/meracle-dashboard.css'), 'utf8')
  const tokens = readFileSync(join(root, 'src/styles/design-tokens.css'), 'utf8')
  const service = readFileSync(join(root, 'src/core/services/company-dashboard.ts'), 'utf8')

  assert(page.includes("t('navDashboard')"), 'dashboard title')
  assert(page.includes('dashboardFinancialPeriod'), 'period control')
  assert(page.includes('setPeriodKey'), 'existing periodKey wiring')
  assert(page.includes('getCompanyDashboardForUser(persistence, currentUser, periodKey)'), 'period uses existing service')
  assert(page.includes("t('quickNewSale')"), 'primary new sale')
  assert(!page.includes("t('quickNewDeal')"), 'deal action stays in crm')
  assert(!page.includes("t('quickReceiveStock')"), 'receive stays in warehouse')
  assert(!page.includes("t('quickNewExpense')"), 'expense stays in finance')
  assert(!page.includes('RevenueSparkline'), 'no decorative chart')
  assert(page.includes('dash-hero__primary'), 'revenue hero')
  assert(page.includes('dash-kpi-rest'), 'secondary strip')
  assert(page.includes('dash-work-row'), 'independent work rows')
  assert(page.includes("t('dashboardPlans')"), 'plans section')
  assert(page.includes("t('navCounterpartyDebts')"), 'debts section')
  assert(page.includes("t('navWarehouseSection')"), 'warehouse section')
  assert(page.includes("t('navAnalyticsSection')"), 'analytics section')
  assert(page.includes('navigate(\'/inventory\')') === false, 'no extra inventory button')
  assert(page.includes("navigate('/deals')") === false || page.includes('crmPath'), 'crm lives in section')
  assert(!page.includes('25309920'), 'no hardcoded revenue')

  assert(css.includes('.company-dashboard > .dash-hero'), 'premium hero block')
  assert(css.includes('.dash-work-row'), 'work row layout')
  assert(css.includes('align-items: start'), 'sections do not stretch empty')
  assert(css.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'), 'two-column work areas')
  assert(css.includes('dash-kpi-rest--premium'), 'detached sales metric strip')
  assert(css.includes('workspace-city-banner.png'), 'premium city banner')
  assert(css.includes('linear-gradient'), 'readable banner overlay')
  assert(css.includes('@media (max-width: 1024px)'), 'tablet breakpoint')
  assert(css.includes('@media (max-width: 767px)'), 'mobile breakpoint')

  assert(tokens.includes('--bg: #ffffff'), 'white canvas')
  assert(tokens.includes('--accent: #1b5854'), 'meracle accent')
  assert(tokens.includes("'Manrope'"), 'existing font')

  assert(service.includes('export function getCompanyDashboardForUser'), 'service untouched')
  assert(service.includes('export function resolveDashboardSections'), 'sections resolver kept')

  console.log('dashboard-premium-calm.verify: ok')
}

runDashboardPremiumCalmChecks()

