import { PDFDocument, type PDFFont } from 'pdf-lib'
import type { ReconciliationStatement } from '../types'
import { loadInvoicePdfFonts } from './invoice-fonts'
import { formatInvoiceDateFile, formatInvoiceMoney } from './invoice-format'
import {
  drawText,
  registerFontkit,
  strokeLine,
  strokeRect,
  wrapLines,
  type PdfPainter,
  type PdfTextBox,
} from './pdf-draw'

const PAGE: [number, number] = [595.28, 841.89]
const MARGIN_X = 28
const MARGIN_TOP = 24
const MARGIN_BOTTOM = 22
const CONTENT = PAGE[0] - MARGIN_X * 2
const HALF = CONTENT / 2
const DATE_W = 44
const MONEY_W = 50
const DOC_W = HALF - DATE_W - MONEY_W * 2
const TITLE = 11
const BODY = 8
const CELL = 6.5
const ROW = 16
const CAPTION_H = 22
const COL_H = 13
const HEADER_H = CAPTION_H + COL_H

export type ReconciliationPdfDocument = {
  statement: ReconciliationStatement
  filename: string
  periodFromFile: string
  periodToFile: string
  periodFromLong: string
  periodToLong: string
  documentDateLong: string
  documentDateFile: string
}

export type ReconciliationPdfLayout = {
  bytes: Uint8Array
  boxes: PdfTextBox[]
  pageCount: number
}

export async function renderReconciliationStatementPdfWithLayout(
  document: ReconciliationPdfDocument,
): Promise<ReconciliationPdfLayout> {
  const pdf = await PDFDocument.create()
  registerFontkit(pdf)
  const loaded = await loadInvoicePdfFonts()
  const fonts = {
    regular: await pdf.embedFont(loaded.regular, { subset: false }),
    bold: await pdf.embedFont(loaded.bold, { subset: false }),
  }
  const boxes: PdfTextBox[] = []
  const introH = measureIntro(fonts, document)
  const conclusionH = 118
  const lines = document.statement.lines
  const pages: { start: number; end: number }[] = []
  let index = 0
  while (index < lines.length || pages.length === 0) {
    const preamble = pages.length === 0 ? introH : 28
    const budget = PAGE[1] - MARGIN_TOP - MARGIN_BOTTOM - preamble - HEADER_H
    let end = index
    let height = pages.length === 0 ? ROW : 0
    while (end < lines.length) {
      const last = end === lines.length - 1
      const extras = last ? ROW * 2 + conclusionH : 0
      if (height + ROW + extras > budget && end > index) {
        break
      }
      height += ROW
      end += 1
    }
    if (end === index && lines.length > 0) {
      end = index + 1
    }
    pages.push({ start: index, end: Math.max(end, index) })
    index = end
    if (lines.length === 0) {
      break
    }
  }

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const slice = pages[pageIndex]
    if (!slice) {
      continue
    }
    const page = pdf.addPage(PAGE)
    const painter: PdfPainter = { page, fonts, boxes, pageIndex }
    let y = PAGE[1] - MARGIN_TOP
    if (pageIndex === 0) {
      y = drawIntro(painter, document, y)
    } else {
      const title = `АКТ СВЕРКИ № ${document.statement.documentNumber} (продолжение)`
      const tw = fonts.bold.widthOfTextAtSize(title, 10)
      drawText(painter, fonts.bold, title, MARGIN_X + (CONTENT - tw) / 2, y, 10, 'title')
      y -= 16
    }
    const tableTop = y
    y = drawDualHeader(painter, document, y)
    if (pageIndex === 0) {
      y = drawBalanceRow(
        painter,
        `Сальдо на начало ${document.periodFromLong}`,
        document.statement.openingOrgDebit,
        document.statement.openingOrgCredit,
        y,
        'opening',
      )
    }
    for (let i = slice.start; i < slice.end; i += 1) {
      const line = lines[i]
      if (!line) {
        continue
      }
      y = drawOpRow(painter, line, y)
    }
    const last = pageIndex === pages.length - 1
    if (last) {
      y = drawBalanceRow(
        painter,
        'Обороты за период',
        document.statement.debitTurnover,
        document.statement.creditTurnover,
        y,
        'turnover',
      )
      y = drawBalanceRow(
        painter,
        `Сальдо на конец ${document.periodToLong}`,
        document.statement.closingOrgDebit,
        document.statement.closingOrgCredit,
        y,
        'closing',
      )
    }
    strokeRect(painter.page, MARGIN_X, y, CONTENT, tableTop - y)
    strokeLine(painter.page, MARGIN_X + HALF, y, MARGIN_X + HALF, tableTop)
    if (last) {
      drawConclusion(painter, document, y - 10)
    }
  }

  return {
    bytes: await pdf.save({ useObjectStreams: false }),
    boxes,
    pageCount: pages.length,
  }
}

