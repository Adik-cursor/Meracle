# PostgreSQL schema — CRM Platform

Проектирование будущей схемы. Подключения к PostgreSQL, ORM, миграций, API и сервера **нет**. Документ соответствует текущим Core types, repository interfaces и services.

Идентификаторы: `uuid`. Время: `timestamptz`. Деньги: `numeric(18, 2)` (KZT, без floating point). Количество: `numeric(18, 6)` с `CHECK (>= 0)`.

Статусы: `varchar` + `CHECK`, без PostgreSQL `ENUM`.

---

## 1. Multi-tenancy

Каждая бизнес-строка несёт `organization_id` (кроме глобального `users` и самой `organizations`).

Стратегия:

1. **Tenant key** — `organization_id uuid NOT NULL`.
2. **FK на организацию** — `organization_id → organizations(id)` `ON DELETE RESTRICT`.
3. **Составные FK** — дочерняя сущность ссылается на родителя парой `(organization_id, parent_id)`, чтобы нельзя было привязать склад/товар чужой организации. Для этого на родителе: `UNIQUE (organization_id, id)` (при глобально уникальном `id` это избыточно для уникальности, но нужно для составного FK).
4. **Индексы tenant-first** — ведущий столбец `organization_id` во всех списках по организации.

`organizations.organization_id` в TypeScript (`BaseEntity`) в БД **не дублируется**: у организации первичный ключ — `id`.

---

## 2. Таблицы и связи

```
organizations
├── organization_settings          1:1
├── organization_modules           1:N (по имени модуля)
├── organization_users             N:M users
├── branches
│     └── warehouses
│           └── inventory_items
├── contacts
│     └── companies (optional)
├── companies
├── customers                      XOR contact | company
├── products
│     └── inventory_items
├── stock_movements
├── warehouse_transfers
│     └── warehouse_transfer_items
├── sales
│     ├── sale_items
│     ├── payments
│     │     └── payment_refunds
│     └── sale_returns
│           └── sale_return_items
users
```

### 2.1. Организация

#### `organizations`

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid | PK |
| name | varchar(255) | NOT NULL |
| status | varchar(32) | NOT NULL, CHECK `active \| inactive \| suspended` |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |

`created_by` не нужен (организация — корень tenant).

#### `organization_settings`

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, UNIQUE, FK → organizations |
| locale | varchar(8) | NOT NULL, CHECK `ru \| kk` |
| timezone | varchar(64) | NOT NULL |
| currency | char(3) | NOT NULL (ISO 4217, сейчас `KZT`) |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |

Модули **не** хранить JSON-полем в settings (в TS сейчас `settings.modules`). В БД — отдельная таблица.

#### `organization_modules`

| Колонка | Тип | Ограничения |
|---|---|---|
| organization_id | uuid | PK, FK → organizations |
| module | varchar(32) | PK, CHECK список модулей |
| enabled | boolean | NOT NULL |

Допустимые `module`: `crm`, `contacts`, `companies`, `deals`, `tasks`, `activities`, `warehouses`, `reports`, `sales`.

Правило приложения (не CHECK в БД): `sales = true` только если `warehouses = true`.

---

### 2.2. Пользователи

#### `users`

Глобальная учётка, **без** `organization_id`.

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid | PK |
| email | varchar(255) | NOT NULL, UNIQUE |
| first_name | varchar(100) | NOT NULL |
| last_name | varchar(100) | NOT NULL |
| status | varchar(32) | NOT NULL, CHECK `invited \| active \| disabled` |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |

Роль **не** на `users`: в TS сейчас `User.role` и `User.organizationId` лежат на пользователе. В БД роль — на членстве.

#### `organization_users`

| Колонка | Тип | Ограничения |
|---|---|---|
| organization_id | uuid | PK, FK → organizations |
| user_id | uuid | PK, FK → users |
| role | varchar(32) | NOT NULL, CHECK `owner \| commercial_director \| branch_director \| sales_manager \| sales_employee` |
| warehouse_id | uuid | NULL, FK → warehouses. В TS: `User.warehouseId`. Обязателен для `sales_employee`. Не ограничивает RBAC scope руководителей. |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |

