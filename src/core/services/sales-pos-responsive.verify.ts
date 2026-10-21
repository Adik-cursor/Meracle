import { SALES_WORKSPACE_LAYOUT } from '../../modules/sales/sales-workspace-layout'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runSalesPosResponsiveChecks(): void {
  assert(SALES_WORKSPACE_LAYOUT.categoriesShare === '196px', '1440 categories')
  assert(SALES_WORKSPACE_LAYOUT.saleShare.includes('456px'), '1440 cart')
  assert(SALES_WORKSPACE_LAYOUT.wideSaleShare.includes('480px'), '1920 cart')
  assert(SALES_WORKSPACE_LAYOUT.tabletCategoriesShare === '150px', '1024 narrower categories')
  assert(SALES_WORKSPACE_LAYOUT.tabletSaleShare.includes('380px'), '1024 cart stays usable')
  assert(SALES_WORKSPACE_LAYOUT.mobileMaxPx <= 900, '390 uses stacked layout')
  assert(SALES_WORKSPACE_LAYOUT.cartFabClass === 'pos-cart-fab', 'mobile cart trigger')
  assert(SALES_WORKSPACE_LAYOUT.ticketShellClass === 'pos-ticket-shell', 'mobile cart drawer')
  console.log('sales-pos-responsive.verify: ok')
}

runSalesPosResponsiveChecks()
