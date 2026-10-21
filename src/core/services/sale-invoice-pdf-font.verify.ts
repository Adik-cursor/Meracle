import { PDFDocument } from 'pdf-lib'
import * as fontkitModule from '@pdf-lib/fontkit'
import { loadInvoicePdfFonts } from '../pdf/invoice-fonts'
import { assert } from './sale-invoice-pdf.verify-support'

export async function runSaleInvoicePdfFontChecks(): Promise<void> {
  const fonts = await loadInvoicePdfFonts()
  assert(fonts.regular.byteLength > 1024, 'regular font bytes')
  assert(fonts.bold.byteLength > 1024, 'bold font bytes')
  const pdf = await PDFDocument.create()
  let kit: unknown = fontkitModule
  while (
    kit &&
    typeof kit === 'object' &&
    'default' in kit &&
    (kit as { default: unknown }).default &&
    (kit as { default: unknown }).default !== kit
  ) {
    kit = (kit as { default: unknown }).default
  }
  pdf.registerFontkit(kit as Parameters<PDFDocument['registerFontkit']>[0])
  const regular = await pdf.embedFont(fonts.regular, { subset: false })
  const bold = await pdf.embedFont(fonts.bold, { subset: false })
  assert(regular.widthOfTextAtSize('Счёт на оплату', 12) > 0, 'regular cyrillic')
  assert(bold.widthOfTextAtSize('Пакет тур Шанхай', 12) > 0, 'bold cyrillic')
  console.log('sale-invoice-pdf-font.verify: ok')
}

void runSaleInvoicePdfFontChecks()