---

### 2.3. CRM

Общие поля tenant-сущностей: `id`, `organization_id`, `created_at`, `updated_at`. `created_by` на CRM-карточках не требуется (в текущих services не пишется).

#### `contacts`

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK |
| first_name | varchar(100) | NOT NULL |
| last_name | varchar(100) | NOT NULL |
| email | varchar(255) | NULL |
| phone | varchar(64) | NULL |
| company_id | uuid | NULL |
| status | varchar(32) | CHECK `active \| inactive \| archived` |
| created_at / updated_at | timestamptz | NOT NULL |

FK: `(organization_id, company_id) → companies (organization_id, id)` (если `company_id` NOT NULL).

#### `companies`

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK |
| name | varchar(255) | NOT NULL |
| website | varchar(512) | NULL |
| status | varchar(32) | CHECK `active \| inactive \| archived` |
| created_at / updated_at | timestamptz | NOT NULL |

#### `customers`

Контрагент реализации: ссылка **XOR** на контакт или компанию.

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK |
| type | varchar(16) | CHECK `contact \| company` |
| contact_id | uuid | NULL |
| company_id | uuid | NULL |
| status | varchar(32) | CHECK `active \| inactive` |
| created_at / updated_at | timestamptz | NOT NULL |

CHECK:

- `type = 'contact'` → `contact_id IS NOT NULL AND company_id IS NULL`
- `type = 'company'` → `company_id IS NOT NULL AND contact_id IS NULL`

FK: `(organization_id, contact_id) → contacts`, `(organization_id, company_id) → companies`.

#### `branches`

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK |
| name | varchar(255) | NOT NULL |
| code | varchar(64) | NULL |
| status | varchar(32) | CHECK `active \| inactive` |
| created_at / updated_at | timestamptz | NOT NULL |

UNIQUE `(organization_id, id)`. UNIQUE `(organization_id, code)` если `code` задан.

---

### 2.4. Склад

#### `warehouses`

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK |
| branch_id | uuid | NOT NULL |
| name | varchar(255) | NOT NULL |
| description | text | NULL |
| address | text | NULL |
| status | varchar(32) | CHECK `active \| inactive` |
| created_at / updated_at | timestamptz | NOT NULL |

UNIQUE `(organization_id, id)`.

Склад **всегда** принадлежит филиалу. `branch_id` NOT NULL.

FK:

- `(organization_id, branch_id) → branches (organization_id, id)`

Цепочка: `organizations → branches → warehouses → inventory_items`.

`inventory_items` **не** хранит `branch_id`. Филиал остатка: `inventory_items.warehouse_id → warehouses.branch_id`.

#### `products`

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK |
| name | varchar(255) | NOT NULL |
| sku | varchar(64) | NOT NULL |
| description | text | NULL |
| unit | varchar(32) | NOT NULL |
| status | varchar(32) | CHECK `active \| inactive` |
| created_at / updated_at | timestamptz | NOT NULL |

UNIQUE `(organization_id, sku)`, UNIQUE `(organization_id, id)`.

#### `inventory_items`

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK |
| warehouse_id | uuid | NOT NULL |
| product_id | uuid | NOT NULL |
| quantity | numeric(18, 6) | NOT NULL, CHECK `>= 0` |
| reserved_quantity | numeric(18, 6) | NOT NULL, DEFAULT 0, CHECK `>= 0` |
| created_at / updated_at | timestamptz | NOT NULL |

CHECK `reserved_quantity <= quantity`.

**UNIQUE (organization_id, warehouse_id, product_id)** — одна строка остатка на пару склад+товар в организации.

FK:

- `(organization_id, warehouse_id) → warehouses (organization_id, id)`
- `(organization_id, product_id) → products (organization_id, id)`

#### `stock_movements`

Журнал. Независим от `inventory_items` по записи (остаток меняют services в той же транзакции).

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK |
| warehouse_id | uuid | NOT NULL |
| product_id | uuid | NOT NULL |
| type | varchar(32) | CHECK `receipt \| shipment \| transfer \| adjustment` |
| quantity | numeric(18, 6) | NOT NULL, CHECK `> 0` |
| note | text | NULL |
| created_at | timestamptz | NOT NULL |
| created_by | uuid | NOT NULL, FK → users |

