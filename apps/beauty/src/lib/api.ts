import type { Appointment, AppointmentStatus, BusinessHour, BusinessPolicy, CustomerProfile, FinancialEntry, Payable, Promotion, PromotionInput, PublicPromotionPrice, Service } from '../types'

export type StorageMode = 'local-json' | 'mysql'
export type AdminRole = 'owner' | 'studio_admin'
export type AdminIdentity = { loginId: string; displayName: string; role: AdminRole }

export class ApiError extends Error {
  code: string
  status: number

  constructor(message: string, code = 'API_ERROR', status = 500) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    })
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor local. Confira se o P18 está iniciado.', 'NETWORK_ERROR', 0)
  }

  const payload = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) {
    throw new ApiError(
      typeof payload.message === 'string' ? payload.message : 'Não foi possível concluir a operação.',
      typeof payload.error === 'string' ? payload.error : 'API_ERROR',
      response.status,
    )
  }
  return payload as T
}

export type HealthResponse = {
  ok: boolean
  storageMode: StorageMode
  persistentOnThisComputer: boolean
  published: boolean
}

export type CreatedBooking = {
  public_code: string
  price_cents: number
  deposit_cents: number
  deposit_required: boolean
  status: string
  starts_at: string
  regular_price_cents: number
  promotion_name: string | null
}

export type BookingInput = {
  serviceId: string
  serviceIds?: string[]
  date: string
  time: string
  customerName: string
  customerPhone: string
  customerNote: string
  captchaToken: string
  policyAcknowledged: boolean
}

export type AdminData = {
  appointments: Appointment[]
  services: Service[]
  promotions: Promotion[]
  hours: BusinessHour[]
  blocks: Array<{ id: string; blocked_date: string; start_time: string | null; end_time: string | null; note: string }>
  policies: BusinessPolicy
  customers: CustomerProfile[]
  financial_entries: FinancialEntry[]
  payables: Payable[]
}

export async function getHealth() {
  return request<HealthResponse>('/api/health')
}

export async function getPublicServices() {
  const result = await request<{ services: Service[] }>('/api/public/services')
  return result.services
}

export async function getPublicPromotions(date: string) {
  const query = new URLSearchParams({ date })
  const result = await request<{ promotions: PublicPromotionPrice[] }>(`/api/public/promotions?${query.toString()}`)
  return result.promotions
}

export async function getPublicPolicies() {
  const result = await request<{ policies: BusinessPolicy }>('/api/public/policies')
  return result.policies
}

export async function getAvailableSlots(serviceIdsInput: string | string[], date: string) {
  const query = new URLSearchParams({ date })
  if (Array.isArray(serviceIdsInput)) query.set('serviceIds', serviceIdsInput.join(','))
  else query.set('serviceId', serviceIdsInput)
  const result = await request<{ slots: string[] }>(`/api/public/slots?${query.toString()}`)
  return result.slots
}

export async function createPublicBooking(input: BookingInput) {
  const result = await request<{ booking: CreatedBooking }>('/api/public/bookings', { method: 'POST', body: JSON.stringify(input) })
  return result.booking
}

export async function reportPublicDepositPayment(publicCode: string, customerPhone: string) {
  return request<{ success: true; deposit_reported: true }>(`/api/public/bookings/${encodeURIComponent(publicCode)}/deposit-reported`, {
    method: 'POST',
    body: JSON.stringify({ customerPhone }),
  })
}

export async function getAdminSession() {
  return request<{ authenticated: boolean; loginId: string | null; displayName: string | null; role: AdminRole | null }>('/api/admin/session')
}

export async function loginAdmin(id: string, password: string) {
  return request<{ authenticated: true } & AdminIdentity>('/api/admin/login', { method: 'POST', body: JSON.stringify({ id, password }) })
}

export async function logoutAdmin() {
  return request<{ success: true }>('/api/admin/logout', { method: 'POST', body: '{}' })
}

export async function getAdminData() {
  return request<AdminData>('/api/admin/data')
}

