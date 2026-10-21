import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import * as fontkitModule from '@pdf-lib/fontkit'
import type { InvoiceDocument } from '../services/sales-invoices'
import { loadInvoicePdfFonts } from './invoice-fonts'
import { formatInvoiceMoney, formatInvoiceQuantity } from './invoice-format'

const A4: [number, number] = [595.28, 841.89]
export const INVOICE_PDF_CONTENT_WIDTH = 539
export const INVOICE_PDF_PAYMENT_RATIOS = { left: 0.48, mid: 0.34, right: 0.18 } as const
export const INVOICE_PDF_KBE_LABEL = 'Кбе'
const MARGIN_X = (A4[0] - INVOICE_PDF_CONTENT_WIDTH) / 2
const MARGIN_TOP = 22
const MARGIN_BOTTOM = 28
const BLACK = rgb(0, 0, 0)
const STROKE = 0.5
const GAP = 7
/** Cursor drop from payment table bottom to invoice title baseline. Was 7. */
export const INVOICE_PDF_GAP_AFTER_PAYMENT = 40
const TITLE_SIZE = 13.5
const TITLE_UNDERLINE_GAP = 10
const AFTER_TITLE_LINE = 14
const STAMP_SIZE = 62
const PAY_PAD_X = 4
const PAY_PAD_Y = 3.5
const PAY_LINE = 10
const PRODUCT_COLS = [22, 64, 0, 44, 32, 70, 76] as const

export type InvoicePdfTextBox = {
  page: number
  block: string
  text: string
  x: number
  y: number
  width: number
  height: number
}

export type InvoicePdfLayout = {
  bytes: Uint8Array
  boxes: InvoicePdfTextBox[]
  pageCount: number
  paymentTableBottom: number
  titleBaseline: number
}

type Fonts = { regular: PDFFont; bold: PDFFont }
type CellLine = { text: string; font: PDFFont; size: number }
type Painter = {
  page: PDFPage
  fonts: Fonts
  boxes: InvoicePdfTextBox[]
  pageIndex: number
}

function wrapLines(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const source = (text ?? '').trim()
  if (!source) {
    return []
  }
  const limit = Number.isFinite(maxWidth) && maxWidth > 1 ? maxWidth : 1
  const words = source.split(/\s+/)
  const lines: string[] = []
  let current = ''
  const pushChunked = (word: string) => {
    let chunk = ''
    for (const ch of word) {
      const trial = chunk + ch
      if (font.widthOfTextAtSize(trial, size) <= limit) {
        chunk = trial
      } else {
        if (chunk) {
          lines.push(chunk)
        }
        chunk = ch
      }
    }
    current = chunk
  }
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= limit) {
      current = next
    } else if (current) {
      lines.push(current)
      if (font.widthOfTextAtSize(word, size) <= limit) {
        current = word
      } else {
        pushChunked(word)
      }
    } else {
      pushChunked(word)
    }
  }
  if (current) {
    lines.push(current)
  }
  return lines.length > 0 ? lines : ['']
}

function wrapWithFirstWidth(
  font: PDFFont,
  text: string,
  size: number,
  fullWidth: number,
  firstWidth: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  let limit = firstWidth
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= limit) {
      current = next
    } else {
      if (current) {
        lines.push(current)
      }
      current = word
      limit = fullWidth
    }
  }
  if (current) {
    lines.push(current)
  }
  return lines
}

function registerFontkit(pdf: PDFDocument) {
  let current: unknown = fontkitModule
  while (
    current &&
    typeof current === 'object' &&
    'default' in current &&
    (current as { default: unknown }).default &&
    (current as { default: unknown }).default !== current
  ) {
    current = (current as { default: unknown }).default
  }
  pdf.registerFontkit(current as Parameters<PDFDocument['registerFontkit']>[0])
}

async function embedDataImage(pdf: PDFDocument, dataUrl?: string) {
  const raw = dataUrl?.trim()
  if (!raw) {
    return undefined
  }
  const match = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i.exec(raw)
  if (!match) {
    return undefined
  }
  const bytes = Uint8Array.from(atob(match[2]), (ch) => ch.charCodeAt(0))
  if (match[1].toLowerCase() === 'png') {
    return pdf.embedPng(bytes)
  }
  return pdf.embedJpg(bytes)
}

