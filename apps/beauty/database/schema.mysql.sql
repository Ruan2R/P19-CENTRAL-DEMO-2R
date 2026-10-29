-- P18 — Schema MySQL 8 / MariaDB compatível com hospedagem gerenciada.
-- Execute uma única vez em um banco novo e exclusivo do P18. Nunca execute sobre outro banco com dados.
-- Horários de funcionamento são armazenados como TIME local do estúdio.
-- appointments.starts_at/ends_at são DATETIME em UTC; o backend faz a conversão.

CREATE TABLE IF NOT EXISTS services (
  id CHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description VARCHAR(1000) NOT NULL DEFAULT '',
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  price_cents INT UNSIGNED NOT NULL,
  deposit_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_services_duration CHECK (duration_minutes BETWEEN 15 AND 600),
  CONSTRAINT chk_services_deposit_percent CHECK (deposit_percent BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promotions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_promotions_dates_active (active, starts_on, ends_on),
  CONSTRAINT chk_promotions_name CHECK (CHAR_LENGTH(name) BETWEEN 2 AND 100),
  CONSTRAINT chk_promotions_range CHECK (ends_on >= starts_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promotion_items (
  promotion_id CHAR(36) NOT NULL,
  service_id CHAR(36) NOT NULL,
  promotional_price_cents INT UNSIGNED NOT NULL,
  PRIMARY KEY (promotion_id, service_id),
  INDEX idx_promotion_items_service (service_id),
  CONSTRAINT fk_promotion_items_promotion FOREIGN KEY (promotion_id) REFERENCES promotions (id) ON DELETE CASCADE,
  CONSTRAINT fk_promotion_items_service FOREIGN KEY (service_id) REFERENCES services (id),
  CONSTRAINT chk_promotion_price_positive CHECK (promotional_price_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS business_hours (
  weekday TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  start_time TIME NULL,
  end_time TIME NULL,
  break_start TIME NULL,
  break_end TIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_business_hours_weekday CHECK (weekday BETWEEN 0 AND 6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS business_policies (
  singleton TINYINT(1) NOT NULL PRIMARY KEY DEFAULT 1,
  lateness_tolerance_minutes TINYINT UNSIGNED NOT NULL DEFAULT 10,
  cancellation_notice_hours SMALLINT UNSIGNED NOT NULL DEFAULT 2,
  companion_policy VARCHAR(700) NOT NULL,
  no_show_policy VARCHAR(700) NOT NULL,
  show_lateness_policy TINYINT(1) NOT NULL DEFAULT 0,
  show_cancellation_policy TINYINT(1) NOT NULL DEFAULT 0,
  show_companion_policy TINYINT(1) NOT NULL DEFAULT 0,
  show_no_show_policy TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_business_policy_singleton CHECK (singleton = 1),
  CONSTRAINT chk_lateness_tolerance CHECK (lateness_tolerance_minutes <= 60),
  CONSTRAINT chk_cancellation_notice CHECK (cancellation_notice_hours <= 168)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS date_blocks (
  id CHAR(36) NOT NULL PRIMARY KEY,
  blocked_date DATE NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  note VARCHAR(120) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_date_blocks_date (blocked_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) NULL UNIQUE COMMENT 'Telefone brasileiro normalizado, somente dígitos; NULL quando não informado',
  require_deposit TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Exige sinal apenas para futuras reservas deste telefone',
  internal_note VARCHAR(500) NOT NULL DEFAULT '' COMMENT 'Observação administrativa, nunca exposta ao público',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customers_name (name),
  CONSTRAINT chk_customers_name CHECK (CHAR_LENGTH(name) BETWEEN 2 AND 100),
  CONSTRAINT chk_customers_phone CHECK (phone IS NULL OR CHAR_LENGTH(phone) BETWEEN 10 AND 11)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appointments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  public_code CHAR(8) NOT NULL UNIQUE,
  customer_name VARCHAR(100) NOT NULL,
  customer_phone VARCHAR(15) NOT NULL,
  customer_note VARCHAR(500) NULL,
  service_id CHAR(36) NOT NULL,
  service_snapshot JSON NULL COMMENT 'Snapshot dos procedimentos do atendimento',
  promotion_id CHAR(36) NULL COMMENT 'Snapshot da campanha aplicada no momento da reserva',
  promotion_name VARCHAR(100) NULL COMMENT 'Nome da campanha guardado para histórico',
  starts_at DATETIME NOT NULL COMMENT 'UTC',
  ends_at DATETIME NOT NULL COMMENT 'UTC',
  price_cents INT UNSIGNED NOT NULL,
  regular_price_cents INT UNSIGNED NULL COMMENT 'Preço normal congelado para exibir o desconto histórico',
  deposit_cents INT UNSIGNED NOT NULL DEFAULT 0,
  deposit_required TINYINT(1) NOT NULL DEFAULT 0,
  deposit_received TINYINT(1) NOT NULL DEFAULT 0,
  deposit_reported TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Cliente informou que pagou; não equivale a recebimento validado',
  policy_acknowledged TINYINT(1) NOT NULL DEFAULT 0,
  policy_acknowledged_at DATETIME NULL COMMENT 'UTC',
  policy_snapshot JSON NULL,
  status ENUM('pending_confirmation','awaiting_deposit','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'pending_confirmation',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'UTC',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'UTC',
  INDEX idx_appointments_starts_at (starts_at),
  INDEX idx_appointments_status (status),
  INDEX idx_appointments_service_id (service_id),
  INDEX idx_appointments_active_overlap (status, starts_at, ends_at),
  CONSTRAINT fk_appointments_service FOREIGN KEY (service_id) REFERENCES services (id),
  CONSTRAINT chk_appointments_name CHECK (CHAR_LENGTH(customer_name) BETWEEN 2 AND 100),
  CONSTRAINT chk_appointments_phone CHECK (CHAR_LENGTH(customer_phone) = 0 OR CHAR_LENGTH(customer_phone) BETWEEN 10 AND 15),
  CONSTRAINT chk_appointments_range CHECK (ends_at > starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A single row serializes booking inserts so two requests cannot claim one interval concurrently.
CREATE TABLE IF NOT EXISTS booking_mutex (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  note VARCHAR(80) NOT NULL DEFAULT 'Booking transaction lock'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO booking_mutex (id) VALUES (1);

-- P18: nenhum serviço comercial é pré-cadastrado; configurar os dados reais da Ana antes de publicar.
-- Serviços intencionalmente não pré-cadastrados. Cadastre o catálogo validado no painel.


-- Configure os dias e horários reais no painel antes de abrir a agenda.
INSERT IGNORE INTO business_hours (weekday, enabled, start_time, end_time, break_start, break_end) VALUES
(0, 0, NULL, NULL, NULL, NULL),
(1, 0, NULL, NULL, NULL, NULL),
(2, 0, NULL, NULL, NULL, NULL),
(3, 0, NULL, NULL, NULL, NULL),
(4, 0, NULL, NULL, NULL, NULL),
(5, 0, NULL, NULL, NULL, NULL),
(6, 0, NULL, NULL, NULL, NULL);

INSERT IGNORE INTO business_policies (singleton, lateness_tolerance_minutes, cancellation_notice_hours, companion_policy, no_show_policy) VALUES
(1, 0, 0, 'Política de acompanhantes pendente de confirmação pela Ana.', 'Política de faltas, cancelamentos e sinal pendente de confirmação pela Ana.');
-- P17 — financeiro básico (MySQL 8 / MariaDB)
-- Aplicar uma vez antes de ativar o modo MySQL. Não apaga nem altera os dados existentes.

CREATE TABLE IF NOT EXISTS financial_entries (
  id CHAR(36) NOT NULL PRIMARY KEY,
  direction ENUM('income','expense') NOT NULL,
  description VARCHAR(120) NOT NULL,
  category VARCHAR(80) NOT NULL,
  amount_cents BIGINT UNSIGNED NOT NULL,
  movement_date DATE NOT NULL,
  payment_method VARCHAR(60) NOT NULL DEFAULT 'Não informado',
  source_type ENUM('manual','appointment_deposit','appointment_balance','payable_payment') NOT NULL DEFAULT 'manual',
  source_id CHAR(36) NULL,
  related_appointment_id CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_financial_entries_source (source_type, source_id),
  INDEX idx_financial_entries_month (movement_date, direction),
  INDEX idx_financial_entries_appointment (related_appointment_id),
  CONSTRAINT chk_financial_entries_amount CHECK (amount_cents > 0),
  CONSTRAINT chk_financial_entries_description CHECK (CHAR_LENGTH(description) BETWEEN 2 AND 120)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payables (
  id CHAR(36) NOT NULL PRIMARY KEY,
  description VARCHAR(120) NOT NULL,
  category VARCHAR(80) NOT NULL,
  amount_cents BIGINT UNSIGNED NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('pending','paid') NOT NULL DEFAULT 'pending',
  paid_at DATETIME NULL,
  expense_entry_id CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payables_expense_entry (expense_entry_id),
  INDEX idx_payables_status_due (status, due_date),
  CONSTRAINT chk_payables_amount CHECK (amount_cents > 0),
  CONSTRAINT chk_payables_description CHECK (CHAR_LENGTH(description) BETWEEN 2 AND 120)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- One-time marker for the guarded local JSON → MySQL initial import. Stores no customer data.
CREATE TABLE IF NOT EXISTS p14_local_json_imports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  source_sha256 CHAR(64) NOT NULL UNIQUE,
  source_file VARCHAR(255) NOT NULL,
  row_counts JSON NOT NULL,
  imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
