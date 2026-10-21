import { isKnownAppPathname } from '../../app/routes/app.routes'
import { resolveSalesReturnPath } from '../../app/routes/sales-workspace-draft'
import { SALES_WORKSPACE_LAYOUT } from '../../modules/sales/sales-workspace-layout'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runSalesWorkspaceLayoutChecks(): void {
  assert(isKnownAppPathname('/sales'), 'sales route known')
  assert(resolveSalesReturnPath('/dashboard') === '/sales', 'customer create returns to sales')
  assert(resolveSalesReturnPath('/') === '/sales', 'never dashboard')
  assert(resolveSalesReturnPath('/packages') === '/sales', 'sales return never package')
  assert(SALES_WORKSPACE_LAYOUT.catalogScrollClass === 'pos-catalog__grid', 'catalog scroll')
  assert(SALES_WORKSPACE_LAYOUT.ticketSummaryClass === 'pos-ticket__summary', 'pinned summary')
  assert(SALES_WORKSPACE_LAYOUT.ticketActionsClass === 'pos-ticket__actions', 'actions')
  assert(SALES_WORKSPACE_LAYOUT.workspaceClass === 'pos-workspace', 'workspace')
  assert(SALES_WORKSPACE_LAYOUT.categoriesClass === 'pos-categories', 'categories column')
  assert(SALES_WORKSPACE_LAYOUT.catalogShare.includes('1fr'), 'catalog remaining width')
  assert(SALES_WORKSPACE_LAYOUT.saleShare.includes('456px'), 'sale panel working width')
  assert(SALES_WORKSPACE_LAYOUT.desktopMinCartPx >= 450, 'cart not a thin column')
  console.log('sales-workspace-layout.verify: ok')
}

runSalesWorkspaceLayoutChecks()
