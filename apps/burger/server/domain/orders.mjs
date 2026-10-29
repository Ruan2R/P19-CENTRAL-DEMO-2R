import { assertPositiveCents } from './money.mjs'

export const ORDER_STATUSES = Object.freeze(['received', 'preparing', 'ready', 'delivered', 'cancelled'])

const ALLOWED_TRANSITIONS = new Map([
  ['received', new Set(['preparing', 'cancelled'])],
  ['preparing', new Set(['ready', 'cancelled'])],
  ['ready', new Set(['delivered', 'cancelled'])],
  ['delivered', new Set()],
  ['cancelled', new Set()],
])

export function canTransitionOrderStatus(currentStatus, nextStatus) {
  return ALLOWED_TRANSITIONS.get(currentStatus)?.has(nextStatus) ?? false
}

export function transitionOrderStatus(order, nextStatus) {
  if (!order || typeof order !== 'object') throw new Error('ORDER_NOT_FOUND')
  if (!ORDER_STATUSES.includes(order.status) || !ORDER_STATUSES.includes(nextStatus)) throw new Error('INVALID_ORDER_STATUS')
  if (!canTransitionOrderStatus(order.status, nextStatus)) throw new Error('INVALID_ORDER_STATUS_TRANSITION')
  return { ...order, status: nextStatus }
}

export function validateOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('ORDER_REQUIRES_ITEMS')
  return items.map((item) => {
    const productId = String(item?.productId ?? '').trim()
    const name = String(item?.name ?? '').trim()
    const quantity = Number(item?.quantity)
    if (!productId) throw new Error('INVALID_ORDER_PRODUCT')
    if (name.length < 2 || name.length > 120) throw new Error('INVALID_ORDER_ITEM_NAME')
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) throw new Error('INVALID_ORDER_ITEM_QUANTITY')
    const quantityMilli = Math.round((quantity + Number.EPSILON) * 1000)
    if (!Number.isSafeInteger(quantityMilli) || quantityMilli <= 0) throw new Error('INVALID_ORDER_ITEM_QUANTITY')
    assertPositiveCents(item.unitPriceCents, 'INVALID_ORDER_ITEM_PRICE')
    const costCents = item.unitCostCents ?? 0
    if (!Number.isSafeInteger(costCents) || costCents < 0) throw new Error('INVALID_ORDER_ITEM_COST')
    return {
      productId,
      name,
      quantityMilli,
      unitPriceCents: item.unitPriceCents,
      unitCostCents: costCents,
      lineTotalCents: Math.round((quantityMilli / 1000) * item.unitPriceCents),
    }
  })
}

export function calculateOrderTotalCents(items) {
  const normalized = validateOrderItems(items)
  const total = normalized.reduce((sum, item) => sum + item.lineTotalCents, 0)
  if (!Number.isSafeInteger(total) || total <= 0) throw new Error('INVALID_ORDER_TOTAL')
  return total
}
