import { createContext, useContext } from 'react'
import type { Company, CompanyStatus, Id } from '../../core/types'

export type CompanyDraft = {
  name: string
  website?: string
  status: Extract<CompanyStatus, 'active' | 'inactive'>
}

export type CompanyContextValue = {
  companies: Company[]
  createCompany: (draft: CompanyDraft) => void
  updateCompany: (id: Id, draft: CompanyDraft) => void
  setCompanyStatus: (
    id: Id,
    status: Extract<CompanyStatus, 'active' | 'inactive'>,
  ) => void
  getCompany: (id: Id) => Company | undefined
}

export const CompanyContext = createContext<CompanyContextValue | null>(null)

export function useCompanies(): CompanyContextValue {
  const context = useContext(CompanyContext)

  if (!context) {
    throw new Error('useCompanies must be used within CompanyProvider')
  }

  return context
}
