import { SALES_WORKSPACE_LAYOUT } from '../../modules/sales/sales-workspace-layout'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runSalesPosCartLayoutChecks(): void {
  assert(SALES_WORKSPACE_LAYOUT.desktopMinCartPx >= 450, '1440 cart width')
  assert(SALES_WORKSPACE_LAYOUT.wideMinCartPx >= 480, '1920 cart width')
  assert(SALES_WORKSPACE_LAYOUT.tabletMinCartPx >= 380, '1024 cart still usable')
  assert(SALES_WORKSPACE_LAYOUT.categoriesShare === '196px', 'category rail')
  assert(SALES_WORKSPACE_LAYOUT.ticketItemsClass === 'pos-ticket__items', 'cart scroll')
  assert(SALES_WORKSPACE_LAYOUT.ticketActionsClass === 'pos-ticket__actions', 'pay pinned')
  console.log('sales-pos-cart-layout.verify: ok')
}

runSalesPosCartLayoutChecks()
