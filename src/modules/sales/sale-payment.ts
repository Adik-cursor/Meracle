import type { Payment, PaymentMethod, SalePaymentStatus } from '../../core/types'

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function sumCompletedPayments(payments: Payment[]): number {
  return roundMoney(
    payments
      .filter((payment) => payment.status === 'completed')
      .reduce((sum, payment) => sum + payment.amount, 0),
  )
}

export function getDueAmount(saleTotal: number, paidAmount: number): number {
  return Math.max(0, roundMoney(saleTotal - paidAmount))
}

export function deriveSalePaymentStatus(
  saleTotal: number,
  paidAmount: number,
): SalePaymentStatus {
  const paid = roundMoney(paidAmount)
  const total = roundMoney(saleTotal)

  if (paid <= 0) {
    return 'unpaid'
  }

  if (paid >= total && total > 0) {
    return 'paid'
  }

  return 'partially_paid'
}

export function sumCompletedPaymentsByMethod(
  payments: Payment[],
): Record<PaymentMethod, number> {
  const totals: Record<PaymentMethod, number> = {
    cash: 0,
    card: 0,
    bank_transfer: 0,
    invoice: 0,
    on_credit: 0,
    other: 0,
  }

  for (const payment of payments) {
    if (payment.status !== 'completed') {
      continue
    }

    totals[payment.method] = roundMoney(
      (totals[payment.method] ?? 0) + payment.amount,
    )
  }

  return totals
}