export async function createAdminAppointment(input: { serviceId: string; serviceIds?: string[]; date: string; time: string; customerName: string; customerPhone: string; customerNote: string; allowMissingPhone?: boolean }) {
  const result = await request<{ booking: CreatedBooking }>('/api/admin/appointments', { method: 'POST', body: JSON.stringify(input) })
  return result.booking
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const result = await request<{ appointment: Appointment }>(`/api/admin/appointments/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
  return result.appointment
}

export type NewServiceInput = Pick<Service, 'name' | 'category' | 'description' | 'duration_minutes' | 'price_cents' | 'deposit_percent' | 'active'>

export async function createService(input: NewServiceInput) {
  const result = await request<{ service: Service }>('/api/admin/services', { method: 'POST', body: JSON.stringify(input) })
  return result.service
}

export async function deleteService(id: string) {
  return request<{ success: true }>(`/api/admin/services/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function updateService(service: Service) {
  const result = await request<{ service: Service }>(`/api/admin/services/${encodeURIComponent(service.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: service.name, category: service.category, description: service.description, duration_minutes: service.duration_minutes, price_cents: service.price_cents, deposit_percent: service.deposit_percent, active: service.active }),
  })
  return result.service
}

export async function createPromotion(input: PromotionInput) {
  const result = await request<{ promotion: Promotion }>('/api/admin/promotions', { method: 'POST', body: JSON.stringify(input) })
  return result.promotion
}

export async function updatePromotion(id: string, input: PromotionInput) {
  const result = await request<{ promotion: Promotion }>(`/api/admin/promotions/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) })
  return result.promotion
}


export async function createCustomer(input: { name: string; phone: string; require_deposit: boolean; internal_note: string }) {
  const result = await request<{ customer: CustomerProfile }>('/api/admin/customers', { method: 'POST', body: JSON.stringify(input) })
  return result.customer
}

export type ContactImportResult = { created: number; duplicates: number; invalid: number }

export async function importCustomers(contacts: Array<{ name: string; phone: string }>) {
  return request<ContactImportResult>('/api/admin/customers/import', {
    method: 'POST',
    body: JSON.stringify({ contacts }),
  })
}

export async function updateCustomer(customer: CustomerProfile) {
  const result = await request<{ customer: CustomerProfile }>(`/api/admin/customers/${encodeURIComponent(customer.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: customer.name, require_deposit: customer.require_deposit, internal_note: customer.internal_note }),
  })
  return result.customer
}

export async function saveBusinessHours(hours: BusinessHour[]) {
  const result = await request<{ hours: BusinessHour[] }>('/api/admin/hours', { method: 'PUT', body: JSON.stringify({ hours }) })
  return result.hours
}

export async function saveBusinessPolicies(policies: BusinessPolicy) {
  const result = await request<{ policies: BusinessPolicy }>('/api/admin/policies', { method: 'PUT', body: JSON.stringify(policies) })
  return result.policies
}

export async function createDateBlock(block: { blocked_date: string; start_time: string | null; end_time: string | null; note: string }) {
  const result = await request<{ block: AdminData['blocks'][number] }>('/api/admin/blocks', { method: 'POST', body: JSON.stringify(block) })
  return result.block
}

export async function removeDateBlock(id: string) {
  return request<{ success: true }>(`/api/admin/blocks/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function createFinancialEntry(input: { direction: 'income' | 'expense'; description: string; category: string; amount_cents: number; movement_date: string; payment_method: string }) {
  const result = await request<{ entry: FinancialEntry }>('/api/admin/finance/entries', { method: 'POST', body: JSON.stringify(input) })
  return result.entry
}

export async function deleteFinancialEntry(id: string) {
  return request<{ success: true }>(`/api/admin/finance/entries/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function receiveAppointmentBalance(appointmentId: string, paymentMethod: string) {
  return request<{ entry: FinancialEntry; already_received: boolean }>(`/api/admin/finance/appointments/${encodeURIComponent(appointmentId)}/receive-balance`, {
    method: 'POST',
    body: JSON.stringify({ payment_method: paymentMethod }),
  })
}

export async function createPayable(input: { description: string; category: string; amount_cents: number; due_date: string }) {
  const result = await request<{ payable: Payable }>('/api/admin/finance/payables', { method: 'POST', body: JSON.stringify(input) })
  return result.payable
}

export async function markPayablePaid(id: string) {
  const result = await request<{ payable: Payable; already_paid: boolean }>(`/api/admin/finance/payables/${encodeURIComponent(id)}/paid`, { method: 'POST', body: '{}' })
  return result
}

export async function deletePayable(id: string) {
  return request<{ success: true }>(`/api/admin/finance/payables/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
