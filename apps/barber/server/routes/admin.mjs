import { isValidDate } from '../domain/business-time.mjs'
import { validateFinanceMonth } from '../domain/admin-data-validation.mjs'

const VALID_ACTION_STATUSES = new Set(['cancelled', 'completed', 'no_show'])

function error(status, code, message) {
  return { status, body: { error: code, message } }
}

export async function handleAdminRoute({ method, pathname, searchParams, storage, session, readBody }) {
  if (method === 'GET' && pathname === '/api/admin/agenda') {
    const date = searchParams.get('date') || ''
    const professionalId = searchParams.get('professionalId') || 'all'
    const status = searchParams.get('status') || 'all'
    if (!isValidDate(date)) return error(400, 'INVALID_DATE', 'Escolha uma data válida para consultar a agenda.')
    if (!['all', 'confirmed', 'cancelled', 'completed', 'no_show'].includes(status)) return error(400, 'INVALID_STATUS_FILTER', 'O filtro de status não é válido.')
    try {
      const result = await storage.getAdminAgenda(date, { professionalId, status })
      return { status: 200, body: result }
    } catch (cause) {
      console.error('[P15 admin] agenda:', cause?.stack || cause)
      return error(500, 'ADMIN_AGENDA_ERROR', 'Não foi possível carregar a agenda. Tente novamente.')
    }
  }

  const statusMatch = pathname.match(/^\/api\/admin\/booking-groups\/([^/]+)\/status$/)
  if (method === 'PATCH' && statusMatch) {
    let payload
    try { payload = await readBody() } catch { return error(400, 'INVALID_JSON', 'Confira os dados enviados e tente novamente.') }
    const status = String(payload?.status ?? '')
    if (!VALID_ACTION_STATUSES.has(status)) return error(400, 'INVALID_STATUS', 'Selecione uma ação de atendimento válida.')
    try {
      const booking = await storage.updateBookingGroupStatus(decodeURIComponent(statusMatch[1]), status)
      return { status: 200, body: { booking } }
    } catch (cause) {
      if (cause?.message === 'BOOKING_GROUP_NOT_FOUND') return error(404, 'BOOKING_GROUP_NOT_FOUND', 'Esse atendimento não foi encontrado.')
      if (cause?.message === 'BOOKING_GROUP_NOT_ACTIONABLE') return error(409, 'BOOKING_GROUP_NOT_ACTIONABLE', 'Somente atendimentos confirmados podem receber essa alteração.')
      console.error('[P15 admin] alteração de status:', cause?.stack || cause)
      return error(500, 'ADMIN_STATUS_ERROR', 'Não foi possível atualizar o atendimento.')
    }
  }

  const whatsappMatch = pathname.match(/^\/api\/admin\/booking-groups\/([^/]+)\/whatsapp-confirmation$/)
  if (method === 'POST' && whatsappMatch) {
    try {
      const booking = await storage.markWhatsAppConfirmationSent(decodeURIComponent(whatsappMatch[1]), session.id)
      return { status: 200, body: { booking } }
    } catch (cause) {
      if (cause?.message === 'BOOKING_GROUP_NOT_FOUND') return error(404, 'BOOKING_GROUP_NOT_FOUND', 'Esse atendimento não foi encontrado.')
      if (cause?.message === 'BOOKING_GROUP_NOT_ACTIONABLE') return error(409, 'BOOKING_GROUP_NOT_ACTIONABLE', 'A confirmação via WhatsApp só pode ser registrada para um atendimento confirmado.')
      console.error('[P15 admin] confirmação WhatsApp:', cause?.stack || cause)
      return error(500, 'ADMIN_WHATSAPP_ERROR', 'Não foi possível registrar a confirmação enviada.')
    }
  }

  if (method === 'GET' && pathname === '/api/admin/booking-groups') {
    const filter = searchParams.get('filter') || 'upcoming'
    if (!['upcoming', 'pending', 'all'].includes(filter)) return error(400, 'INVALID_BOOKING_FILTER', 'O filtro de agendamentos não é válido.')
    try { return { status: 200, body: await storage.getAdminBookingGroups(filter) } }
    catch (cause) {
      console.error('[P15 admin] lista de agendamentos:', cause?.stack || cause)
      return error(500, 'ADMIN_BOOKING_LIST_ERROR', 'Não foi possível carregar os agendamentos.')
    }
  }

  if (method === 'GET' && pathname === '/api/admin/customers') {
    try { return { status: 200, body: await storage.getAdminCustomers(searchParams.get('search') || '') } }
    catch (cause) {
      console.error('[P15 admin] clientes:', cause?.stack || cause)
      return error(500, 'ADMIN_CUSTOMERS_ERROR', 'Não foi possível carregar os clientes.')
    }
  }

  const customerHistoryMatch = pathname.match(/^\/api\/admin\/customers\/([^/]+)\/history$/)
  if (method === 'GET' && customerHistoryMatch) {
    try { return { status: 200, body: await storage.getAdminCustomerHistory(decodeURIComponent(customerHistoryMatch[1])) } }
    catch (cause) { return adminDataError(cause) }
  }

  if (method === 'POST' && pathname === '/api/admin/customers') {
    let payload
    try { payload = await readBody() } catch { return error(400, 'INVALID_JSON', 'Confira os dados enviados e tente novamente.') }
    try { return { status: 201, body: { customer: await storage.createCustomer(payload) } } }
    catch (cause) { return adminDataError(cause) }
  }

  const customerMatch = pathname.match(/^\/api\/admin\/customers\/([^/]+)$/)
  if (method === 'PATCH' && customerMatch) {
    let payload
    try { payload = await readBody() } catch { return error(400, 'INVALID_JSON', 'Confira os dados enviados e tente novamente.') }
    try { return { status: 200, body: { customer: await storage.updateCustomer(decodeURIComponent(customerMatch[1]), payload) } } }
    catch (cause) { return adminDataError(cause) }
  }

  if (method === 'GET' && pathname === '/api/admin/promotions') {
    try { return { status: 200, body: await storage.getAdminPromotions() } }
    catch (cause) { return adminPromotionError(cause) }
  }

  if (method === 'POST' && pathname === '/api/admin/promotions') {
    let payload
    try { payload = await readBody() } catch { return error(400, 'INVALID_JSON', 'Confira os dados enviados e tente novamente.') }
    try { return { status: 201, body: { promotion: await storage.savePromotion(null, payload) } } }
    catch (cause) { return adminPromotionError(cause) }
  }

  const promotionMatch = pathname.match(/^\/api\/admin\/promotions\/([^/]+)$/)
  if (method === 'PATCH' && promotionMatch) {
    let payload
    try { payload = await readBody() } catch { return error(400, 'INVALID_JSON', 'Confira os dados enviados e tente novamente.') }
    try { return { status: 200, body: { promotion: await storage.savePromotion(decodeURIComponent(promotionMatch[1]), payload) } } }
    catch (cause) { return adminPromotionError(cause) }
  }

  if (method === 'GET' && pathname === '/api/admin/finance') {
    const month = searchParams.get('month') || ''
    try { validateFinanceMonth(month) }
    catch { return error(400, 'INVALID_FINANCE_MONTH', 'Escolha um mês válido para consultar o financeiro.') }
    try { return { status: 200, body: await storage.getAdminFinance(month) } }
    catch (cause) {
      console.error('[P15 admin] financeiro:', cause?.stack || cause)
      return error(500, 'ADMIN_FINANCE_ERROR', 'Não foi possível carregar o financeiro.')
    }
  }

  const bookingReceiptMatch = pathname.match(/^\/api\/admin\/finance\/booking-groups\/([^/]+)\/receipt$/)
  if (method === 'POST' && bookingReceiptMatch) {
    let payload
    try { payload = await readBody() } catch { return error(400, 'INVALID_JSON', 'Confira os dados enviados e tente novamente.') }
    try { return { status: 200, body: await storage.recordBookingReceipt(decodeURIComponent(bookingReceiptMatch[1]), payload.paymentMethod) } }
    catch (cause) {
      if (cause?.message === 'BOOKING_GROUP_NOT_FOUND') return error(404, 'BOOKING_GROUP_NOT_FOUND', 'Esse atendimento não foi encontrado.')
      if (cause?.message === 'BOOKING_RECEIPT_NOT_ELIGIBLE') return error(409, 'BOOKING_RECEIPT_NOT_ELIGIBLE', 'O atendimento ainda não está elegível para registrar recebimento. Confira o status e o horário previsto.')
      return adminDataError(cause)
    }
  }

  if (method === 'POST' && pathname === '/api/admin/finance/entries') {
    let payload
    try { payload = await readBody() } catch { return error(400, 'INVALID_JSON', 'Confira os dados enviados e tente novamente.') }
    try { return { status: 201, body: { entry: await storage.createFinancialEntry(payload) } } }
    catch (cause) { return adminDataError(cause) }
  }

  const financialEntryMatch = pathname.match(/^\/api\/admin\/finance\/entries\/([^/]+)$/)
  if (method === 'DELETE' && financialEntryMatch) {
    try { return { status: 200, body: await storage.deleteFinancialEntry(decodeURIComponent(financialEntryMatch[1])) } }
    catch (cause) { return adminDataError(cause) }
  }

  if (method === 'POST' && pathname === '/api/admin/finance/payables') {
    let payload
    try { payload = await readBody() } catch { return error(400, 'INVALID_JSON', 'Confira os dados enviados e tente novamente.') }
    try { return { status: 201, body: { payable: await storage.createPayable(payload) } } }
    catch (cause) { return adminDataError(cause) }
  }

  const payablePaidMatch = pathname.match(/^\/api\/admin\/finance\/payables\/([^/]+)\/paid$/)
  if (method === 'POST' && payablePaidMatch) {
    try { return { status: 200, body: await storage.markPayablePaid(decodeURIComponent(payablePaidMatch[1])) } }
    catch (cause) { return adminDataError(cause) }
  }

  const payableMatch = pathname.match(/^\/api\/admin\/finance\/payables\/([^/]+)$/)
  if (method === 'DELETE' && payableMatch) {
    try { return { status: 200, body: await storage.deletePayable(decodeURIComponent(payableMatch[1])) } }
    catch (cause) { return adminDataError(cause) }
  }

  if (method === 'GET' && pathname === '/api/admin/configuration') {
    const result = await storage.getAdminConfiguration()
    return { status: 200, body: result }
  }

  if (method === 'POST' && pathname === '/api/admin/services') {
    let payload
    try { payload = await readBody() } catch { return error(400, 'INVALID_JSON', 'Confira os dados enviados e tente novamente.') }
    try { return { status: 201, body: { service: await storage.createService(payload) } } }
    catch (cause) { return adminConfigError(cause) }
  }

  const serviceActiveMatch = pathname.match(/^\/api\/admin\/services\/([^/]+)\/active$/)
  if (method === 'PATCH' && serviceActiveMatch) {
    let payload
    try { payload = await readBody() } catch { return error(400, 'INVALID_JSON', 'Confira os dados enviados e tente novamente.') }
    if (typeof payload?.active !== 'boolean') return error(400, 'INVALID_ACTIVE_FLAG', 'Informe se o serviço ficará ativo ou inativo.')
    try { return { status: 200, body: { service: await storage.setServiceActive(decodeURIComponent(serviceActiveMatch[1]), payload.active) } } }
    catch (cause) { return adminConfigError(cause) }
  }

  const serviceMatch = pathname.match(/^\/api\/admin\/services\/([^/]+)$/)
  if (method === 'PATCH' && serviceMatch) {
    let payload
    try { payload = await readBody() } catch { return error(400, 'INVALID_JSON', 'Confira os dados enviados e tente novamente.') }
    try { return { status: 200, body: { service: await storage.updateService(decodeURIComponent(serviceMatch[1]), payload) } } }
    catch (cause) { return adminConfigError(cause) }
  }

  if (method === 'POST' && pathname === '/api/admin/professionals') {
    let payload
    try { payload = await readBody() } catch { return error(400, 'INVALID_JSON', 'Confira os dados enviados e tente novamente.') }
    try { return { status: 201, body: { professional: await storage.createProfessional(payload) } } }
    catch (cause) { return adminConfigError(cause) }
  }

  const professionalActiveMatch = pathname.match(/^\/api\/admin\/professionals\/([^/]+)\/active$/)
  if (method === 'PATCH' && professionalActiveMatch) {
    let payload
    try { payload = await readBody() } catch { return error(400, 'INVALID_JSON', 'Confira os dados enviados e tente novamente.') }
    if (typeof payload?.active !== 'boolean') return error(400, 'INVALID_ACTIVE_FLAG', 'Informe se o profissional ficará ativo ou inativo.')
    try { return { status: 200, body: { professional: await storage.setProfessionalActive(decodeURIComponent(professionalActiveMatch[1]), payload.active) } } }
    catch (cause) { return adminConfigError(cause) }
  }

  const professionalMatch = pathname.match(/^\/api\/admin\/professionals\/([^/]+)$/)
  if (method === 'PATCH' && professionalMatch) {
    let payload
    try { payload = await readBody() } catch { return error(400, 'INVALID_JSON', 'Confira os dados enviados e tente novamente.') }
    try { return { status: 200, body: { professional: await storage.updateProfessional(decodeURIComponent(professionalMatch[1]), payload) } } }
    catch (cause) { return adminConfigError(cause) }
  }

  const hoursMatch = pathname.match(/^\/api\/admin\/business-hours\/(\d)$/)
  if (method === 'PUT' && hoursMatch) {
    let payload
    try { payload = await readBody() } catch { return error(400, 'INVALID_JSON', 'Confira os dados enviados e tente novamente.') }
    try { return { status: 200, body: { hours: await storage.updateBusinessHours(hoursMatch[1], payload) } } }
    catch (cause) { return adminConfigError(cause) }
  }

  if (method === 'GET' && pathname === '/api/admin/blocks') {
    const date = searchParams.get('date') || ''
    if (!isValidDate(date)) return error(400, 'INVALID_DATE', 'Escolha uma data válida para consultar os bloqueios.')
    return { status: 200, body: { date, blocks: await storage.getAdminBlocks(date) } }
  }

  if (method === 'POST' && pathname === '/api/admin/blocks') {
    let payload
    try { payload = await readBody() } catch { return error(400, 'INVALID_JSON', 'Confira os dados enviados e tente novamente.') }
    try { return { status: 201, body: { block: await storage.createAdminBlock(payload) } } }
    catch (cause) { return adminConfigError(cause) }
  }

  const blockMatch = pathname.match(/^\/api\/admin\/blocks\/([^/]+)$/)
  if (method === 'DELETE' && blockMatch) {
    try { return { status: 200, body: { block: await storage.deleteAdminBlock(decodeURIComponent(blockMatch[1])) } } }
    catch (cause) { return adminConfigError(cause) }
  }

  return error(404, 'NOT_FOUND', 'Esta função administrativa ainda não foi implementada.')
}