export async function renderReconciliationStatementPdfBytes(
  document: ReconciliationPdfDocument,
): Promise<Uint8Array> {
  return (await renderReconciliationStatementPdfWithLayout(document)).bytes
}

function measureIntro(
  fonts: { regular: PDFFont; bold: PDFFont },
  document: ReconciliationPdfDocument,
): number {
  let height = 18
  const title = `АКТ СВЕРКИ № ${document.statement.documentNumber} от ${document.documentDateLong}`
  height += wrapLines(fonts.bold, title, TITLE, CONTENT).length * 13
  const period = [
    `взаимных расчетов за период с ${document.periodFromFile} по ${document.periodToFile}`,
    `между ${document.statement.organization.name} и ${document.statement.counterparty.name}`,
    `по договору ${document.statement.contractLabel}`,
  ]
  period.forEach((line) => {
    height += wrapLines(fonts.regular, line, BODY, CONTENT).length * 10
  })
  height += 8
  introWeLines(document).forEach((line) => {
    height += wrapLines(fonts.regular, line, BODY, CONTENT).length * 10
  })
  return height + 8
}

function introWeLines(document: ReconciliationPdfDocument): string[] {
  return [
    `Мы, нижеподписавшиеся, ______________________ ${document.statement.organization.name}, с одной стороны,`,
    `и ______________________ ${document.statement.counterparty.name} ______________________, с другой стороны,`,
    'составили настоящий акт сверки в том, что состояние взаимных расчетов по данным учета следующее:',
  ]
}

function drawIntro(
  painter: PdfPainter,
  document: ReconciliationPdfDocument,
  y: number,
): number {
  const { fonts } = painter
  const title = `АКТ СВЕРКИ № ${document.statement.documentNumber} от ${document.documentDateLong}`
  wrapLines(fonts.bold, title, TITLE, CONTENT).forEach((line) => {
    const width = fonts.bold.widthOfTextAtSize(line, TITLE)
    drawText(painter, fonts.bold, line, MARGIN_X + (CONTENT - width) / 2, y, TITLE, 'title')
    y -= 13
  })
  y -= 4
  const period = [
    `взаимных расчетов за период с ${document.periodFromFile} по ${document.periodToFile}`,
    `между ${document.statement.organization.name} и ${document.statement.counterparty.name}`,
    `по договору ${document.statement.contractLabel}`,
  ]
  period.forEach((line) => {
    wrapLines(fonts.regular, line, BODY, CONTENT).forEach((part) => {
      const width = fonts.regular.widthOfTextAtSize(part, BODY)
      drawText(painter, fonts.regular, part, MARGIN_X + (CONTENT - width) / 2, y, BODY, 'intro')
      y -= 10
    })
  })
  y -= 6
  introWeLines(document).forEach((line) => {
    wrapLines(fonts.regular, line, BODY, CONTENT).forEach((part) => {
      drawText(painter, fonts.regular, part, MARGIN_X, y, BODY, 'intro')
      y -= 10
    })
  })
  return y - 6
}

