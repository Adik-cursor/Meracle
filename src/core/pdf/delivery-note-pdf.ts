import { PDFDocument } from 'pdf-lib'
import type { DeliveryNoteDocument } from '../services/delivery-notes'
import { loadInvoicePdfFonts } from './invoice-fonts'
import { formatInvoiceMoney, formatInvoiceQuantity } from './invoice-format'
import {
  drawText,
  registerFontkit,
  strokeLine,
  strokeRect,
  wrapLines,
  type PdfPainter,
  type PdfTextBox,
} from './pdf-draw'

const PAGE: [number, number] = [792, 612]
const MARGIN_X = 28
const MARGIN_TOP = 28
const MARGIN_BOTTOM = 28
const CONTENT = PAGE[0] - MARGIN_X * 2
const COLS = [37, 180, 62, 47, 78, 67, 86, 86, 93] as const

export type DeliveryNotePdfLayout = {
  bytes: Uint8Array
  boxes: PdfTextBox[]
  pageCount: number
}

function columnWidths(): number[] {
  const used = (COLS.slice(0, 8) as number[]).reduce((sum, width) => sum + width, 0)
  return [...COLS.slice(0, 8), CONTENT - used]
}

export async function renderDeliveryNotePdfWithLayout(
  document: DeliveryNoteDocument,
): Promise<DeliveryNotePdfLayout> {
  const pdf = await PDFDocument.create()
  registerFontkit(pdf)
  const loaded = await loadInvoicePdfFonts()
  const fonts = {
    regular: await pdf.embedFont(loaded.regular, { subset: false }),
    bold: await pdf.embedFont(loaded.bold, { subset: false }),
  }
  const boxes: PdfTextBox[] = []
  const widths = columnWidths()
  const headerHeight = 50
  const rowMin = 19
  const itemHeights = document.note.items.map((item) => {
    const nameLines = wrapLines(fonts.regular, item.name, 7, widths[1] - 4)
    return Math.max(rowMin, nameLines.length * 8 + 4)
  })
  const footerHeight = 158
  const identityHeight = 244
  const pages: { start: number; end: number }[] = []
  let index = 0
  while (index < document.note.items.length || pages.length === 0) {
    const preamble = pages.length === 0 ? identityHeight : 24
    let end = index
    const budget = PAGE[1] - MARGIN_TOP - MARGIN_BOTTOM - preamble - headerHeight
    let height = 0
    while (end < document.note.items.length) {
      const next = itemHeights[end] ?? rowMin
      const extras = document.note.items.length - end - 1 === 0 ? footerHeight : 0
      if (height + next + extras > budget && end > index) {
        break
      }
      height += next
      end += 1
    }
    if (end === index && document.note.items.length > 0) {
      end = index + 1
    }
    pages.push({ start: index, end: Math.max(end, index) })
    index = end
    if (document.note.items.length === 0) {
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
      y = drawIdentity(painter, document, y)
    } else {
      drawText(
        painter,
        fonts.bold,
        `НАКЛАДНАЯ НА ОТПУСК ЗАПАСОВ НА СТОРОНУ № ${document.note.documentNumber} (продолжение)`,
        MARGIN_X,
        y,
        10,
        'title',
      )
      y -= 18
    }
    y = drawTableHeader(painter, widths, headerHeight, y)
    for (let i = slice.start; i < slice.end; i += 1) {
      const item = document.note.items[i]
      if (!item) {
        continue
      }
      y = drawItem(painter, item, widths, itemHeights[i] ?? rowMin, y)
    }
    if (pageIndex === pages.length - 1) {
      drawFooter(painter, document, widths, y)
    }
  }

  return {
    bytes: await pdf.save({ useObjectStreams: false }),
    boxes,
    pageCount: pages.length,
  }
}

export async function renderDeliveryNotePdfBytes(
  document: DeliveryNoteDocument,
): Promise<Uint8Array> {
  return (await renderDeliveryNotePdfWithLayout(document)).bytes
}

