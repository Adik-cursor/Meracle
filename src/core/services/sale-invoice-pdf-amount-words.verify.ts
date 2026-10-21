import { amountInWordsInvoiceRu } from '../utils/amount-in-words'
import { assert } from './sale-invoice-pdf.verify-support'

export function runSaleInvoicePdfAmountWordsChecks(): void {
  assert(
    amountInWordsInvoiceRu(25_000, 'KZT') === 'Двадцать пять тысяч тенге 00 тиын',
    '25000',
  )
  assert(
    amountInWordsInvoiceRu(2_500_000, 'KZT') === 'Два миллиона пятьсот тысяч тенге 00 тиын',
    '2.5m',
  )
  assert(
    amountInWordsInvoiceRu(20_230_000, 'KZT') ===
      'Двадцать миллионов двести тридцать тысяч тенге 00 тиын',
    '20.23m',
  )
  assert(
    amountInWordsInvoiceRu(44_990, 'KZT') ===
      'Сорок четыре тысячи девятьсот девяносто тенге 00 тиын',
    '44990',
  )
  console.log('sale-invoice-pdf-amount-words.verify: ok')
}

runSaleInvoicePdfAmountWordsChecks()