function adminPromotionError(cause) {
  const code = String(cause?.message || '')
  const messages = {
    INVALID_PROMOTION_NAME: 'Informe um nome entre 2 e 100 caracteres.',
    INVALID_PROMOTION_KIND: 'Escolha promoção de serviço ou combo.',
    INVALID_PROMOTION_DATES: 'Confira as datas de início e término da promoção.',
    INVALID_PROMOTION_SERVICES: 'Uma promoção individual precisa de um serviço; um combo precisa de 2 a 6 serviços diferentes.',
    INVALID_PROMOTION_PRICE: 'O preço promocional precisa ser maior que zero e menor que o total normal dos serviços selecionados.',
    PROMOTION_SERVICE_NOT_FOUND: 'Um dos serviços selecionados não está ativo ou não existe mais.',
    PROMOTION_SERVICE_CONFLICT: 'Há outra promoção ativa para um destes serviços em período sobreposto.',
    PROMOTION_NOT_FOUND: 'A promoção não foi encontrada.',
  }
  const badRequest = new Set(['INVALID_PROMOTION_NAME','INVALID_PROMOTION_KIND','INVALID_PROMOTION_DATES','INVALID_PROMOTION_SERVICES','INVALID_PROMOTION_PRICE','PROMOTION_SERVICE_NOT_FOUND'])
  const status = badRequest.has(code) ? 400 : code === 'PROMOTION_NOT_FOUND' ? 404 : code === 'PROMOTION_SERVICE_CONFLICT' ? 409 : 500
  if (status === 500) console.error('[P15 admin promotions]', cause?.stack || cause)
  return error(status, code || 'ADMIN_PROMOTION_ERROR', messages[code] || 'Não foi possível salvar a promoção. Tente novamente.')
}