function columnXs(origin: number): [number, number, number, number] {
  return [origin, origin + DATE_W, origin + DATE_W + DOC_W, origin + DATE_W + DOC_W + MONEY_W]
}

function drawDualHeader(
  painter: PdfPainter,
  document: ReconciliationPdfDocument,
  y: number,
): number {
  const left = MARGIN_X
  const right = MARGIN_X + HALF
  strokeLine(painter.page, left, y, left + CONTENT, y)
  const leftCap = `ПО ДАННЫМ ${document.statement.organization.name}, ${document.statement.currency}`
  const rightCap = `ПО ДАННЫМ ${document.statement.counterparty.name}, ${document.statement.currency}`
  wrapLines(painter.fonts.bold, leftCap, 7, HALF - 8)
    .slice(0, 2)
    .forEach((line, i) => {
      drawText(painter, painter.fonts.bold, line, left + 4, y - 9 - i * 8, 7, 'table-header')
    })
  wrapLines(painter.fonts.bold, rightCap, 7, HALF - 8)
    .slice(0, 2)
    .forEach((line, i) => {
      drawText(painter, painter.fonts.bold, line, right + 4, y - 9 - i * 8, 7, 'table-header')
    })
  y -= CAPTION_H
  strokeLine(painter.page, left, y, left + CONTENT, y)
  drawColHeads(painter, left, y)
  drawColHeads(painter, right, y)
  return y - COL_H
}

function drawColHeads(painter: PdfPainter, x: number, y: number) {
  const cols = columnXs(x)
  const widths = [DATE_W, DOC_W, MONEY_W, MONEY_W]
  ;['Дата', 'Документ', 'Дебет', 'Кредит'].forEach((label, i) => {
    const origin = cols[i] ?? x
    const colW = widths[i] ?? DATE_W
    if (i > 0) {
      strokeLine(painter.page, origin, y - COL_H, origin, y)
    }
    const tw = painter.fonts.regular.widthOfTextAtSize(label, CELL)
    drawText(
      painter,
      painter.fonts.regular,
      label,
      origin + Math.max(2, (colW - tw) / 2),
      y - 9,
      CELL,
      'table-header',
    )
  })
  strokeLine(painter.page, x, y - COL_H, x + HALF, y - COL_H)
}

function drawMoney(
  painter: PdfPainter,
  amount: number,
  right: number,
  y: number,
  block: string,
) {
  if (!amount) {
    return
  }
  const text = formatInvoiceMoney(amount)
  drawText(
    painter,
    painter.fonts.regular,
    text,
    right - painter.fonts.regular.widthOfTextAtSize(text, CELL) - 3,
    y,
    CELL,
    block,
  )
}

function drawBalanceRow(
  painter: PdfPainter,
  label: string,
  debit: number,
  credit: number,
  y: number,
  block: string,
): number {
  drawHalfBalance(painter, MARGIN_X, label, debit, credit, y, block)
  drawHalfBalance(painter, MARGIN_X + HALF, label, credit, debit, y, block)
  return y - ROW
}

function drawHalfBalance(
  painter: PdfPainter,
  x: number,
  label: string,
  debit: number,
  credit: number,
  y: number,
  block: string,
) {
  const cols = columnXs(x)
  strokeLine(painter.page, cols[2], y - ROW, cols[2], y)
  strokeLine(painter.page, cols[3], y - ROW, cols[3], y)
  strokeLine(painter.page, x, y - ROW, x + HALF, y - ROW)
  wrapLines(painter.fonts.regular, label, 6.2, DATE_W + DOC_W - 6)
    .slice(0, 2)
    .forEach((line, i) => {
      drawText(painter, painter.fonts.regular, line, x + 3, y - 8 - i * 5.5, 6.2, block)
    })
  drawMoney(painter, debit, cols[3], y - 9, block)
  drawMoney(painter, credit, x + HALF, y - 9, block)
}

