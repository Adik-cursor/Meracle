# RBAC склада

Доменная модель разрешений складского модуля. **Не подключена** к UI операций и к `completeSale` / `completeReceipt` / `completeWriteoff` / `completeAudit` / `completeTransfer`. Матрица `WarehousePermission` не менялась.

Слой проверки: `AuthContext.currentUser` → AccessService (`access.ts` + `warehouse-access.ts`).

## Цепочка

```
User.warehouseId       assigned / основной склад
UserRole
  → AccessScope        зона ответственности (не assigned warehouse)
  → WarehousePermission
  → WarehouseAccess    assigned warehouse XOR branch/org scope
```

```
Organization
  └── Branch
        └── Warehouse
              └── InventoryItem   (филиал только через warehouseId)
```

| UserRole | AccessScope |
|---|---|
| `sales_employee` | `own` |
| `sales_manager` | `department` |
| `branch_director` | `branch` |
| `commercial_director` | `organization` |
| `owner` | `organization` |

`sales_employee` **не** получает полный складской доступ только потому, что работает с продажами.

## Группы разрешений

| Группа | Permissions |
|---|---|
| CATALOG | `products.read` |
| INVENTORY | `inventory.read`, `inventory.adjust` |
| OPERATIONS | `movements.read`, `receipt.create`, `receipt.complete`, `writeoff.create`, `writeoff.complete`, `audit.create`, `audit.complete`, `transfer.create`, `transfer.complete` |
| SALES | `sales.create`, `sales.complete`, `payments.read` |
| RETURNS | `returns.create`, `returns.complete` |
| ANALYTICS | `analytics.read` |
| ADMINISTRATION | `warehouses.manage` |

## Матрица UserRole → WarehousePermission

Не изменена.

| Permission | sales_employee | sales_manager | branch_director | commercial_director | owner |
|---|---|---|---|---|---|
| `products.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `inventory.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `inventory.adjust` | — | — | ✓ | — | ✓ |
| `movements.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `receipt.create` | — | — | ✓ | — | ✓ |
| `receipt.complete` | — | — | ✓ | — | ✓ |
| `writeoff.create` | — | — | ✓ | — | ✓ |
| `writeoff.complete` | — | — | ✓ | — | ✓ |
| `audit.create` | — | — | ✓ | — | ✓ |
| `audit.complete` | — | — | ✓ | — | ✓ |
| `transfer.create` | — | — | ✓ | — | ✓ |
| `transfer.complete` | — | — | ✓ | — | ✓ |
| `sales.create` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `sales.complete` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `returns.create` | — | ✓ | ✓ | ✓ | ✓ |
| `returns.complete` | — | ✓ | ✓ | ✓ | ✓ |
| `payments.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `analytics.read` | — | ✓ | ✓ | ✓ | ✓ |
| `warehouses.manage` | — | — | — | ✓ | ✓ |

Право в матрице ≠ доступ к складу. Операции с `Warehouse` требуют `canAccessWarehouse`.

## Матрица доступа к складам (`canAccessWarehouse`)

Два разных понятия:

1. **Assigned warehouse** — `User.warehouseId` (рабочий / основной склад).
2. **Access scope** — какие склады входят в зону ответственности роли.

`user.warehouseId === warehouse.id` применяется **только** к `sales_employee`.

| Роль | Assigned warehouse | Access scope |
|---|---|---|
| `sales_employee` | обязателен | только `currentUser.warehouseId` |
| `sales_manager` | опциональный основной склад | склады филиала (`Warehouse.branchId === user.branchId`); `warehouseId` не режет scope |
| `branch_director` | опциональный | все склады `user.branchId` |
| `commercial_director` | опциональный | все склады организации |
| `owner` | опциональный | все склады организации |

Чужая организация → `WAREHOUSE_ORGANIZATION_MISMATCH`. Нет `currentUser` → `CURRENT_USER_REQUIRED`. Нет `warehouseId` у `sales_employee` → `USER_WAREHOUSE_REQUIRED`. Чужой филиал у руководителя → `WAREHOUSE_BRANCH_MISMATCH`. Чужой склад у сотрудника → `ACCESS_DENIED`.

`Warehouse.branchId` обязателен. Склада без филиала нет.

## Architectural gap: склады отдела

У `Warehouse` нет `departmentId`. Связь Warehouse → Department **не добавлялась**.

Для `sales_manager` список складов сейчас = склады его **филиала** (`Warehouse.branchId` + `user.branchId`), а не уникальный набор «складов отдела». Чтобы однозначно сузить склады до отдела, нужна отдельная связь; до неё department-level warehouse filter не выдумывается.

## Inventory

`InventoryItem` содержит `warehouseId` и `productId`, **без** `branchId`.

Филиал: `InventoryItem.warehouseId` → `Warehouse.branchId`.

`canReadInventory(persistence, user, item)` загружает склад и применяет `canAccessWarehouse` + `inventory.read`.

## Transfer

`WarehouseTransfer` по-прежнему ссылается на `sourceWarehouseId` / `destinationWarehouseId`. Оба склада имеют `branchId`. Бизнес-логика transfer не менялась; проверки organization в `transfers.ts` сохранены.

## Правила runtime

1. `currentUser` обязателен.
2. `organizationId` склада проверяется первым (`WAREHOUSE_ORGANIZATION_MISMATCH`).
3. Assigned warehouse и access scope не смешиваются.
4. Операции склада идут через `listWarehousesForUser` / `requireAccessibleWarehouse`, не через `warehouseRepository.list(organizationId)` в пользовательском UI.

## Оставшиеся gaps

1. **`Product` не содержит `warehouseId` / `branchId`.** Каталог общий на организацию.
2. Складские операции (`completeReceipt` и др.) ещё не вызывают `can*`.
3. Нет роли кладовщика; используются CRM `UserRole`.
4. `department` не режет склад однозначно: у Warehouse нет `departmentId` (см. gap выше).
5. Список складов в пользовательском UI идёт через `listWarehousesForUser`.
