// Dados iniciais apenas para desenvolvimento local. O modo de produção deverá ler do banco.
export const developmentServices = [
  { id: 'corte', name: 'Corte degradê', durationMinutes: 40, priceCents: 5500, active: true },
  { id: 'barba', name: 'Barba completa', durationMinutes: 30, priceCents: 3500, active: true },
  { id: 'barba-pigmentacao', name: 'Barba e acabamento', durationMinutes: 45, priceCents: 6000, active: true },
  { id: 'corte-barba', name: 'Corte + barba', durationMinutes: 60, priceCents: 8000, active: true },
  { id: 'low-fade-navalhado', name: 'Low fade / navalhado', durationMinutes: 50, priceCents: 5800, active: true },
  { id: 'pezinho', name: 'Pézinho', durationMinutes: 15, priceCents: 2000, active: true },
  { id: 'sobrancelha', name: 'Sobrancelha', durationMinutes: 15, priceCents: 1500, active: true },
]

export const developmentProfessionals = [
  { id: 'felipe', name: 'Rafael Lima', role: 'Barbeiro', active: true },
  { id: 'vitoria', name: 'Caio Martins', role: 'Barbeiro', active: true },
]
