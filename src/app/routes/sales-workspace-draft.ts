export const SALES_WORKSPACE_DRAFT_KEY = 'meracle.salesWorkspaceDraft'

export type SalesWorkspaceDraft = {
  saleId: string
  warehouseId: string
  customerId: string
}

export function resolveSalesReturnPath(candidate: string | null | undefined): string {
  if (!candidate) {
    return '/sales'
  }
  const pathname = candidate.split('?')[0]
  if (pathname === '/sales' || pathname.startsWith('/sales/')) {
    return '/sales'
  }
  return '/sales'
}

export function parseSalesWorkspaceDraft(raw: string): SalesWorkspaceDraft | null {
  try {
    const parsed = JSON.parse(raw) as Partial<SalesWorkspaceDraft>
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    return {
      saleId: String(parsed.saleId ?? ''),
      warehouseId: String(parsed.warehouseId ?? ''),
      customerId: String(parsed.customerId ?? ''),
    }
  } catch {
    return null
  }
}

export function readSalesWorkspaceDraft(): SalesWorkspaceDraft | null {
  if (typeof sessionStorage === 'undefined') {
    return null
  }
  const raw = sessionStorage.getItem(SALES_WORKSPACE_DRAFT_KEY)
  return raw ? parseSalesWorkspaceDraft(raw) : null
}

export function saveSalesWorkspaceDraft(draft: SalesWorkspaceDraft): void {
  if (typeof sessionStorage === 'undefined') {
    return
  }
  sessionStorage.setItem(SALES_WORKSPACE_DRAFT_KEY, JSON.stringify(draft))
}

export function clearSalesWorkspaceDraft(): void {
  if (typeof sessionStorage === 'undefined') {
    return
  }
  sessionStorage.removeItem(SALES_WORKSPACE_DRAFT_KEY)
}