function splitWarning(warning: string): { lead: string; rest: string } {
  const trimmed = warning.trim()
  const match = /^(Внимание!)\s*(.*)$/s.exec(trimmed)
  if (!match) {
    return { lead: '', rest: trimmed }
  }
  return { lead: match[1], rest: match[2] }
}

function tableColumns(contentWidth: number) {
  const nameWidth =
    contentWidth -
    PRODUCT_COLS[0] -
    PRODUCT_COLS[1] -
    PRODUCT_COLS[3] -
    PRODUCT_COLS[4] -
    PRODUCT_COLS[5] -
    PRODUCT_COLS[6]
  const widths = [
    PRODUCT_COLS[0],
    PRODUCT_COLS[1],
    nameWidth,
    PRODUCT_COLS[3],
    PRODUCT_COLS[4],
    PRODUCT_COLS[5],
    PRODUCT_COLS[6],
  ]
  const x: number[] = []
  let cursor = MARGIN_X
  for (const width of widths) {
    x.push(cursor)
    cursor += width
  }
  return { widths, x }
}

function boxesOverlap(a: InvoicePdfTextBox, b: InvoicePdfTextBox): boolean {
  if (a.page !== b.page) {
    return false
  }
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return overlapX > 0.8 && overlapY > 0.8
}

export function findOverlappingInvoiceText(
  boxes: InvoicePdfTextBox[],
): [InvoicePdfTextBox, InvoicePdfTextBox] | undefined {
  for (let i = 0; i < boxes.length; i += 1) {
    const left = boxes[i]
    if (!left) {
      continue
    }
    for (let j = i + 1; j < boxes.length; j += 1) {
      const right = boxes[j]
      if (!right) {
        continue
      }
      if (boxesOverlap(left, right)) {
        return [left, right]
      }
    }
  }
  return undefined
}

function drawText(
  painter: Painter,
  font: PDFFont,
  text: string,
  x: number,
  baseline: number,
  size: number,
  block: string,
) {
  if (!text) {
    return
  }
  painter.page.drawText(text, { x, y: baseline, size, font, color: BLACK })
  painter.boxes.push({
    page: painter.pageIndex,
    block,
    text,
    x,
    y: baseline,
    width: font.widthOfTextAtSize(text, size),
    height: size,
  })
}

function strokeRect(page: PDFPage, x: number, y: number, width: number, height: number) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderWidth: STROKE,
    borderColor: BLACK,
  })
}

function strokeLine(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness = STROKE,
) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness,
    color: BLACK,
  })
}

function cellHeight(lines: CellLine[]): number {
  return PAY_PAD_Y * 2 + Math.max(1, lines.length) * PAY_LINE
}

function drawCell(
  painter: Painter,
  lines: CellLine[],
  x: number,
  cellTop: number,
  block: string,
) {
  let baseline = cellTop - PAY_PAD_Y - (lines[0]?.size ?? 8)
  for (const line of lines) {
    drawText(painter, line.font, line.text, x + PAY_PAD_X, baseline, line.size, block)
    baseline -= PAY_LINE
  }
}

function toLines(font: PDFFont, texts: string[], size: number): CellLine[] {
  return texts.map((text) => ({ text, font, size }))
}

type PaymentLayout = {
  leftW: number
  midW: number
  rightW: number
  row1: number
  row2: number
  height: number
  topLeft: CellLine[]
  topMid: CellLine[]
  topRight: CellLine[]
  botLeft: CellLine[]
  botRight: CellLine[]
  botMid: CellLine[]
}

