export type ExcelCellValue = string | number | null | undefined

export type ExcelSheet = {
  name: string
  headers: readonly string[]
  rows: readonly ExcelCellValue[][]
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let crc = i
    for (let j = 0; j < 8; j += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
    table[i] = crc >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function u16(value: number): Uint8Array {
  const out = new Uint8Array(2)
  const view = new DataView(out.buffer)
  view.setUint16(0, value, true)
  return out
}

function u32(value: number): Uint8Array {
  const out = new Uint8Array(4)
  const view = new DataView(out.buffer)
  view.setUint32(0, value, true)
  return out
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function columnLetter(index: number): string {
  let n = index
  let letters = ''
  while (n >= 0) {
    letters = String.fromCharCode((n % 26) + 65) + letters
    n = Math.floor(n / 26) - 1
  }
  return letters
}

function cellXml(column: number, row: number, value: ExcelCellValue): string {
  const ref = `${columnLetter(column)}${row}`
  if (value === null || value === undefined || value === '') {
    return `<c r="${ref}"/>`
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}" t="n"><v>${value}</v></c>`
  }
  return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(String(value))}</t></is></c>`
}

function sheetXml(sheet: ExcelSheet): string {
  const rows = [sheet.headers, ...sheet.rows]
  const rowXml = rows
    .map((cells, rowIndex) => {
      const r = rowIndex + 1
      const inner = cells.map((cell, col) => cellXml(col, r, cell)).join('')
      return `<row r="${r}">${inner}</row>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>${rowXml}</sheetData>
</worksheet>`
}

function localFile(
  name: string,
  data: Uint8Array,
  localOffset: number,
): {
  local: Uint8Array
  central: Uint8Array
  size: number
} {
  const nameBytes = utf8(name)
  const crc = crc32(data)
  const header = concatBytes([
    u32(0x04034b50),
    u16(20),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(crc),
    u32(data.length),
    u32(data.length),
    u16(nameBytes.length),
    u16(0),
    nameBytes,
    data,
  ])
  return {
    local: header,
    central: concatBytes([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(localOffset),
      nameBytes,
    ]),
    size: header.length,
  }
}

export function buildExcelWorkbook(sheets: readonly ExcelSheet[]): Uint8Array {
  const safeSheets = sheets.length > 0 ? sheets : [{ name: 'Sheet1', headers: [], rows: [] }]
  const files: { name: string; body: string }[] = [
    {
      name: '[Content_Types].xml',
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${safeSheets
  .map(
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  )
  .join('')}
</Types>`,
    },
    {
      name: '_rels/.rels',
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
${safeSheets
  .map(
    (sheet, i) =>
      `<sheet name="${escapeXml(sheet.name.slice(0, 31) || `Sheet${i + 1}`)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
  )
  .join('')}
</sheets>
</workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${safeSheets
  .map(
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  )
  .join('')}
</Relationships>`,
    },
    ...safeSheets.map((sheet, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      body: sheetXml(sheet),
    })),
  ]

  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const file of files) {
    const packed = localFile(file.name, utf8(file.body), offset)
    locals.push(packed.local)
    centrals.push(packed.central)
    offset += packed.size
  }

  const centralDir = concatBytes(centrals)
  const eocd = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ])
  return concatBytes([...locals, centralDir, eocd])
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes)
}

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0
}

type ZipEntry = {
  name: string
  method: number
  data: Uint8Array
}

function findEocdOffset(bytes: Uint8Array): number {
  const start = Math.max(0, bytes.length - 22 - 65535)
  for (let offset = bytes.length - 22; offset >= start; offset -= 1) {
    if (readU32(bytes, offset) === 0x06054b50) {
      return offset
    }
  }
  return -1
}

function listZipEntries(bytes: Uint8Array): ZipEntry[] {
  const eocd = findEocdOffset(bytes)
  if (eocd >= 0) {
    const total = readU16(bytes, eocd + 10)
    let offset = readU32(bytes, eocd + 16)
    const entries: ZipEntry[] = []
    for (let index = 0; index < total && offset + 46 <= bytes.length; index += 1) {
      if (readU32(bytes, offset) !== 0x02014b50) {
        break
      }
      const method = readU16(bytes, offset + 10)
      const compressed = readU32(bytes, offset + 20)
      const nameLen = readU16(bytes, offset + 28)
      const extraLen = readU16(bytes, offset + 30)
      const commentLen = readU16(bytes, offset + 32)
      const localOffset = readU32(bytes, offset + 42)
      const name = decodeUtf8(bytes.slice(offset + 46, offset + 46 + nameLen))
      if (localOffset + 30 <= bytes.length && readU32(bytes, localOffset) === 0x04034b50) {
        const localNameLen = readU16(bytes, localOffset + 26)
        const localExtraLen = readU16(bytes, localOffset + 28)
        const dataStart = localOffset + 30 + localNameLen + localExtraLen
        entries.push({
          name,
          method,
          data: bytes.slice(dataStart, dataStart + compressed),
        })
      }
      offset += 46 + nameLen + extraLen + commentLen
    }
    if (entries.length > 0) {
      return entries
    }
  }

  const entries: ZipEntry[] = []
  let offset = 0
  while (offset + 4 <= bytes.length && readU32(bytes, offset) === 0x04034b50) {
    const method = readU16(bytes, offset + 8)
    const compressed = readU32(bytes, offset + 18)
    const nameLen = readU16(bytes, offset + 26)
    const extraLen = readU16(bytes, offset + 28)
    const name = decodeUtf8(bytes.slice(offset + 30, offset + 30 + nameLen))
    const dataStart = offset + 30 + nameLen + extraLen
    entries.push({
      name,
      method,
      data: bytes.slice(dataStart, dataStart + compressed),
    })
    offset = dataStart + compressed
  }
  return entries
}

