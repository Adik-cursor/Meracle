import type { Id, Sale, SalePaymentStatus } from '../types'
import type { Persistence } from '../repositories/persistence'
import {
  deriveSalePaymentStatus,
  getDueAmount,
  roundMoney,
  sumCompletedPayments,
} from '../../modules/sales/sale-payment'

export type SaleSettlement = {
  saleId: Id
  grossSales: number
  returnedAmount: number
  netSales: number
  paidAmount: number
  refundedAmount: number
  netPaid: number
  remainingAmount: number
  status: SalePaymentStatus
}

function sumCompletedReturnsForSale(
  persistence: Persistence,
  organizationId: Id,
  saleId: Id,
): number {
  return roundMoney(
    persistence.saleReturns
      .list(organizationId)
      .filter(
        (item) =>
          item.saleId === saleId &&
          item.organizationId === organizationId &&
          item.status === 'completed',
      )
      .reduce((sum, item) => sum + item.total, 0),
  )
}

function sumCompletedRefundsForSale(
  persistence: Persistence,
  organizationId: Id,
  saleId: Id,
): number {
  return roundMoney(
    persistence.paymentRefunds
      .listBySaleId(organizationId, saleId)
      .filter((item) => item.status === 'completed')
      .reduce((sum, item) => sum + item.amount, 0),
  )
}

export function getSaleSettlement(
  persistence: Persistence,
  sale: Pick<Sale, 'id' | 'organizationId' | 'total'>,
): SaleSettlement {
  const grossSales = roundMoney(sale.total)
  const returnedAmount = sumCompletedReturnsForSale(
    persistence,
    sale.organizationId,
    sale.id,
  )
  const paidAmount = sumCompletedPayments(
    persistence.payments.listBySaleId(sale.organizationId, sale.id),
  )
  const refundedAmount = sumCompletedRefundsForSale(
    persistence,
    sale.organizationId,
    sale.id,
  )
  const netSales = roundMoney(Math.max(0, grossSales - returnedAmount))
  const netPaid = roundMoney(Math.max(0, paidAmount - refundedAmount))
  const remainingAmount = getDueAmount(netSales, netPaid)
  const status =
    netSales <= 0 ? 'paid' : deriveSalePaymentStatus(netSales, netPaid)

  return {
    saleId: sale.id,
    grossSales,
    returnedAmount,
    netSales,
    paidAmount,
    refundedAmount,
    netPaid,
    remainingAmount,
    status,
  }
}
