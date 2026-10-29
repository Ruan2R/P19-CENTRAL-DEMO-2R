import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createStorage } from '../server/storage.mjs'
import { addDateDays, getStudioDate, getWeekday } from '../server/domain.mjs'

function hoursForDate(date, start = '09:00', end = '17:00') {
  const weekday = getWeekday(date)
  return Array.from({ length: 7 }, (_, index) => ({
    weekday: index, enabled: index === weekday,
    start_time: index === weekday ? start : null,
    end_time: index === weekday ? end : null,
    break_start: null, break_end: null,
  }))
}

test('fresh P18 local data starts without example services or configured working hours', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p18-empty-start-test-'))
  try {
    const store = await createStorage({ NODE_ENV: 'development' }, tempRoot)
    assert.deepEqual(await store.getPublicServices(), [])
    const adminData = await store.getAdminData()
    assert.equal(adminData.hours.some((hour) => hour.enabled), false)
    assert.equal(adminData.appointments.length, 0)
    assert.equal(adminData.customers.length, 0)
    assert.equal(adminData.financial_entries.length, 0)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('P18 clears only the untouched P17 example catalog in existing local data', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p18-clean-example-catalog-test-'))
  try {
    const oldStore = await createStorage({ NODE_ENV: 'development', P18_TEST_FIXTURES: 'true' }, tempRoot)
    assert.equal((await oldStore.getPublicServices()).length, 5)
    const anaStore = await createStorage({ NODE_ENV: 'development' }, tempRoot)
    assert.deepEqual(await anaStore.getPublicServices(), [])
    const adminData = await anaStore.getAdminData()
    assert.equal(adminData.appointments.length, 0)
    assert.equal(adminData.hours.some((hour) => hour.enabled), false)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('local JSON store persists services, schedule and refuses duplicate booking', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p14-storage-test-'))
  try {
    const store = await createStorage({ NODE_ENV: 'development', P18_TEST_FIXTURES: 'true' }, tempRoot)
    const services = await store.getPublicServices()
    assert.equal(services.length, 5)
    assert.equal(Object.hasOwn(services[0], 'deposit_required'), false, 'sinal obrigatório não deve ser configurado no serviço')
    const date = addDateDays(getStudioDate(), 2)
    await store.saveHours(hoursForDate(date))
    const slots = await store.getAvailableSlots(services[0].id, date)
    assert.ok(slots.includes('09:00'))
    const booking = await store.createBooking({ serviceId: services[0].id, date, time: '09:00', customerName: 'Cliente de Teste', customerPhone: '67999990000', customerNote: '', policyAcknowledged: true })
    assert.match(booking.public_code, /^[A-F0-9]{8}$/)
    assert.equal(booking.deposit_required, false, 'cliente comum não deve pagar sinal automaticamente')
    assert.equal(booking.deposit_cents, 0)
    await assert.rejects(store.createBooking({ serviceId: services[0].id, date, time: '09:00', customerName: 'Outra Cliente', customerPhone: '67999990001', customerNote: '', policyAcknowledged: true }), /SLOT_TAKEN/)
    const adminData = await store.getAdminData()
    assert.equal(adminData.appointments.length, 1)
    assert.equal(adminData.appointments[0].public_code, booking.public_code)
    assert.equal(adminData.customers.length, 1)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('deposit is individualized by customer phone and applies only to future bookings', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p14-customer-deposit-test-'))
  try {
    const store = await createStorage({ NODE_ENV: 'development', P18_TEST_FIXTURES: 'true' }, tempRoot)
    const [service] = await store.getPublicServices()
    await store.updateService(service.id, { ...service, deposit_percent: 30 })
    const date = addDateDays(getStudioDate(), 3)
    await store.saveHours(hoursForDate(date))

    const regularBooking = await store.createBooking({
      serviceId: service.id, date, time: '09:00', customerName: 'Cliente Regular',
      customerPhone: '67999990000', customerNote: '', policyAcknowledged: true,
    })
    assert.equal(regularBooking.deposit_required, false)

    const flaggedCustomer = await store.createCustomer({
      name: 'Cliente com sinal individual', phone: '+55 (67) 98888-0000',
      require_deposit: true, internal_note: 'Cadastro de teste; informação interna.',
    })
    assert.equal(flaggedCustomer.phone, '67988880000')
    assert.equal(flaggedCustomer.require_deposit, true)
    await assert.rejects(store.createCustomer({ name: 'Duplicada', phone: '67988880000' }), /CUSTOMER_PHONE_ALREADY_EXISTS/)

    const flaggedBooking = await store.createBooking({
      serviceId: service.id, date, time: '10:30', customerName: 'Cliente com sinal individual',
      customerPhone: '(67) 98888-0000', customerNote: '', policyAcknowledged: true,
    })
    assert.equal(flaggedBooking.deposit_required, true)
    assert.equal(flaggedBooking.deposit_cents, 3600)
    assert.equal(flaggedBooking.status, 'awaiting_deposit')

    await store.updateCustomer(flaggedCustomer.id, { require_deposit: false })
    const nextBooking = await store.createBooking({
      serviceId: service.id, date, time: '12:00', customerName: 'Cliente com sinal individual',
      customerPhone: '67988880000', customerNote: '', policyAcknowledged: true,
    })
    assert.equal(nextBooking.deposit_required, false, 'desativar o sinal deve afetar somente as próximas reservas')
    assert.equal(nextBooking.deposit_cents, 0)
    assert.equal(flaggedBooking.deposit_required, true, 'uma reserva já criada mantém sua própria condição')

    const regularProfile = (await store.getAdminData()).customers.find((customer) => customer.phone === '67999990000')
    const adminAppointments = await store.getAdminData()
    const regularAppointment = adminAppointments.appointments.find((appointment) => appointment.public_code === regularBooking.public_code)
    await store.updateAppointmentStatus(regularAppointment.id, 'no_show')
    const refreshedRegular = (await store.getAdminData()).customers.find((customer) => customer.id === regularProfile.id)
    assert.equal(refreshedRegular.no_show_count, 1, 'histórico deve refletir faltas marcadas no painel')
    assert.equal(refreshedRegular.appointment_count, 1)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})


test('public bookings create a customer profile automatically and reuse it by normalized phone', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p14-auto-customer-test-'))
  try {
    const store = await createStorage({ NODE_ENV: 'development', P18_TEST_FIXTURES: 'true' }, tempRoot)
    const [service] = await store.getPublicServices()
    const date = addDateDays(getStudioDate(), 4)
    await store.saveHours(hoursForDate(date))

    await store.createBooking({
      serviceId: service.id, date, time: '09:00', customerName: 'Cliente Automática',
      customerPhone: '(67) 99999-1234', customerNote: '', policyAcknowledged: true,
    })
    let data = await store.getAdminData()
    assert.equal(data.customers.length, 1)
    assert.equal(data.customers[0].name, 'Cliente Automática')
    assert.equal(data.customers[0].phone, '67999991234', 'storage keeps the phone normalized as digits')

    await store.createBooking({
      serviceId: service.id, date, time: '10:30', customerName: 'Nome digitado novamente',
      customerPhone: '+55 (67) 99999-1234', customerNote: '', policyAcknowledged: true,
    })
    data = await store.getAdminData()
    assert.equal(data.customers.length, 1, 'same phone should not create duplicate customer profiles')
    assert.equal(data.customers[0].appointment_count, 2)
    assert.equal(data.appointments.length, 2)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('customer Pix report does not confirm automatically; selecting Confirmado records payment verification', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p14-pix-report-test-'))
  try {
    const store = await createStorage({ NODE_ENV: 'development', P18_TEST_FIXTURES: 'true' }, tempRoot)
    const [service] = await store.getPublicServices()
    await store.updateService(service.id, { ...service, deposit_percent: 30 })
    const date = addDateDays(getStudioDate(), 5)
    await store.saveHours(hoursForDate(date))
    await store.createCustomer({
      name: 'Cliente com sinal', phone: '(67) 98888-1122', require_deposit: true,
      internal_note: 'Conta fictícia para teste do Pix.',
    })
    const booking = await store.createBooking({
      serviceId: service.id, date, time: '09:00', customerName: 'Cliente com sinal',
      customerPhone: '67988881122', customerNote: '', policyAcknowledged: true,
    })
    assert.equal(booking.deposit_required, true)
    assert.equal(booking.status, 'awaiting_deposit')

    await assert.rejects(
      store.reportDepositPayment(booking.public_code, '67999990000'),
      /APPOINTMENT_NOT_FOUND/,
      'the booking code must also match the customer phone',
    )

    const report = await store.reportDepositPayment(booking.public_code, '(67) 98888-1122')
    assert.equal(report.success, true)
    assert.equal(report.deposit_reported, true)

    let adminData = await store.getAdminData()
    let savedBooking = adminData.appointments.find((item) => item.public_code === booking.public_code)
    assert.equal(savedBooking.deposit_reported, true)
    assert.equal(savedBooking.deposit_received, false, 'a customer report must not be treated as verified money')
    assert.equal(savedBooking.status, 'awaiting_deposit')

    // A single admin action is enough: after checking Pix, choosing Confirmado
    // records the required deposit as received and confirms the appointment.
    await store.updateAppointmentStatus(savedBooking.id, 'confirmed')
    adminData = await store.getAdminData()
    savedBooking = adminData.appointments.find((item) => item.public_code === booking.public_code)
    assert.equal(savedBooking.deposit_reported, true, 'the customer report remains in the record for audit context')
    assert.equal(savedBooking.deposit_received, true, 'the admin confirmation also records that the required deposit was checked and received')
    assert.equal(savedBooking.status, 'confirmed')
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})


test('admin can confirm a deposit-required booking with one status action after independently checking Pix', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p14-one-step-confirm-test-'))
  try {
    const store = await createStorage({ NODE_ENV: 'development', P18_TEST_FIXTURES: 'true' }, tempRoot)
    const [service] = await store.getPublicServices()
    await store.updateService(service.id, { ...service, deposit_percent: 30 })
    const date = addDateDays(getStudioDate(), 6)
    await store.saveHours(hoursForDate(date))
    await store.createCustomer({
      name: 'Cliente Pix Conferido', phone: '67988881123', require_deposit: true,
      internal_note: 'Reserva fictícia para validar confirmação em uma ação.',
    })
    const booking = await store.createBooking({
      serviceId: service.id, date, time: '09:00', customerName: 'Cliente Pix Conferido',
      customerPhone: '67988881123', customerNote: '', policyAcknowledged: true,
    })
    assert.equal(booking.deposit_required, true)
    assert.equal(Boolean(booking.deposit_received), false)
    assert.equal(Boolean(booking.deposit_reported), false, 'a cliente não precisa clicar em Já fiz o Pix se a Fer conferiu diretamente')

    const beforeConfirmation = await store.getAdminData()
    const adminBooking = beforeConfirmation.appointments.find((item) => item.public_code === booking.public_code)
    assert.ok(adminBooking, 'booking should be available to the admin panel')

    const confirmed = await store.updateAppointmentStatus(adminBooking.id, 'confirmed')
    assert.equal(confirmed.status, 'confirmed')
    assert.equal(confirmed.deposit_received, true, 'Confirmado registra que a Fer conferiu o sinal')
    const data = await store.getAdminData()
    const saved = data.appointments.find((item) => item.public_code === booking.public_code)
    assert.equal(saved.deposit_received, true)
    assert.equal(saved.status, 'confirmed')
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('financial entries validate values and payable payment is recorded exactly once', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p14-finance-test-'))
  try {
    const store = await createStorage({ NODE_ENV: 'development', P18_TEST_FIXTURES: 'true' }, tempRoot)
    const today = getStudioDate()
    const income = await store.createFinancialEntry({
      direction: 'income', description: 'Atendimento recebido', category: 'Atendimento',
      amount_cents: 12500, movement_date: today, payment_method: 'Pix',
    })
    assert.equal(income.direction, 'income')
    assert.equal(income.amount_cents, 12500)
    await assert.rejects(store.createFinancialEntry({ direction: 'expense', description: 'Inválida', category: 'Teste', amount_cents: 0, movement_date: today }), /INVALID_FINANCIAL_AMOUNT/)

    const payable = await store.createPayable({ description: 'Compra de materiais', category: 'Materiais', amount_cents: 4500, due_date: today })
    assert.equal(payable.status, 'pending')
    assert.equal(payable.amount_cents, 4500)
    const first = await store.markPayablePaid(payable.id)
    assert.equal(first.already_paid, false)
    assert.equal(first.payable.status, 'paid')
    assert.equal(first.entry.direction, 'expense')
    assert.equal(first.entry.source_type, 'payable_payment')
    const second = await store.markPayablePaid(payable.id)
    assert.equal(second.already_paid, true)
    const data = await store.getAdminData()
    assert.equal(data.financial_entries.filter((entry) => entry.source_type === 'payable_payment' && entry.source_id === payable.id).length, 1)
    assert.equal(data.payables.find((item) => item.id === payable.id).status, 'paid')
    await assert.rejects(store.deletePayable(payable.id), /PAID_PAYABLE_PROTECTED/)
    assert.equal(await store.deleteFinancialEntry(income.id).then((result) => result.success), true)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('confirming an appointment with required deposit records the signal as income only once', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p14-finance-deposit-test-'))
  try {
    const store = await createStorage({ NODE_ENV: 'development', P18_TEST_FIXTURES: 'true' }, tempRoot)
    const [service] = await store.getPublicServices()
    await store.updateService(service.id, { ...service, deposit_percent: 30 })
    const date = addDateDays(getStudioDate(), 7)
    await store.saveHours(hoursForDate(date))
    await store.createCustomer({ name: 'Cliente com sinal financeiro', phone: '67988887766', require_deposit: true, internal_note: '' })
    const booking = await store.createBooking({ serviceId: service.id, date, time: '09:00', customerName: 'Cliente com sinal financeiro', customerPhone: '67988887766', customerNote: '', policyAcknowledged: true })
    let data = await store.getAdminData()
    const appointment = data.appointments.find((item) => item.public_code === booking.public_code)
    await store.updateAppointmentStatus(appointment.id, 'confirmed')
    await store.updateAppointmentStatus(appointment.id, 'confirmed')
    data = await store.getAdminData()
    const entries = data.financial_entries.filter((entry) => entry.source_type === 'appointment_deposit' && entry.source_id === appointment.id)
    assert.equal(entries.length, 1)
    assert.equal(entries[0].direction, 'income')
    assert.equal(entries[0].amount_cents, booking.deposit_cents)
    assert.equal(entries[0].payment_method, 'Pix')
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})


test('appointment receivables show the signal and register only the remaining balance once', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p14-appointment-balance-test-'))
  try {
    const store = await createStorage({ NODE_ENV: 'development', P18_TEST_FIXTURES: 'true' }, tempRoot)
    const [service] = await store.getPublicServices()
    await store.updateService(service.id, { ...service, deposit_percent: 30 })
    const date = addDateDays(getStudioDate(), 8)
    await store.saveHours(hoursForDate(date))
    await store.createCustomer({ name: 'Cliente com sinal e saldo', phone: '67988887761', require_deposit: true, internal_note: '' })
    const booking = await store.createBooking({ serviceId: service.id, date, time: '09:00', customerName: 'Cliente com sinal e saldo', customerPhone: '67988887761', customerNote: '', policyAcknowledged: true })
    const initialData = await store.getAdminData()
    const appointment = initialData.appointments.find((item) => item.public_code === booking.public_code)
    await store.updateAppointmentStatus(appointment.id, 'confirmed')

    let data = await store.getAdminData()
    const depositEntries = data.financial_entries.filter((entry) => entry.source_type === 'appointment_deposit' && entry.related_appointment_id === appointment.id)
    assert.equal(depositEntries.length, 1)
    assert.equal(depositEntries[0].amount_cents, booking.deposit_cents)

    const savedAppointment = store.data.appointments.find((item) => item.id === appointment.id)
    savedAppointment.ends_at = new Date(Date.now() - 60_000).toISOString()
    await store.persist()

    const remaining = await store.receiveAppointmentBalance(appointment.id, 'Dinheiro')
    assert.equal(remaining.already_received, false)
    assert.equal(remaining.entry.source_type, 'appointment_balance')
    assert.equal(remaining.entry.related_appointment_id, appointment.id)
    assert.equal(remaining.entry.amount_cents, booking.price_cents - booking.deposit_cents)
    assert.equal(remaining.entry.payment_method, 'Dinheiro')

    const duplicate = await store.receiveAppointmentBalance(appointment.id, 'Pix')
    assert.equal(duplicate.already_received, true)
    assert.equal(duplicate.entry.id, remaining.entry.id, 'repeated action must return the existing balance entry')

    data = await store.getAdminData()
    const appointmentEntries = data.financial_entries.filter((entry) => entry.related_appointment_id === appointment.id && ['appointment_deposit', 'appointment_balance'].includes(entry.source_type))
    assert.equal(appointmentEntries.length, 2)
    assert.equal(appointmentEntries.reduce((total, entry) => total + entry.amount_cents, 0), booking.price_cents)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('appointment without signal becomes a receivable for the full value, but cannot be settled before the scheduled end', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p14-full-appointment-receivable-test-'))
  try {
    const store = await createStorage({ NODE_ENV: 'development', P18_TEST_FIXTURES: 'true' }, tempRoot)
    const [service] = await store.getPublicServices()
    const date = addDateDays(getStudioDate(), 9)
    await store.saveHours(hoursForDate(date))
    const booking = await store.createBooking({ serviceId: service.id, date, time: '09:00', customerName: 'Cliente sem sinal', customerPhone: '67988887762', customerNote: '', policyAcknowledged: true })
    const data = await store.getAdminData()
    const appointment = data.appointments.find((item) => item.public_code === booking.public_code)
    await store.updateAppointmentStatus(appointment.id, 'confirmed')
    await assert.rejects(store.receiveAppointmentBalance(appointment.id, 'Pix'), /APPOINTMENT_NOT_FINISHED/)

    const savedAppointment = store.data.appointments.find((item) => item.id === appointment.id)
    savedAppointment.ends_at = new Date(Date.now() - 60_000).toISOString()
    await store.persist()
    const payment = await store.receiveAppointmentBalance(appointment.id, 'Pix')
    assert.equal(payment.entry.amount_cents, booking.price_cents)
    assert.equal(payment.entry.source_type, 'appointment_balance')

    const secondDate = addDateDays(getStudioDate(), 10)
    await store.saveHours(hoursForDate(secondDate))
    const cancelledBooking = await store.createBooking({ serviceId: service.id, date: secondDate, time: '09:00', customerName: 'Cliente cancelada', customerPhone: '67988887763', customerNote: '', policyAcknowledged: true })
    const afterCancelData = await store.getAdminData()
    const cancelledAppointment = afterCancelData.appointments.find((item) => item.public_code === cancelledBooking.public_code)
    const cancelledSaved = store.data.appointments.find((item) => item.id === cancelledAppointment.id)
    cancelledSaved.ends_at = new Date(Date.now() - 60_000).toISOString()
    await store.persist()
    await store.updateAppointmentStatus(cancelledAppointment.id, 'cancelled')
    await assert.rejects(store.receiveAppointmentBalance(cancelledAppointment.id, 'Pix'), /APPOINTMENT_NOT_FINISHED/)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})


test('explicit completion makes a no-signal balance receivable; signal appointments cannot be completed before the signal is confirmed', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p14-completed-balance-test-'))
  try {
    const store = await createStorage({ NODE_ENV: 'development', P18_TEST_FIXTURES: 'true' }, tempRoot)
    const [service] = await store.getPublicServices()
    await store.updateService(service.id, { ...service, deposit_percent: 30 })
    const date = addDateDays(getStudioDate(), 11)
    await store.saveHours(hoursForDate(date))
    const booking = await store.createBooking({ serviceId: service.id, date, time: '09:00', customerName: 'Cliente concluída', customerPhone: '67988887764', customerNote: '', policyAcknowledged: true })
    const before = await store.getAdminData()
    const appointment = before.appointments.find((item) => item.public_code === booking.public_code)
    await assert.rejects(store.updateAppointmentStatus(appointment.id, 'completed'), /APPOINTMENT_NOT_CONFIRMED/)
    await store.updateAppointmentStatus(appointment.id, 'confirmed')
    await store.updateAppointmentStatus(appointment.id, 'completed')
    const received = await store.receiveAppointmentBalance(appointment.id, 'Pix')
    assert.equal(received.entry.amount_cents, booking.price_cents)

    const nextDate = addDateDays(getStudioDate(), 12)
    await store.saveHours(hoursForDate(nextDate))
    await store.createCustomer({ name: 'Cliente com sinal pendente', phone: '67988887765', require_deposit: true, internal_note: '' })
    const withDeposit = await store.createBooking({ serviceId: service.id, date: nextDate, time: '09:00', customerName: 'Cliente com sinal pendente', customerPhone: '67988887765', customerNote: '', policyAcknowledged: true })
    const after = await store.getAdminData()
    const depositAppointment = after.appointments.find((item) => item.public_code === withDeposit.public_code)
    await assert.rejects(store.updateAppointmentStatus(depositAppointment.id, 'completed'), /DEPOSIT_NOT_CONFIRMED/)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('promotion price applies by appointment date and is snapshotted on the booking', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p14-promotions-test-'))
  try {
    const store = await createStorage({ NODE_ENV: 'development', P18_TEST_FIXTURES: 'true' }, tempRoot)
    const [service] = await store.getPublicServices()
    await store.updateService(service.id, { ...service, deposit_percent: 30 })
    const promotionDate = addDateDays(getStudioDate(), 3)
    const outsideDate = addDateDays(promotionDate, 7)
    await store.saveHours(hoursForDate(promotionDate))

    const promotion = await store.createPromotion({
      name: 'Promo da semana', starts_on: promotionDate, ends_on: promotionDate, active: true,
      items: [{ service_id: service.id, promotional_price_cents: 10000 }],
    })
    assert.equal(promotion.name, 'Promo da semana')
    assert.equal(promotion.items[0].regular_price_cents, service.price_cents)
    assert.equal((await store.getPublicPromotions(promotionDate)).length, 1)
    assert.equal((await store.getPublicPromotions(outsideDate)).length, 0, 'a oferta só vale para a data do atendimento dentro do período')

    const flaggedCustomer = await store.createCustomer({
      name: 'Cliente da promoção', phone: '67988887777', require_deposit: true, internal_note: '',
    })
    assert.equal(flaggedCustomer.require_deposit, true)
    const discountedBooking = await store.createBooking({
      serviceId: service.id, date: promotionDate, time: '09:00', customerName: 'Cliente da promoção',
      customerPhone: '67988887777', customerNote: '', policyAcknowledged: true,
    })
    assert.equal(discountedBooking.price_cents, 10000)
    assert.equal(discountedBooking.regular_price_cents, service.price_cents)
    assert.equal(discountedBooking.promotion_name, 'Promo da semana')
    assert.equal(discountedBooking.deposit_cents, 3000, 'o sinal deve usar o valor promocional')

    const regularBooking = await store.createBooking({
      serviceId: service.id, date: outsideDate, time: '09:00', customerName: 'Cliente sem promoção',
      customerPhone: '67988887778', customerNote: '', policyAcknowledged: true,
    })
    assert.equal(regularBooking.price_cents, service.price_cents)
    assert.equal(regularBooking.promotion_name, null)

    const adminData = await store.getAdminData()
    const savedDiscountedBooking = adminData.appointments.find((item) => item.public_code === discountedBooking.public_code)
    assert.equal(savedDiscountedBooking.price_cents, 10000)
    assert.equal(savedDiscountedBooking.regular_price_cents, service.price_cents)
    assert.equal(savedDiscountedBooking.promotion_name, 'Promo da semana')

    await store.updatePromotion(promotion.id, {
      name: promotion.name, starts_on: promotionDate, ends_on: promotionDate, active: false,
      items: [{ service_id: service.id, promotional_price_cents: 10000 }],
    })
    const stillSnapshotted = (await store.getAdminData()).appointments.find((item) => item.public_code === discountedBooking.public_code)
    assert.equal(stillSnapshotted.price_cents, 10000, 'pausar a campanha não deve alterar uma reserva existente')
    assert.equal(stillSnapshotted.promotion_name, 'Promo da semana')
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('active promotions cannot overlap for the same service and date range', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p14-promotion-conflict-test-'))
  try {
    const store = await createStorage({ NODE_ENV: 'development', P18_TEST_FIXTURES: 'true' }, tempRoot)
    const [service] = await store.getPublicServices()
    const start = addDateDays(getStudioDate(), 3)
    const end = addDateDays(start, 4)
    const input = { name: 'Campanha A', starts_on: start, ends_on: end, active: true, items: [{ service_id: service.id, promotional_price_cents: 10000 }] }
    await store.createPromotion(input)
    await assert.rejects(store.createPromotion({ ...input, name: 'Campanha B', starts_on: addDateDays(start, 2), ends_on: addDateDays(end, 2) }), /PROMOTION_SERVICE_DATE_CONFLICT/)
    const paused = await store.createPromotion({ ...input, name: 'Campanha pausada', active: false })
    assert.equal(paused.active, false, 'campanhas pausadas podem manter histórico sobreposto sem afetar o site')
    await assert.rejects(store.createPromotion({ ...input, name: 'Preço igual ao normal', items: [{ service_id: service.id, promotional_price_cents: service.price_cents }] }), /INVALID_PROMOTION_PRICE/)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})


test('admin-created appointments do not claim that the customer accepted public policies', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p17-admin-booking-test-'))
  try {
    const store = await createStorage({ NODE_ENV: 'development', P18_TEST_FIXTURES: 'true' }, tempRoot)
    const [service] = await store.getPublicServices()
    const date = addDateDays(getStudioDate(), 2)
    await store.saveHours(hoursForDate(date))
    const booking = await store.createBooking({
      serviceId: service.id, date, time: '09:00', customerName: 'aNA sOUZA',
      customerPhone: '(67) 99999-0000', customerNote: '', policyAcknowledged: false,
    }, { adminCreated: true })
    const saved = (await store.getAdminData()).appointments.find((item) => item.public_code === booking.public_code)
    assert.equal(saved.customer_name, 'Ana Souza')
    assert.equal(saved.policy_acknowledged, false)
    assert.equal(saved.policy_acknowledged_at, null)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('public bookings do not require or record consent when all public policy notices are disabled', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p17-optional-guidelines-test-'))
  try {
    const store = await createStorage({ NODE_ENV: 'development', P18_TEST_FIXTURES: 'true' }, tempRoot)
    const [service] = await store.getPublicServices()
    const date = addDateDays(getStudioDate(), 3)
    await store.saveHours(hoursForDate(date))
    const policies = await store.getPolicies()
    assert.equal(policies.show_lateness_policy, false)
    assert.equal(policies.show_cancellation_policy, false)
    assert.equal(policies.show_companion_policy, false)
    assert.equal(policies.show_no_show_policy, false)

    const booking = await store.createBooking({
      serviceId: service.id, date, time: '09:00', customerName: 'Ana Souza',
      customerPhone: '67999990002', customerNote: '', policyAcknowledged: false,
    })
    const saved = (await store.getAdminData()).appointments.find((item) => item.public_code === booking.public_code)
    assert.equal(saved.policy_acknowledged, false)
    assert.equal(saved.policy_acknowledged_at, null)

    await store.savePolicies({ ...policies, show_lateness_policy: true })
    await assert.rejects(store.createBooking({
      serviceId: service.id, date, time: '10:45', customerName: 'Maria Souza',
      customerPhone: '67999990003', customerNote: '', policyAcknowledged: false,
    }), /POLICY_ACKNOWLEDGEMENT_REQUIRED/)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('services can be added and deleted while services with appointment history are protected', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p17-service-crud-test-'))
  try {
    const store = await createStorage({ NODE_ENV: 'development', P18_TEST_FIXTURES: 'true' }, tempRoot)
    const initial = await store.getPublicServices()
    const created = await store.createService({
      name: 'Henna de Sobrancelhas', category: 'Sobrancelhas', description: 'Teste de cadastro.',
      duration_minutes: 25, price_cents: 3500, deposit_percent: 0, active: true,
    })
    assert.equal(created.slug, 'henna-de-sobrancelhas')
    assert.equal(created.category, 'Sobrancelhas')
    assert.equal((await store.getPublicServices()).length, initial.length + 1)
    await store.deleteService(created.id)
    assert.equal((await store.getPublicServices()).length, initial.length)

    const usedService = initial[0]
    const date = addDateDays(getStudioDate(), 2)
    await store.saveHours(hoursForDate(date))
    await store.createBooking({
      serviceId: usedService.id, date, time: '09:00', customerName: 'Ana Souza',
      customerPhone: '67999990001', customerNote: '', policyAcknowledged: true,
    })
    await assert.rejects(store.deleteService(usedService.id), /SERVICE_IN_USE/)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})


test('public appointments combine procedures and persist summed price, duration and exact end availability', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p17-multiple-services-test-'))
  try {
    const store = await createStorage({ NODE_ENV: 'development', P18_TEST_FIXTURES: 'true' }, tempRoot)
    const services = await store.getPublicServices()
    const selected = services.slice(0, 2)
    const date = addDateDays(getStudioDate(), 2)
    await store.saveHours(hoursForDate(date))
    const slots = await store.getAvailableSlots(selected.map((service) => service.id), date)
    assert.ok(slots.includes('09:00'))
    const booking = await store.createBooking({ serviceId: selected[0].id, serviceIds: selected.map((service) => service.id), date, time: '09:00', customerName: 'aNA SOUZA', customerPhone: '67999990001', customerNote: '', policyAcknowledged: true })
    const saved = (await store.getAdminData()).appointments.find((item) => item.public_code === booking.public_code)
    assert.equal(saved.price_cents, selected.reduce((sum, service) => sum + service.price_cents, 0))
    assert.equal(saved.service.duration_minutes, selected.reduce((sum, service) => sum + service.duration_minutes, 0))
    assert.equal(saved.service_items.length, 2)
    assert.match(saved.service.name, / \+ /)
    const totalDuration = selected.reduce((sum, service) => sum + service.duration_minutes, 0)
    const nextSlots = await store.getAvailableSlots(services[2].id, date)
    const totalEndMinute = 9 * 60 + totalDuration
    const exactEndTime = String(Math.floor(totalEndMinute / 60)).padStart(2, '0') + ':' + String(totalEndMinute % 60).padStart(2, '0')
    assert.ok(nextSlots.includes(exactEndTime), 'the next booking can start at the exact end of the combined appointment')
  } finally { await rm(tempRoot, { recursive: true, force: true }) }
})


test('admin-created combined appointments can omit phone and keep service snapshots and exact end availability', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p18-admin-multi-no-phone-test-'))
  try {
    const store = await createStorage({ NODE_ENV: 'development', P18_TEST_FIXTURES: 'true' }, tempRoot)
    const services = await store.getPublicServices()
    const selected = services.slice(0, 2)
    const date = addDateDays(getStudioDate(), 2)
    await store.saveHours(hoursForDate(date))
    const expectedDuration = selected.reduce((sum, service) => sum + service.duration_minutes, 0)
    const booking = await store.createBooking({
      serviceId: selected[0].id, serviceIds: selected.map((service) => service.id),
      date, time: '09:00', customerName: 'Cliente Sem Telefone', customerPhone: '',
      customerNote: '', allowMissingPhone: true, policyAcknowledged: false,
    }, { adminCreated: true })
    const adminData = await store.getAdminData()
    const saved = adminData.appointments.find((item) => item.public_code === booking.public_code)
    assert.ok(saved)
    assert.equal(saved.customer_phone, '')
    assert.equal(saved.policy_acknowledged, false)
    assert.equal(saved.service_items.length, 2)
    assert.equal(saved.service.duration_minutes, expectedDuration)
    assert.equal(saved.ends_at, new Date(new Date(saved.starts_at).getTime() + expectedDuration * 60_000).toISOString())
    assert.ok(adminData.customers.some((customer) => customer.name === 'Cliente Sem Telefone' && customer.phone === ''))
    const nextSlots = await store.getAvailableSlots(services[2].id, date)
    const endMinute = 9 * 60 + expectedDuration
    const exactEnd = String(Math.floor(endMinute / 60)).padStart(2, '0') + ':' + String(endMinute % 60).padStart(2, '0')
    assert.ok(nextSlots.includes(exactEnd), 'a combined manual appointment releases its exact end minute')
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})
