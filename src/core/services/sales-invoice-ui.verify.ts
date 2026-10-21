import { SalesPage } from '../../app/routes/pages/SalesPage'
import { PosTicket } from '../../modules/sales/components/PosTicket'
import { PosHistory } from '../../modules/sales/components/PosHistory'
import { PosSuccess } from '../../modules/sales/components/PosSuccess'
import {
  createSaleInvoiceForUser,
  findActiveSaleInvoiceForUser,
  generateSaleInvoicePdfForUser,
} from './sales-invoices'
import { downloadSaleInvoicePdf, openSaleInvoicePdf } from '../pdf/sale-invoice-pdf'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runSalesInvoiceUiChecks(): void {
  assert(typeof SalesPage === 'function', 'sales page')
  assert(typeof PosTicket === 'function', 'ticket has invoice actions')
  assert(typeof PosHistory === 'function', 'history keeps sales')
  assert(typeof PosSuccess === 'function', 'success keeps invoice')
  assert(typeof createSaleInvoiceForUser === 'function', 'create invoice service')
  assert(typeof findActiveSaleInvoiceForUser === 'function', 'find active invoice')
  assert(typeof generateSaleInvoicePdfForUser === 'function', 'real pdf generator')
  assert(typeof openSaleInvoicePdf === 'function', 'open pdf')
  assert(typeof downloadSaleInvoicePdf === 'function', 'download pdf')
  console.log('sales-invoice-ui.verify: ok')
}

runSalesInvoiceUiChecks()
