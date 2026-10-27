import type { Id, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { employeeAttendanceCutoffDate } from '../repositories/attendance-retention'
import { requireCurrentUser } from './access'
import { isModuleEnabledForOrganization } from './organization-modules'
import { listUsersForUser } from './users'
import { listContactsForUser } from './contacts'
import { listProductsForUser } from './products'
import { listAccessibleInventoryForUser } from './inventory'
import { listAccessibleMovementsForUser } from './stock-movements'
import { listTransfersForUser } from './transfers'
import { listSalesForUser } from './sales'
import { listPaymentsForUser } from './create-payment'
import { listExpensesForUser } from './expenses'
import { listSaleDebtRowsForUser } from './customer-debts'
import { buildFinanceDebtsSheet, mapSaleDebtsToExportRows } from './finance-excel'
import { listAuditsForUser } from './inventory-audit'
import {
  listImplantPackageMovementsForUser,
  listImplantPackagesForUser,
} from './implant-packages'
import { listPackageContractsForUser } from './package-contracts'
import { requireAttendanceReader } from './care-access'
import { requireRentalReader } from './rental-access'
import {
  buildExcelWorkbook,
  type ExcelCellValue,
  type ExcelSheet,
} from '../utils/excel-workbook'
import { getCustomerDisplayName } from '../../modules/crm/customers/customer-name'
import { userDisplayName } from '../../modules/crm/users/user-name'

export const EXCEL_DATASETS = [
  'employees',
  'customers',
  'contacts',
  'products',
  'inventory',
  'stock_movements',
  'transfers',
  'inventory_audits',
  'sales',
  'sale_items',
  'payments',
  'expenses',
  'debts',
  'attendance',
  'rental_bookings',
  'implant_packages',
  'implant_movements',
  'package_contracts',
] as const

export type ExcelDataset = (typeof EXCEL_DATASETS)[number]

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function sheet(
  name: string,
  headers: readonly string[],
  rows: readonly ExcelCellValue[][],
): ExcelSheet {
  return { name, headers, rows }
}

function moduleOn(
  persistence: Persistence,
  organizationId: Id,
  moduleKey: 'crm' | 'sales' | 'warehouse' | 'expenses' | 'attendance' | 'rental' | 'packages',
): boolean {
  return isModuleEnabledForOrganization(persistence, organizationId, moduleKey)
}

export function exportExcelDatasetForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  dataset: ExcelDataset,
): ServiceResult<{ filename: string; bytes: Uint8Array }> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }
  const built = buildDatasetSheet(persistence, actor.value, dataset)
  if (!built.ok) {
    return built
  }
  return ok({
    filename: `${dataset}-${todayDate()}.xlsx`,
    bytes: buildExcelWorkbook([built.value]),
  })
}