function drawIdentity(painter: PdfPainter, document: DeliveryNoteDocument, y: number): number {
  const { fonts } = painter
  const appendix = [
    'Приложение 26',
    'к приказу Министра финансов',
    'Республики Казахстан',
    'от 20 декабря 2012 года № 562',
  ]
  appendix.forEach((line, i) => {
    const size = 8
    drawText(
      painter,
      fonts.regular,
      line,
      PAGE[0] - MARGIN_X - fonts.regular.widthOfTextAtSize(line, size),
      y - i * 11,
      size,
      'meta',
    )
  })
  const form = 'Форма 3-2'
  const formSize = 8.5
  drawText(
    painter,
    fonts.bold,
    form,
    PAGE[0] - MARGIN_X - fonts.bold.widthOfTextAtSize(form, formSize),
    y - 58,
    formSize,
    'meta',
  )
  const orgLabel = 'Организация (индивидуальный предприниматель)'
  drawText(painter, fonts.regular, orgLabel, MARGIN_X + 2, y - 91, 8, 'org')
  const orgLineLeft = MARGIN_X + 200
  const orgLineRight = MARGIN_X + 542
  const orgName = document.note.shipper.name
  const orgNameSize = 9
  const orgNameWidth = fonts.bold.widthOfTextAtSize(orgName, orgNameSize)
  drawText(
    painter,
    fonts.bold,
    orgName,
    orgLineLeft + Math.max(0, (orgLineRight - orgLineLeft - orgNameWidth) / 2),
    y - 88,
    orgNameSize,
    'org',
  )
  strokeLine(painter.page, orgLineLeft, y - 95, orgLineRight, y - 95)
  const taxLabel = 'ИИН/БИН'
  drawText(painter, fonts.regular, taxLabel, MARGIN_X + 562, y - 91, 8, 'org')
  const binX = MARGIN_X + 620
  strokeRect(painter.page, binX, y - 102, PAGE[0] - MARGIN_X - binX, 16)
  if (document.note.shipper.taxId) {
    const taxSize = 9
    const taxWidth = fonts.bold.widthOfTextAtSize(document.note.shipper.taxId, taxSize)
    drawText(
      painter,
      fonts.bold,
      document.note.shipper.taxId,
      binX + (PAGE[0] - MARGIN_X - binX - taxWidth) / 2,
      y - 97,
      taxSize,
      'org',
    )
  }

  const dateY = y - 120
  const numX = PAGE[0] - MARGIN_X - 124
  const numW = 62
  const dateH = 30
  strokeRect(painter.page, numX, dateY - dateH, numW, dateH)
  strokeRect(painter.page, numX + numW, dateY - dateH, numW, dateH)
  drawText(painter, fonts.regular, 'Номер', numX + 17, dateY - 8, 8, 'org')
  drawText(painter, fonts.regular, 'документа', numX + 9, dateY - 17, 8, 'org')
  drawText(painter, fonts.regular, 'Дата', numX + numW + 19, dateY - 8, 8, 'org')
  drawText(painter, fonts.regular, 'составления', numX + numW + 6, dateY - 17, 8, 'org')
  strokeLine(painter.page, numX, dateY - 20, numX + numW * 2, dateY - 20)
  const docNumber = document.note.documentNumber.padStart(3, '0')
  const numberWidth = fonts.bold.widthOfTextAtSize(docNumber, 9)
  drawText(
    painter,
    fonts.bold,
    docNumber,
    numX + (numW - numberWidth) / 2,
    dateY - 27,
    9,
    'org',
  )
  const formattedDateWidth = fonts.bold.widthOfTextAtSize(document.formattedDate, 9)
  drawText(
    painter,
    fonts.bold,
    document.formattedDate,
    numX + numW + (numW - formattedDateWidth) / 2,
    dateY - 27,
    9,
    'org',
  )
  const title = 'НАКЛАДНАЯ НА ОТПУСК ЗАПАСОВ НА СТОРОНУ'
  const tw = fonts.bold.widthOfTextAtSize(title, 11)
  drawText(painter, fonts.bold, title, (PAGE[0] - tw) / 2, y - 170, 11, 'title')
  const partyTop = y - 198
  const partyH = 40
  const partyW = CONTENT / 5
  const labels = [
    'Организация (индивидуальный предприниматель) - отправитель',
    'Организация (индивидуальный предприниматель) - получатель',
    'Ответственный за поставку (Ф.И.О.)',
    'Транспортная организация',
    'Товарно-транспортная накладная (номер, дата)',
  ]
  const values = [
    document.note.shipper.name,
    document.note.consignee.name,
    document.note.performerName,
    '',
    '',
  ]
  for (let i = 0; i < 5; i += 1) {
    const x = MARGIN_X + partyW * i
    strokeRect(painter.page, x, partyTop - partyH, partyW, partyH)
    wrapLines(fonts.regular, labels[i] ?? '', 7.2, partyW - 6)
      .slice(0, 3)
      .forEach((line, lineIndex) => {
        drawText(painter, fonts.regular, line, x + 3, partyTop - 8 - lineIndex * 8, 7.2, 'party')
      })
    wrapLines(fonts.bold, values[i] ?? '', 7.4, partyW - 6)
      .slice(0, 2)
      .forEach((line, lineIndex) => {
        drawText(painter, fonts.bold, line, x + 3, partyTop - 29 - lineIndex * 7, 7.4, 'party')
      })
  }
  return partyTop - partyH - 8
}

