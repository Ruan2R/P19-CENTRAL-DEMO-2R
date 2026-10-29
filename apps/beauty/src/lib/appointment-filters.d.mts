import type { Appointment, AppointmentStatus } from '../types'

export type AppointmentListMode = 'upcoming' | 'pending' | 'all'
export type AppointmentPeriod = 'any' | 'today' | 'next7' | 'month' | 'custom'
export type AppointmentStatusFilter = AppointmentStatus | 'all'
export type AppointmentFilterOptions = {
  mode: AppointmentListMode
  search: string
  status: AppointmentStatusFilter
  period: AppointmentPeriod
  dateFrom: string
  dateTo: string
}

export declare function filterAppointments(
  appointments: Appointment[],
  options: AppointmentFilterOptions,
  now?: Date,
): Appointment[]
