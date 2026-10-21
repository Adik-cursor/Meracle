export function weightedAverageCost(
  currentQuantity: number,
  currentUnitCost: number,
  incomingQuantity: number,
  incomingUnitCost: number,
): number {
  const nextQuantity = currentQuantity + incomingQuantity
  if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
    return 0
  }

  const nextCost =
    (currentQuantity * currentUnitCost + incomingQuantity * incomingUnitCost) /
    nextQuantity

  if (!Number.isFinite(nextCost) || nextCost < 0) {
    return 0
  }

  return Math.round(nextCost * 100) / 100
}

export function lineCost(quantity: number, costPrice: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(costPrice)) {
    return 0
  }

  return Math.round(quantity * costPrice * 100) / 100
}
