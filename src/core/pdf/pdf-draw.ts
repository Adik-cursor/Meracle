import { rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import * as fontkitModule from '@pdf-lib/fontkit'
import type { PDFDocument } from 'pdf-lib'

export const BLACK = rgb(0, 0, 0)

export type PdfTextBox = {
  page: number
  block: string
  text: string
  x: number
  y: number
  width: number
  height: number
}

export type PdfPainter = {
  page: PDFPage
  fonts: { regular: PDFFont; bold: PDFFont }
  boxes: PdfTextBox[]
  pageIndex: number
}

export function registerFontkit(pdf: PDFDocument) {
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

export function wrapLines(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
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

export function drawText(
  painter: PdfPainter,
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

export function strokeRect(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  thickness = 0.5,
) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderWidth: thickness,
    borderColor: BLACK,
  })
}

export function strokeLine(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness = 0.5,
) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness,
    color: BLACK,
  })
}
