export type Service = {
  id: string
  slug: string
  name: string
  category: string
  description: string
  duration_minutes: number
  price_cents: number
  deposit_percent: number
  active: boolean
}

export type PromotionItem = {
  service_id: string
  promotional_price_cents: number
  service_name?: string
  regular_price_cents?: number
}

export type Promotion = {
  id: string
  name: string
  starts_on: string
  ends_on: string
  active: boolean
  items: PromotionItem[]
  created_at: string
  updated_at: string
}

export type PromotionInput = {
  name: string
  starts_on: string
  ends_on: string
  active: boolean
  items: Array<{ service_id: string; promotional_price_cents: number }>
}

export type PublicPromotionPrice = {
  promotion_id: string
  promotion_name: string
  starts_on: string
  ends_on: string
  service_id: string
  service_name: string
  regular_price_cents: number
  promotional_price_cents: number
}

export type AppointmentStatus = 'pending_confirmation' | 'awaiting_deposit' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

export type Appointment = {
  id: string
  public_code: string
  customer_name: string
  customer_phone: string
  customer_note: string | null
  service_id: string
  promotion_id?: string | null
  promotion_name?: string | null
  starts_at: string
  ends_at: string
  price_cents: number
  regular_price_cents?: number | null
  deposit_cents: number
  deposit_required: boolean
  deposit_received: boolean
  deposit_reported: boolean
  policy_acknowledged: boolean
  status: AppointmentStatus
  created_at: string
  service?: Pick<Service, 'name' | 'category' | 'duration_minutes'>
  service_items?: Array<{ service_id: string; name: string; category: string; duration_minutes: number; price_cents: number; regular_price_cents: number; promotion_id?: string | null; promotion_name?: string | null }>
}


export type CustomerProfile = {
  id: string
  name: string
  phone: string
  require_deposit: boolean
  internal_note: string
  created_at: string
  updated_at: string
  appointment_count: number
  no_show_count: number
  last_appointment_at: string | null
}


export type FinancialDirection = 'income' | 'expense'
export type FinancialSource = 'manual' | 'appointment_deposit' | 'appointment_balance' | 'payable_payment'

export type FinancialEntry = {
  id: string
  direction: FinancialDirection
  description: string
  category: string
  amount_cents: number
  movement_date: string
  payment_method: string
  source_type: FinancialSource
  source_id: string | null
  related_appointment_id: string | null
  created_at: string
}

export type PayableStatus = 'pending' | 'paid'
export type Payable = {
  id: string
  description: string
  category: string
  amount_cents: number
  due_date: string
  status: PayableStatus
  paid_at: string | null
  expense_entry_id: string | null
  created_at: string
}

export type BusinessPolicy = {
  singleton: boolean
  lateness_tolerance_minutes: number
  cancellation_notice_hours: number
  companion_policy: string
  no_show_policy: string
  show_lateness_policy: boolean
  show_cancellation_policy: boolean
  show_companion_policy: boolean
  show_no_show_policy: boolean
  updated_at?: string
}

export type BusinessHour = {
  weekday: number
  start_time: string | null
  end_time: string | null
  break_start: string | null
  break_end: string | null
  enabled: boolean
}

export const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending_confirmation: 'Aguardando confirmação',
  awaiting_deposit: 'Aguardando sinal',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
}