function drawOpRow(
  painter: PdfPainter,
  line: ReconciliationStatement['lines'][number],
  y: number,
): number {
  drawHalfOp(painter, MARGIN_X, line.date, line.document, line.orgDebit, line.orgCredit, y)
  drawHalfOp(
    painter,
    MARGIN_X + HALF,
    line.date,
    line.document,
    line.customerDebit,
    line.customerCredit,
    y,
  )
  return y - ROW
}

function drawHalfOp(
  painter: PdfPainter,
  x: number,
  date: string,
  document: string,
  debit: number,
  credit: number,
  y: number,
) {
  const cols = columnXs(x)
  strokeLine(painter.page, cols[1], y - ROW, cols[1], y)
  strokeLine(painter.page, cols[2], y - ROW, cols[2], y)
  strokeLine(painter.page, cols[3], y - ROW, cols[3], y)
  strokeLine(painter.page, x, y - ROW, x + HALF, y - ROW)
  drawText(
    painter,
    painter.fonts.regular,
    formatInvoiceDateFile(date),
    cols[0] + 2,
    y - 9,
    6.4,
    'operations',
  )
  wrapLines(painter.fonts.regular, document, 6.2, DOC_W - 4)
    .slice(0, 2)
    .forEach((line, i) => {
      drawText(painter, painter.fonts.regular, line, cols[1] + 2, y - 7 - i * 7, 6.2, 'operations')
    })
  drawMoney(painter, debit, cols[3], y - 9, 'operations')
  drawMoney(painter, credit, x + HALF, y - 9, 'operations')
}

function drawConclusion(
  painter: PdfPainter,
  document: ReconciliationPdfDocument,
  y: number,
) {
  const { statement } = document
  let cursor = y
  const lines: string[] = []
  if (statement.balanceSide === 'none' || statement.balanceAmount === 0) {
    lines.push('Задолженность отсутствует.')
  } else {
    const favor =
      statement.balanceSide === 'organization'
        ? statement.organization.name
        : statement.counterparty.name
    lines.push(
      `По данным ${statement.organization.name} на ${document.periodToFile} задолженность в пользу ${favor}`,
    )
    lines.push(`${formatInvoiceMoney(statement.balanceAmount)} ${statement.currency}`)
    lines.push(`(${statement.balanceWords})`)
  }
  lines.forEach((line) => {
    wrapLines(painter.fonts.regular, line, BODY, CONTENT).forEach((part) => {
      drawText(painter, painter.fonts.regular, part, MARGIN_X, cursor, BODY, 'conclusion')
      cursor -= 10
    })
  })
  cursor -= 10
  const half = HALF - 12
  drawSignBlock(
    painter,
    MARGIN_X,
    cursor,
    half,
    `От ${statement.organization.name}`,
    statement.organization.taxId ? `БИН: ${statement.organization.taxId}` : 'БИН:',
  )
  drawSignBlock(
    painter,
    MARGIN_X + HALF + 8,
    cursor,
    half,
    `От ${statement.counterparty.name}`,
    statement.counterparty.taxId ? `ИИН/БИН: ${statement.counterparty.taxId}` : 'ИИН/БИН:',
  )
}

function drawSignBlock(
  painter: PdfPainter,
  x: number,
  y: number,
  width: number,
  title: string,
  tax: string,
) {
  wrapLines(painter.fonts.regular, title, 7.5, width)
    .slice(0, 2)
    .forEach((line, i) => {
      drawText(painter, painter.fonts.regular, line, x, y - i * 10, 7.5, 'signature')
    })
  drawText(painter, painter.fonts.regular, tax, x, y - 28, 7.5, 'signature')
  strokeLine(painter.page, x, y - 44, x + Math.min(170, width), y - 44)
  drawText(painter, painter.fonts.regular, '(_______________________)', x + 10, y - 58, 7, 'signature')
  drawText(painter, painter.fonts.regular, 'М.П.', x, y - 74, 8, 'signature')
}