`updated_at` нет (append-only журнал, как в TS).

Опционально позже: `reference_type` / `reference_id` (sale / return / transfer). Сейчас связь только через `note` (id документа) — расхождение, см. §12.

#### `warehouse_transfers`

Шапка перемещения.

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK |
| source_warehouse_id | uuid | NOT NULL |
| destination_warehouse_id | uuid | NOT NULL |
| status | varchar(32) | CHECK `draft \| pending \| completed \| cancelled` |
| created_at / updated_at | timestamptz | NOT NULL |

CHECK `source_warehouse_id <> destination_warehouse_id`.

FK обоих складов: `(organization_id, *_warehouse_id) → warehouses`.

`created_by` не обязателен (в текущем transfer service не пишется).

#### `warehouse_transfer_items`

Нормализованные позиции. **В текущем TypeScript позиции нет**: `WarehouseTransfer` содержит `productId` + `quantity` на шапке. Таблица — целевая форма; до миграции модели шапка 1:1 отображается в одну строку items.

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK |
| transfer_id | uuid | NOT NULL |
| product_id | uuid | NOT NULL |
| quantity | numeric(18, 6) | NOT NULL, CHECK `> 0` |
| created_at / updated_at | timestamptz | NOT NULL |

FK: `(organization_id, transfer_id) → warehouse_transfers`, `(organization_id, product_id) → products`.

UNIQUE `(transfer_id, product_id)` — одна позиция товара в перемещении.

---

### 2.5. Реализация

#### `sales`

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK |
| warehouse_id | uuid | NOT NULL |
| customer_id | uuid | NULL |
| status | varchar(32) | CHECK `draft \| confirmed \| cancelled \| completed` |
| currency | char(3) | NOT NULL |
| subtotal | numeric(18, 2) | NOT NULL, CHECK `>= 0` |
| discount | numeric(18, 2) | NOT NULL, CHECK `>= 0` |
| total | numeric(18, 2) | NOT NULL, CHECK `>= 0` |
| note | text | NULL |
| created_at / updated_at | timestamptz | NOT NULL |

CHECK `total = GREATEST(subtotal - discount, 0)` — опционально, если `subtotal` всегда сумма линий. Сейчас total считается в service; CHECK можно добавить после стабилизации округления.

FK: `(organization_id, warehouse_id) → warehouses`, `(organization_id, customer_id) → customers`.

`SalePaymentStatus` (`unpaid` / `partially_paid` / `paid`) **не колонка** — вычисляется из платежей.

#### `sale_items`

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK |
| sale_id | uuid | NOT NULL |
| warehouse_id | uuid | NOT NULL |
| product_id | uuid | NOT NULL |
| quantity | numeric(18, 6) | NOT NULL, CHECK `> 0` |
| unit_price | numeric(18, 2) | NOT NULL, CHECK `>= 0` |
| discount | numeric(18, 2) | NOT NULL, CHECK `>= 0` |
| total | numeric(18, 2) | NOT NULL, CHECK `>= 0` |
| created_at / updated_at | timestamptz | NOT NULL |

CHECK `total = GREATEST(quantity * unit_price - discount, 0)` — с учётом `numeric`; лучше считать в service и хранить результат, CHECK как защита.

FK: `(organization_id, sale_id) → sales`, `(organization_id, warehouse_id) → warehouses`, `(organization_id, product_id) → products`.

`warehouse_id` обязателен. Сейчас он копируется с `sales.warehouse_id` (одна продажа — один склад).

#### `payments`

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK |
| sale_id | uuid | NOT NULL |
| amount | numeric(18, 2) | NOT NULL, CHECK `> 0` |
| currency | char(3) | NOT NULL |
| method | varchar(32) | CHECK `cash \| card \| bank_transfer \| other` |
| status | varchar(32) | CHECK `completed \| cancelled` |
| note | text | NULL |
| created_at | timestamptz | NOT NULL |
| created_by | uuid | NOT NULL, FK → users |