function drawTableHeader(
  painter: PdfPainter,
  widths: number[],
  height: number,
  y: number,
): number {
  strokeRect(painter.page, MARGIN_X, y - height, CONTENT, height)
  const qtyStart = MARGIN_X + widths.slice(0, 4).reduce((sum, width) => sum + width, 0)
  const qtyW = (widths[4] ?? 0) + (widths[5] ?? 0)
  const numberTop = y - height + 10
  strokeLine(painter.page, MARGIN_X, numberTop, MARGIN_X + CONTENT, numberTop)
  drawText(painter, painter.fonts.regular, 'Количество', qtyStart + (qtyW - painter.fonts.regular.widthOfTextAtSize('Количество', 7.5)) / 2, y - 9, 7.5, 'products-header')
  strokeLine(painter.page, qtyStart, y - 17, qtyStart + qtyW, y - 17)
  const labels = [
    '№\nпо\nпорядку',
    'Наименование, характеристика',
    'Номенклатурный\nномер',
    'Единица\nизмерения',
    'подлежит\nотпуску',
    'отпущено',
    'Цена за единицу,\nв KZT',
    'Сумма с НДС,\nв KZT',
    'Сумма НДС,\nв KZT',
  ]
  const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
  let x = MARGIN_X
  for (let i = 0; i < widths.length; i += 1) {
    const width = widths[i] ?? 0
    if (i > 0) {
      strokeLine(painter.page, x, y - height, x, y)
    }
    const parts = (labels[i] ?? '').split('\n')
    if (i === 4 || i === 5) {
      const part = parts[0] ?? ''
      const textWidth = painter.fonts.regular.widthOfTextAtSize(part, 7)
      drawText(painter, painter.fonts.regular, part, x + (width - textWidth) / 2, y - 27, 7, 'products-header')
    } else {
      const lineGap = 8
      const top = y - (parts.length > 2 ? 12 : parts.length === 2 ? 15 : 20)
      parts.forEach((part, lineIndex) => {
        const textWidth = painter.fonts.regular.widthOfTextAtSize(part, 7)
        drawText(
          painter,
          painter.fonts.regular,
          part,
          x + Math.max(1, (width - textWidth) / 2),
          top - lineIndex * lineGap,
          7,
          'products-header',
        )
      })
    }
    const num = numbers[i] ?? ''
    const nw = painter.fonts.regular.widthOfTextAtSize(num, 6)
    drawText(
      painter,
      painter.fonts.regular,
      num,
      x + Math.max(1, (width - nw) / 2),
      y - height + 2,
      6,
      'products-header',
    )
    x += width
  }
  return y - height
}

function drawItem(
  painter: PdfPainter,
  item: DeliveryNoteDocument['note']['items'][number],
  widths: number[],
  height: number,
  y: number,
): number {
  strokeRect(painter.page, MARGIN_X, y - height, CONTENT, height)
  let x = MARGIN_X
  for (let i = 1; i < widths.length; i += 1) {
    x += widths[i - 1] ?? 0
    strokeLine(painter.page, x, y - height, x, y)
  }
  const vatAmount = ''
  const qty = formatInvoiceQuantity(item.quantity)
  const values = [
    String(item.index),
    item.name,
    item.sku,
    item.unit,
    qty,
    qty,
    formatInvoiceMoney(item.price),
    formatInvoiceMoney(item.total),
    vatAmount,
  ]
  const right = new Set([0, 4, 5, 6, 7, 8])
  x = MARGIN_X
  const top = y - 9
  for (let i = 0; i < widths.length; i += 1) {
    const width = widths[i] ?? 0
    const value = values[i] ?? ''
    if (i === 1) {
      wrapLines(painter.fonts.regular, value, 6.8, width - 4).forEach((line, lineIndex) => {
        drawText(painter, painter.fonts.regular, line, x + 2, top - lineIndex * 8, 6.8, 'products')
      })
    } else if (value) {
      const textWidth = painter.fonts.regular.widthOfTextAtSize(value, 6.8)
      const tx = right.has(i) ? x + width - 3 - textWidth : x + 2
      drawText(painter, painter.fonts.regular, value, tx, top, 6.8, 'products')
    }
    x += width
  }
  return y - height
}

