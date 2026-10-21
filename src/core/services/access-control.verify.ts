import type { Branch, Deal, Department, Id, Organization, User, UserRole, Warehouse } from '../types'
import type { DomainErrorCode } from '../types/domain-error'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { getCurrentUser, login } from './auth'
import {
  createDealForUser,
  deleteDealForUser,
  getDealForUser,
  listDealsForUser,
  searchDealsForUser,
  updateDealForUser,
} from './deals'
import {
  createUserForUser,
  canAssignRole,
  filterUsersForUser,
  getUserForUser,
  listUsersForUser,
  removeUserPermissionOverrideForUser,
  setUserPermissionOverrideForUser,
  updateUserForUser,
} from './users'
import { newId, nowIso } from './primitives'
import { canAccessWarehouse } from './warehouse-access'
import { hasEffectiveFinancialPermission } from './access'
import { getFinancialPermissions } from '../types/financial-permission'
import { listSalesForManagedEmployeeForUser } from './sales'
import { seedEnabledBusinessModules } from './organization-modules'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function denied(
  result: { ok: boolean; error?: { code: DomainErrorCode } },
  code: DomainErrorCode,
  message: string,
): void {
  assert(!result.ok && result.error?.code === code, message)
}

const emptyLookup = {
  getContact: () => undefined,
  getCompany: () => undefined,
}