function unzipStored(bytes: Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>()
  for (const entry of listZipEntries(bytes)) {
    if (entry.method === 0) {
      files.set(entry.name, entry.data)
    }
  }
  return files
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') {
    return null
  }
  try {
    const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(
      new DecompressionStream('deflate-raw'),
    )
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    try {
      const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(
        new DecompressionStream('deflate'),
      )
      return new Uint8Array(await new Response(stream).arrayBuffer())
    } catch {
      return null
    }
  }
}

async function unzipWorkbookFiles(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>()
  for (const entry of listZipEntries(bytes)) {
    if (entry.method === 0) {
      files.set(entry.name, entry.data)
      continue
    }
    if (entry.method === 8) {
      const inflated = await inflateRaw(entry.data)
      if (inflated) {
        files.set(entry.name, inflated)
      }
    }
  }
  return files
}

function parseSharedStrings(xml: string): string[] {
  const values: string[] = []
  const matches = xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)
  for (const match of matches) {
    const parts = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
    values.push(parts.map((part) => decodeXml(part[1])).join(''))
  }
  return values
}

function parseSheetRows(xml: string, sharedStrings: readonly string[] = []): string[][] {
  const rows: string[][] = []
  const rowMatches = xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)
  for (const rowMatch of rowMatches) {
    const cells: string[] = []
    const cellMatches = rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g)
    for (const cell of cellMatches) {
      const attrs = cell[1] ?? cell[3] ?? ''
      const inner = cell[2] ?? ''
      const type = attrs.match(/\bt="([^"]+)"/)?.[1]
      const inline = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/)
      const number = inner.match(/<v>([\s\S]*?)<\/v>/)
      let value = inline ? decodeXml(inline[1]) : number ? decodeXml(number[1]) : ''
      if (type === 's' && number) {
        const index = Number(decodeXml(number[1]))
        value = sharedStrings[index] ?? ''
      }
      const ref = attrs.match(/r="([A-Z]+)\d+"/)
      const col = ref ? columnIndex(ref[1]) : cells.length
      while (cells.length < col) {
        cells.push('')
      }
      cells[col] = value
    }
    rows.push(cells)
  }
  return rows
}

function decodeXml(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
}

function columnIndex(letters: string): number {
  let n = 0
  for (const ch of letters) {
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n - 1
}

function sheetsFromZipFiles(files: Map<string, Uint8Array>): ExcelSheet[] {
  const shared = files.get('xl/sharedStrings.xml')
  const sharedStrings = shared ? parseSharedStrings(decodeUtf8(shared)) : []
  const sheets: ExcelSheet[] = []
  let index = 1
  while (true) {
    const xml = files.get(`xl/worksheets/sheet${index}.xml`)
    if (!xml) {
      break
    }
    const rows = parseSheetRows(decodeUtf8(xml), sharedStrings)
    const headers = rows[0] ?? []
    sheets.push({
      name: `Sheet${index}`,
      headers,
      rows: rows.slice(1),
    })
    index += 1
  }
  return sheets
}

export function parseExcelWorkbook(bytes: Uint8Array): ExcelSheet[] {
  return sheetsFromZipFiles(unzipStored(bytes))
}

export async function parseExcelWorkbookAsync(bytes: Uint8Array): Promise<ExcelSheet[]> {
  const files = await unzipWorkbookFiles(bytes)
  const sheets = sheetsFromZipFiles(files)
  if (sheets.length > 0) {
    return sheets
  }
  return parseExcelWorkbook(bytes)
}

export function parseCsv(text: string): ExcelSheet {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.length > 0)
  const rows = lines.map((line) => splitCsvLine(line))
  return {
    name: 'Sheet1',
    headers: rows[0] ?? [],
    rows: rows.slice(1),
  }
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else if (ch === '"') {
        quoted = false
      } else {
        current += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',' || ch === ';') {
      cells.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells
}

export function workbookToObjectUrl(bytes: Uint8Array): Blob {
  return new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export function downloadExcelFile(filename: string, bytes: Uint8Array): void {
  const blob = workbookToObjectUrl(bytes)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