function measurePaymentOrder(
  document: InvoiceDocument,
  fonts: Fonts,
  contentWidth: number,
): PaymentLayout {
  const leftW = contentWidth * INVOICE_PDF_PAYMENT_RATIOS.left
  const midW = contentWidth * INVOICE_PDF_PAYMENT_RATIOS.mid
  const rightW = contentWidth - leftW - midW
  const inner = (width: number) => Math.max(16, width - PAY_PAD_X * 2)
  const s = document.supplier
  const topLeft: CellLine[] = [
    { text: 'Бенефициар:', font: fonts.regular, size: 7 },
    ...toLines(fonts.regular, wrapLines(fonts.regular, s.name, 8, inner(leftW)), 8),
    {
      text: `${document.supplierTaxLabel}: ${s.taxId ?? ''}`,
      font: fonts.regular,
      size: 8,
    },
  ]
  const topMid: CellLine[] = [
    { text: 'ИИК', font: fonts.regular, size: 7 },
    ...toLines(fonts.regular, wrapLines(fonts.regular, s.iban ?? '', 8, inner(midW)), 8),
  ]
  const topRight: CellLine[] = [
    { text: INVOICE_PDF_KBE_LABEL, font: fonts.regular, size: 7 },
    { text: s.kbe ?? '', font: fonts.regular, size: 8 },
  ]
  const botLeft: CellLine[] = [
    { text: 'Банк бенефициара:', font: fonts.regular, size: 7 },
    ...toLines(fonts.regular, wrapLines(fonts.regular, s.bankName ?? '', 8, inner(leftW)), 8),
  ]
  const botMid: CellLine[] = [
    { text: 'БИК', font: fonts.regular, size: 7 },
    { text: s.bik ?? '', font: fonts.regular, size: 8 },
  ]
  const botRight: CellLine[] = [
    { text: 'КНП', font: fonts.regular, size: 7 },
    { text: s.knp ?? '', font: fonts.regular, size: 8 },
  ]
  const row1 = Math.max(cellHeight(topLeft), cellHeight(topMid), cellHeight(topRight), 46)
  const row2 = Math.max(cellHeight(botLeft), cellHeight(botMid), cellHeight(botRight), 32)
  return {
    leftW,
    midW,
    rightW,
    row1,
    row2,
    height: 12 + row1 + row2,
    topLeft,
    topMid,
    topRight,
    botLeft,
    botMid,
    botRight,
  }
}

function measureWarning(warning: string, fonts: Fonts, contentWidth: number): number {
  const warnSize = 7.5
  const { lead, rest } = splitWarning(warning)
  const leadWidth = lead ? fonts.bold.widthOfTextAtSize(`${lead} `, warnSize) : 0
  const firstWidth = lead ? Math.max(40, contentWidth - leadWidth) : contentWidth
  const restLines = wrapWithFirstWidth(fonts.regular, rest, warnSize, contentWidth, firstWidth)
  return Math.max(1, restLines.length) * 9.4
}

function measureLabeled(fonts: Fonts, label: string, body: string, contentWidth: number): number {
  const indent = fonts.bold.widthOfTextAtSize(label, 9) + 3
  const firstLines = wrapLines(fonts.regular, body, 9, contentWidth - indent)
  return Math.max(1, firstLines.length) * 11.2
}

function measureParties(document: InvoiceDocument, fonts: Fonts, contentWidth: number): number {
  return (
    measureLabeled(fonts, 'Поставщик:', document.supplierLine, contentWidth) +
    4 +
    measureLabeled(fonts, 'Покупатель:', document.buyerLine, contentWidth) +
    4 +
    measureLabeled(fonts, 'Договор:', document.contract ?? 'Без договора', contentWidth)
  )
}

function measureTotals(
  document: InvoiceDocument,
  fonts: Fonts,
  contentWidth: number,
  hasStamp: boolean,
): number {
  const words = wrapLines(
    fonts.regular,
    document.totalInWords,
    9,
    contentWidth - fonts.bold.widthOfTextAtSize('Всего к оплате:', 9) - 6,
  )
  return 8 + 12 + 12 + 12 + Math.max(1, words.length) * 11 + 18 + (hasStamp ? STAMP_SIZE : 10) + 10
}