function drawFooter(
  painter: PdfPainter,
  document: DeliveryNoteDocument,
  widths: number[],
  y: number,
) {
  const qty = document.note.items.reduce((sum, item) => sum + item.quantity, 0)
  const totalText = formatInvoiceMoney(document.note.total)
  const qtyStart = MARGIN_X + widths.slice(0, 4).reduce((sum, width) => sum + width, 0)
  const totalH = 12
  strokeRect(painter.page, MARGIN_X, y - totalH, CONTENT, totalH)
  let x = MARGIN_X
  for (let i = 1; i < widths.length; i += 1) {
    x += widths[i - 1] ?? 0
    if (i >= 4) {
      strokeLine(painter.page, x, y - totalH, x, y)
    }
  }
  drawText(painter, painter.fonts.bold, 'Итого', qtyStart - 24, y - 9, 7.5, 'totals')
  const qtyText = formatInvoiceQuantity(qty)
  drawText(
    painter,
    painter.fonts.bold,
    qtyText,
    qtyStart + (widths[4] ?? 0) - painter.fonts.bold.widthOfTextAtSize(qtyText, 7.5) - 3,
    y - 9,
    7.5,
    'totals',
  )
  drawText(
    painter,
    painter.fonts.bold,
    qtyText,
    qtyStart + (widths[4] ?? 0) + (widths[5] ?? 0) - painter.fonts.bold.widthOfTextAtSize(qtyText, 7.5) - 3,
    y - 9,
    7.5,
    'totals',
  )
  drawText(painter, painter.fonts.bold, 'х', qtyStart + (widths[4] ?? 0) + (widths[5] ?? 0) + 32, y - 9, 7.5, 'totals')
  drawText(
    painter,
    painter.fonts.bold,
    totalText,
    MARGIN_X +
      widths.slice(0, 8).reduce((sum, width) => sum + width, 0) -
      painter.fonts.bold.widthOfTextAtSize(totalText, 7.5) -
      3,
    y - 9,
    7.5,
    'totals',
  )
  let cursor = y - totalH - 22
  const qtyWords = document.itemCountWords || '________________________________'
  const amountWords = document.totalInWords || '____________________________________________'
  drawText(painter, painter.fonts.regular, 'Всего отпущено количество запасов (прописью)', MARGIN_X, cursor, 7.5, 'totals')
  drawText(painter, painter.fonts.bold, qtyWords, MARGIN_X + 202, cursor, 7.5, 'totals')
  strokeLine(painter.page, MARGIN_X + 200, cursor - 2, MARGIN_X + 335, cursor - 2)
  drawText(painter, painter.fonts.regular, 'на сумму (прописью), в KZT', MARGIN_X + 344, cursor, 7.5, 'totals')
  drawText(painter, painter.fonts.bold, amountWords, MARGIN_X + 474, cursor, 7.5, 'totals')
  strokeLine(painter.page, MARGIN_X + 472, cursor - 2, PAGE[0] - MARGIN_X, cursor - 2)

  const dividerX = MARGIN_X + 372
  const signatureTop = cursor - 17
  strokeLine(painter.page, dividerX, signatureTop + 5, dividerX, signatureTop - 88)
  drawText(painter, painter.fonts.regular, 'Отпуск разрешил', MARGIN_X, signatureTop, 7.5, 'signature')
  drawText(painter, painter.fonts.regular, 'Директор', MARGIN_X + 103, signatureTop, 7.5, 'signature')
  drawText(painter, painter.fonts.regular, '/', MARGIN_X + 181, signatureTop, 8, 'signature')
  drawText(painter, painter.fonts.regular, '/', MARGIN_X + 266, signatureTop, 8, 'signature')
  strokeLine(painter.page, MARGIN_X + 82, signatureTop - 2, MARGIN_X + 157, signatureTop - 2)
  strokeLine(painter.page, MARGIN_X + 194, signatureTop - 2, MARGIN_X + 257, signatureTop - 2)
  strokeLine(painter.page, MARGIN_X + 280, signatureTop - 2, dividerX - 8, signatureTop - 2)
  drawText(painter, painter.fonts.regular, 'должность', MARGIN_X + 99, signatureTop - 11, 6.5, 'signature')
  drawText(painter, painter.fonts.regular, 'подпись', MARGIN_X + 204, signatureTop - 11, 6.5, 'signature')
  drawText(painter, painter.fonts.regular, 'расшифровка подписи', MARGIN_X + 273, signatureTop - 11, 6.5, 'signature')

  const rightX = dividerX + 16
  drawText(painter, painter.fonts.regular, 'По доверенности', rightX, signatureTop, 7.5, 'signature')
  drawText(painter, painter.fonts.regular, '№ _____________ от "____" __________________ 20___ года', rightX + 82, signatureTop, 7.5, 'signature')
  drawText(painter, painter.fonts.regular, 'выданной', rightX, signatureTop - 22, 7.5, 'signature')
  strokeLine(painter.page, rightX + 52, signatureTop - 24, PAGE[0] - MARGIN_X, signatureTop - 24)
  strokeLine(painter.page, rightX, signatureTop - 42, PAGE[0] - MARGIN_X, signatureTop - 42)
  drawText(painter, painter.fonts.regular, 'Запасы получил', rightX, signatureTop - 78, 7.5, 'signature')
  strokeLine(painter.page, rightX + 82, signatureTop - 80, rightX + 166, signatureTop - 80)
  drawText(painter, painter.fonts.regular, '/', rightX + 169, signatureTop - 78, 8, 'signature')
  strokeLine(painter.page, rightX + 184, signatureTop - 80, PAGE[0] - MARGIN_X, signatureTop - 80)
  drawText(painter, painter.fonts.regular, 'подпись', rightX + 99, signatureTop - 89, 6.5, 'signature')
  drawText(painter, painter.fonts.regular, 'расшифровка подписи', rightX + 212, signatureTop - 89, 6.5, 'signature')

  const accountantY = signatureTop - 42
  drawText(painter, painter.fonts.regular, 'Главный бухгалтер', MARGIN_X, accountantY - 14, 7.5, 'signature')
  strokeLine(painter.page, MARGIN_X + 82, accountantY - 16, MARGIN_X + 157, accountantY - 16)
  drawText(painter, painter.fonts.regular, '/', MARGIN_X + 161, accountantY - 14, 8, 'signature')
  strokeLine(painter.page, MARGIN_X + 174, accountantY - 16, dividerX - 8, accountantY - 16)
  drawText(painter, painter.fonts.regular, 'подпись', MARGIN_X + 98, accountantY - 25, 6.5, 'signature')
  drawText(painter, painter.fonts.regular, 'расшифровка подписи', MARGIN_X + 210, accountantY - 25, 6.5, 'signature')
  drawText(painter, painter.fonts.bold, 'М.П.', MARGIN_X, accountantY - 46, 8, 'signature')

  const releasedY = accountantY - 70
  drawText(painter, painter.fonts.regular, 'Отпустил', MARGIN_X, releasedY, 7.5, 'signature')
  strokeLine(painter.page, MARGIN_X + 50, releasedY - 2, MARGIN_X + 148, releasedY - 2)
  drawText(painter, painter.fonts.regular, '/', MARGIN_X + 152, releasedY, 8, 'signature')
  strokeLine(painter.page, MARGIN_X + 166, releasedY - 2, dividerX - 8, releasedY - 2)
  drawText(painter, painter.fonts.regular, 'подпись', MARGIN_X + 70, releasedY - 11, 6.5, 'signature')
  drawText(painter, painter.fonts.regular, 'расшифровка подписи', MARGIN_X + 193, releasedY - 11, 6.5, 'signature')
  if (document.note.performerName) {
    drawText(painter, painter.fonts.bold, document.note.performerName, MARGIN_X + 194, releasedY, 7, 'signature')
  }
}
