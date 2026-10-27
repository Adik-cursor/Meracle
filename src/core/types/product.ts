import type { BaseEntity } from './common'

export type ProductStatus = 'active' | 'inactive'

export type ProductItemType = 'product' | 'service'

export type Product = BaseEntity & {
  name: string
  sku: string
  barcode?: string
  description?: string
  unit: string
  itemType: ProductItemType
  basePrice: number
  costPrice: number
  status: ProductStatus
  categoryId?: string
  size?: string
  /** Data URL (`data:image/...;base64,...`) stored with the product. */
  imageUrl?: string
}

export const PRODUCT_IMAGE_MAX_BYTES = 2 * 1024 * 1024
export const PRODUCT_IMAGE_DATA_URL_MAX_LENGTH =
  Math.ceil(PRODUCT_IMAGE_MAX_BYTES * (4 / 3)) + 80
export const PRODUCT_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

const PRODUCT_IMAGE_DATA_URL =
  /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i

export function parseProductImageUrl(value: unknown): string | undefined | null {
  if (value === undefined || value === null) {
    return undefined
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  if (trimmed.length > PRODUCT_IMAGE_DATA_URL_MAX_LENGTH) {
    return null
  }

  if (!PRODUCT_IMAGE_DATA_URL.test(trimmed)) {
    return null
  }

  return trimmed.replace(/\s/g, '')
}

export function isPhysicalProduct(
  product: Pick<Product, 'itemType'> | undefined,
): boolean {
  return product?.itemType !== 'service'
}

export function normalizeProductItemType(value: unknown): ProductItemType {
  return value === 'service' ? 'service' : 'product'
}

export function normalizeBasePrice(value: unknown): number {
  const amount = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(amount) || amount < 0) {
    return 0
  }

  return amount
}

export function normalizeProductRecord(value: unknown): Product | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const record = value as Record<string, unknown>
  if (
    typeof record.id !== 'string' ||
    typeof record.organizationId !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.sku !== 'string' ||
    typeof record.unit !== 'string' ||
    typeof record.status !== 'string' ||
    typeof record.createdAt !== 'string' ||
    typeof record.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    sku: record.sku,
    barcode: typeof record.barcode === 'string' ? record.barcode : undefined,
    description:
      typeof record.description === 'string' ? record.description : undefined,
    unit: record.unit,
    itemType: normalizeProductItemType(record.itemType),
    basePrice: normalizeBasePrice(record.basePrice),
    costPrice: normalizeBasePrice(record.costPrice),
    status: record.status === 'inactive' ? 'inactive' : 'active',
    categoryId:
      typeof record.categoryId === 'string' && record.categoryId
        ? record.categoryId
        : undefined,
    imageUrl: parseProductImageUrl(record.imageUrl) ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}
