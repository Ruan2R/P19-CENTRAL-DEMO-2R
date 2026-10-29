-- P15 — catálogo inicial da Boss67 para uma base MySQL DEDICADA e VAZIA.
-- Execute somente depois de database/schema.mysql.sql e após confirmar os dados com a barbearia.
-- Não altera preços/horários existentes devido ao uso de INSERT IGNORE.
-- Todos os serviços estão inicialmente disponíveis para todos os profissionais; a associação
-- por profissional pode ser ativada no painel administrativo em uma etapa futura.

INSERT IGNORE INTO services (id, slug, name, duration_minutes, price_cents, active, sort_order) VALUES
('15000000-0000-4000-8000-000000000001', 'corte', 'Corte', 30, 5000, 1, 10),
('15000000-0000-4000-8000-000000000002', 'barba', 'Barba', 30, 4000, 1, 20),
('15000000-0000-4000-8000-000000000003', 'barba-pigmentacao', 'Barba e Pigmentação', 45, 6500, 1, 30),
('15000000-0000-4000-8000-000000000004', 'corte-barba', 'Corte e Barba', 60, 8500, 1, 40),
('15000000-0000-4000-8000-000000000005', 'low-fade-navalhado', 'Low Fade ou Navalhado', 60, 6000, 1, 50),
('15000000-0000-4000-8000-000000000006', 'pezinho', 'Pézinho', 15, 2000, 1, 60),
('15000000-0000-4000-8000-000000000007', 'sobrancelha', 'Sobrancelha', 15, 2000, 1, 70);

INSERT IGNORE INTO professionals (id, slug, name, role, active, sort_order) VALUES
('15000000-0000-4000-8000-000000000101', 'felipe', 'Felipe', 'Barbeiro', 1, 10),
('15000000-0000-4000-8000-000000000102', 'vitoria', 'Vitória', 'Barbeira', 1, 20);

INSERT IGNORE INTO business_hours (weekday, enabled, start_time, end_time, break_start, break_end) VALUES
(0, 0, NULL, NULL, NULL, NULL),
(1, 1, '13:30:00', '20:00:00', NULL, NULL),
(2, 1, '09:00:00', '20:00:00', NULL, NULL),
(3, 1, '09:00:00', '20:00:00', NULL, NULL),
(4, 1, '09:00:00', '20:00:00', NULL, NULL),
(5, 1, '09:00:00', '20:00:00', NULL, NULL),
(6, 1, '09:00:00', '17:00:00', NULL, NULL);

INSERT IGNORE INTO booking_mutex (id, note) VALUES (1, 'Serializa reservas concorrentes');