function adminDataError(cause) {
  const code = String(cause?.message || '')
  const messages = {
    INVALID_CUSTOMER_NAME: 'Informe um nome entre 2 e 100 caracteres.',
    INVALID_CUSTOMER_PHONE: 'Informe um WhatsApp válido com DDD.',
    CUSTOMER_PHONE_ALREADY_EXISTS: 'Já existe um cliente com esse WhatsApp. Pesquise pelo número para localizar o cadastro.',
    CUSTOMER_NOT_FOUND: 'O cadastro do cliente não foi encontrado.',
    INVALID_FINANCIAL_DIRECTION: 'Selecione entrada ou saída.',
    INVALID_FINANCIAL_DESCRIPTION: 'Informe uma descrição entre 2 e 120 caracteres.',
    INVALID_FINANCIAL_CATEGORY: 'Informe uma categoria entre 2 e 80 caracteres.',
    INVALID_FINANCIAL_AMOUNT: 'Informe um valor maior que zero.',
    INVALID_FINANCIAL_DATE: 'A data da movimentação deve ser válida e não pode estar no futuro.',
    INVALID_PAYMENT_METHOD: 'Selecione uma forma de pagamento válida.',
    BOOKING_RECEIPT_NOT_ELIGIBLE: 'O atendimento ainda não está elegível para registrar recebimento.',
    BOOKING_GROUP_NOT_FOUND: 'O atendimento não foi encontrado.',
    INVALID_PAYABLE_DESCRIPTION: 'Informe uma descrição entre 2 e 120 caracteres.',
    INVALID_PAYABLE_CATEGORY: 'Informe uma categoria entre 2 e 80 caracteres.',
    INVALID_PAYABLE_AMOUNT: 'Informe um valor maior que zero.',
    INVALID_PAYABLE_DUE_DATE: 'Informe uma data de vencimento válida.',
    INVALID_FINANCE_MONTH: 'Escolha um mês válido.',
    FINANCIAL_ENTRY_NOT_FOUND: 'A movimentação não foi encontrada.',
    FINANCIAL_ENTRY_PROTECTED: 'Movimentações geradas pelo sistema não podem ser excluídas manualmente.',
    PAYABLE_NOT_FOUND: 'A conta a pagar não foi encontrada.',
    PAID_PAYABLE_PROTECTED: 'Uma conta já paga não pode ser excluída.',
  }
  const badRequest = new Set(['INVALID_CUSTOMER_NAME','INVALID_CUSTOMER_PHONE','INVALID_FINANCIAL_DIRECTION','INVALID_FINANCIAL_DESCRIPTION','INVALID_FINANCIAL_CATEGORY','INVALID_FINANCIAL_AMOUNT','INVALID_FINANCIAL_DATE','INVALID_PAYMENT_METHOD','INVALID_PAYABLE_DESCRIPTION','INVALID_PAYABLE_CATEGORY','INVALID_PAYABLE_AMOUNT','INVALID_PAYABLE_DUE_DATE','INVALID_FINANCE_MONTH'])
  const notFound = new Set(['CUSTOMER_NOT_FOUND','FINANCIAL_ENTRY_NOT_FOUND','PAYABLE_NOT_FOUND','BOOKING_GROUP_NOT_FOUND'])
  const conflict = new Set(['CUSTOMER_PHONE_ALREADY_EXISTS','FINANCIAL_ENTRY_PROTECTED','PAID_PAYABLE_PROTECTED','BOOKING_RECEIPT_NOT_ELIGIBLE'])
  const status = badRequest.has(code) ? 400 : notFound.has(code) ? 404 : conflict.has(code) ? 409 : 500
  if (status >= 500) console.error('[P15 admin] dados administrativos:', cause?.stack || cause)
  return error(status, code || 'ADMIN_DATA_ERROR', messages[code] || 'Não foi possível concluir a operação administrativa.')
}