`updated_at` нет (как в TS). Отмена — смена `status`, можно добавить `updated_at` позже.

FK: `(organization_id, sale_id) → sales`.

Сумма completed-платежей по продаже не должна превышать `sales.total` — это правило service + транзакция, не простой CHECK по одной строке. Имеет смысл `EXCLUDE`/`constraint trigger` на этапе реализации.

#### `payment_refunds`

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK |
| payment_id | uuid | NOT NULL |
| sale_id | uuid | NOT NULL |
| return_id | uuid | NULL |
| amount | numeric(18, 2) | NOT NULL, CHECK `> 0` |
| currency | char(3) | NOT NULL |
| status | varchar(32) | CHECK `completed \| cancelled` |
| note | text | NULL |
| created_at | timestamptz | NOT NULL |
| created_by | uuid | NOT NULL, FK → users |

FK: `(organization_id, payment_id) → payments`, `(organization_id, sale_id) → sales`, `(organization_id, return_id) → sale_returns`.

`sale_id` денормализован с платежа; service требует `payment.sale_id = sale_return.sale_id` если задан `return_id`.

#### `sale_returns`

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK |
| sale_id | uuid | NOT NULL |
| warehouse_id | uuid | NOT NULL |
| customer_id | uuid | NULL |
| status | varchar(32) | CHECK `draft \| completed \| cancelled` |
| total | numeric(18, 2) | NOT NULL, CHECK `>= 0` |
| note | text | NULL |
| created_at / updated_at | timestamptz | NOT NULL |

FK: `(organization_id, sale_id) → sales`, `(organization_id, warehouse_id) → warehouses`, `(organization_id, customer_id) → customers`.

#### `sale_return_items`

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK |
| return_id | uuid | NOT NULL |
| sale_item_id | uuid | NOT NULL |
| warehouse_id | uuid | NOT NULL |
| product_id | uuid | NOT NULL |
| quantity | numeric(18, 6) | NOT NULL, CHECK `> 0` |
| unit_price | numeric(18, 2) | NOT NULL, CHECK `>= 0` |
| total | numeric(18, 2) | NOT NULL, CHECK `>= 0` |
| created_at / updated_at | timestamptz | NOT NULL |

FK: `(organization_id, return_id) → sale_returns`, `(organization_id, sale_item_id) → sale_items`, склады и товары — составные FK как выше.

Лимит «возвращено ≤ продано» по `sale_item_id` (сумма completed return items) — constraint trigger / service, не CHECK одной строки.

---

## 3. Ключевые связи (ER)

```
organization
   └── warehouse
          └── inventory_item
                 ↑
              product

sale
├── warehouse
├── customer? 
└── sale_items
      ├── product
      └── warehouse

sale
└── sale_return
      └── sale_return_item
            └── sale_item

sale
└── payment
      └── payment_refund
            └── sale_return?   (optional return_id)
```

---

## 4. Деньги

Тип колонок: **`numeric(18, 2)`**, не `float`/`double`/`real`.

| Поле | Таблица | Тип |
|---|---|---|
| unit_price | sale_items, sale_return_items | numeric(18, 2) |
| discount | sales, sale_items | numeric(18, 2) |
| subtotal | sales | numeric(18, 2) |
| total | sales, sale_items, sale_returns, sale_return_items | numeric(18, 2) |
| amount | payments, payment_refunds | numeric(18, 2) |

**Не хранить как независимые колонки:**

| Показатель | Формула |
|---|---|
| `paidAmount` | `SUM(payments.amount)` WHERE `sale_id` AND `status = 'completed'` |
| `refundedAmount` | `SUM(payment_refunds.amount)` WHERE `sale_id` (или `payment_id`) AND `status = 'completed'` |
| `netPaidAmount` | `paidAmount - refundedAmount` |
| `outstanding` / due | `GREATEST(sale.total - paidAmount, 0)` |
| статус оплаты продажи | unpaid / partial / paid из `paidAmount` vs `sale.total` |

