import { PDFDocument, type PDFFont, type PDFPage } from 'pdf-lib'
import type { SupplyContractDocument } from '../services/supply-contracts'
import { loadInvoicePdfFonts } from './invoice-fonts'
import { formatInvoiceDateFile, formatInvoiceDateLong, formatInvoiceMoney, formatInvoiceQuantity } from './invoice-format'
import { amountInWordsInvoiceRu } from '../utils/amount-in-words'
import {
  drawText,
  registerFontkit,
  strokeRect,
  wrapLines,
  type PdfPainter,
  type PdfTextBox,
} from './pdf-draw'

const A4: [number, number] = [595.28, 841.89]
const MARGIN_X = 48
const MARGIN_TOP = 42
const MARGIN_BOTTOM = 40
const CONTENT = A4[0] - MARGIN_X * 2
const BODY = 9.2
const HEAD = 11
const TITLE = 13
const LINE = 12.2

export type SupplyContractPdfLayout = {
  bytes: Uint8Array
  boxes: PdfTextBox[]
  pageCount: number
  width: number
  height: number
}

type Flow = {
  pdf: PDFDocument
  fonts: { regular: PDFFont; bold: PDFFont }
  boxes: PdfTextBox[]
  page: PDFPage
  painter: PdfPainter
  y: number
}

function createFlow(
  pdf: PDFDocument,
  fonts: { regular: PDFFont; bold: PDFFont },
  boxes: PdfTextBox[],
): Flow {
  const page = pdf.addPage(A4)
  const painter: PdfPainter = { page, fonts, boxes, pageIndex: pdf.getPageCount() - 1 }
  return { pdf, fonts, boxes, page, painter, y: A4[1] - MARGIN_TOP }
}

function ensure(flow: Flow, height: number) {
  if (flow.y - height >= MARGIN_BOTTOM) {
    return
  }
  flow.page = flow.pdf.addPage(A4)
  flow.painter = {
    page: flow.page,
    fonts: flow.fonts,
    boxes: flow.boxes,
    pageIndex: flow.pdf.getPageCount() - 1,
  }
  flow.y = A4[1] - MARGIN_TOP
}

function drawCentered(flow: Flow, text: string, size: number, font: PDFFont, block: string) {
  const width = font.widthOfTextAtSize(text, size)
  drawText(flow.painter, font, text, MARGIN_X + (CONTENT - width) / 2, flow.y, size, block)
  flow.y -= size + 4
}

function drawParagraph(flow: Flow, text: string, block: string, bold = false) {
  const font = bold ? flow.fonts.bold : flow.fonts.regular
  const lines = wrapLines(font, text, BODY, CONTENT)
  for (const line of lines) {
    ensure(flow, LINE)
    drawText(flow.painter, font, line, MARGIN_X, flow.y, BODY, block)
    flow.y -= LINE
  }
  flow.y -= 2
}

function drawHeading(flow: Flow, text: string, block: string) {
  ensure(flow, HEAD + 8)
  flow.y -= 4
  drawText(flow.painter, flow.fonts.bold, text, MARGIN_X, flow.y, HEAD, block)
  flow.y -= HEAD + 4
}

function money(value: number): string {
  return `${formatInvoiceMoney(value)} тенге`
}

function drawSignatures(flow: Flow, seller: string, buyer: string, block: string) {
  ensure(flow, 42)
  flow.y -= 10
  drawText(flow.painter, flow.fonts.regular, `___________ ${seller || '—'}`, MARGIN_X, flow.y, BODY, block)
  drawText(
    flow.painter,
    flow.fonts.regular,
    `____________________ ${buyer || '—'}`,
    MARGIN_X + CONTENT / 2,
    flow.y,
    BODY,
    block,
  )
  flow.y -= 18
}

