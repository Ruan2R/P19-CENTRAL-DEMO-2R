// Dados iniciais apenas para desenvolvimento local. O modo de produção deverá ler do banco.
export const developmentServices = [
  { id: 'corte', name: 'Corte', durationMinutes: 30, priceCents: 5000, active: true },
  { id: 'barba', name: 'Barba', durationMinutes: 30, priceCents: 4000, active: true },
  { id: 'barba-pigmentacao', name: 'Barba e Pigmentação', durationMinutes: 45, priceCents: 6500, active: true },
  { id: 'corte-barba', name: 'Corte e Barba', durationMinutes: 60, priceCents: 8500, active: true },
  { id: 'low-fade-navalhado', name: 'Low Fade ou Navalhado', durationMinutes: 60, priceCents: 6000, active: true },
  { id: 'pezinho', name: 'Pézinho', durationMinutes: 15, priceCents: 2000, active: true },
  { id: 'sobrancelha', name: 'Sobrancelha', durationMinutes: 15, priceCents: 2000, active: true },
]

export const developmentProfessionals = [
  { id: 'felipe', name: 'Felipe', role: 'Barbeiro', active: true },
  { id: 'vitoria', name: 'Vitória', role: 'Barbeira', active: true },
]