export async function renderSaleInvoicePdfWithLayout(
  document: InvoiceDocument,
): Promise<InvoicePdfLayout> {
  const pdf = await PDFDocument.create()
  registerFontkit(pdf)
  const loaded = await loadInvoicePdfFonts()
  const fonts: Fonts = {
    regular: await pdf.embedFont(loaded.regular, { subset: false }),
    bold: await pdf.embedFont(loaded.bold, { subset: false }),
  }
  const stamp = await embedDataImage(pdf, document.stamp)
  const signature = await embedDataImage(pdf, document.signature)
  const boxes: InvoicePdfTextBox[] = []
  const contentWidth = INVOICE_PDF_CONTENT_WIDTH
  const cols = tableColumns(contentWidth)
  const headerHeight = 15
  const cellPad = 3
  const payment = measurePaymentOrder(document, fonts, contentWidth)
  const preambleHeight =
    measureWarning(document.warning, fonts, contentWidth) +
    GAP +
    payment.height +
    INVOICE_PDF_GAP_AFTER_PAYMENT +
    TITLE_SIZE +
    TITLE_UNDERLINE_GAP +
    AFTER_TITLE_LINE +
    measureParties(document, fonts, contentWidth) +
    GAP
  const totalsHeight = measureTotals(document, fonts, contentWidth, Boolean(stamp))
  const itemHeights = document.items.map((item) => {
    const skuLines = wrapLines(fonts.regular, item.sku, 8, cols.widths[1] - cellPad * 2)
    const nameLines = wrapLines(fonts.regular, item.name, 8, cols.widths[2] - cellPad * 2)
    return Math.max(14.5, skuLines.length * 9 + 5, nameLines.length * 9 + 5)
  })

  const pages: { start: number; end: number }[] = []
  let paymentTableBottom = 0
  let titleBaseline = 0
  let index = 0
  while (index < document.items.length || pages.length === 0) {
    const preamble = pages.length === 0 ? preambleHeight : 22
    let end = index
    const pageBudget = A4[1] - MARGIN_TOP - MARGIN_BOTTOM - preamble
    let height = headerHeight
    while (end < document.items.length) {
      const next = itemHeights[end] ?? 14.5
      const extras = document.items.length - end - 1 === 0 ? totalsHeight : 0
      if (height + next + extras > pageBudget && end > index) {
        break
      }
      height += next
      end += 1
    }
    if (end === index && document.items.length > 0) {
      end = index + 1
    }
    pages.push({ start: index, end: Math.max(end, index) })
    index = end
    if (document.items.length === 0) {
      break
    }
  }

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const slice = pages[pageIndex]
    if (!slice) {
      continue
    }
    const page = pdf.addPage(A4)
    const painter: Painter = { page, fonts, boxes, pageIndex }
    let y = A4[1] - MARGIN_TOP
    if (pageIndex === 0) {
      y = drawWarning(painter, document.warning, contentWidth, y)
      y -= GAP
      y = drawPaymentOrder(painter, payment, y)
      paymentTableBottom = y
      y -= INVOICE_PDF_GAP_AFTER_PAYMENT
      titleBaseline = y
      y = drawTitle(painter, document, contentWidth, y)
      y = drawParties(painter, document, contentWidth, y)
      y -= GAP
    }
    y = drawProductsHeader(painter, cols, contentWidth, headerHeight, y)
    for (let i = slice.start; i < slice.end; i += 1) {
      const item = document.items[i]
      if (!item) {
        continue
      }
      y = drawItemRow(painter, item, cols, contentWidth, itemHeights[i] ?? 14.5, y)
    }
    if (pageIndex === pages.length - 1) {
      drawTotals(painter, document, contentWidth, stamp, signature, y)
    }
  }

  return {
    bytes: await pdf.save({ useObjectStreams: false }),
    boxes,
    pageCount: pages.length,
    paymentTableBottom,
    titleBaseline,
  }
}

export async function renderSaleInvoicePdfBytes(
  document: InvoiceDocument,
): Promise<Uint8Array> {
  const rendered = await renderSaleInvoicePdfWithLayout(document)
  return rendered.bytes
}

