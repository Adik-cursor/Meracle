export function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function newId(): string {
  return crypto.randomUUID()
}

export function isPositiveQuantity(quantity: number): boolean {
  return Number.isFinite(quantity) && quantity > 0
}

export function isNonNegativeQuantity(quantity: number): boolean {
  return Number.isFinite(quantity) && quantity >= 0
}

export function isPositiveAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0
}