function addOrganization(
  persistence: Persistence,
  id: Id,
  name: string,
): Organization {
  const now = nowIso()
  const organization: Organization = {
    id,
    organizationId: id,
    name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.organizations.create(organization)
  return organization
}

function addBranch(
  persistence: Persistence,
  organizationId: Id,
  name: string,
): Branch {
  const now = nowIso()
  const branch: Branch = {
    id: newId(),
    organizationId,
    name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.branches.create(branch)
  return branch
}

function addDepartment(
  persistence: Persistence,
  organizationId: Id,
  branchId: Id,
  name: string,
): Department {
  const now = nowIso()
  const department: Department = {
    id: newId(),
    organizationId,
    branchId,
    name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.departments.create(department)
  return department
}

function addWarehouse(
  persistence: Persistence,
  organizationId: Id,
  branchId: Id,
  name: string,
): Warehouse {
  const now = nowIso()
  const warehouse: Warehouse = {
    id: newId(),
    organizationId,
    branchId,
    name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.warehouses.create(warehouse)
  return warehouse
}

function addUser(
  persistence: Persistence,
  organizationId: Id,
  role: UserRole,
  extras: {
    branchId?: Id
    departmentId?: Id
    warehouseId?: Id
  } = {},
): User {
  const now = nowIso()
  const user: User = {
    id: newId(),
    organizationId,
    email: `${role}-${newId()}@${organizationId}.local`,
    firstName: role,
    lastName: organizationId,
    role,
    status: 'active',
    ...extras,
    createdAt: now,
    updatedAt: now,
  }
  persistence.users.create(user)
  return user
}

function addDeal(
  persistence: Persistence,
  actor: User,
  title: string,
  assignedUserId?: Id,
): Deal {
  const created = createDealForUser(
    persistence,
    actor,
    actor.organizationId,
    {
      title,
      amount: 1000,
      currency: 'KZT',
      companyId: null,
      contactId: null,
      status: 'new',
      assignedUserId,
    },
    emptyLookup,
  )
  assert(created.ok, `create deal ${title}`)
  return created.value
}

export function runAccessControlChecks(): void {
  const persistence = createInMemoryPersistence()
  const orgA = 'org-a'
  const orgB = 'org-b'
  addOrganization(persistence, orgA, 'Organization A')
  addOrganization(persistence, orgB, 'Organization B')
  seedEnabledBusinessModules(persistence, orgA, 'seed')
  seedEnabledBusinessModules(persistence, orgB, 'seed')
  const branchA = addBranch(persistence, orgA, 'Branch A')
  const branchB = addBranch(persistence, orgA, 'Branch B')
  const deptA = addDepartment(persistence, orgA, branchA.id, 'Sales A')
  const deptB = addDepartment(persistence, orgA, branchA.id, 'Sales B')
  const warehouseA = addWarehouse(persistence, orgA, branchA.id, 'WH A')
  const warehouseB = addWarehouse(persistence, orgA, branchB.id, 'WH B')

  const owner = addUser(persistence, orgA, 'owner')
  const directorA = addUser(persistence, orgA, 'branch_director', {
    branchId: branchA.id,
  })
  const directorB = addUser(persistence, orgA, 'branch_director', {
    branchId: branchB.id,
  })
  const managerA = addUser(persistence, orgA, 'sales_manager', {
    branchId: branchA.id,
    departmentId: deptA.id,
  })
  const employeeA = addUser(persistence, orgA, 'sales_employee', {
    branchId: branchA.id,
    departmentId: deptA.id,
    warehouseId: warehouseA.id,
  })
  const employeeB = addUser(persistence, orgA, 'sales_employee', {
    branchId: branchA.id,
    departmentId: deptB.id,
    warehouseId: warehouseA.id,
  })
  const deptBranchB = addDepartment(persistence, orgA, branchB.id, 'Sales B2')
  const employeeOtherBranch = addUser(persistence, orgA, 'sales_employee', {
    branchId: branchB.id,
    departmentId: deptBranchB.id,
    warehouseId: warehouseB.id,
  })
  const warehouseManagerA = addUser(persistence, orgA, 'warehouse_manager', {
    branchId: branchA.id,
    warehouseId: warehouseA.id,
  })
  const foreignOwner = addUser(persistence, orgB, 'owner')

  const dealA = addDeal(persistence, employeeA, 'Deal A', employeeA.id)
  const dealB = addDeal(persistence, employeeB, 'Deal B', employeeB.id)
  const dealBranchB = addDeal(persistence, directorB, 'Deal Branch B', directorB.id)

  const listedA = listDealsForUser(persistence, employeeA)
  assert(listedA.ok && listedA.value.some((deal) => deal.id === dealA.id), '1 employee A sees deal A')
  assert(listedA.ok && !listedA.value.some((deal) => deal.id === dealB.id), '2 employee A does not see deal B')

  const getB = getDealForUser(persistence, employeeA, dealB.id)
  denied(getB, 'ACCESS_DENIED', '9 direct ID access denied')

  const searchB = searchDealsForUser(persistence, employeeA, dealB.id, emptyLookup)
  assert(searchB.ok && searchB.value.length === 0, '10 search does not leak deal B')

  denied(
    updateDealForUser(
      persistence,
      employeeA,
      orgA,
      dealB.id,
      {
        title: 'Hacked',
        amount: 1,
        currency: 'KZT',
        companyId: null,
        contactId: null,
        status: 'won',
        assignedUserId: employeeA.id,
      },
      emptyLookup,
    ),
    'ACCESS_DENIED',
    '11 update foreign deal denied',
  )

  denied(
    deleteDealForUser(persistence, employeeA, orgA, dealB.id),
    'ACCESS_DENIED',
    '12 delete foreign deal denied',
  )

  const managerListed = listDealsForUser(persistence, managerA)
  assert(
    managerListed.ok && managerListed.value.some((deal) => deal.id === dealA.id),
    '3 manager A sees department A',
  )
  assert(
    managerListed.ok && !managerListed.value.some((deal) => deal.id === dealB.id),
    '4 manager A does not see department B',
  )

  const directorListed = listDealsForUser(persistence, directorA)
  assert(
    directorListed.ok &&
      directorListed.value.some((deal) => deal.id === dealA.id) &&
      directorListed.value.some((deal) => deal.id === dealB.id),
    '5 director A sees branch A',
  )
  assert(
    directorListed.ok &&
      !directorListed.value.some((deal) => deal.id === dealBranchB.id),
    '6 director A does not see branch B',
  )

  const ownerListed = listDealsForUser(persistence, owner)
  assert(
    ownerListed.ok &&
      ownerListed.value.some((deal) => deal.id === dealA.id) &&
      ownerListed.value.some((deal) => deal.id === dealB.id) &&
      ownerListed.value.some((deal) => deal.id === dealBranchB.id),
    '7 owner sees A+B',
  )

  denied(
    getDealForUser(persistence, foreignOwner, dealA.id),
    'ACCESS_DENIED',
    '8 cross-org denied',
  )

  assert(login(persistence, employeeA.id).ok, '13 login before disable')
  persistence.users.update(employeeA.id, {
    status: 'disabled',
    updatedAt: nowIso(),
  })
  denied(
    getCurrentUser(persistence, orgA),
    'USER_INACTIVE',
    '13 disabled user session invalid',
  )
  denied(login(persistence, employeeA.id), 'USER_INACTIVE', '13 disabled user login denied')

  const usersForDirector = listUsersForUser(persistence, directorA)
  assert(
    usersForDirector.ok &&
      !usersForDirector.value.some((user) => user.id === directorB.id),
    'director A does not list director B',
  )
  assert(
    usersForDirector.ok &&
      usersForDirector.value.some((user) => user.id === employeeA.id) &&
      usersForDirector.value.some((user) => user.id === employeeB.id),
    'director A lists branch A employees',
  )

  denied(
    updateUserForUser(persistence, employeeB, orgA, employeeB.id, {
      firstName: employeeB.firstName,
      lastName: employeeB.lastName,
      email: employeeB.email,
      role: 'owner',
      status: 'active',
      branchId: employeeB.branchId,
      departmentId: employeeB.departmentId,
      warehouseId: employeeB.warehouseId,
    }),
    'ACCESS_DENIED',
    'self role escalation denied',
  )

  denied(
    createUserForUser(persistence, employeeA, orgA, {
      firstName: 'X',
      lastName: 'Y',
      email: 'demo-user-056@example.com',
      role: 'sales_employee',
      status: 'active',
      branchId: branchA.id,
      departmentId: deptA.id,
      warehouseId: warehouseA.id,
    }),
    'ACCESS_DENIED',
    'sales_employee cannot manage users',
  )

  const employeeDraft = {
    firstName: employeeA.firstName,
    lastName: employeeA.lastName,
    email: employeeA.email,
    role: employeeA.role,
    status: 'active' as const,
    branchId: employeeA.branchId,
    departmentId: employeeA.departmentId,
    warehouseId: employeeA.warehouseId,
  }

  denied(
    updateUserForUser(persistence, directorA, orgA, employeeA.id, {
      ...employeeDraft,
      role: 'commercial_director',
    }),
    'ACCESS_DENIED',
    'director A cannot assign commercial_director',
  )
  denied(
    updateUserForUser(persistence, directorA, orgA, employeeA.id, {
      ...employeeDraft,
      role: 'owner',
    }),
    'ACCESS_DENIED',
    'director A cannot assign owner',
  )
  denied(
    updateUserForUser(persistence, directorA, orgA, employeeA.id, {
      ...employeeDraft,
      branchId: branchB.id,
      warehouseId: warehouseB.id,
    }),
    'ACCESS_DENIED',
    'director A cannot assign Branch B',
  )
  denied(
    updateUserForUser(persistence, directorA, orgA, employeeA.id, {
      ...employeeDraft,
      warehouseId: warehouseB.id,
    }),
    'ACCESS_DENIED',
    'director A cannot assign Warehouse B',
  )
  denied(
    setUserPermissionOverrideForUser(
      persistence,
      managerA,
      orgA,
      employeeA.id,
      'financial',
      'returns.create',
      'allow',
    ),
    'ACCESS_DENIED',
    'manager cannot grant permission',
  )
  denied(
    setUserPermissionOverrideForUser(
      persistence,
      employeeA,
      orgA,
      employeeA.id,
      'financial',
      'returns.create',
      'allow',
    ),
    'ACCESS_DENIED',
    'employee cannot grant permission to self',
  )
  denied(
    updateUserForUser(persistence, employeeA, orgA, employeeA.id, {
      ...employeeDraft,
      role: 'sales_manager',
    }),
    'ACCESS_DENIED',
    'employee cannot change own role',
  )
  denied(
    updateUserForUser(persistence, employeeA, orgA, employeeA.id, {
      ...employeeDraft,
      branchId: branchB.id,
    }),
    'ACCESS_DENIED',
    'employee cannot change own branch',
  )
  denied(
    updateUserForUser(persistence, employeeA, orgA, employeeA.id, {
      ...employeeDraft,
      warehouseId: warehouseB.id,
    }),
    'ACCESS_DENIED',
    'employee cannot change own warehouse',
  )
  assert(
    getUserForUser(persistence, employeeA, employeeA.id).ok,
    'employee can open own card',
  )
  assert(
    getUserForUser(persistence, managerA, employeeA.id).ok,
    'manager can open employee in department',
  )
  denied(
    getUserForUser(persistence, managerA, employeeB.id),
    'ACCESS_DENIED',
    'manager cannot open employee of other department',
  )
  denied(
    getUserForUser(persistence, directorA, employeeOtherBranch.id),
    'ACCESS_DENIED',
    'director A cannot open employee of Branch B',
  )
  assert(
    getUserForUser(persistence, directorA, employeeA.id).ok,
    'director A can open employee A',
  )

  const createdByOwner = createUserForUser(persistence, owner, orgA, {
    firstName: 'New',
    lastName: 'Seller',
    email: 'demo-user-032@example.com',
    role: 'sales_employee',
    status: 'active',
    branchId: branchA.id,
    departmentId: deptA.id,
    warehouseId: warehouseA.id,
  })
  assert(createdByOwner.ok, 'owner creates employee with role')
  const baseSales = getFinancialPermissions('sales_employee')
  assert(baseSales.includes('sales.read'), 'employee gets role base sales.read')
  assert(!baseSales.includes('returns.create'), 'sales_employee base has no returns.create')
  assert(
    (createdByOwner.value.permissionOverrides ?? []).length === 0,
    'new employee has no overrides',
  )

  assert(!canAssignRole(managerA, 'owner'), 'manager cannot assign owner')
  denied(
    updateUserForUser(persistence, managerA, orgA, employeeA.id, {
      ...employeeDraft,
      role: 'owner',
    }),
    'ACCESS_DENIED',
    'manager cannot assign owner via update',
  )

  assert(
    setUserPermissionOverrideForUser(
      persistence,
      directorA,
      orgA,
      employeeA.id,
      'financial',
      'returns.create',
      'allow',
    ).ok,
    'director grant returns.create',
  )
  const granted = persistence.users.getById(employeeA.id)
  assert(granted && hasEffectiveFinancialPermission(granted, 'returns.create'), 'effective allow')

  assert(
    setUserPermissionOverrideForUser(
      persistence,
      directorA,
      orgA,
      employeeA.id,
      'financial',
      'returns.create',
      'deny',
    ).ok,
    'director deny returns.create',
  )
  const deniedOverride = persistence.users.getById(employeeA.id)
  assert(
    deniedOverride && !hasEffectiveFinancialPermission(deniedOverride, 'returns.create'),
    'effective deny',
  )

  assert(
    removeUserPermissionOverrideForUser(
      persistence,
      directorA,
      orgA,
      employeeA.id,
      'financial',
      'returns.create',
    ).ok,
    'remove override returns to role base',
  )

  assert(
    setUserPermissionOverrideForUser(
      persistence,
      directorA,
      orgA,
      employeeA.id,
      'financial',
      'returns.create',
      'allow',
    ).ok,
    'grant before role change',
  )
  const roleChanged = updateUserForUser(persistence, directorA, orgA, employeeA.id, {
    ...employeeDraft,
    role: 'office_employee',
    warehouseId: undefined,
    departmentId: undefined,
  })
  assert(roleChanged.ok, 'director can assign office_employee')
  assert(
    (roleChanged.value.permissionOverrides ?? []).length === 0,
    'role change resets overrides',
  )

  const restored = updateUserForUser(persistence, directorA, orgA, employeeA.id, employeeDraft)
  assert(restored.ok, 'restore sales_employee')

  const deptFiltered = filterUsersForUser(persistence, directorA, {
    departmentId: deptB.id,
  })
  assert(
    deptFiltered.ok && deptFiltered.value.every((user) => user.departmentId === deptB.id),
    'filterUsersForUser uses scoped list',
  )

  assert(
    listSalesForManagedEmployeeForUser(persistence, employeeA, employeeA.id).ok,
    'employee can list own cashier sales through managed-employee filter',
  )
  denied(
    listSalesForManagedEmployeeForUser(persistence, employeeA, employeeB.id),
    'ACCESS_DENIED',
    'employee cannot list another employee sales',
  )

  denied(
    getUserForUser(persistence, directorA, foreignOwner.id),
    'ACCESS_DENIED',
    'cross-organization user access denied',
  )

  assert(
    canAccessWarehouse(warehouseManagerA, warehouseA).ok,
    'warehouse manager sees warehouse A',
  )
  denied(
    canAccessWarehouse(warehouseManagerA, warehouseB),
    'ACCESS_DENIED',
    'warehouse manager does not see warehouse B',
  )
  denied(
    getDealForUser(persistence, warehouseManagerA, dealA.id),
    'ACCESS_DENIED',
    'warehouse manager has no deal access',
  )
}

runAccessControlChecks()
