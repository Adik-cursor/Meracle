import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkoutOnCreditForUser } from './checkout-on-credit'
import { checkoutSaleForUser } from './checkout-sale'
import { createPaymentForUser } from './create-payment'
import { addRoleUser } from './sales-debt.fixture'
import { createSaleForUser } from './sales'
import { setStock } from './inventory'
import { getSaleSettlement } from './sale-settlement'
import {
  addManySaleItems,
  assert,
  isPdfBytes,
  readPdfMeta,
  setupInvoiceOrg,
} from './sale-invoice-pdf.verify-support'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { addOrg, addUser, seedSale } from './sales-invoice.verify'
import {
  buildSupplyContractDocumentForUser,
  createSupplyContractForUser,
  generateSupplyContractPdfForUser,
  getSupplyContractForUser,
} from './supply-contracts'
import { renderSupplyContractPdfWithLayout } from '../pdf/supply-contract-pdf'
import { newId, nowIso } from './primitives'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

export async function runSupplyContractDebtOnlyChecks(): Promise<void> {
  const page = readFileSync(join(root, 'src/app/routes/pages/SaleDetailPage.tsx'), 'utf8')
  assert(page.includes('createSupplyContractForUser'), 'create service in UI')
  assert(page.includes('setContractFormOpen(true)'), 'explicit form action')
  assert(!page.includes('useEffect(() => {\n    createSupplyContractForUser'), 'no auto create')

  const paidCtx = setupInvoiceOrg('org-sc-paid', 'ТОО Оплата', '000000000003')
  const paidSale = paidCtx.persistence.sales.getById(paidCtx.saleId)
  assert(paidSale, 'paid sale')
  const checkout = checkoutSaleForUser(
    paidCtx.persistence,
    paidCtx.owner,
    paidCtx.orgId,
    paidCtx.saleId,
    { amount: paidSale.total, method: 'cash' },
  )
  assert(checkout.ok, 'full payment')
  const paidDenied = createSupplyContractForUser(paidCtx.persistence, paidCtx.owner, {
    saleId: paidCtx.saleId,
  })
  assert(
    !paidDenied.ok && paidDenied.error.code === 'SUPPLY_CONTRACT_NOT_AVAILABLE',
    'fully paid sale has no contract',
  )

  const debtCtx = setupInvoiceOrg('org-sc-debt', 'ТОО Долг', '000000000003')
  const credited = checkoutOnCreditForUser(
    debtCtx.persistence,
    debtCtx.owner,
    debtCtx.orgId,
    debtCtx.saleId,
  )
  assert(credited.ok, 'on credit')
  const saleBefore = debtCtx.persistence.sales.getById(debtCtx.saleId)
  assert(saleBefore, 'debt sale')
  const paymentsBefore = debtCtx.persistence.payments.list(debtCtx.orgId).map((item) => ({
    id: item.id,
    amount: item.amount,
    status: item.status,
  }))
  const settlementBefore = getSaleSettlement(debtCtx.persistence, saleBefore)
  const employee = addRoleUser(
    debtCtx.persistence,
    debtCtx.orgId,
    'sales_employee',
    debtCtx.warehouseId,
  )
  const created = createSupplyContractForUser(debtCtx.persistence, employee, {
    saleId: debtCtx.saleId,
    number: '054',
    contractDate: '2026-09-21',
    advanceAmount: 0,
    fxRate: '450$',
    fxRateDate: '2026-09-21',
    correctionCoefficient: '1.00',
    schedule: [
      { dueDate: '2026-10-21', plannedAmount: 50 },
      { dueDate: '2026-11-21', plannedAmount: 50 },
    ],
  })
  assert(created.ok, 'debt sale contract available')
  assert(created.value.customerId === saleBefore.customerId, 'customer bound to sale')
  assert(created.value.organizationId === debtCtx.orgId, 'org from actor')
  const again = createSupplyContractForUser(debtCtx.persistence, employee, {
    saleId: debtCtx.saleId,
    number: '999',
  })
  assert(again.ok && again.value.id === created.value.id, 'no second contract')
  const saleAfter = debtCtx.persistence.sales.getById(debtCtx.saleId)
  assert(saleAfter?.total === saleBefore.total, 'Sale.total unchanged')
  const paymentsAfter = debtCtx.persistence.payments.list(debtCtx.orgId)
  assert(paymentsAfter.length === paymentsBefore.length, 'payment count unchanged')
  assert(
    paymentsAfter.every(
      (payment, index) =>
        payment.id === paymentsBefore[index]?.id &&
        payment.amount === paymentsBefore[index]?.amount,
    ),
    'Payment unchanged',
  )
  const settlementAfter = getSaleSettlement(debtCtx.persistence, saleAfter ?? saleBefore)
  assert(settlementAfter.remainingAmount === settlementBefore.remainingAmount, 'Debt unchanged')
  assert(settlementAfter.netPaid === settlementBefore.netPaid, 'fx does not change debt')

  const accountant = addRoleUser(
    debtCtx.persistence,
    debtCtx.orgId,
    'accountant',
    debtCtx.warehouseId,
  )
  const accountantDenied = createSupplyContractForUser(debtCtx.persistence, accountant, {
    saleId: debtCtx.saleId,
  })
  assert(
    !accountantDenied.ok && accountantDenied.error.code === 'FORBIDDEN',
    'sales.documents.create required',
  )

  const installment = setupInvoiceOrg('org-sc-inst', 'ТОО Рассрочка', '000000000003')
  const instSale = installment.persistence.sales.getById(installment.saleId)
  assert(instSale, 'installment sale')
  const instCredit = checkoutOnCreditForUser(
    installment.persistence,
    installment.owner,
    installment.orgId,
    installment.saleId,
  )
  assert(instCredit.ok, 'installment credit')
  const partial = createPaymentForUser(installment.persistence, installment.owner, {
    organizationId: installment.orgId,
    createdBy: installment.owner.id,
    saleId: installment.saleId,
    amount: 40,
    method: 'cash',
  })
  assert(partial.ok, 'down payment')
  const instContract = createSupplyContractForUser(installment.persistence, installment.owner, {
    saleId: installment.saleId,
    advanceAmount: 40,
    schedule: [{ dueDate: '2026-10-21', plannedAmount: 60 }],
  })
  assert(instContract.ok, 'installment contract available')

  const document = buildSupplyContractDocumentForUser(
    debtCtx.persistence,
    employee,
    created.value.id,
  )
  assert(document.ok, 'document')
  assert(document.value.items.length >= 1, 'sale items in spec')
  assert(document.value.total === saleBefore.total, 'spec total from sale')
  const pdf = await generateSupplyContractPdfForUser(
    debtCtx.persistence,
    employee,
    created.value.id,
  )
  assert(pdf.ok && isPdfBytes(pdf.value.bytes), 'pdf bytes')
  const layout = await renderSupplyContractPdfWithLayout(document.value)
  assert(layout.width === 595.28 && layout.height === 841.89, 'A4 portrait')
  const texts = layout.boxes.map((box) => box.text).join(' ')
  assert(/[А-Яа-яЁё]/.test(texts), 'cyrillic in pdf text')
  assert(texts.includes(document.value.sellerName), 'seller in pdf')
  assert(texts.includes(document.value.buyerName), 'buyer in pdf')
  assert(texts.includes('054'), 'number in pdf')
  assert(texts.includes('21') || texts.includes('2026'), 'date in pdf')
  assert(texts.includes(String(saleBefore.total).split('.')[0]) || texts.includes('100'), 'amount')
  assert(texts.includes('УСЛОВИЯ ОПЛАТЫ'), 'payment terms')
  assert(texts.includes('21.10.2026') || texts.includes('Дата оплаты'), 'schedule')
  assert(texts.includes('Техническая спецификация'), 'specification')
  assert(texts.includes('РЕКВИЗИТЫ') || texts.includes('ПРОДАВЕЦ'), 'requisites')
  assert(texts.includes('___________') || texts.includes('Директор'), 'signatures')
  assert(!texts.includes('Yersin Group'), 'no hardcoded seller')
  const opened = getSupplyContractForUser(debtCtx.persistence, employee, created.value.id)
  assert(opened.ok, 'existing opens')

  const giftCtx = setupInvoiceOrg('org-sc-gift', 'ТОО Подарок', '000000000003')
  const giftSale = giftCtx.persistence.sales.getById(giftCtx.saleId)
  assert(giftSale?.customerId, 'gift customer')
  const extraId = newId()
  const now = nowIso()
  giftCtx.persistence.products.create({
    id: extraId,
    organizationId: giftCtx.orgId,
    name: 'Хирургический набор',
    sku: 'GIFT',
    unit: 'шт',
    itemType: 'product',
    basePrice: 800000,
    costPrice: 1,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  setStock(giftCtx.persistence, giftCtx.orgId, giftCtx.warehouseId, extraId, 5)
  const mixed = createSaleForUser(giftCtx.persistence, giftCtx.owner, giftCtx.orgId, 'KZT', {
    warehouseId: giftCtx.warehouseId,
    discount: 0,
    customerId: giftSale.customerId,
    items: [
      { productId: giftCtx.productId, quantity: 1, unitPrice: 100, discount: 0 },
      { productId: extraId, quantity: 1, unitPrice: 800000, discount: 800000 },
    ],
  })
  assert(mixed.ok, 'mixed sale')
  const mixedCredit = checkoutOnCreditForUser(
    giftCtx.persistence,
    giftCtx.owner,
    giftCtx.orgId,
    mixed.value.sale.id,
  )
  assert(mixedCredit.ok, 'mixed credit')
  const giftContract = createSupplyContractForUser(giftCtx.persistence, giftCtx.owner, {
    saleId: mixed.value.sale.id,
  })
  assert(giftContract.ok, 'gift sale contract')
  const giftDoc = buildSupplyContractDocumentForUser(
    giftCtx.persistence,
    giftCtx.owner,
    giftContract.value.id,
  )
  assert(giftDoc.ok && giftDoc.value.items.some((item) => item.gift), 'gift row in spec')

  const multi = setupInvoiceOrg('org-sc-multi', 'ТОО Многостр', '000000000003')
  const multiSaleEntity = multi.persistence.sales.getById(multi.saleId)
  assert(multiSaleEntity?.customerId, 'multi customer')
  const large = addManySaleItems(
    multi.persistence,
    multi.orgId,
    multi.owner,
    multi.warehouseId,
    multiSaleEntity.customerId,
    40,
  )
  const largeCredit = checkoutOnCreditForUser(
    multi.persistence,
    multi.owner,
    multi.orgId,
    large.id,
  )
  assert(largeCredit.ok, 'large credit')
  const largeContract = createSupplyContractForUser(multi.persistence, multi.owner, {
    saleId: large.id,
  })
  assert(largeContract.ok, 'large contract')
  const largePdf = await generateSupplyContractPdfForUser(
    multi.persistence,
    multi.owner,
    largeContract.value.id,
  )
  assert(largePdf.ok, 'large pdf')
  const meta = await readPdfMeta(largePdf.value.bytes)
  assert(meta.pageCount >= 2, 'multipage')
  assert(!meta.landscape, 'portrait pages')

  const persistence = createInMemoryPersistence()
  addOrg(persistence, 'org-sc-a', 'A')
  addOrg(persistence, 'org-sc-b', 'B')
  persistence.organizations.update('org-sc-a', {
    legalName: 'ТОО A',
    taxId: '000000000003',
    bankName: 'Bank',
    iban: 'KZ1',
    bik: 'BIK',
  })
  persistence.organizations.update('org-sc-b', {
    legalName: 'ТОО B',
    taxId: '000000000005',
    bankName: 'Bank',
    iban: 'KZ2',
    bik: 'BIK',
  })
  seedEnabledBusinessModules(persistence, 'org-sc-a', 'seed', ['sales', 'warehouse', 'crm'])
  seedEnabledBusinessModules(persistence, 'org-sc-b', 'seed', ['sales', 'warehouse', 'crm'])
  const ownerA = addUser(persistence, 'org-sc-a', 'owner')
  const ownerB = addUser(persistence, 'org-sc-b', 'owner')
  const saleA = seedSale(persistence, 'org-sc-a', ownerA)
  const actorA = persistence.users.getById(ownerA.id)
  const actorB = persistence.users.getById(ownerB.id)
  const creditA = checkoutOnCreditForUser(persistence, actorA, 'org-sc-a', saleA.saleId)
  assert(creditA.ok, 'org A credit')
  const iso = createSupplyContractForUser(persistence, actorA, { saleId: saleA.saleId })
  assert(iso.ok, 'org A contract')
  const stolen = createSupplyContractForUser(persistence, actorB, { saleId: saleA.saleId })
  assert(!stolen.ok, 'org B cannot create for A')
  const stolenGet = getSupplyContractForUser(persistence, actorB, iso.value.id)
  assert(!stolenGet.ok, 'org B cannot get A contract')

  console.log('supply-contract-debt-only.verify: ok')
}

void runSupplyContractDebtOnlyChecks()
