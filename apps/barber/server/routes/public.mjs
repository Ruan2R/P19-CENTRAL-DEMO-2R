import { getBusinessClock, isValidDate } from '../domain/business-time.mjs'

const ERROR_DETAILS = {
  INVALID_CUSTOMER_NAME: [400, 'Informe seu nome completo ou pelo menos dois caracteres.'],
  INVALID_JSON: [400, 'Os dados enviados não estão em um formato válido.'],
  REQUEST_TOO_LARGE: [413, 'A solicitação enviada é muito grande.'],
  INVALID_ORIGIN: [403, 'Origem não autorizada. Atualize a página e tente novamente.'],
  INVALID_CUSTOMER_PHONE: [400, 'Informe um WhatsApp válido com DDD.'],
  INVALID_BOOKING_DATE: [400, 'Escolha uma data entre hoje e os próximos 60 dias.'],
  INVALID_BOOKING_ITEMS: [400, 'Selecione de 1 a 6 procedimentos para continuar.'],
  INVALID_AVAILABILITY_QUERY: [400, 'Informe serviço, profissional e uma data válida.'],
  INVALID_BOOKING_ITEM: [400, 'Revise os procedimentos, profissionais e horários escolhidos.'],
  INVALID_TIME: [400, 'Um dos horários escolhidos é inválido.'],
  INVALID_SERVICE_DURATION: [400, 'A duração de um dos serviços está inválida.'],
  INVALID_OPENING_HOURS: [400, 'O horário de funcionamento precisa ser revisado.'],
  INVALID_SLOT_INTERVAL: [400, 'A grade de horários está inválida.'],
  SERVICE_NOT_AVAILABLE: [404, 'Esse serviço não está mais disponível. Atualize a página e tente novamente.'],
  PROFESSIONAL_NOT_AVAILABLE: [404, 'Esse profissional não está disponível. Atualize a página e tente novamente.'],
  SLOT_TAKEN: [409, 'Esse horário acabou de ficar indisponível. Escolha outro horário.'],
  PROCEDURES_OVERLAP: [409, 'Os procedimentos do mesmo atendimento não podem ocupar horários sobrepostos. Ajuste os horários.'],
  CUSTOMER_NOT_FOUND: [500, 'Não foi possível concluir o cadastro do cliente. Tente novamente.'],
}

function errorResult(error) {
  const code = typeof error?.message === 'string' ? error.message : 'INTERNAL_ERROR'
  const [status, message] = ERROR_DETAILS[code] ?? [500, 'Não foi possível concluir a operação agora. Tente novamente.']
  if (status >= 500) console.error('[P15 API]', code, error?.stack || error)
  return { status, body: { error: code, message } }
}

export async function handlePublicRoute({ method, pathname, searchParams, isProduction, storage, readBody }) {
  if (method === 'GET' && pathname === '/api/health') {
    return { status: 200, body: { ok: true, project: 'P15-SISTEMA-BARBEARIA', stage: 'booking-core', storage: isProduction ? 'configured' : storage.mode } }
  }

  if (method === 'GET' && pathname === '/api/public/services') {
    return { status: 200, body: { services: await storage.getPublicServices(), source: isProduction ? 'database' : storage.mode === 'local-json' ? 'local-database' : 'database' } }
  }

  if (method === 'GET' && pathname === '/api/public/professionals') {
    return { status: 200, body: { professionals: await storage.getPublicProfessionals(), source: isProduction ? 'database' : storage.mode === 'local-json' ? 'local-database' : 'database' } }
  }

  if (method === 'GET' && pathname === '/api/public/promotions') {
    return { status: 200, body: await storage.getPublicPromotions() }
  }

  if (method === 'GET' && pathname === '/api/public/availability') {
    const serviceId = searchParams.get('serviceId') || ''
    const professionalId = searchParams.get('professionalId') || ''
    const date = searchParams.get('date') || ''
    if (!serviceId || !professionalId || !isValidDate(date)) {
      return { status: 400, body: { error: 'INVALID_AVAILABILITY_QUERY', message: 'Informe serviço, profissional e uma data válida.' } }
    }
    const clock = getBusinessClock()
    const requestedDate = new Date(`${date}T12:00:00Z`)
    const today = new Date(`${clock.date}T12:00:00Z`)
    const maxDate = new Date(`${clock.date}T12:00:00Z`)
    maxDate.setUTCDate(maxDate.getUTCDate() + 60)
    if (requestedDate < today || requestedDate > maxDate) {
      return { status: 400, body: { error: 'INVALID_BOOKING_DATE', message: 'Escolha uma data entre hoje e os próximos 60 dias.' } }
    }
    try {
      const availability = await storage.getAvailableSlots(serviceId, professionalId, date)
      return { status: 200, body: { date, ...availability, source: isProduction ? 'database' : storage.mode === 'local-json' ? 'local-database' : 'database' } }
    } catch (error) {
      return errorResult(error)
    }
  }

  if (method === 'POST' && pathname === '/api/public/booking-groups') {
    try {
      const booking = await storage.createBookingGroup(await readBody())
      return { status: 201, body: { booking } }
    } catch (error) {
      return errorResult(error)
    }
  }

  if (pathname.startsWith('/api/')) {
    return { status: 404, body: { error: 'NOT_FOUND', message: 'Esta rota ainda não foi implementada.' } }
  }
  return null
}
