import { isValidDate, localDateTimeToUtc } from './business-time.mjs'

function timeToMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value ?? ''))
  if (!match) return NaN
  const hours = Number(match[1]); const minutes = Number(match[2])
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : NaN
}

export function validatePromotionInput(payload = {}, { services = [], promotions = [], exceptId = null } = {}) {
  const name = String(payload.name ?? '').trim().replace(/\s+/g, ' ')
  const kind = String(payload.kind ?? '')
  const startsOn = String(payload.startsOn ?? payload.starts_on ?? '')
  const endsOn = String(payload.endsOn ?? payload.ends_on ?? '')
  const active = payload.active !== false
  const serviceIds = Array.isArray(payload.serviceIds ?? payload.service_ids)
    ? [...new Set((payload.serviceIds ?? payload.service_ids).map((value) => String(value ?? '').trim()).filter(Boolean))]
    : []
  const promoPriceCents = Number(payload.promoPriceCents ?? payload.promo_price_cents)

  if (name.length < 2 || name.length > 100) throw new Error('INVALID_PROMOTION_NAME')
  if (!['service', 'combo'].includes(kind)) throw new Error('INVALID_PROMOTION_KIND')
  if (!isValidDate(startsOn) || !isValidDate(endsOn) || endsOn < startsOn) throw new Error('INVALID_PROMOTION_DATES')
  if (kind === 'service' && serviceIds.length !== 1) throw new Error('INVALID_PROMOTION_SERVICES')
  if (kind === 'combo' && (serviceIds.length < 2 || serviceIds.length > 6)) throw new Error('INVALID_PROMOTION_SERVICES')
  if (!Number.isSafeInteger(promoPriceCents) || promoPriceCents <= 0) throw new Error('INVALID_PROMOTION_PRICE')

  const selectedServices = serviceIds.map((id) => services.find((service) => String(service.id) === id))
  if (selectedServices.some((service) => !service)) throw new Error('PROMOTION_SERVICE_NOT_FOUND')
  if (active && selectedServices.some((service) => !service.active)) throw new Error('PROMOTION_SERVICE_NOT_FOUND')
  const regularPriceCents = selectedServices.reduce((sum, service) => sum + Number(service.priceCents), 0)
  if (promoPriceCents >= regularPriceCents) throw new Error('INVALID_PROMOTION_PRICE')

  if (active) {
    const ids = new Set(serviceIds)
    const overlap = promotions.find((promotion) => {
      if (!promotion.active || String(promotion.id) === String(exceptId ?? '')) return false
      if (promotion.endsOn < startsOn || promotion.startsOn > endsOn) return false
      return (promotion.serviceIds ?? []).some((id) => ids.has(String(id)))
    })
    if (overlap) throw new Error('PROMOTION_SERVICE_CONFLICT')
  }

  return { name, kind, startsOn, endsOn, active, serviceIds, promoPriceCents }
}

export function formatPromotion(promotion, services = []) {
  const serviceById = new Map(services.map((service) => [String(service.id), service]))
  const serviceIds = (promotion.serviceIds ?? promotion.service_ids ?? []).map(String)
  return {
    id: String(promotion.id),
    name: String(promotion.name),
    kind: String(promotion.kind),
    startsOn: String(promotion.startsOn ?? promotion.starts_on).slice(0, 10),
    endsOn: String(promotion.endsOn ?? promotion.ends_on).slice(0, 10),
    active: Boolean(promotion.active),
    serviceIds,
    services: serviceIds.map((id) => {
      const service = serviceById.get(id)
      return { id, name: service?.name ?? 'Serviço indisponível', priceCents: Number(service?.priceCents ?? 0), active: Boolean(service?.active) }
    }),
    promoPriceCents: Number(promotion.promoPriceCents ?? promotion.promo_price_cents),
    createdAt: promotion.createdAt ?? promotion.created_at ?? null,
    updatedAt: promotion.updatedAt ?? promotion.updated_at ?? null,
  }
}

function allocateComboPrice(promoPriceCents, services) {
  const regularTotal = services.reduce((sum, service) => sum + Number(service.priceCents), 0)
  if (regularTotal <= 0) return services.map(() => 0)
  const result = services.map((service) => Math.floor(Number(promoPriceCents) * Number(service.priceCents) / regularTotal))
  let centsLeft = Number(promoPriceCents) - result.reduce((sum, cents) => sum + cents, 0)
  const remainders = services.map((service, index) => ({ index, remainder: (Number(promoPriceCents) * Number(service.priceCents)) % regularTotal }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (let index = 0; centsLeft > 0; index += 1, centsLeft -= 1) result[remainders[index % remainders.length].index] += 1
  return result
}

export function calculatePromotionalPricing(selectedServices, promotions, date) {
  const selected = selectedServices.map((service) => ({ ...service, id: String(service.id), priceCents: Number(service.priceCents) }))
  const selectedById = new Map(selected.map((service) => [service.id, service]))
  const prices = Object.fromEntries(selected.map((service) => [service.id, service.priceCents]))
  const promotionNames = {}
  const applicable = (promotions ?? []).filter((promotion) => promotion.active && promotion.startsOn <= date && promotion.endsOn >= date)
  const appliedPromotions = []

  for (const promotion of applicable) {
    const ids = (promotion.serviceIds ?? []).map(String)
    if (ids.some((id) => !selectedById.has(id))) continue
    const promoPriceCents = Number(promotion.promoPriceCents)
    const regular = ids.reduce((sum, id) => sum + selectedById.get(id).priceCents, 0)
    if (regular <= promoPriceCents || promoPriceCents <= 0) continue

    if (promotion.kind === 'service' && ids.length === 1) {
      prices[ids[0]] = promoPriceCents
      promotionNames[ids[0]] = promotion.name
    } else if (promotion.kind === 'combo' && ids.length >= 2) {
      const comboServices = ids.map((id) => selectedById.get(id))
      const allocated = allocateComboPrice(promoPriceCents, comboServices)
      ids.forEach((id, index) => {
        prices[id] = allocated[index]
        promotionNames[id] = promotion.name
      })
    } else continue

    appliedPromotions.push({ id: String(promotion.id), name: String(promotion.name), kind: promotion.kind, serviceIds: ids, discountCents: regular - promoPriceCents })
  }

  const baseTotalPriceCents = selected.reduce((sum, service) => sum + service.priceCents, 0)
  const totalPriceCents = selected.reduce((sum, service) => sum + Number(prices[service.id]), 0)
  return { prices, promotionNames, appliedPromotions, baseTotalPriceCents, totalPriceCents, discountCents: baseTotalPriceCents - totalPriceCents }
}

export function bookingGroupEndEpoch(group) {
  if (!group?.items?.length || !group.date) return null
  let latest = null
  for (const item of group.items) {
    const start = timeToMinutes(item.time)
    const end = start + Number(item.durationMinutes)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end >= 24 * 60) continue
    const endTime = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
    const epoch = localDateTimeToUtc(group.date, endTime).getTime()
    latest = latest == null ? epoch : Math.max(latest, epoch)
  }
  return latest
}

export function isBookingGroupReceivable(group, now = new Date()) {
  if (!group || !['confirmed', 'completed'].includes(group.status)) return false
  if (group.status === 'completed') return true
  const endsAt = bookingGroupEndEpoch(group)
  return Number.isFinite(endsAt) && endsAt <= now.getTime()
}
