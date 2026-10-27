const LEFT_ODD = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011',
]
const LEFT_EVEN = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111',
]
const RIGHT = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100',
]
const FIRST_DIGIT_PARITY = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL',
]

export function isValidEan13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) {
    return false
  }

  const sum = [...value.slice(0, 12)].reduce((total, digit, index) => {
    return total + Number(digit) * (index % 2 === 0 ? 1 : 3)
  }, 0)
  return (10 - (sum % 10)) % 10 === Number(value[12])
}

export function generateInternalEan13(): string {
  const randomDigits = Array.from({ length: 10 }, () =>
    Math.floor(Math.random() * 10),
  ).join('')
  const body = `20${randomDigits}`
  const sum = [...body].reduce((total, digit, index) => {
    return total + Number(digit) * (index % 2 === 0 ? 1 : 3)
  }, 0)
  return `${body}${(10 - (sum % 10)) % 10}`
}

export function ean13Svg(value: string): string | undefined {
  if (!isValidEan13(value)) {
    return undefined
  }

  const parity = FIRST_DIGIT_PARITY[Number(value[0])]
  let bits = '101'
  for (let index = 1; index <= 6; index += 1) {
    const digit = Number(value[index])
    bits += parity[index - 1] === 'L' ? LEFT_ODD[digit] : LEFT_EVEN[digit]
  }
  bits += '01010'
  for (let index = 7; index <= 12; index += 1) {
    bits += RIGHT[Number(value[index])]
  }
  bits += '101'

  const bars = [...bits]
    .map((bit, index) =>
      bit === '1'
        ? `<rect x="${index}" y="0" width="1" height="64"/>`
        : '',
    )
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 95 64" role="img" aria-label="EAN-13 ${value}" shape-rendering="crispEdges"><rect width="95" height="64" fill="white"/>${bars}</svg>`
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character] ?? character
  })
}

export function printEan13Label(
  value: string,
  productName: string,
  sku: string,
): boolean {
  const svg = ean13Svg(value)
  if (!svg) {
    return false
  }

  const printWindow = window.open('', '_blank', 'width=420,height=320')
  if (!printWindow) {
    return false
  }

  printWindow.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Этикетка ${value}</title><style>@page{size:58mm 35mm;margin:2mm}*{box-sizing:border-box}body{width:54mm;margin:0;padding:1mm;font:10px Arial,sans-serif;text-align:center;color:#111}.name{font-weight:700;max-height:8mm;overflow:hidden}.sku{font-size:8px;color:#444;margin-top:1mm}svg{display:block;width:50mm;height:18mm;margin:1mm auto 0} .code{font:9px Arial,sans-serif;letter-spacing:1px;margin-top:-1mm}</style></head><body><div class="name">${escapeHtml(productName)}</div><div class="sku">Артикул: ${escapeHtml(sku)}</div>${svg}<div class="code">${value}</div><script>window.addEventListener('load',()=>{window.focus();window.print()},{once:true})</script></body></html>`)
  printWindow.document.close()
  return true
}