function drawWarning(
  painter: Painter,
  warning: string,
  contentWidth: number,
  y: number,
): number {
  const warnSize = 7.5
  const { lead, rest } = splitWarning(warning)
  const leadWidth = lead ? painter.fonts.bold.widthOfTextAtSize(`${lead} `, warnSize) : 0
  const firstWidth = lead ? Math.max(40, contentWidth - leadWidth) : contentWidth
  const restLines = wrapWithFirstWidth(
    painter.fonts.regular,
    rest,
    warnSize,
    contentWidth,
    firstWidth,
  )
  let cursor = y
  if (lead) {
    drawText(painter, painter.fonts.bold, lead, MARGIN_X, cursor, warnSize, 'warning')
    if (restLines[0]) {
      drawText(
        painter,
        painter.fonts.regular,
        restLines[0],
        MARGIN_X + leadWidth,
        cursor,
        warnSize,
        'warning',
      )
    }
    cursor -= 9.4
    for (const line of restLines.slice(1)) {
      drawText(painter, painter.fonts.regular, line, MARGIN_X, cursor, warnSize, 'warning')
      cursor -= 9.4
    }
  } else {
    for (const line of restLines) {
      drawText(painter, painter.fonts.regular, line, MARGIN_X, cursor, warnSize, 'warning')
      cursor -= 9.4
    }
  }
  return cursor
}

function drawPaymentOrder(painter: Painter, payment: PaymentLayout, y: number): number {
  drawText(
    painter,
    painter.fonts.bold,
    'Образец платежного поручения',
    MARGIN_X,
    y,
    9.5,
    'payment-title',
  )
  const tableTop = y - 12
  const { leftW, midW, rightW, row1, row2 } = payment
  const width = leftW + midW + rightW
  const tableBottom = tableTop - row1 - row2
  const midX = MARGIN_X + leftW
  const rightX = midX + midW
  strokeRect(painter.page, MARGIN_X, tableBottom, width, row1 + row2)
  strokeLine(painter.page, midX, tableBottom, midX, tableTop)
  strokeLine(painter.page, rightX, tableBottom, rightX, tableTop)
  strokeLine(painter.page, MARGIN_X, tableTop - row1, MARGIN_X + width, tableTop - row1)
  drawCell(painter, payment.topLeft, MARGIN_X, tableTop, 'payment')
  drawCell(painter, payment.topMid, midX, tableTop, 'payment')
  drawCell(painter, payment.topRight, rightX, tableTop, 'payment')
  drawCell(painter, payment.botLeft, MARGIN_X, tableTop - row1, 'payment')
  drawCell(painter, payment.botMid, midX, tableTop - row1, 'payment')
  drawCell(painter, payment.botRight, rightX, tableTop - row1, 'payment')
  return tableBottom
}

function drawTitle(
  painter: Painter,
  document: InvoiceDocument,
  contentWidth: number,
  y: number,
): number {
  const title = `Счет на оплату № ${document.invoice.invoiceNumber} от ${document.formattedDate}`
  drawText(painter, painter.fonts.bold, title, MARGIN_X, y, TITLE_SIZE, 'title')
  const under = y - TITLE_UNDERLINE_GAP
  strokeLine(painter.page, MARGIN_X, under, MARGIN_X + contentWidth, under, 1)
  return under - AFTER_TITLE_LINE
}

function drawLabeled(
  painter: Painter,
  label: string,
  body: string,
  contentWidth: number,
  y: number,
  block: string,
): number {
  const size = 9
  const lineGap = 11.2
  const labelWidth = painter.fonts.bold.widthOfTextAtSize(label, size)
  drawText(painter, painter.fonts.bold, label, MARGIN_X, y, size, block)
  const firstLines = wrapLines(
    painter.fonts.regular,
    body,
    size,
    contentWidth - labelWidth - 3,
  )
  const lines = firstLines.length > 0 ? firstLines : ['']
  lines.forEach((line, lineIndex) => {
    drawText(
      painter,
      painter.fonts.regular,
      lineIndex === 0 ? ` ${line}` : line,
      lineIndex === 0 ? MARGIN_X + labelWidth : MARGIN_X,
      y - lineIndex * lineGap,
      size,
      block,
    )
  })
  return y - Math.max(1, lines.length) * lineGap
}

