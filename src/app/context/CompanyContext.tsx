import { useMemo, useState, type ReactNode } from 'react'
import type { Company, CompanyStatus, Id } from '../../core/types'
import { useOrganization } from './organization-context'
import {
  CompanyContext,
  type CompanyContextValue,
  type CompanyDraft,
} from './company-context'

type CompanyProviderProps = {
  children: ReactNode
}

function toNullableText(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function CompanyProvider({ children }: CompanyProviderProps) {
  const { organization } = useOrganization()
  const [companies, setCompanies] = useState<Company[]>([])

  const value = useMemo<CompanyContextValue>(() => {
    const getCompany = (id: Id) =>
      companies.find((company) => company.id === id)

    const createCompany = (draft: CompanyDraft) => {
      const name = draft.name.trim()

      if (!name) {
        return
      }

      const now = new Date().toISOString()
      const company: Company = {
        id: crypto.randomUUID(),
        organizationId: organization.id,
        name,
        website: toNullableText(draft.website),
        status: draft.status,
        createdAt: now,
        updatedAt: now,
      }

      setCompanies((current) => [...current, company])
    }

    const updateCompany = (id: Id, draft: CompanyDraft) => {
      const name = draft.name.trim()

      if (!name) {
        return
      }

      const now = new Date().toISOString()

      setCompanies((current) =>
        current.map((company) =>
          company.id === id
            ? {
                ...company,
                name,
                website: toNullableText(draft.website),
                status: draft.status,
                updatedAt: now,
              }
            : company,
        ),
      )
    }

    const setCompanyStatus = (
      id: Id,
      status: Extract<CompanyStatus, 'active' | 'inactive'>,
    ) => {
      const now = new Date().toISOString()

      setCompanies((current) =>
        current.map((company) =>
          company.id === id
            ? {
                ...company,
                status,
                updatedAt: now,
              }
            : company,
        ),
      )
    }

    return {
      companies,
      createCompany,
      updateCompany,
      setCompanyStatus,
      getCompany,
    }
  }, [companies, organization.id])

  return (
    <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
  )
}
