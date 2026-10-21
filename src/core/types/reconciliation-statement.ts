import type { BaseEntity, Id } from './common'
import type { PartySnapshot } from './party-snapshot'

export type ReconciliationLineSnapshot = {
  date: string
  document: string
  orgDebit: number
  orgCredit: number
  customerDebit: number
  customerCredit: number
}

export type ReconciliationBalanceSide = 'organization' | 'customer' | 'none'

export type ReconciliationStatement = BaseEntity & {
  customerId: Id
  documentNumber: string
  documentDate: string
  dateFrom: string
  dateTo: string
  currency: string
  organization: PartySnapshot
  counterparty: PartySnapshot
  contractLabel: string
  openingOrgDebit: number
  openingOrgCredit: number
  debitTurnover: number
  creditTurnover: number
  closingOrgDebit: number
  closingOrgCredit: number
  lines: ReconciliationLineSnapshot[]
  balanceSide: ReconciliationBalanceSide
  balanceAmount: number
  balanceWords: string
  createdBy: Id
}