`Sale.total` — итог документа (после скидки продажи), хранится.  
`Payment.amount` — сумма этого платежа, хранится.  
`PaymentRefund.amount` — сумма этого возврата денег, хранится.

Округление: как сейчас в service (`round` до 2 знаков) — в SQL `numeric` + то же правило в транзакции.

---

## 5. Статусы (`varchar` + CHECK)

| Домен | Значения |
|---|---|
| OrganizationStatus | `active`, `inactive`, `suspended` |
| UserStatus | `invited`, `active`, `disabled` |
| UserRole (`organization_users.role`) | `owner`, `admin`, `manager`, `user` |
| ContactStatus / CompanyStatus | `active`, `inactive`, `archived` |
| CustomerStatus | `active`, `inactive` |
| WarehouseStatus | `active`, `inactive` |
| ProductStatus | `active`, `inactive` |
| WarehouseTransferStatus | `draft`, `pending`, `completed`, `cancelled` |
| SaleStatus | `draft`, `confirmed`, `cancelled`, `completed` |
| PaymentStatus | `completed`, `cancelled` |
| PaymentRefundStatus | `completed`, `cancelled` |
| SaleReturnStatus | `draft`, `completed`, `cancelled` |
| StockMovementType | `receipt`, `shipment`, `transfer`, `adjustment` |
| PaymentMethod | `cash`, `card`, `bank_transfer`, `other` |
| Locale | `ru`, `kk` |

SalePaymentStatus в БД не хранится.

---

## 6. Аудит

| Поле | Где |
|---|---|
| `id` | все таблицы |
| `created_at` | все таблицы |
| `updated_at` | все изменяемые сущности; **нет** у `stock_movements`, `payments`, `payment_refunds` (как в TS) |
| `created_by` | **только** `stock_movements`, `payments`, `payment_refunds` (факт операции). FK → `users`. Сейчас in-memory пишет `organization.id` — это **не** user id; перед подключением БД `created_by` должен стать реальным `users.id`. |

Не добавлять `created_by` на warehouse/product/sale/return: текущие services их не заполняют.

---

## 7. Transaction boundaries (одна PostgreSQL transaction)

Соответствует `persistence.runInTransaction` в services.

### Продажа (`completeSale`)

```
lock / idempotency (status = confirmed)
→ проверить org, склад, товары, остатки
→ уменьшить inventory_items
→ INSERT stock_movements (shipment)
→ UPDATE sales.status = completed
COMMIT
```

Откат: ни остаток, ни movement, ни статус не фиксируются по отдельности.

### Перемещение (`completeTransfer`)

```
проверить source remainder и склады
→ source inventory −
→ destination inventory +
→ UPDATE warehouse_transfers.status = completed
COMMIT
```

В текущем коде movement типа `transfer` **не** создаётся. Если в БД появятся две строки journal (out/in), это расширение модели — зафиксировать отдельно.

### Возврат товара (`completeReturn`)

```
проверить returnable quantity (sold − уже completed returns)
→ inventory +
→ INSERT stock_movements (receipt)
→ UPDATE sale_returns.status = completed
COMMIT
```

Оплата и refund денег — отдельные транзакции (`INSERT payments` / `INSERT payment_refunds` с проверкой лимита). Товарный возврат **не** меняет платежи.

---

## 8. Индексы

Не дублировать PK и UNIQUE.

| Индекс | Назначение |
|---|---|
| `products (organization_id)` | товары организации (список) |
| `products (organization_id, sku)` UNIQUE | артикул |
| `warehouses (organization_id)` | склады организации |
| `warehouses (organization_id, branch_id)` | склады филиала |
| `inventory_items (organization_id, warehouse_id)` | остатки по складу |
| `inventory_items (organization_id, warehouse_id, product_id)` UNIQUE | остаток товара на складе |
| `sales (organization_id, created_at DESC)` | продажи за период |
| `sales (organization_id, warehouse_id, created_at DESC)` | продажи по складу |
| `sale_items (sale_id)` | позиции продажи |
| `stock_movements (organization_id, product_id, created_at DESC)` | движения товара |
| `stock_movements (organization_id, warehouse_id, created_at DESC)` | журнал склада |
| `payments (organization_id, sale_id)` | платежи продажи |
| `payment_refunds (payment_id)` | возвраты по оплате |
| `payment_refunds (sale_id)` | возвраты денег по продаже |
| `sale_returns (organization_id, sale_id)` | возвраты продажи |
| `sale_return_items (return_id)` | позиции возврата |
| `sale_return_items (sale_item_id)` | уже возвращено по линии |
| `customers (organization_id)` | контрагенты |
| `warehouse_transfers (organization_id, created_at DESC)` | список перемещений |
| `organization_users (user_id)` | организации пользователя |

