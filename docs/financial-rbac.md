# RBAC финансовых данных CRM

Отдельный доменный контур. **Не подключён** к UI, `SalesContext`, `PaymentContext`, `PaymentRefundContext`, `SaleReturnContext` и к существующим sales/payment services.

`FinancialPermission` ≠ `WarehousePermission`. Это разные слои.

## Цепочка

```
User
  → UserRole
  → AccessScope
  → WarehouseAccess     к каким складам есть доступ
  → FinancialPermission что можно делать с финансовыми документами склада
```

```
User
  → FinancialPermission
  → FinancialAccessService
```

Порядок проверки операции:

```
currentUser
  → organizationId
  → WarehouseAccess
  → FinancialPermission
  → operation
```

WarehouseAccess **не** дублируется внутри FinancialAccess: используется существующий `canAccessWarehouse`.

## Слои

| Слой | Вопрос |
|---|---|
| WarehouseAccess | К каким складам пользователь имеет доступ? Assigned warehouse (`User.warehouseId`) ограничивает только `sales_employee`. Руководители проверяются по scope филиала/организации. |
| FinancialAccess | Что он может делать с финансовыми документами этого склада? |

Пример:

- WarehouseAccess: employee → Warehouse A
- FinancialAccess: `sales.create` = да, `payments.read` = да (только доступный склад), `refunds.create` = нет

## UserRole → AccessScope

Не изменены.

| UserRole | AccessScope | Финансовый scope складов |
|---|---|---|
| `sales_employee` | `own` | склады своего `branchId` |
| `sales_manager` | `department` | склады своего branch |
| `branch_director` | `branch` | склады своего branch |
| `commercial_director` | `organization` | все склады организации |
| `owner` | `organization` | все склады организации |

Scope филиала задаёт WarehouseAccess. FinancialAccess его не пересчитывает.

## Группы FinancialPermission

| Группа | Permissions |
|---|---|
| SALES | `sales.read`, `sales.read_amount`, `sales.create`, `sales.update`, `sales.confirm`, `sales.complete` |
| PAYMENTS | `payments.read`, `payments.create`, `payments.cancel` |
| RETURNS | `returns.read`, `returns.create`, `returns.complete` |
| REFUNDS | `refunds.read`, `refunds.create`, `refunds.cancel` |
| ANALYTICS | `financial_analytics.read` |
| ADMINISTRATION | `financial_documents.manage` |

## Матрица UserRole → FinancialPermission

| Permission | sales_employee | sales_manager | branch_director | commercial_director | owner |
|---|---|---|---|---|---|
| `sales.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `sales.read_amount` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `sales.create` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `sales.update` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `sales.confirm` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `sales.complete` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `payments.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `payments.create` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `payments.cancel` | — | — | ✓ | ✓ | ✓ |
| `returns.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `returns.create` | — | ✓ | ✓ | ✓ | ✓ |
| `returns.complete` | — | ✓ | ✓ | ✓ | ✓ |
| `refunds.read` | — | ✓ | ✓ | ✓ | ✓ |
| `refunds.create` | — | — | ✓ | ✓ | ✓ |
| `refunds.cancel` | — | — | ✓ | ✓ | ✓ |
| `financial_analytics.read` | — | ✓ | ✓ | ✓ | ✓ |
| `financial_documents.manage` | — | — | ✓ | ✓ | ✓ |

Сейчас у всех ролей с `sales.read` также есть `sales.read_amount`. Разделение всё равно обязательно: access-aware projection не возвращает суммы без `sales.read_amount`.

## Граф документов

Customer, Product и SaleItem **не** задают финансовый scope. Scope: `organization → warehouse`.

```
Sale.organizationId + Sale.warehouseId
  → WarehouseAccess
  → FinancialPermission

Payment
  → Sale
  → Sale.warehouseId
  → WarehouseAccess
  → FinancialPermission

PaymentRefund
  → Payment
  → Sale
  → Warehouse
  → WarehouseAccess
  → FinancialPermission

SaleReturn
  → Sale
  → Warehouse
  → WarehouseAccess
  → FinancialPermission
```

В `Payment`, `PaymentRefund` и как финансовый scope `SaleReturn` **не** добавляется `warehouseId`. Используются существующие связи. У `SaleReturn` поле `warehouseId` уже есть в домене реализации; FinancialAccess берёт склад из `Sale`.

## Денежные поля и projections

Отдельный read-model. Существующие `Sale` / `Payment` / `PaymentRefund` не переписываются.

| Permission | Что видно |
|---|---|
| `sales.read` | факт реализации (`SaleFinancialView.canRead`) |
| `sales.read_amount` | `subtotal`, `discount`, `total`, `paidAmount`, `outstandingAmount` |
| `payments.read` | `PaymentFinancialView`: method, amount, status, createdAt |
| `refunds.read` | `RefundFinancialView`: amount, status, paymentId, returnId, createdAt |

Без `sales.read_amount` суммы **не** попадают в projection (не CSS/скрытие UI).

Без `payments.read` / `refunds.read` access-aware projection не возвращает документ.

Аналитика: отдельное `financial_analytics.read`. Право видеть реализации **не** открывает финансовую аналитику.

## Примеры

### Employee

Warehouse A (свой branch):

- `sales.read` = да
- `sales.create` = да
- `payments.read` = да
- `refunds.create` = нет
- `financial_analytics.read` = нет

Warehouse B (чужой branch): WarehouseAccess → `ACCESS_DENIED` до FinancialPermission.

### Sales Manager

Склады своего branch:

- sales = да
- returns = да
- `refunds.read` = да
- `refunds.create` = нет
- financial analytics = да

### Branch Director

Все склады своего branch: полный финансовый доступ своего branch (`payments.cancel`, refunds write, `financial_documents.manage`).

### Commercial Director

Вся organization: все FinancialPermission.

### Owner

Вся organization: все FinancialPermission.

Owner организации A **не** видит sale/payment/refund организации B: сначала `organizationId` → `ORGANIZATION_MISMATCH`.
