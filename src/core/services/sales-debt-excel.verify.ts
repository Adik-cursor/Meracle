import { checkoutOnCreditForUser } from './checkout-on-credit'
import { exportExcelDatasetForUser } from './excel-export'
import {
  FINANCE_DEBTS_HEADERS,
  buildFinanceDebtsSheet,
  mapSaleDebtsToExportRows,
} from './finance-excel'
import { listSaleDebtRowsForUser } from './customer-debts'
import { parseExcelWorkbook } from '../utils/excel-workbook'
import { assert, setupSalesOrg } from './sales-debt.fixture'

export function runSalesDebtExcelChecks(): void {
  const ctx = setupSalesOrg('org-dsk-debt-xlsx', 'DSK')
  const credited = checkoutOnCreditForUser(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    ctx.saleId,
  )
  assert(credited.ok, 'credit')
  const rows = listSaleDebtRowsForUser(ctx.persistence, ctx.owner)
  assert(rows.ok && rows.value.length > 0, 'rows')
  const sheet = buildFinanceDebtsSheet(
    mapSaleDebtsToExportRows(rows.value, {
      customerName: (id) => id,
      responsible: () => '',
    }),
  )
  assert(sheet.headers.join() === FINANCE_DEBTS_HEADERS.join(), 'headers')
  assert(
    sheet.rows.some((row) => String(row[2]).includes(ctx.saleId.slice(-4).toUpperCase())),
    'sale number in excel',
  )

  const exported = exportExcelDatasetForUser(ctx.persistence, ctx.owner, 'debts')
  assert(exported.ok, 'universal export')
  const parsed = parseExcelWorkbook(exported.value.bytes)[0]
  assert(parsed?.headers.includes('Клиент'), 'xlsx client')
  assert(parsed?.headers.includes('ИИН/БИН'), 'xlsx tax')
  assert(parsed?.headers.includes('Основание'), 'xlsx basis')
  assert(parsed?.headers.includes('Задолженность'), 'xlsx remaining')
  console.log('sales-debt-excel.verify: ok')
}

runSalesDebtExcelChecks()
