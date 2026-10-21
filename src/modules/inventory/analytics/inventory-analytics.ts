import type { SaleRecord } from '../../../app/context/sales-context'
import type { Id, InventoryItem } from '../../../core/types'

export type AnalyticsPeriod = 'today' | '7d' | '30d' | 'all'

export type ProductSalesRow = {
  productId: Id
  sold: number
  revenue: number
}

export type WarehouseSalesRow = {
  warehouseId: Id
  sold: number
  revenue: number
}

export type RevenuePoint = {
  day: string
  revenue: number
}

export type InventoryAnalytics = {
  revenue: number
  salesCount: number
  unitsSold: number
  productCount: number
  warehouseCount: number
  outOfStockCount: number
  productSales: ProductSalesRow[]
  warehouseSales: WarehouseSalesRow[]
  stock: InventoryItem[]
  outOfStock: InventoryItem[]
  chart: RevenuePoint[]
}

function addDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  const nextYear = date.getUTCFullYear()
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0')
  const nextDay = String(date.getUTCDate()).padStart(2, '0')
  return `${nextYear}-${nextMonth}-${nextDay}`
}

export function toDayKey(isoDate: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(isoDate))
}

export function periodDayRange(
  period: AnalyticsPeriod,
  timeZone: string,
  now: Date,
): { from: string; to: string } | null {
  if (period === 'all') {
    return null
  }

  const today = toDayKey(now.toISOString(), timeZone)
  const offset = period === 'today' ? 0 : period === '7d' ? 6 : 29

  return {
    from: addDaysYmd(today, -offset),
    to: today,
  }
}

function isDayInRange(
  day: string,
  range: { from: string; to: string } | null,
): boolean {
  if (!range) {
    return true
  }

  return day >= range.from && day <= range.to
}

function listDays(range: { from: string; to: string }): string[] {
  const days: string[] = []
  let current = range.from

  while (current <= range.to) {
    days.push(current)
    current = addDaysYmd(current, 1)
  }

  return days
}

export function computeInventoryAnalytics(params: {
  sales: SaleRecord[]
  inventory: InventoryItem[]
  productCount: number
  warehouseCount: number
  includeSales: boolean
  period: AnalyticsPeriod
  warehouseId: string
  productId: string
  timeZone: string
  now?: Date
}): InventoryAnalytics {
  const now = params.now ?? new Date()
  const range = periodDayRange(params.period, params.timeZone, now)
  const stock = params.inventory.filter((item) => {
    if (params.warehouseId && item.warehouseId !== params.warehouseId) {
      return false
    }

    if (params.productId && item.productId !== params.productId) {
      return false
    }

    return true
  })
  const outOfStock = stock.filter((item) => item.quantity === 0)

  if (!params.includeSales) {
    return {
      revenue: 0,
      salesCount: 0,
      unitsSold: 0,
      productCount: params.productCount,
      warehouseCount: params.warehouseCount,
      outOfStockCount: outOfStock.length,
      productSales: [],
      warehouseSales: [],
      stock,
      outOfStock,
      chart: [],
    }
  }

  const completed = params.sales.filter((record) => {
    if (record.sale.status !== 'completed') {
      return false
    }

    if (params.warehouseId && record.sale.warehouseId !== params.warehouseId) {
      return false
    }

    const saleDay = toDayKey(record.sale.updatedAt, params.timeZone)
    if (!isDayInRange(saleDay, range)) {
      return false
    }

    if (
      params.productId &&
      !record.items.some((item) => item.productId === params.productId)
    ) {
      return false
    }

    return true
  })

  const productSalesMap = new Map<Id, ProductSalesRow>()
  const warehouseSalesMap = new Map<Id, WarehouseSalesRow>()
  const revenueByDay = new Map<string, number>()
  let revenue = 0
  let unitsSold = 0

  for (const record of completed) {
    const saleDay = toDayKey(record.sale.updatedAt, params.timeZone)
    const items = params.productId
      ? record.items.filter((item) => item.productId === params.productId)
      : record.items
    const saleRevenue = params.productId
      ? items.reduce((sum, item) => sum + item.total, 0)
      : record.sale.total
    const saleUnits = items.reduce((sum, item) => sum + item.quantity, 0)

    revenue += saleRevenue
    unitsSold += saleUnits
    revenueByDay.set(saleDay, (revenueByDay.get(saleDay) ?? 0) + saleRevenue)

    const warehouseId = record.sale.warehouseId
    if (warehouseId) {
      const warehouseRow = warehouseSalesMap.get(warehouseId) ?? {
        warehouseId,
        sold: 0,
        revenue: 0,
      }
      warehouseRow.sold += saleUnits
      warehouseRow.revenue += saleRevenue
      warehouseSalesMap.set(warehouseId, warehouseRow)
    }

    for (const item of items) {
      const productRow = productSalesMap.get(item.productId) ?? {
        productId: item.productId,
        sold: 0,
        revenue: 0,
      }
      productRow.sold += item.quantity
      productRow.revenue += item.total
      productSalesMap.set(item.productId, productRow)
    }
  }

  const chart = range
    ? listDays(range).map((day) => ({
        day,
        revenue: revenueByDay.get(day) ?? 0,
      }))
    : [...revenueByDay.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([day, dayRevenue]) => ({ day, revenue: dayRevenue }))

  return {
    revenue,
    salesCount: completed.length,
    unitsSold,
    productCount: params.productCount,
    warehouseCount: params.warehouseCount,
    outOfStockCount: outOfStock.length,
    productSales: [...productSalesMap.values()].sort(
      (left, right) => right.revenue - left.revenue,
    ),
    warehouseSales: [...warehouseSalesMap.values()].sort(
      (left, right) => right.revenue - left.revenue,
    ),
    stock,
    outOfStock,
    chart: chart.some((point) => point.revenue > 0) ? chart : [],
  }
}
