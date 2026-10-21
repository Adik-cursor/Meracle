import type {
  Organization,
  OrganizationContextState,
  OrganizationModules,
  OrganizationSettings,
} from '../types'

const createdAt = '2026-01-01T00:00:00.000Z'
const organizationId = 'org-runtime'

export const defaultModules: OrganizationModules = {
  crm: true,
  contacts: true,
  companies: true,
  deals: true,
  tasks: true,
  activities: true,
  warehouses: true,
  reports: true,
  sales: true,
  expenses: true,
  analytics: true,
  rental: false,
  children: false,
  attendance: false,
  plans: true,
  packages: false,
}

export const defaultOrganization: Organization = {
  id: organizationId,
  organizationId,
  name: 'Основная компания',
  status: 'active',
  createdAt,
  updatedAt: createdAt,
}

export const defaultOrganizationSettings: OrganizationSettings = {
  id: 'org-runtime-settings',
  organizationId,
  locale: 'ru',
  timezone: 'Asia/Almaty',
  currency: 'KZT',
  modules: { ...defaultModules },
  createdAt,
  updatedAt: createdAt,
}

export const defaultOrganizationState: OrganizationContextState = {
  organization: defaultOrganization,
  settings: defaultOrganizationSettings,
  modules: { ...defaultModules },
}