export function exportExcelSheetsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  filename: string,
  sheets: ExcelSheet[],
): ServiceResult<{ filename: string; bytes: Uint8Array }> {
  void persistence
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }
  if (sheets.length === 0) {
    return fail({ code: 'INVALID_INPUT' })
  }
  return ok({
    filename: filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`,
    bytes: buildExcelWorkbook(sheets),
  })
}

function buildDatasetSheet(
  persistence: Persistence,
  actor: User,
  dataset: ExcelDataset,
): ServiceResult<ExcelSheet> {
  const organizationId = actor.organizationId

  if (dataset === 'employees') {
    const users = listUsersForUser(persistence, actor)
    if (!users.ok) {
      return users
    }
    return ok(
      sheet(
        'Сотрудники',
        ['Имя', 'Фамилия', 'Email', 'Роль', 'Статус', 'Должность'],
        users.value.map((user) => [
          user.firstName,
          user.lastName,
          user.email,
          user.role,
          user.status,
          user.jobTitle ?? '',
        ]),
      ),
    )
  }

  if (dataset === 'contacts') {
    if (!moduleOn(persistence, organizationId, 'crm')) {
      return fail({ code: 'MODULE_NOT_ENABLED' })
    }
    const contacts = listContactsForUser(persistence, actor, organizationId)
    if (!contacts.ok) {
      return contacts
    }
    return ok(
      sheet(
        'Контакты',
        ['Имя', 'Фамилия', 'Телефон', 'Email', 'Статус'],
        contacts.value.map((contact) => [
          contact.firstName,
          contact.lastName,
          contact.phone ?? '',
          contact.email ?? '',
          contact.status,
        ]),
      ),
    )
  }

  if (dataset === 'customers') {
    if (!moduleOn(persistence, organizationId, 'crm')) {
      return fail({ code: 'MODULE_NOT_ENABLED' })
    }
    const customers = persistence.customers.list(organizationId)
    const contacts = persistence.contacts.list(organizationId)
    return ok(
      sheet(
        'Клиенты',
        ['Наименование', 'Тип', 'ИИН/БИН', 'Телефон', 'Email', 'Статус'],
        customers.map((customer) => {
          const contact = customer.contactId
            ? persistence.contacts.getById(customer.contactId)
            : undefined
          return [
            getCustomerDisplayName(customer, contacts, []),
            customer.type === 'company' ? 'Организация' : 'Физическое лицо',
            customer.taxId ?? '',
            contact?.phone ?? '',
            contact?.email ?? '',
            customer.status,
          ]
        }),
      ),
    )
  }

  if (dataset === 'products') {
    if (
      !moduleOn(persistence, organizationId, 'warehouse') &&
      !moduleOn(persistence, organizationId, 'sales')
    ) {
      return fail({ code: 'MODULE_NOT_ENABLED' })
    }
    const products = listProductsForUser(persistence, actor)
    if (!products.ok) {
      return products
    }
    const categories = persistence.productCategories.list(organizationId)
    return ok(
      sheet(
        'Товары',
        ['Артикул', 'Наименование', 'Категория', 'Размер', 'Ед. измерения', 'Тип', 'Цена', 'Статус'],
        products.value.map((product) => [
          product.sku,
          product.name,
          categories.find((item) => item.id === product.categoryId)?.name ?? '',
          product.size ?? '',
          product.unit,
          product.itemType,
          product.basePrice,
          product.status,
        ]),
      ),
    )
  }

  if (dataset === 'inventory') {
    if (!moduleOn(persistence, organizationId, 'warehouse')) {
      return fail({ code: 'MODULE_NOT_ENABLED' })
    }
    const inventory = listAccessibleInventoryForUser(persistence, actor)
    if (!inventory.ok) {
      return inventory
    }
    return ok(
      sheet(
        'Остатки',
        ['Склад', 'Артикул', 'Наименование', 'Количество', 'Себестоимость'],
        inventory.value.map((item) => {
          const warehouse = persistence.warehouses.getById(item.warehouseId)
          const product = persistence.products.getById(item.productId)
          return [
            warehouse?.name ?? '',
            product?.sku ?? '',
            product?.name ?? '',
            item.quantity,
            item.unitCost,
          ]
        }),
      ),
    )
  }

  if (dataset === 'stock_movements') {
    if (!moduleOn(persistence, organizationId, 'warehouse')) {
      return fail({ code: 'MODULE_NOT_ENABLED' })
    }
    const movements = listAccessibleMovementsForUser(persistence, actor)
    if (!movements.ok) {
      return movements
    }
    return ok(
      sheet(
        'Движения',
        ['Дата', 'Склад', 'Артикул', 'Наименование', 'Тип', 'Количество', 'Комментарий'],
        movements.value.map((item) => {
          const warehouse = persistence.warehouses.getById(item.warehouseId)
          const product = persistence.products.getById(item.productId)
          return [
            item.createdAt,
            warehouse?.name ?? '',
            product?.sku ?? '',
            product?.name ?? '',
            item.type,
            item.quantity,
            item.note ?? '',
          ]
        }),
      ),
    )
  }

  if (dataset === 'transfers') {
    if (!moduleOn(persistence, organizationId, 'warehouse')) {
      return fail({ code: 'MODULE_NOT_ENABLED' })
    }
    const transfers = listTransfersForUser(persistence, actor)
    if (!transfers.ok) {
      return transfers
    }
    return ok(
      sheet(
        'Перемещения',
        ['Дата', 'Откуда', 'Куда', 'Артикул', 'Количество', 'Статус'],
        transfers.value.map((item) => [
          item.createdAt,
          persistence.warehouses.getById(item.sourceWarehouseId)?.name ?? '',
          persistence.warehouses.getById(item.destinationWarehouseId)?.name ?? '',
          persistence.products.getById(item.productId)?.sku ?? '',
          item.quantity,
          item.status,
        ]),
      ),
    )
  }

  if (dataset === 'inventory_audits') {
    if (!moduleOn(persistence, organizationId, 'warehouse')) {
      return fail({ code: 'MODULE_NOT_ENABLED' })
    }
    const audits = listAuditsForUser(persistence, actor)
    if (!audits.ok) {
      return audits
    }
    return ok(
      sheet(
        'Ревизии',
        ['Дата', 'Склад', 'Статус', 'Комментарий'],
        audits.value.map((audit) => [
          audit.createdAt,
          persistence.warehouses.getById(audit.warehouseId)?.name ?? '',
          audit.status,
          audit.note ?? '',
        ]),
      ),
    )
  }

  if (dataset === 'sales' || dataset === 'sale_items') {
    if (!moduleOn(persistence, organizationId, 'sales')) {
      return fail({ code: 'MODULE_NOT_ENABLED' })
    }
    const sales = listSalesForUser(persistence, actor)
    if (!sales.ok) {
      return sales
    }
    const contacts = persistence.contacts.list(organizationId)
    if (dataset === 'sales') {
      return ok(
        sheet(
          'Продажи',
          ['Дата', 'Клиент', 'ИИН/БИН', 'Статус', 'Сумма', 'Валюта'],
          sales.value.map((sale) => {
            const customer = sale.customerId
              ? persistence.customers.getById(sale.customerId)
              : undefined
            return [
              sale.createdAt,
              customer ? getCustomerDisplayName(customer, contacts, []) : '',
              customer?.taxId ?? '',
              sale.status,
              sale.total,
              sale.currency,
            ]
          }),
        ),
      )
    }
    return ok(
      sheet(
        'Позиции продаж',
        ['Продажа', 'Артикул', 'Наименование', 'Количество', 'Цена', 'Сумма'],
        sales.value.flatMap((sale) =>
          persistence.saleItems.listBySaleId(sale.id).map((item) => {
            const product = persistence.products.getById(item.productId)
            return [
              sale.id.slice(-6).toUpperCase(),
              product?.sku ?? '',
              product?.name ?? '',
              item.quantity,
              item.unitPrice,
              item.total,
            ]
          }),
        ),
      ),
    )
  }

  if (dataset === 'payments') {
    if (!moduleOn(persistence, organizationId, 'sales')) {
      return fail({ code: 'MODULE_NOT_ENABLED' })
    }
    const payments = listPaymentsForUser(persistence, actor)
    if (!payments.ok) {
      return payments
    }
    const contacts = persistence.contacts.list(organizationId)
    return ok(
      sheet(
        'Оплаты',
        ['Дата', 'Клиент', 'ИИН/БИН', 'Сумма', 'Валюта', 'Метод', 'Статус'],
        payments.value.map((payment) => {
          const sale = payment.saleId
            ? persistence.sales.getById(payment.saleId)
            : undefined
          const customer = sale?.customerId
            ? persistence.customers.getById(sale.customerId)
            : undefined
          return [
            payment.createdAt,
            customer ? getCustomerDisplayName(customer, contacts, []) : '',
            customer?.taxId ?? '',
            payment.amount,
            payment.currency,
            payment.method,
            payment.status,
          ]
        }),
      ),
    )
  }

  if (dataset === 'expenses') {
    if (!moduleOn(persistence, organizationId, 'expenses')) {
      return fail({ code: 'MODULE_NOT_ENABLED' })
    }
    const expenses = listExpensesForUser(persistence, actor)
    if (!expenses.ok) {
      return expenses
    }
    return ok(
      sheet(
        'Расходы',
        ['Дата', 'Категория', 'Описание', 'Сумма'],
        expenses.value.map((expense) => [
          expense.date,
          expense.category,
          expense.description,
          expense.amount,
        ]),
      ),
    )
  }

  if (dataset === 'debts') {
    if (!moduleOn(persistence, organizationId, 'sales')) {
      return fail({ code: 'MODULE_NOT_ENABLED' })
    }
    const debts = listSaleDebtRowsForUser(persistence, actor)
    if (!debts.ok) {
      return debts
    }
    const contacts = persistence.contacts.list(organizationId)
    const sheetData = buildFinanceDebtsSheet(
      mapSaleDebtsToExportRows(debts.value, {
        customerName: (customerId) => {
          const customer = persistence.customers.getById(customerId)
          return customer ? getCustomerDisplayName(customer, contacts, []) : ''
        },
        customerTaxId: (customerId) =>
          persistence.customers.getById(customerId)?.taxId ?? '',
        responsible: () => '',
      }),
    )
    return ok(sheet(sheetData.name, sheetData.headers, sheetData.rows))
  }

  if (dataset === 'attendance') {
    const reader = requireAttendanceReader(persistence, actor)
    if (!reader.ok) {
      return reader
    }
    const cutoff = employeeAttendanceCutoffDate()
    return ok(
      sheet(
        'Посещаемость',
        ['Дата', 'Приход', 'Уход', 'Статус', 'Сотрудник', 'Ребёнок'],
        persistence.attendanceRecords
          .list(organizationId)
          .filter((record) => !record.employeeId || record.date >= cutoff)
          .map((record) => [
            record.date,
            record.checkInAt ? new Date(record.checkInAt).toLocaleString('ru-RU') : '',
            record.checkOutAt ? new Date(record.checkOutAt).toLocaleString('ru-RU') : '',
            record.status,
            record.employeeId
              ? (() => {
                  const user = persistence.users.getById(record.employeeId)
                  return user ? userDisplayName(user) : ''
                })()
              : '',
            record.childId ?? '',
          ]),
      ),
    )
  }

  if (dataset === 'rental_bookings') {
    const reader = requireRentalReader(persistence, actor, organizationId)
    if (!reader.ok) {
      return reader
    }
    return ok(
      sheet(
        'Прокат',
        ['Клиент', 'Начало', 'Окончание', 'Статус', 'Сумма'],
        persistence.rentalBookings.list(organizationId).map((booking) => [
          booking.customerId,
          booking.startAt,
          booking.endAt,
          booking.status,
          booking.total,
        ]),
      ),
    )
  }

  if (dataset === 'implant_packages') {
    const packages = listImplantPackagesForUser(persistence, actor)
    if (!packages.ok) {
      return packages
    }
    return ok(
      sheet(
        'Пакеты',
        [
          'Номер пакета',
          'Клиент',
          'Договор',
          'Дата',
          'Стоимость',
          'Валюта',
          'Всего имплантов',
          'Выдано',
          'Использовано',
          'Возвращено',
          'Остаток',
          'Оплачено',
          'Задолженность',
          'Ответственный',
          'Статус',
        ],
        packages.value.map((row) => [
          row.pkg.id.slice(-6).toUpperCase(),
          row.customerName,
          row.contractNumber,
          row.pkg.startDate,
          row.pkg.price,
          row.pkg.currency,
          row.balance.total,
          row.balance.issued,
          row.balance.used,
          row.balance.returned,
          row.balance.remaining,
          row.balance.paid,
          row.balance.debt,
          row.responsibleName,
          row.pkg.status,
        ]),
      ),
    )
  }

  if (dataset === 'implant_movements') {
    const movements = listImplantPackageMovementsForUser(persistence, actor)
    if (!movements.ok) {
      return movements
    }
    return ok(
      sheet(
        'История имплантов',
        ['Имплант', 'Размер', 'Операция', 'Клиент', 'Пакет', 'Дата', 'Ответственный'],
        movements.value.map((row) => [
          row.productName,
          row.size,
          row.movement.movementType,
          row.customerName,
          row.packageName,
          row.movement.date,
          row.performedByName,
        ]),
      ),
    )
  }

  if (dataset === 'package_contracts') {
    const contracts = listPackageContractsForUser(persistence, actor)
    if (!contracts.ok) {
      return contracts
    }
    return ok(
      sheet(
        'Договоры',
        ['Номер', 'Дата', 'Статус', 'Пакет', 'Клиент'],
        contracts.value.map((row) => [
          row.contract.contractNumber,
          row.contract.contractDate,
          row.contract.status,
          row.packageName,
          row.customerName,
        ]),
      ),
    )
  }

  return fail({ code: 'INVALID_INPUT' })
}
