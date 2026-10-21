import { SALES_WORKSPACE_LAYOUT } from '../../modules/sales/sales-workspace-layout'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runSalesPosLayoutChecks(): void {
  assert(SALES_WORKSPACE_LAYOUT.workspaceClass === 'pos-workspace', 'workspace')
  assert(SALES_WORKSPACE_LAYOUT.categoriesShare === '196px', 'categories ~200px')
  assert(SALES_WORKSPACE_LAYOUT.catalogShare === 'minmax(0, 1fr)', 'catalog remaining')
  assert(SALES_WORKSPACE_LAYOUT.saleShare.includes('456px'), 'cart min 456')
  assert(SALES_WORKSPACE_LAYOUT.saleShare.includes('480px'), 'cart max 480 at 1440')
  assert(SALES_WORKSPACE_LAYOUT.wideSaleShare.includes('520px'), 'cart max 520 at 1920')
  assert(SALES_WORKSPACE_LAYOUT.desktopMinCartPx >= 450, 'cart is the POS priority')
  assert(SALES_WORKSPACE_LAYOUT.catalogScrollClass === 'pos-catalog__grid', 'catalog scroll')
  assert(SALES_WORKSPACE_LAYOUT.ticketItemsClass === 'pos-ticket__items', 'cart scroll')
  console.log('sales-pos-layout.verify: ok')
}

runSalesPosLayoutChecks()
