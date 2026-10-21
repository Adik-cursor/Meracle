export const PACKAGE_FORM_DRAFT_KEY = 'meracle.packageFormDraft'

export type PackageFormDraft = {
  returnPath: string
  name: string
  price: string
  totalImplants: string
  customerId: string
}

export function resolvePackageReturnPath(candidate: string | null | undefined): string {
  if (!candidate) {
    return '/packages'
  }
  const pathname = candidate.split('?')[0]
  if (pathname === '/dashboard' || pathname === '/') {
    return '/packages'
  }
  if (pathname === '/packages' || pathname.startsWith('/packages/')) {
    return pathname
  }
  return '/packages'
}

export function parsePackageFormDraft(raw: string): PackageFormDraft | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PackageFormDraft>
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    return {
      returnPath: resolvePackageReturnPath(parsed.returnPath),
      name: String(parsed.name ?? ''),
      price: String(parsed.price ?? ''),
      totalImplants: String(parsed.totalImplants ?? ''),
      customerId: String(parsed.customerId ?? ''),
    }
  } catch {
    return null
  }
}

export function serializePackageFormDraft(draft: PackageFormDraft): string {
  return JSON.stringify({
    ...draft,
    returnPath: resolvePackageReturnPath(draft.returnPath),
  })
}

export function readPackageFormDraft(): PackageFormDraft | null {
  if (typeof sessionStorage === 'undefined') {
    return null
  }
  const raw = sessionStorage.getItem(PACKAGE_FORM_DRAFT_KEY)
  return raw ? parsePackageFormDraft(raw) : null
}

export function savePackageFormDraft(draft: PackageFormDraft): void {
  if (typeof sessionStorage === 'undefined') {
    return
  }
  sessionStorage.setItem(PACKAGE_FORM_DRAFT_KEY, serializePackageFormDraft(draft))
}

export function clearPackageFormDraft(): void {
  if (typeof sessionStorage === 'undefined') {
    return
  }
  sessionStorage.removeItem(PACKAGE_FORM_DRAFT_KEY)
}
