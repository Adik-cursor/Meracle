# RBAC и организационная структура

Доменная модель и runtime-слой доступа CRM Platform. Login, JWT, session и mock currentUser **не реализованы**. `AccessContext.currentUser` сейчас явно `null`.

## Роли

| Код | Название | Назначение |
|---|---|---|
| `owner` | Владелец / Администратор | Полный доступ к организации. Не обязан иметь филиал или отдел. |
| `commercial_director` | Коммерческий директор | Видит все филиалы организации. Филиал и отдел не обязательны. |
| `branch_director` | Директор филиала | Управляет одним филиалом. Обязателен `branchId`. Отдел может отсутствовать. |
| `sales_manager` | Руководитель отдела продаж | Видит сделки и задачи своего отдела. Обязательны `branchId` и `departmentId`. |
| `sales_employee` | Сотрудник отдела продаж | Видит только свои объекты (`own`). Обязательны `branchId` и `departmentId`. |

`role`, `branchId` и `departmentId` — разные понятия. Роль задаёт область доступа. Филиал и отдел задают место в иерархии.

## Иерархия

```
Organization
├── Branch
│   └── Department
│       ├── Sales Manager
│       └── Sales Employees
│
├── Branch
│   └── Department
│
└── Commercial Director

Owner находится на уровне всей Organization.
```

## Организационные правила

1. Branch принадлежит Organization.
2. Department принадлежит Branch и Organization.
3. User принадлежит Organization.
4. `User.branchId` должен ссылаться на Branch той же Organization.
5. `User.departmentId` должен ссылаться на Department той же Organization.
6. Если указан `departmentId`, `branchId` пользователя должен совпадать с `branchId` отдела.
7. `sales_employee` должен иметь `branchId` и `departmentId`.
8. `sales_manager` должен иметь `branchId` и `departmentId`.
9. `branch_director` должен иметь `branchId`.
10. `commercial_director` не обязан иметь `branchId`.
11. `owner` не обязан иметь `branchId` или `departmentId`.

Коды ошибок доменной валидации:

- `BRANCH_NOT_FOUND`
- `DEPARTMENT_NOT_FOUND`
- `BRANCH_ORGANIZATION_MISMATCH`
- `DEPARTMENT_ORGANIZATION_MISMATCH`
- `DEPARTMENT_BRANCH_MISMATCH`
- `INVALID_USER_ORGANIZATION_STRUCTURE`

## Матрица области видимости

| Роль | Свои | Отдел | Филиал | Вся организация |
|---|---|---|---|---|
| `sales_employee` | ✓ | — | — | — |
| `sales_manager` | ✓ | ✓ | — | — |
| `branch_director` | ✓ | ✓ | ✓ | — |
| `commercial_director` | ✓ | ✓ | ✓ | ✓ |
| `owner` | ✓ | ✓ | ✓ | ✓ |

`getAccessScope(role)` → `own` | `department` | `branch` | `organization`.

Соответствие:

| Роль | Scope |
|---|---|
| `sales_employee` | `own` |
| `sales_manager` | `department` |
| `branch_director` | `branch` |
| `commercial_director` | `organization` |
| `owner` | `organization` |

## Примеры

Менеджер филиала A (`sales_employee`):  
видит только свои сделки.

РОП филиала A (`sales_manager`):  
видит сделки сотрудников своего отдела.

Директор филиала A (`branch_director`):  
видит весь филиал A.

Коммерческий директор:  
видит филиалы A, B, C.

Владелец:  
видит всю организацию.

## Runtime access control

Слой: `AccessContext` → `*ForUser` в services → `canAccess*` в `src/core/services/access.ts`.

`organizationId` проверяется **первым**. Owner организации A не видит данные организации B.

Отсутствие `currentUser` **не** даёт полный доступ. Списки возвращают `CURRENT_USER_REQUIRED`, UI показывает «Требуется авторизация».

Запись вне своего scope отклоняется с `ACCESS_DENIED`.

### Сделки и задачи без assignedUserId

| Роль | Unassigned Deal/Task |
|---|---|
| `sales_employee` | не видит |
| `sales_manager` | не видит |
| `branch_director` | не видит |
| `commercial_director` | видит |
| `owner` | видит |

### Примеры

Менеджер A (`sales_employee`):  
может видеть Deal A, если `assignedUserId === A.id`.  
не может видеть Deal B другого сотрудника.

РОП A (`sales_manager`):  
видит сделки отдела A.  
не видит сделки отдела B.

Директор A (`branch_director`):  
видит филиал A.  
не видит филиал B.

Коммерческий директор:  
видит филиалы A + B.

Owner:  
видит всю организацию.

### Списки

| Роль | Users | Branches | Departments | Deals / Tasks |
|---|---|---|---|---|
| `sales_employee` | только сам | нет списка | свой отдел | свои (`assignedUserId`) |
| `sales_manager` | свой отдел | нет списка | свой отдел | отдел |
| `branch_director` | свой филиал | свой филиал | отделы филиала | филиал |
| `commercial_director` | вся орг. | вся орг. | вся орг. | вся орг. |
| `owner` | вся орг. | вся орг. | вся орг. | вся орг. |

Склад (Warehouse, Inventory, Sale, Payment) этим CRM-слоем пока **не фильтруется**. Черновик складских разрешений: [warehouse-rbac.md](./warehouse-rbac.md). К UI и складским сервисам **не подключён**.

## Cross-organization isolation

Пользователь организации A никогда не должен видеть:

- пользователей B;
- филиалы B;
- отделы B;
- сделки B;
- задачи B;
- склады B;
- реализации B.
