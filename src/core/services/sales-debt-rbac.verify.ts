import { checkoutOnCreditForUser } from './checkout-on-credit'
import { createCustomerDebtPaymentForUser } from './customer-debts'
import { createSaleForUser } from './sales'
import {
  addRoleUser,
  assert,
  setupKindergartenOrg,
  setupRentalOrg,
  setupSalesOrg,
} from './sales-debt.fixture'

export function runSalesDebtRbacChecks(): void {
  const ctx = setupSalesOrg('org-dsk-debt-rbac', 'DSK')
  const accountant = addRoleUser(
    ctx.persistence,
    ctx.orgId,
    'accountant',
    ctx.warehouseId,
  )
  const deniedComplete = checkoutOnCreditForUser(
    ctx.persistence,
    accountant,
    ctx.orgId,
    ctx.saleId,
  )
  assert(
    !deniedComplete.ok && deniedComplete.error.code === 'ACCESS_DENIED',
    'accountant cannot complete on credit',
  )

  const warehouse = addRoleUser(
    ctx.persistence,
    ctx.orgId,
    'warehouse_manager',
    ctx.warehouseId,
  )
  const deniedWh = checkoutOnCreditForUser(
    ctx.persistence,
    warehouse,
    ctx.orgId,
    ctx.saleId,
  )
  assert(!deniedWh.ok, 'warehouse manager cannot sale-credit')

  const employee = addRoleUser(
    ctx.persistence,
    ctx.orgId,
    'sales_employee',
    ctx.warehouseId,
  )
  const employeeSale = createSaleForUser(ctx.persistence, employee, ctx.orgId, 'KZT', {
    warehouseId: ctx.warehouseId,
    discount: 0,
    customerId: ctx.customerId,
    items: [{ productId: ctx.productId, quantity: 1, unitPrice: 25, discount: 0 }],
  })
  assert(employeeSale.ok, 'employee sale')
  const employeeCredit = checkoutOnCreditForUser(
    ctx.persistence,
    employee,
    ctx.orgId,
    employeeSale.value.sale.id,
  )
  assert(employeeCredit.ok, 'sales employee can complete on credit')

  ctx.persistence.users.update(accountant.id, {
    permissionOverrides: [
      {
        domain: 'financial',
        permission: 'payments.create',
        effect: 'deny',
      },
    ],
  })
  const payDenied = createCustomerDebtPaymentForUser(
    ctx.persistence,
    accountant,
    {
      customerId: ctx.customerId,
      saleId: employeeSale.value.sale.id,
      amount: 10,
      method: 'cash',
    },
  )
  assert(
    !payDenied.ok && payDenied.error.code === 'ACCESS_DENIED',
    'pay requires payments.create',
  )

  const rental = setupRentalOrg()
  const rentalDenied = checkoutOnCreditForUser(
    rental.persistence,
    rental.owner,
    rental.owner.organizationId,
    'missing',
  )
  assert(
    !rentalDenied.ok && rentalDenied.error.code === 'MODULE_NOT_ENABLED',
    'rental sales off',
  )

  const kg = setupKindergartenOrg()
  const kgDenied = checkoutOnCreditForUser(
    kg.persistence,
    kg.owner,
    kg.owner.organizationId,
    'missing',
  )
  assert(
    !kgDenied.ok && kgDenied.error.code === 'MODULE_NOT_ENABLED',
    'kindergarten sales off',
  )
  console.log('sales-debt-rbac.verify: ok')
}

runSalesDebtRbacChecks()
