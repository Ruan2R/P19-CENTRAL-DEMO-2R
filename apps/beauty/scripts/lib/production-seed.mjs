import { normalizeLocalDataset, validateLocalDataset } from './local-json-migration.mjs'

/**
 * Create an initial production dataset containing configuration only.
 * Test customers, reservations, blocks, promotions, financial movements and payables are omitted.
 * The source object is not mutated.
 */
export function createProductionSeed(raw) {
  const source = normalizeLocalDataset(raw)
  const sourceCounts = {
    services: source.services.length,
    business_hours: source.business_hours.length,
    business_policies: 1,
    date_blocks: source.date_blocks.length,
    customers: source.customers.length,
    promotions: source.promotions.length,
    appointments: source.appointments.length,
    financial_entries: source.financial_entries.length,
    payables: source.payables.length,
  }

  const seed = {
    schema_version: 1,
    services: structuredClone(source.services),
    business_hours: structuredClone(source.business_hours),
    business_policies: structuredClone(source.business_policies),
    date_blocks: [],
    appointments: [],
    customers: [],
    promotions: [],
    financial_entries: [],
    payables: [],
  }

  const validated = validateLocalDataset(seed)
  return {
    data: validated.data,
    sourceCounts,
    outputCounts: validated.counts,
  }
}