function adminConfigError(cause) {
  const code = String(cause?.message || '')
  const messages = {
    INVALID_SERVICE_NAME: 'Informe um nome de serviço entre 2 e 120 caracteres.',
    INVALID_SERVICE_DURATION: 'A duração deve ficar entre 5 e 240 minutos.',
    INVALID_SERVICE_PRICE: 'Informe um preço válido, de R$ 0,00 a R$ 10.000,00.',
    SERVICE_NOT_FOUND: 'O serviço não foi encontrado.',
    LAST_ACTIVE_SERVICE: 'Mantenha ao menos um serviço ativo.',
    INVALID_PROFESSIONAL_NAME: 'Informe um nome de profissional entre 2 e 100 caracteres.',
    INVALID_PROFESSIONAL_ROLE: 'Informe uma função entre 2 e 80 caracteres.',
    PROFESSIONAL_NOT_FOUND: 'O profissional não foi encontrado.',
    LAST_ACTIVE_PROFESSIONAL: 'Mantenha ao menos um profissional ativo.',
    INVALID_WEEKDAY: 'O dia da semana informado é inválido.',
    INVALID_BUSINESS_HOURS: 'Confira o horário de abertura e fechamento.',
    INVALID_BUSINESS_BREAK: 'O intervalo precisa ter início e fim e ficar dentro do funcionamento.',
    INVALID_BLOCK_DATE: 'Selecione hoje ou uma data futura válida.',
    INVALID_BLOCK_SCOPE: 'Selecione se o bloqueio será geral ou de um profissional.',
    INVALID_BLOCK_PROFESSIONAL: 'Selecione um profissional ativo para o bloqueio.',
    INVALID_BLOCK_RANGE: 'Informe início e fim válidos; para bloquear o dia inteiro, use um bloqueio geral sem horário.',
    BLOCK_CONFLICTS_WITH_BOOKING: 'Esse bloqueio conflita com um atendimento confirmado.',
    BLOCK_NOT_FOUND: 'O bloqueio não foi encontrado.',
  }
  const badRequest = new Set(['INVALID_SERVICE_NAME','INVALID_SERVICE_DURATION','INVALID_SERVICE_PRICE','INVALID_PROFESSIONAL_NAME','INVALID_PROFESSIONAL_ROLE','INVALID_WEEKDAY','INVALID_BUSINESS_HOURS','INVALID_BUSINESS_BREAK','INVALID_BLOCK_DATE','INVALID_BLOCK_PROFESSIONAL','INVALID_BLOCK_RANGE','INVALID_BLOCK_SCOPE'])
  const notFound = new Set(['SERVICE_NOT_FOUND','PROFESSIONAL_NOT_FOUND','BLOCK_NOT_FOUND'])
  const conflict = new Set(['LAST_ACTIVE_SERVICE','LAST_ACTIVE_PROFESSIONAL','BLOCK_CONFLICTS_WITH_BOOKING'])
  const status = badRequest.has(code) ? 400 : notFound.has(code) ? 404 : conflict.has(code) ? 409 : 500
  if (status === 500) console.error('[P15 admin config]', cause?.stack || cause)
  return error(status, code || 'ADMIN_CONFIGURATION_ERROR', messages[code] || 'Não foi possível salvar a configuração. Tente novamente.')
}
