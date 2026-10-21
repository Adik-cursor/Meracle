import type { OrganizationModule, OrganizationModules } from '../types'
import { defaultModules } from './default-organization'

export const ORGANIZATION_SETTINGS_STORAGE_KEY =
  'crm-platform.organization-settings'

type StoredOrganizationSettings = {
  modules?: Partial<Record<OrganizationModule, unknown>>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readStoredSettings(): StoredOrganizationSettings | null {
  try {
    const raw = localStorage.getItem(ORGANIZATION_SETTINGS_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) {
      return null
    }

    return {
      modules: isRecord(parsed.modules)
        ? (parsed.modules as Partial<Record<OrganizationModule, unknown>>)
        : undefined,
    }
  } catch {
    return null
  }
}

function booleanFlag(
  value: unknown,
  fallback: boolean,
): boolean {
  if (value === true || value === false) {
    return value
  }

  return fallback
}

export function loadStoredOrganizationModules(): OrganizationModules {
  const stored = readStoredSettings()?.modules
  const warehouses = booleanFlag(stored?.warehouses, true)
  const modules: OrganizationModules = {
    ...defaultModules,
    crm: booleanFlag(stored?.crm, defaultModules.crm),
    contacts: booleanFlag(stored?.contacts, defaultModules.contacts),
    companies: booleanFlag(stored?.companies, defaultModules.companies),
    deals: booleanFlag(stored?.deals, defaultModules.deals),
    tasks: booleanFlag(stored?.tasks, defaultModules.tasks),
    activities: booleanFlag(stored?.activities, defaultModules.activities),
    reports: booleanFlag(stored?.reports, defaultModules.reports),
    warehouses,
    sales: booleanFlag(stored?.sales, defaultModules.sales),
    expenses: booleanFlag(stored?.expenses, defaultModules.expenses),
    analytics: booleanFlag(stored?.analytics, defaultModules.analytics),
    rental: booleanFlag(stored?.rental, defaultModules.rental),
    children: booleanFlag(stored?.children, defaultModules.children),
    attendance: booleanFlag(stored?.attendance, defaultModules.attendance),
    plans: booleanFlag(stored?.plans, defaultModules.plans),
    packages: booleanFlag(stored?.packages, defaultModules.packages),
  }

  return modules
}

export function saveStoredOrganizationModules(
  modules: OrganizationModules,
): void {
  try {
    localStorage.setItem(
      ORGANIZATION_SETTINGS_STORAGE_KEY,
      JSON.stringify({ modules }),
    )
  } catch {
    /* ignore quota / private-mode failures */
  }
}