function drawParties(
  painter: Painter,
  document: InvoiceDocument,
  contentWidth: number,
  y: number,
): number {
  y = drawLabeled(painter, 'Поставщик:', document.supplierLine, contentWidth, y, 'supplier')
  y -= 3
  y = drawLabeled(painter, 'Покупатель:', document.buyerLine, contentWidth, y, 'customer')
  y -= 3
  return drawLabeled(
    painter,
    'Договор:',
    document.contract ?? 'Без договора',
    contentWidth,
    y,
    'contract',
  )
}

function drawProductsHeader(
  painter: Painter,
  cols: { widths: number[] },
  contentWidth: number,
  headerHeight: number,
  y: number,
): number {
  const labels = ['№', 'Артикул', 'Наименование', 'Кол-во', 'Ед.', 'Цена', 'Сумма']
  strokeRect(painter.page, MARGIN_X, y - headerHeight, contentWidth, headerHeight)
  let cursor = MARGIN_X
  for (let i = 0; i < cols.widths.length; i += 1) {
    const width = cols.widths[i] ?? 0
    if (i > 0) {
      strokeLine(painter.page, cursor, y - headerHeight, cursor, y)
    }
    const label = labels[i] ?? ''
    const textWidth = painter.fonts.bold.widthOfTextAtSize(label, 8)
    drawText(
      painter,
      painter.fonts.bold,
      label,
      cursor + Math.max(1, (width - textWidth) / 2),
      y - 10.5,
      8,
      'products-header',
    )
    cursor += width
  }
  return y - headerHeight
}

function drawItemRow(
  painter: Painter,
  item: InvoiceDocument['items'][number],
  cols: { widths: number[]; x: number[] },
  contentWidth: number,
  height: number,
  y: number,
): number {
  strokeRect(painter.page, MARGIN_X, y - height, contentWidth, height)
  let cursor = MARGIN_X
  for (let i = 1; i < cols.widths.length; i += 1) {
    cursor += cols.widths[i - 1] ?? 0
    strokeLine(painter.page, cursor, y - height, cursor, y)
  }
  const top = y - 10
  const skuLines = wrapLines(painter.fonts.regular, item.sku, 8, (cols.widths[1] ?? 54) - 6)
  const nameLines = wrapLines(painter.fonts.regular, item.name, 8, (cols.widths[2] ?? 80) - 6)
  const values: (string | string[])[] = [
    String(item.index),
    skuLines,
    nameLines,
    formatInvoiceQuantity(item.quantity),
    item.unit,
    formatInvoiceMoney(item.price),
    formatInvoiceMoney(item.total),
  ]
  const alignRight = new Set([0, 3, 5, 6])
  for (let i = 0; i < cols.x.length; i += 1) {
    const x0 = cols.x[i] ?? MARGIN_X
    const width = cols.widths[i] ?? 0
    const value = values[i]
    if (Array.isArray(value)) {
      value.forEach((line, lineIndex) => {
        drawText(
          painter,
          painter.fonts.regular,
          line,
          x0 + 3,
          top - lineIndex * 9,
          8,
          'products',
        )
      })
    } else if (value) {
      const textWidth = painter.fonts.regular.widthOfTextAtSize(value, 8)
      const x = alignRight.has(i) ? x0 + width - 3 - textWidth : x0 + 3
      drawText(painter, painter.fonts.regular, value, x, top, 8, 'products')
    }
  }
  return y - height
}

