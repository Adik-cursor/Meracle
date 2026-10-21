import type { Branch, Department, Id, User, UserRole } from '../types'
import type { DomainErrorCode } from '../types/domain-error'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { PLATFORM_ORGANIZATION_ID } from '../config/platform'
import { newId, nowIso } from './primitives'
import { createFirstOwner, createUserForUser } from './users'
import { getAccessScope } from '../types'
import {
  canAssignCompanyRoleForPlatformUser,
  createUserForPlatformUser,
  getCompanyPeopleForPlatformUser,
  getCompanyUserForPlatformUser,
} from './platform-users'

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

function addOrg(persistence: Persistence, id: Id, name: string): void {
  const now = nowIso()
  persistence.organizations.create({
    id,
    organizationId: id,
    name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
}

function addUser(
  persistence: Persistence,
  organizationId: Id,
  role: UserRole,
  extras: Partial<User> = {},
): User {
  const now = nowIso()
  const user: User = {
    id: newId(),
    organizationId,
    email: `${role}-${newId()}@${organizationId}.local`,
    firstName: role,
    lastName: 'User',
    role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...extras,
  }
  persistence.users.create(user)
  return user
}

function addBranch(
  persistence: Persistence,
  organizationId: Id,
  name: string,
): Branch {
  const now = nowIso()
  return persistence.branches.create({
    id: newId(),
    organizationId,
    name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
}

function addDepartment(
  persistence: Persistence,
  organizationId: Id,
  branchId: Id,
  name: string,
): Department {
  const now = nowIso()
  return persistence.departments.create({
    id: newId(),
    organizationId,
    branchId,
    name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
}

export function runPlatformUsersChecks(): void {
  const persistence = createInMemoryPersistence()
  const orgA = 'org-people-a'
  const orgB = 'org-people-b'
  const orgEmpty = 'org-people-empty'
  addOrg(persistence, orgA, 'Company A')
  addOrg(persistence, orgB, 'Company B')
  addOrg(persistence, orgEmpty, 'Empty Co')
  addOrg(persistence, PLATFORM_ORGANIZATION_ID, 'Platform')

  const platformOwner = addUser(
    persistence,
    PLATFORM_ORGANIZATION_ID,
    'office_employee',
    { platformRole: 'platform_owner' },
  )
  const companyOwnerA = addUser(persistence, orgA, 'owner')
  const employeeA = addUser(persistence, orgA, 'sales_employee')
  const companyOwnerB = addUser(persistence, orgB, 'owner')
  addUser(persistence, orgB, 'office_employee')

  const branchA = addBranch(persistence, orgA, 'Branch A')
  const branchB = addBranch(persistence, orgB, 'Branch B')
  addDepartment(persistence, orgA, branchA.id, 'Sales A')
  addDepartment(persistence, orgB, branchB.id, 'Sales B')

  assert(
    canAssignCompanyRoleForPlatformUser(
      persistence,
      platformOwner,
      orgA,
      'sales_employee',
    ),
    'platform can assign sales_employee',
  )
  assert(
    !canAssignCompanyRoleForPlatformUser(
      persistence,
      platformOwner,
      orgA,
      'owner',
    ),
    'platform cannot assign owner when owner exists',
  )
  assert(
    canAssignCompanyRoleForPlatformUser(
      persistence,
      platformOwner,
      orgEmpty,
      'owner',
    ),
    'platform can assign first owner',
  )
  assert(
    !canAssignCompanyRoleForPlatformUser(
      persistence,
      companyOwnerA,
      orgEmpty,
      'owner',
    ),
    'company owner cannot use platform assign',
  )
  assert(
    !canAssignCompanyRoleForPlatformUser(
      persistence,
      companyOwnerA,
      orgA,
      'sales_employee',
    ),
    'company owner cannot use platform assign roles',
  )

  const listedA = getCompanyPeopleForPlatformUser(
    persistence,
    platformOwner,
    orgA,
  )
  assert(listedA.ok, 'platform lists company A')
  assert(
    listedA.value.users.every((user) => user.organizationId === orgA),
    'list A only org A',
  )
  assert(
    listedA.value.users.some((user) => user.id === employeeA.id),
    'employee A visible in A',
  )
  assert(
    listedA.value.branches.every((branch) => branch.organizationId === orgA),
    'branches A only',
  )
  assert(
    listedA.value.departments.every(
      (department) => department.organizationId === orgA,
    ),
    'departments A only',
  )

  const listedB = getCompanyPeopleForPlatformUser(
    persistence,
    platformOwner,
    orgB,
  )
  assert(listedB.ok, 'platform lists company B')
  assert(
    !listedB.value.users.some((user) => user.id === employeeA.id),
    'employee A absent from B',
  )

  denied(
    getCompanyPeopleForPlatformUser(persistence, companyOwnerA, orgA),
    'ACCESS_DENIED',
    'company owner cannot list via platform',
  )
  denied(
    getCompanyPeopleForPlatformUser(persistence, employeeA, orgA),
    'ACCESS_DENIED',
    'employee cannot list via platform',
  )

  const created = createUserForPlatformUser(persistence, platformOwner, orgA, {
    firstName: 'Dana',
    lastName: 'Kim',
    email: 'demo-user-020@example.com',
    role: 'office_employee',
    status: 'active',
    phone: '+77001112233',
    jobTitle: 'Офис-менеджер',
    branchId: branchA.id,
  })
  assert(created.ok, 'platform creates employee in A')
  assert(created.value.organizationId === orgA, 'created organizationId is A')
  assert(created.value.role === 'office_employee', 'role preserved')
  assert(created.value.branchId === branchA.id, 'branch preserved')
  assert(created.value.status === 'active', 'status preserved')
  assert(created.value.jobTitle === 'Офис-менеджер', 'job title preserved')

  const listedAAfter = getCompanyPeopleForPlatformUser(
    persistence,
    platformOwner,
    orgA,
  )
  assert(listedAAfter.ok, 'list A after create')
  assert(
    listedAAfter.value.users.some((user) => user.id === created.value.id),
    'created user appears in A',
  )
  const listedBAfter = getCompanyPeopleForPlatformUser(
    persistence,
    platformOwner,
    orgB,
  )
  assert(listedBAfter.ok, 'list B after create')
  assert(
    !listedBAfter.value.users.some((user) => user.id === created.value.id),
    'created user absent from B',
  )

  const spoofed = createUserForPlatformUser(persistence, platformOwner, orgA, {
    firstName: 'Spoof',
    lastName: 'User',
    email: 'demo-user-051@example.com',
    role: 'accountant',
    status: 'active',
    ...({ organizationId: orgB } as { organizationId: Id }),
  })
  assert(spoofed.ok, 'spoof payload still creates')
  assert(
    spoofed.value.organizationId === orgA,
    'payload organizationId is ignored',
  )

  denied(
    createUserForPlatformUser(persistence, platformOwner, orgA, {
      firstName: 'Owner',
      lastName: 'Clone',
      email: 'demo-user-041@example.com',
      role: 'owner',
      status: 'active',
    }),
    'ACCESS_DENIED',
    'cannot assign second owner',
  )

  denied(
    createUserForPlatformUser(persistence, platformOwner, orgA, {
      firstName: 'Cross',
      lastName: 'Branch',
      email: 'demo-user-018@example.com',
      role: 'office_employee',
      status: 'active',
      branchId: branchB.id,
    }),
    'BRANCH_ORGANIZATION_MISMATCH',
    'foreign branch rejected',
  )

  denied(
    createUserForPlatformUser(persistence, companyOwnerA, orgA, {
      firstName: 'Nope',
      lastName: 'Owner',
      email: 'demo-user-037@example.com',
      role: 'office_employee',
      status: 'active',
    }),
    'ACCESS_DENIED',
    'company owner cannot call platform create',
  )
  denied(
    createUserForPlatformUser(persistence, employeeA, orgA, {
      firstName: 'Nope',
      lastName: 'Employee',
      email: 'demo-user-036@example.com',
      role: 'office_employee',
      status: 'active',
    }),
    'ACCESS_DENIED',
    'employee cannot call platform create',
  )
  denied(
    createUserForPlatformUser(persistence, companyOwnerB, orgB, {
      firstName: 'Nope',
      lastName: 'B',
      email: 'demo-user-035@example.com',
      role: 'office_employee',
      status: 'active',
    }),
    'ACCESS_DENIED',
    'other company owner cannot call platform create',
  )

  denied(
    createUserForPlatformUser(
      persistence,
      platformOwner,
      PLATFORM_ORGANIZATION_ID,
      {
        firstName: 'Plat',
        lastName: 'Staff',
        email: 'demo-user-044@example.com',
        role: 'office_employee',
        status: 'active',
      },
    ),
    'ACCESS_DENIED',
    'cannot create into platform organization',
  )

  const lookedUp = getCompanyUserForPlatformUser(
    persistence,
    platformOwner,
    orgA,
    created.value.id,
  )
  assert(lookedUp.ok && lookedUp.value.organizationId === orgA, 'view user in A')
  denied(
    getCompanyUserForPlatformUser(
      persistence,
      platformOwner,
      orgB,
      created.value.id,
    ),
    'USER_NOT_FOUND',
    'cannot view A user through B',
  )

  const companyCreated = createUserForUser(
    persistence,
    companyOwnerA,
    orgA,
    {
      firstName: 'Company',
      lastName: 'Hire',
      email: 'demo-user-014@example.com',
      role: 'accountant',
      status: 'active',
    },
  )
  assert(companyCreated.ok, 'company owner still creates via company service')
  assert(companyCreated.value.organizationId === orgA, 'company create stays in A')

  const firstOwner = createUserForPlatformUser(
    persistence,
    platformOwner,
    orgEmpty,
    {
      firstName: 'First',
      lastName: 'Owner',
      email: 'demo-user-027@example.com',
      role: 'owner',
      status: 'active',
    },
  )
  assert(firstOwner.ok, 'platform creates first owner')
  assert(firstOwner.value.role === 'owner', 'first owner role')
  assert(firstOwner.value.organizationId === orgEmpty, 'first owner org')
  assert(getAccessScope(firstOwner.value.role) === 'organization', 'owner scope')
  assert(!firstOwner.value.branchId, 'owner has no branch')
  assert(!firstOwner.value.departmentId, 'owner has no department')
  assert(!firstOwner.value.warehouseId, 'owner has no warehouse')
  const emptyPeople = getCompanyPeopleForPlatformUser(
    persistence,
    platformOwner,
    orgEmpty,
  )
  assert(
    emptyPeople.ok &&
      emptyPeople.value.users.some((user) => user.id === firstOwner.value.id),
    'first owner appears in company',
  )
  assert(
    !canAssignCompanyRoleForPlatformUser(
      persistence,
      platformOwner,
      orgEmpty,
      'owner',
    ),
    'helper hides owner after first',
  )
  denied(
    createUserForPlatformUser(persistence, platformOwner, orgEmpty, {
      firstName: 'Second',
      lastName: 'Owner',
      email: 'demo-user-048@example.com',
      role: 'owner',
      status: 'active',
    }),
    'ACCESS_DENIED',
    'second owner denied',
  )
  denied(
    createUserForPlatformUser(persistence, companyOwnerA, orgEmpty, {
      firstName: 'Co',
      lastName: 'Owner',
      email: 'demo-user-013@example.com',
      role: 'owner',
      status: 'active',
    }),
    'ACCESS_DENIED',
    'company owner cannot create owner via platform',
  )
  denied(
    createUserForPlatformUser(persistence, employeeA, orgEmpty, {
      firstName: 'Emp',
      lastName: 'Owner',
      email: 'demo-user-026@example.com',
      role: 'owner',
      status: 'active',
    }),
    'ACCESS_DENIED',
    'employee cannot create owner via platform',
  )
  denied(
    createUserForPlatformUser(persistence, companyOwnerB, orgEmpty, {
      firstName: 'Cross',
      lastName: 'Owner',
      email: 'demo-user-017@example.com',
      role: 'owner',
      status: 'active',
    }),
    'ACCESS_DENIED',
    'cross-org cannot create owner',
  )

  const spoofOwnerOrg = 'org-people-spoof'
  addOrg(persistence, spoofOwnerOrg, 'Spoof Target')
  const spoofFirst = createUserForPlatformUser(
    persistence,
    platformOwner,
    spoofOwnerOrg,
    {
      firstName: 'Spoof',
      lastName: 'Owner',
      email: 'demo-user-050@example.com',
      role: 'owner',
      status: 'active',
      ...({ organizationId: orgA } as { organizationId: Id }),
    },
  )
  assert(spoofFirst.ok, 'spoof owner payload creates')
  assert(
    spoofFirst.value.organizationId === spoofOwnerOrg,
    'owner org from service context',
  )

  denied(
    createUserForPlatformUser(persistence, platformOwner, orgEmpty, {
      firstName: 'Dir',
      lastName: 'Branch',
      email: 'demo-user-023@example.com',
      role: 'branch_director',
      status: 'active',
    }),
    'INVALID_USER_ORGANIZATION_STRUCTURE',
    'branch director still requires branch',
  )
  denied(
    createUserForPlatformUser(persistence, platformOwner, orgEmpty, {
      firstName: 'Mgr',
      lastName: 'Sales',
      email: 'demo-user-030@example.com',
      role: 'sales_manager',
      status: 'active',
    }),
    'INVALID_USER_ORGANIZATION_STRUCTURE',
    'sales manager still requires branch and department',
  )
  denied(
    createUserForPlatformUser(persistence, platformOwner, orgEmpty, {
      firstName: 'Emp',
      lastName: 'Sales',
      email: 'demo-user-047@example.com',
      role: 'sales_employee',
      status: 'active',
    }),
    'INVALID_USER_ORGANIZATION_STRUCTURE',
    'sales employee still requires structure',
  )
  denied(
    createUserForPlatformUser(persistence, platformOwner, orgEmpty, {
      firstName: 'Wh',
      lastName: 'Mgr',
      email: 'demo-user-054@example.com',
      role: 'warehouse_manager',
      status: 'active',
    }),
    'INVALID_USER_ORGANIZATION_STRUCTURE',
    'warehouse manager still requires branch',
  )

  denied(
    createUserForPlatformUser(persistence, platformOwner, orgA, {
      firstName: 'Se',
      lastName: 'Wh',
      email: 'demo-user-046@example.com',
      role: 'sales_employee',
      status: 'active',
      branchId: branchA.id,
    }),
    'INVALID_USER_ORGANIZATION_STRUCTURE',
    'sales employee still requires department',
  )
  denied(
    createUserForUser(persistence, employeeA, orgA, {
      firstName: 'Emp',
      lastName: 'Owner',
      email: 'demo-user-025@example.com',
      role: 'owner',
      status: 'active',
    }),
    'ACCESS_DENIED',
    'employee cannot create owner via company service',
  )

  const orgFirst = 'org-first-owner'
  addOrg(persistence, orgFirst, 'First Owner Org')
  const seededOwner = createFirstOwner(persistence, orgFirst, {
    firstName: 'Seed',
    lastName: 'Owner',
    email: 'demo-user-049@example.com',
  })
  assert(seededOwner.ok && seededOwner.value.role === 'owner', 'createFirstOwner works')
  const secondSeed = createFirstOwner(persistence, orgFirst, {
    firstName: 'Other',
    lastName: 'Owner',
    email: 'demo-user-040@example.com',
  })
  assert(!secondSeed.ok, 'createFirstOwner still blocks when users exist')

  console.log('platform-users.verify: ok')
}

runPlatformUsersChecks()