function drawTableRow(
  flow: Flow,
  cols: { text: string; width: number; align?: 'right' }[],
  block: string,
  header = false,
) {
  const font = header ? flow.fonts.bold : flow.fonts.regular
  const wrapped = cols.map((col) => wrapLines(font, col.text, 8, col.width - 6))
  const lines = Math.max(1, ...wrapped.map((item) => item.length))
  const height = lines * 10 + 6
  ensure(flow, height)
  const top = flow.y
  let x = MARGIN_X
  for (const col of cols) {
    strokeRect(flow.page, x, top - height, col.width, height)
    x += col.width
  }
  let cursor = MARGIN_X
  for (let index = 0; index < cols.length; index += 1) {
    const col = cols[index]
    const rowLines = wrapped[index] ?? ['']
    rowLines.forEach((line, lineIndex) => {
      const lineWidth = font.widthOfTextAtSize(line, 8)
      const textX =
        col.align === 'right' ? cursor + col.width - 4 - lineWidth : cursor + 3
      drawText(flow.painter, font, line, textX, top - 11 - lineIndex * 10, 8, block)
    })
    cursor += col.width
  }
  flow.y -= height
}

export async function renderSupplyContractPdfWithLayout(
  document: SupplyContractDocument,
): Promise<SupplyContractPdfLayout> {
  const pdf = await PDFDocument.create()
  registerFontkit(pdf)
  const loaded = await loadInvoicePdfFonts()
  const fonts = {
    regular: await pdf.embedFont(loaded.regular, { subset: false }),
    bold: await pdf.embedFont(loaded.bold, { subset: false }),
  }
  const boxes: PdfTextBox[] = []
  const flow = createFlow(pdf, fonts, boxes)
  const totalWords = amountInWordsInvoiceRu(document.total, document.currency)
  const advanceWords = amountInWordsInvoiceRu(document.advanceAmount, document.currency)
  const restWords = amountInWordsInvoiceRu(document.remainingAmount, document.currency)
  const contractDateLong = formatInvoiceDateLong(document.contract.contractDate)
  const dayMatch = /^(\d{2})/.exec(formatInvoiceDateFile(document.contract.contractDate))
  const dateParts = contractDateLong.replace(' г.', '').split(' ')
  const quotedDate = `«${dayMatch?.[1] ?? dateParts[0] ?? ''}» ${dateParts.slice(1).join(' ')} г.`

  drawCentered(flow, `ДОГОВОР ПОСТАВКИ №${document.contract.number}`, TITLE, fonts.bold, 'title')
  drawCentered(
    flow,
    `${document.city ? `г. ${document.city}` : ''} ${quotedDate}`.trim(),
    BODY,
    fonts.regular,
    'header',
  )
  flow.y -= 6

  const sellerFace = document.sellerSignatory
    ? ` в лице ${document.sellerSignatory} действующего на основании Устава`
    : ' действующее на основании Устава'
  const buyerTax = document.buyerTaxId
    ? `, ${document.buyerTaxLabel} ${document.buyerTaxId}`
    : ''
  const buyerFace = document.buyerSignatory
    ? `, в лице ${document.buyerSignatory}`
    : ''
  drawParagraph(
    flow,
    `${document.sellerName}${sellerFace} с одной стороны, и ${document.buyerName}${buyerTax}, именуемый в дальнейшем Покупатель${buyerFace}, с другой стороны, заключили настоящий договор о нижеследующем:`,
    'preamble',
  )

  drawHeading(flow, '1. ПРЕДМЕТ ДОГОВОРА.', 'h1')
  const deliveryAddress =
    document.contract.deliveryAddress?.trim() || document.buyerAddress || '—'
  if (document.profile === 'equipment') {
    drawParagraph(
      flow,
      `1.1. Продавец обязуется осуществить доставку и монтаж товара/оборудования по адресу ${deliveryAddress}.`,
      'c1',
    )
  } else {
    drawParagraph(
      flow,
      `1.1. Продавец обязуется осуществить доставку товара по адресу ${deliveryAddress}.`,
      'c1',
    )
  }
  drawParagraph(
    flow,
    '1.2. Покупатель обязуется оплатить согласно счета на оплату выставленного Продавцом.',
    'c1',
  )
  drawParagraph(
    flow,
    '1.3. Наименование, цена, количество и общая стоимость указываются в Спецификации (Приложение №1), являющейся неотъемлемой частью настоящего договора.',
    'c1',
  )

  drawHeading(flow, '2. ЦЕНА И ОБЩАЯ СУММА ДОГОВОРА.', 'h2')
  drawParagraph(
    flow,
    `2.1. Общая сумма договора ${money(document.total)} (${totalWords}).`,
    'c2',
  )
  drawParagraph(
    flow,
    '2.2. Цена товара, поставленного по настоящему договору, представляет собой цену, действительную на день подписания Спецификации к настоящему договору. Стороны признают, что в результате колебания конъюнктуры цен и возможного изменения покупательской способности тенге, реальная стоимость на момент оплаты может отличаться от цены в счете на оплату. В связи с чем, Стороны соглашаются с тем, что окончательная цена поставленного товара определяется на момент оплаты путем умножения не оплаченной суммы по настоящему договору на Поправочный коэффициент. Поправочный коэффициент представляет собой соотношение официального курса иностранных валют к тенге, установленного Национальным Банком Республики Казахстан для целей учета и таможенных платежей на дату оплаты, к окончательному показателю на дату договора.',
    'c2',
  )
  if (document.contract.fxRate || document.contract.correctionCoefficient || document.contract.fxRateDate) {
    drawParagraph(
      flow,
      [
        document.contract.correctionCoefficient
          ? `Поправочный коэффициент: ${document.contract.correctionCoefficient}.`
          : '',
        document.contract.fxRate ? `Курс: ${document.contract.fxRate}.` : '',
        document.contract.fxRateDate
          ? `Дата курса: ${formatInvoiceDateFile(document.contract.fxRateDate)}.`
          : '',
      ]
        .filter(Boolean)
        .join(' '),
      'c2-fx',
    )
  }

  drawHeading(flow, '3. УСЛОВИЯ ОПЛАТЫ.', 'h3')
  drawParagraph(
    flow,
    `3.1. Авансовую сумму в размере ${money(document.advanceAmount)} (${advanceWords}) покупатель оплачивает в день подписания договора, остаток суммы в размере ${money(document.remainingAmount)} (${restWords}) Покупатель оплачивает согласно следующего графика${document.contract.fxRate ? ` (по курсу: ${document.contract.fxRate})` : ''}:`,
    'c3',
  )
  if (document.schedule.length > 0) {
    const widths = [CONTENT * 0.25, CONTENT * 0.25, CONTENT * 0.25, CONTENT * 0.25]
    drawTableRow(
      flow,
      [
        { text: 'Дата оплаты по графику', width: widths[0] },
        { text: 'Сумма оплаты по графику', width: widths[1], align: 'right' },
        { text: 'Фактическая дата оплаты', width: widths[2] },
        { text: 'Фактическая сумма оплаты', width: widths[3], align: 'right' },
      ],
      'schedule-head',
      true,
    )
    for (const row of document.schedule) {
      drawTableRow(
        flow,
        [
          { text: formatInvoiceDateFile(row.dueDate), width: widths[0] },
          { text: formatInvoiceMoney(row.plannedAmount), width: widths[1], align: 'right' },
          {
            text: row.paidDate ? formatInvoiceDateFile(row.paidDate) : '—',
            width: widths[2],
          },
          {
            text: row.paidAmount == null ? '—' : formatInvoiceMoney(row.paidAmount),
            width: widths[3],
            align: 'right',
          },
        ],
        'schedule',
      )
    }
    const plannedTotal = document.schedule.reduce((sum, row) => sum + row.plannedAmount, 0)
    drawTableRow(
      flow,
      [
        { text: 'Итого к оплате', width: widths[0] },
        { text: formatInvoiceMoney(plannedTotal), width: widths[1], align: 'right' },
        { text: '', width: widths[2] },
        { text: '', width: widths[3] },
      ],
      'schedule-total',
      true,
    )
  }
  drawParagraph(
    flow,
    '3.2. Форма оплаты - платежное поручение установленного образца и наличный расчет.',
    'c3',
  )
  drawParagraph(
    flow,
    '3.3. Днем оплаты товара по настоящему договору признается день поступления денежных средств в кассу либо на расчетный счет Продавца.',
    'c3',
  )
  drawParagraph(
    flow,
    '3.4. Товар переходит в собственность Покупателя после погашения всей суммы по настоящему договору, указанной в п.2.1.',
    'c3',
  )
  drawParagraph(
    flow,
    '3.5 При несвоевременной оплате суммы договор расторгается и оплачивается с оценкой времени применения и состояния товара, товар возвращается продавцу.',
    'c3',
  )
  drawParagraph(
    flow,
    '3.6. Запрещается продажа и дарение следующего лица до полной оплаты суммы приобретаемого товара.',
    'c3',
  )
  if (document.contract.paymentTermsNote) {
    drawParagraph(flow, document.contract.paymentTermsNote, 'c3-note')
  }

  if (document.profile === 'equipment') {
    drawHeading(flow, '4. УСЛОВИЯ ПОСТАВКИ И МОНТАЖА.', 'h4')
  } else {
    drawHeading(flow, '4. УСЛОВИЯ ПОСТАВКИ.', 'h4')
  }
  const deliveryClauses = [
    '4.1. Покупатель подает запрос на поставку, в котором указывает наименование, количество и технические характеристики запрашиваемого товара.',
    '4.2. Стороны должны согласовать запрос в соответствии с отгрузочными возможностями Продавца и наличием товара на складе в течение трех рабочих дней с момента его подачи.',
    '4.3. Товар поставляется в тарных ящиках, упаковка должна быть прочной и обеспечивать сохранность его во время транспортировки.',
    '4.4. Поставка Продавцом производится в течение 45 рабочих дней с момента поступления денежных средств на расчетный счет Продавца.',
  ]
  const equipmentClauses = [
    '4.5. Монтаж производится по согласию с покупателем. Монтаж производится на платной основе.',
    '4.6. Покупатель обязуется согласовать с Продавцом и выполнить своими силами подводку коммуникаций (вода, электричество, воздух и канализация) в местах монтажа.',
    '4.7. Монтажные работы согласуются с покупателем, если цена и условия устраивают все стороны, монтаж будет выполнен в течение 15 рабочих дней.',
    '4.8. Покупатель обязуется своевременно подготовить и предоставить помещение для монтажа за один день до начала работ.',
    '4.9. Продавец производит монтаж, а именно: сборка частей; подключение к имеющимся коммуникациям; наладка и испытание.',
    '4.10. Рекомендации по подготовке к монтажным работам: наличие заземления в сети электропитания; наличие запорной арматуры на трубопроводах вода/воздух; наличие стабилизатора напряжения; выход стока канализации должен отвечать требованиям, оговоренным заранее с Продавцом.',
    '4.11. Подключение и дальнейшее обслуживание к коммуникациям производится в пределах поставляемых производителем комплектующих частей. Все работы по пуско-наладке, не оговоренные условиями данного договора, производятся за счет Покупателя.',
    '4.12. После монтажа Покупатель закрывает кабелегоном все кабели и электропровода, подводимые к смонтированному оборудованию.',
    '4.13. Продавец после монтажа проводит обучение персонала, консультацию с демонстрацией работоспособности.',
  ]
  for (const clause of deliveryClauses) {
    drawParagraph(flow, clause, 'c4')
  }
  if (document.profile === 'equipment') {
    for (const clause of equipmentClauses) {
      drawParagraph(flow, clause, 'c4')
    }
    drawHeading(flow, '5. ПОРЯДОК СДАЧИ-ПРИЕМКИ.', 'h5')
    drawParagraph(
      flow,
      '5.1. Прием проведенного монтажа производится представителем Покупателя в присутствии представителя Продавца, о чем подписывается «Акт выполненных работ монтажа оборудования».',
      'c5',
    )
  }

  drawHeading(flow, '6. ГАРАНТИЙНЫЕ ОБЯЗАТЕЛЬСТВА.', 'h6')
  if (document.profile === 'equipment') {
    drawParagraph(
      flow,
      '6.1. Продавец гарантирует качество товара и проведенного монтажа в течение 12 месяцев с момента подписания договора.',
      'c6',
    )
    drawParagraph(
      flow,
      '6.2. Гарантия не распространяется на механические повреждения, монтажные соединения и другие нарушения правил эксплуатации, произошедшие по вине персонала Покупателя.',
      'c6',
    )
    drawParagraph(
      flow,
      '6.3. Гарантия не распространяется на магистраль воды и канализационную систему, подводимую к оборудованию, а также на случаи засора от плевательницы до канализационной системы.',
      'c6',
    )
    drawParagraph(
      flow,
      '6.4. Претензии к количеству и качеству предъявляются в письменном виде в течение 10-ти рабочих дней с момента подписания «Акта выполненных работ монтажа оборудования».',
      'c6',
    )
  } else {
    drawParagraph(
      flow,
      '6.1. Продавец гарантирует качество товара в течение 12 месяцев с момента подписания договора.',
      'c6',
    )
  }
  drawParagraph(
    flow,
    `6.5. Товар снимается с гарантийного обслуживания досрочно в случае вмешательства третьих лиц, не имеющих отношения к ${document.sellerName}.`,
    'c6',
  )

  drawHeading(flow, '7. ФОРС-МАЖОР.', 'h7')
  drawParagraph(
    flow,
    '7.1. В случае наступления форс-мажорных обстоятельств (войны, забастовки, стихийные бедствия, решения государственных органов), делающих невозможным выполнение сторонами своих обязательств, исполнение договора откладывается на срок действия этих обстоятельств.',
    'c7',
  )
  drawParagraph(
    flow,
    '7.2. О наступлении форс-мажорных обстоятельств стороны обязаны незамедлительно информировать друг друга с последующим письменным подтверждением. При сроке действия форс-мажорных обстоятельств свыше сорока пяти дней договорные обязательства прекращаются по обоюдному согласию сторон.',
    'c7',
  )

  drawHeading(flow, '8. ОТВЕТСТВЕННОСТЬ СТОРОН.', 'h8')
  drawParagraph(
    flow,
    '8.1. В случае задержки поставки Продавец обязан незамедлительно уведомить (письменно или по телефону) об этом Покупателя.',
    'c8',
  )
  drawParagraph(
    flow,
    '8.2. В случае недопоставки (недокомплектации) Продавец гарантирует допоставить товар в течение 15 дней с момента письменного уведомления.',
    'c8',
  )
  drawParagraph(
    flow,
    '8.3. Все споры и разногласия, возникшие в ходе исполнения настоящего договора, будут урегулироваться путем переговоров. В случае невозможности их урегулирования путем переговоров, их разрешение подлежит рассмотрению в соответствии с действующим Законодательством Республики Казахстан.',
    'c8',
  )

  drawHeading(flow, '9. СРОК ДЕЙСТВИЯ ДОГОВОРА.', 'h9')
  drawParagraph(
    flow,
    '9.1. Настоящий договор вступает в силу с момента его подписания и действует до момента исполнения сторонами взятых на себя обязательств, но не позднее года.',
    'c9',
  )

  drawHeading(flow, '10. ПРОЧИЕ УСЛОВИЯ.', 'h10')
  drawParagraph(
    flow,
    '10.1. Все приложения, дополнения к настоящему договору, оформленные в письменной форме и подписанные уполномоченными представителями сторон, а также документы, переданные факсимильной или иными видами связи, имеют юридическую силу и принимаются сторонами для исполнения своих обязательств по настоящему договору.',
    'c10',
  )
  drawParagraph(
    flow,
    '10.2. Вся переписка (письма, сообщения, платежи и уведомления) по исполнению Сторонами своих обязательств производится по указанным в настоящем договоре юридическим адресам и банковским реквизитам. В случае изменения любых реквизитов, Сторона, у которой произошли соответствующие изменения, обязана незамедлительно сообщить об этом другой Стороне.',
    'c10',
  )
  drawParagraph(
    flow,
    '10.3. После подписания настоящего договора все предыдущие переговоры и переписка, связанная с ним, теряют силу.',
    'c10',
  )
  drawParagraph(
    flow,
    '10.4. Продавец может переуступить свои права требования третьему лицу(ам) через 60 дней после просроченной даты оплаты.',
    'c10',
  )
  drawParagraph(
    flow,
    '10.5. Настоящий договор составлен в двух экземплярах на русском языке, по одному экземпляру для каждой из сторон и имеют одинаковую юридическую силу.',
    'c10',
  )

  drawHeading(flow, '11. ЮРИДИЧЕСКИЕ АДРЕСА И РЕКВИЗИТЫ СТОРОН.', 'h11')
  ensure(flow, 120)
  const colW = CONTENT / 2 - 6
  drawText(flow.painter, flow.fonts.bold, 'ПРОДАВЕЦ:', MARGIN_X, flow.y, BODY, 'requisites')
  drawText(flow.painter, flow.fonts.bold, 'ПОКУПАТЕЛЬ:', MARGIN_X + CONTENT / 2, flow.y, BODY, 'requisites')
  flow.y -= LINE
  const sellerLines = [
    document.sellerName,
    document.sellerTaxId ? `${document.sellerTaxLabel} ${document.sellerTaxId}` : '',
    document.sellerAddress,
    document.sellerIban ? `ИИК ${document.sellerIban}` : '',
    document.sellerBankName,
    document.sellerBik ? `БИК ${document.sellerBik}` : '',
  ].filter(Boolean)
  const buyerLines = [
    document.buyerName,
    document.buyerTaxId ? `${document.buyerTaxLabel} ${document.buyerTaxId}` : '',
    document.buyerAddress,
    document.buyerIban ? `ИИК ${document.buyerIban}` : '',
    document.buyerBankName,
    document.buyerBik ? `БИК ${document.buyerBik}` : '',
  ].filter(Boolean)
  const maxLines = Math.max(sellerLines.length, buyerLines.length)
  for (let index = 0; index < maxLines; index += 1) {
    ensure(flow, LINE)
    const sellerLine = sellerLines[index]
    const buyerLine = buyerLines[index]
    if (sellerLine) {
      const wrapped = wrapLines(flow.fonts.regular, sellerLine, BODY, colW)
      drawText(flow.painter, flow.fonts.regular, wrapped[0] ?? '', MARGIN_X, flow.y, BODY, 'requisites')
    }
    if (buyerLine) {
      const wrapped = wrapLines(flow.fonts.regular, buyerLine, BODY, colW)
      drawText(
        flow.painter,
        flow.fonts.regular,
        wrapped[0] ?? '',
        MARGIN_X + CONTENT / 2,
        flow.y,
        BODY,
        'requisites',
      )
    }
    flow.y -= LINE
  }
  flow.y -= 8
  drawText(flow.painter, flow.fonts.regular, 'Директор', MARGIN_X, flow.y, BODY, 'sign')
  drawText(flow.painter, flow.fonts.regular, 'Директор', MARGIN_X + CONTENT / 2, flow.y, BODY, 'sign')
  flow.y -= 16
  drawSignatures(flow, document.sellerSignatory, document.buyerSignatory, 'sign')

  flow.page = flow.pdf.addPage(A4)
  flow.painter = {
    page: flow.page,
    fonts: flow.fonts,
    boxes: flow.boxes,
    pageIndex: flow.pdf.getPageCount() - 1,
  }
  flow.y = A4[1] - MARGIN_TOP
  drawCentered(flow, 'Приложение №1', TITLE, fonts.bold, 'appendix')
  drawCentered(
    flow,
    `к договору №${document.contract.number} от ${formatInvoiceDateFile(document.contract.contractDate)} г.`,
    BODY,
    fonts.regular,
    'appendix',
  )
  drawCentered(flow, 'Техническая спецификация', HEAD, fonts.bold, 'appendix')
  flow.y -= 6
  const specCols = [
    { key: 'n', width: 28 },
    { key: 'name', width: 210 },
    { key: 'unit', width: 46 },
    { key: 'qty', width: 50 },
    { key: 'price', width: 80 },
    { key: 'total', width: CONTENT - 28 - 210 - 46 - 50 - 80 },
  ] as const
  const headerCells = [
    { text: '№', width: specCols[0].width },
    { text: 'Наименование', width: specCols[1].width },
    { text: 'Ед. изм.', width: specCols[2].width },
    { text: 'Кол-во', width: specCols[3].width, align: 'right' as const },
    { text: 'Цена за ед.', width: specCols[4].width, align: 'right' as const },
    { text: 'Общая сумма', width: specCols[5].width, align: 'right' as const },
  ]
  drawTableRow(flow, headerCells, 'spec-head', true)
  for (const item of document.items) {
    if (flow.y < MARGIN_BOTTOM + 80) {
      flow.page = flow.pdf.addPage(A4)
      flow.painter = {
        page: flow.page,
        fonts: flow.fonts,
        boxes: flow.boxes,
        pageIndex: flow.pdf.getPageCount() - 1,
      }
      flow.y = A4[1] - MARGIN_TOP
      drawCentered(flow, 'Техническая спецификация (продолжение)', HEAD, fonts.bold, 'appendix')
      drawTableRow(flow, headerCells, 'spec-head', true)
    }
    drawTableRow(
      flow,
      [
        { text: String(item.index), width: specCols[0].width },
        { text: item.name, width: specCols[1].width },
        { text: item.unit, width: specCols[2].width },
        { text: formatInvoiceQuantity(item.quantity), width: specCols[3].width, align: 'right' },
        { text: formatInvoiceMoney(item.price), width: specCols[4].width, align: 'right' },
        {
          text: item.gift ? 'В подарок' : formatInvoiceMoney(item.total),
          width: specCols[5].width,
          align: 'right',
        },
      ],
      'spec',
    )
  }
  drawTableRow(
    flow,
    [
      { text: 'Итого', width: specCols[0].width + specCols[1].width + specCols[2].width + specCols[3].width + specCols[4].width },
      { text: formatInvoiceMoney(document.total), width: specCols[5].width, align: 'right' },
    ],
    'spec-total',
    true,
  )
  flow.y -= 8
  drawParagraph(flow, `Итого: ${totalWords}.`, 'appendix-total')
  drawParagraph(flow, `Продавец ______________ ${document.sellerSignatory || '—'}`, 'appendix-sign')
  drawParagraph(flow, `Покупатель _____________ ${document.buyerSignatory || '—'}`, 'appendix-sign')

  const bytes = await pdf.save()
  return {
    bytes,
    boxes,
    pageCount: pdf.getPageCount(),
    width: A4[0],
    height: A4[1],
  }
}

export async function renderSupplyContractPdfBytes(
  document: SupplyContractDocument,
): Promise<Uint8Array> {
  const layout = await renderSupplyContractPdfWithLayout(document)
  return layout.bytes
}