UNIQUE на `inventory_items` уже закрывает точечный lookup остатка — отдельный btree на ту же тройку не нужен.

---

## 9. Соответствие Core → Repository → таблица

| Сущность / репозиторий | Таблица | Есть? |
|---|---|---|
| Organization | organizations | да |
| OrganizationSettings | organization_settings | да (без JSON modules) |
| OrganizationModules | organization_modules | да |
| User | users + organization_users | да, **нормализация** |
| Contact | contacts | да |
| Company | companies | да |
| CustomerRepository | customers | да |
| WarehouseRepository | warehouses | да |
| ProductRepository | products | да |
| InventoryRepository | inventory_items | да |
| StockMovementRepository | stock_movements | да |
| WarehouseTransferRepository | warehouse_transfers | да |
| — | warehouse_transfer_items | **таблица есть, TS-типа нет** |
| SaleRepository | sales | да |
| SaleItemRepository | sale_items | да |
| PaymentRepository | payments | да |
| PaymentRefundRepository | payment_refunds | да |
| SaleReturnRepository | sale_returns | да |
| SaleReturnItemRepository | sale_return_items | да |
| Deal | — | тип есть, репозитория и таблицы **нет** (заглушка CRM) |
| Task | — | то же |
| Activity | — | типа/репозитория нет |

---

## 12. Расхождения TypeScript ↔ будущая БД

**Не исправлялись в Core.** Нужно решить до миграции.

1. **`Organization` наследует `BaseEntity.organizationId`** — у корневой организации в БД нет `organization_id`; сейчас `id === organizationId` (`org-runtime`).
2. **`OrganizationSettings.modules`** — в TS объект на settings; в БД отдельная `organization_modules`.
3. **`User.organizationId` + `User.role`** — в БД membership `organization_users`; пользователь может быть в нескольких org.
4. **`WarehouseTransfer`** — `productId`/`quantity` на шапке; в БД — `warehouse_transfer_items`. Пока 1:1 при переносе.
5. **`created_by`** в movements/payments/refunds сейчас = `organization.id`, не `users.id`. FK на `users` сломается без смены семантики.
6. **Нет `updated_at`** у Payment, PaymentRefund, StockMovement; у Payment при cancel статус меняется без audit-поля.
7. **`reserved_quantity`** есть в модели, всегда `0`, резервирования в services нет. Колонку оставить (будущий reserve), не использовать в completeSale.
8. **`stock_movements.note`** хранит id продажи/возврата вместо `reference_type`/`reference_id`.
9. **`sale_items.warehouse_id`** дублирует `sales.warehouse_id`.
10. **`payment_refunds.sale_id`** дублирует `payments.sale_id`.
11. **Деньги и количества в TS — `number` (IEEE float)**; в PostgreSQL — `numeric`. Округление в JS (`roundMoney`) нужно повторить на `numeric`, иначе копейки разъедутся.
12. **`SaleReturn.customerId` типизирован как `string`, не `Id`.**
13. **Contact.email/phone в UI** — optional string; в типах `Nullable<string>`. В БД NULL.
14. **Transfer complete не пишет StockMovement** — в схеме тип `transfer` есть, сервис его не создаёт.
15. **Репозитория Contact/Company/Organization нет** в `src/core/repositories` — таблицы для них всё равно нужны.

---

## Что сознательно не включено

SQL migration, Prisma/Drizzle schema, connection string, API, auth-таблицы сессий/JWT, Docker.