function drawTotals(
  painter: Painter,
  document: InvoiceDocument,
  contentWidth: number,
  stamp: PDFImage | undefined,
  signature: PDFImage | undefined,
  y: number,
): number {
  let cursor = y - 11
  const amount = formatInvoiceMoney(document.invoice.total)
  const totalLabel = 'Итого:'
  const amountWidth = painter.fonts.bold.widthOfTextAtSize(amount, 9)
  drawText(
    painter,
    painter.fonts.bold,
    amount,
    MARGIN_X + contentWidth - amountWidth,
    cursor,
    9,
    'totals',
  )
  const totalLabelWidth = painter.fonts.bold.widthOfTextAtSize(totalLabel, 9)
  drawText(
    painter,
    painter.fonts.bold,
    totalLabel,
    MARGIN_X + contentWidth - amountWidth - 6 - totalLabelWidth,
    cursor,
    9,
    'totals',
  )
  cursor -= 12
  const vatValue = document.vatLabel
  const vatValueWidth = painter.fonts.regular.widthOfTextAtSize(vatValue, 9)
  drawText(
    painter,
    painter.fonts.regular,
    vatValue,
    MARGIN_X + contentWidth - vatValueWidth,
    cursor,
    9,
    'totals',
  )
  const vatLabel = 'В том числе НДС:'
  const vatLabelWidth = painter.fonts.regular.widthOfTextAtSize(vatLabel, 9)
  drawText(
    painter,
    painter.fonts.regular,
    vatLabel,
    MARGIN_X + contentWidth - vatValueWidth - 8 - vatLabelWidth,
    cursor,
    9,
    'totals',
  )
  cursor -= 13
  drawText(
    painter,
    painter.fonts.regular,
    `Всего наименований ${document.itemCount}, на сумму ${amount} тенге`,
    MARGIN_X,
    cursor,
    9,
    'totals',
  )
  cursor -= 13
  const payLabel = 'Всего к оплате:'
  const payWidth = painter.fonts.bold.widthOfTextAtSize(payLabel, 9)
  drawText(painter, painter.fonts.bold, payLabel, MARGIN_X, cursor, 9, 'totals')
  const wordLines = wrapLines(
    painter.fonts.regular,
    document.totalInWords,
    9,
    contentWidth - payWidth - 6,
  )
  wordLines.forEach((line, lineIndex) => {
    drawText(
      painter,
      painter.fonts.regular,
      lineIndex === 0 ? ` ${line}` : line,
      lineIndex === 0 ? MARGIN_X + payWidth : MARGIN_X,
      cursor - lineIndex * 11,
      9,
      'totals',
    )
  })
  cursor -= Math.max(1, wordLines.length) * 11 + 16
  const execLabel = 'Исполнитель'
  drawText(painter, painter.fonts.regular, execLabel, MARGIN_X, cursor, 9, 'signature')
  const lineStart = MARGIN_X + painter.fonts.regular.widthOfTextAtSize(execLabel, 9) + 8
  const lineEnd = lineStart + 118
  strokeLine(painter.page, lineStart, cursor - 1, lineEnd, cursor - 1, 0.6)
  if (signature) {
    const sigW = 86
    const sigH = Math.min((signature.height / signature.width) * sigW, 32)
    painter.page.drawImage(signature, {
      x: lineStart,
      y: cursor - 2,
      width: sigW,
      height: sigH,
    })
  }
  const performer = document.performer ? `/ ${document.performer} /` : '/  /'
  drawText(painter, painter.fonts.regular, performer, lineEnd + 6, cursor, 9, 'signature')
  strokeLine(painter.page, MARGIN_X, cursor - 14, MARGIN_X + contentWidth, cursor - 14, 0.8)
  if (stamp) {
    const stampX = MARGIN_X + 72
    const stampY = cursor - STAMP_SIZE + 18
    painter.page.drawImage(stamp, {
      x: stampX,
      y: stampY,
      width: STAMP_SIZE,
      height: STAMP_SIZE,
    })
    return stampY
  }
  return cursor - 16
}

export function saleInvoicePdfBlob(bytes: Uint8Array): Blob {
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}

function revokeLater(url: string) {
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function clickBlobLink(
  url: string,
  options: { download?: string; target?: '_blank' },
): void {
  const link = document.createElement('a')
  link.href = url
  if (options.download) {
    link.download = options.download
  }
  if (options.target) {
    link.target = options.target
    link.rel = 'noopener noreferrer'
  }
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function openSaleInvoicePdf(bytes: Uint8Array): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false
  }
  const url = URL.createObjectURL(saleInvoicePdfBlob(bytes))
  const popup = window.open(url, '_blank')
  if (popup) {
    revokeLater(url)
    return true
  }
  clickBlobLink(url, { target: '_blank' })
  revokeLater(url)
  return true
}

export function downloadSaleInvoicePdf(filename: string, bytes: Uint8Array): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false
  }
  const url = URL.createObjectURL(saleInvoicePdfBlob(bytes))
  const name = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  clickBlobLink(url, { download: name })
  revokeLater(url)
  return true
}
