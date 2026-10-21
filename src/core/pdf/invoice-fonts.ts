export async function loadInvoicePdfFonts(): Promise<{
  regular: Uint8Array
  bold: Uint8Array
}> {
  const regularUrl = new URL('../../assets/fonts/InvoiceSans.ttf', import.meta.url)
  const boldUrl = new URL('../../assets/fonts/InvoiceSans-Bold.ttf', import.meta.url)
  const [regular, bold] = await Promise.all([readFontUrl(regularUrl), readFontUrl(boldUrl)])
  if (regular.byteLength < 1024 || bold.byteLength < 1024) {
    throw new Error('INVOICE_FONT_INVALID')
  }
  return { regular, bold }
}

async function readFontUrl(fileUrl: URL): Promise<Uint8Array> {
  if (fileUrl.protocol === 'file:') {
    const fs = await import('node:fs')
    const url = await import('node:url')
    return new Uint8Array(fs.readFileSync(url.fileURLToPath(fileUrl)))
  }
  const response = await fetch(fileUrl)
  if (!response.ok) {
    throw new Error(`INVOICE_FONT_MISSING ${fileUrl.href} ${response.status}`)
  }
  return new Uint8Array(await response.arrayBuffer())
}
