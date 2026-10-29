import { assertNonNegativeCents, assertPositiveCents } from './money.mjs'

const PRODUCT_UNITS = new Set(['un', 'kg', 'g', 'l', 'ml', 'porcao'])
const PRODUCT_KINDS = new Set(['resale', 'prepared'])
const STOCK_MOVEMENT_DIRECTIONS = new Map([
  ['purchase', 1],
  ['return', 1],
  ['adjustment_in', 1],
  ['sale', -1],
  ['order_consumption', -1],
  ['adjustment_out', -1],
  ['waste', -1],
])

function toMilliUnits(value, code = 'INVALID_STOCK_QUANTITY') {
  const normal = typeof value === 'string' ? value.trim().replace(',', '.') : value
  const quantity = Number(normal)
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > Number.MAX_SAFE_INTEGER / 1000) throw new Error(code)
  const milli = Math.round((quantity + Number.EPSILON) * 1000)
  if (!Number.isSafeInteger(milli)) throw new Error(code)
  return milli
}

export function validateProduct(input) {
  const name = String(input?.name ?? '').trim()
  const category = String(input?.category ?? '').trim()
  const unit = input?.unit ?? 'un'
  const kind = input?.kind ?? 'resale'
  if (name.length < 2 || name.length > 120) throw new Error('INVALID_PRODUCT_NAME')
  if (category.length < 2 || category.length > 80) throw new Error('INVALID_PRODUCT_CATEGORY')
  if (!PRODUCT_UNITS.has(unit)) throw new Error('INVALID_PRODUCT_UNIT')
  if (!PRODUCT_KINDS.has(kind)) throw new Error('INVALID_PRODUCT_KIND')
  assertNonNegativeCents(input.costCents, 'INVALID_PRODUCT_COST')
  assertPositiveCents(input.priceCents, 'INVALID_PRODUCT_PRICE')
  // MVP stock tracking is intentionally simple: only ready-to-resell products
  // have a quantity. Made-to-order products use a manually estimated unit cost.
  // Ingredient recipes and automatic ingredient consumption are out of scope.
  const stockMilli = kind === 'prepared' ? 0 : toMilliUnits(input.stockQuantity, 'INVALID_PRODUCT_STOCK')
  const minimumMilli = kind === 'prepared' ? 0 : toMilliUnits(input.stockMinimum, 'INVALID_PRODUCT_STOCK_MINIMUM')
  return {
    name, category, unit, kind,
    stockTracked: kind !== 'prepared',
    sellable: true,
    costCents: input.costCents,
    priceCents: input.priceCents,
    stockMilli,
    minimumMilli,
  }
}

export function applyStockMovement(currentQuantity, movement) {
  const currentMilli = toMilliUnits(currentQuantity)
  if (!movement || !STOCK_MOVEMENT_DIRECTIONS.has(movement.type)) throw new Error('INVALID_STOCK_MOVEMENT_TYPE')
  const quantityMilli = toMilliUnits(movement.quantity, 'INVALID_STOCK_MOVEMENT_QUANTITY')
  if (quantityMilli <= 0) throw new Error('INVALID_STOCK_MOVEMENT_QUANTITY')
  const nextMilli = currentMilli + quantityMilli * STOCK_MOVEMENT_DIRECTIONS.get(movement.type)
  if (nextMilli < 0) throw new Error('INSUFFICIENT_STOCK')
  if (!Number.isSafeInteger(nextMilli)) throw new Error('INVALID_STOCK_QUANTITY')
  return nextMilli / 1000
}

export function calculateUnitGrossMargin({ costCents, priceCents }) {
  assertNonNegativeCents(costCents, 'INVALID_PRODUCT_COST')
  assertPositiveCents(priceCents, 'INVALID_PRODUCT_PRICE')
  const marginCents = priceCents - costCents
  return {
    marginCents,
    marginPercentOfPrice: Math.round((marginCents / priceCents) * 10000) / 100,
  }
}

export function isStockAtOrBelowMinimum({ stockQuantity, stockMinimum }) {
  return toMilliUnits(stockQuantity) <= toMilliUnits(stockMinimum)
}

export function assertUniqueStockSource(movements, sourceType, sourceId, productId, movementType) {
  if (!sourceId) return true
  if (movements.some((movement) => movement.sourceType === sourceType && movement.sourceId === sourceId && movement.productId === productId && movement.type === movementType)) {
    throw new Error('DUPLICATE_STOCK_SOURCE')
  }
  return true
}
