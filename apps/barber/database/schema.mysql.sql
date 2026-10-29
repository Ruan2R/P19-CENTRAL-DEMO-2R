-- P15 — schema inicial MySQL 8 / MariaDB.
-- Revisar e aplicar apenas no banco dedicado ao P15; este arquivo não é executado automaticamente.
-- Datas/horários locais de negócio devem ser convertidos pelo backend para UTC ao persistir starts_at/ends_at.

CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone_normalized VARCHAR(15) NOT NULL UNIQUE COMMENT 'Somente dígitos; normalização definida no backend',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customers_name (name),
  CONSTRAINT chk_customers_name CHECK (CHAR_LENGTH(name) BETWEEN 2 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS services (
  id CHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  price_cents INT UNSIGNED NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_services_duration CHECK (duration_minutes BETWEEN 5 AND 240)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS professionals (
  id CHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(80) NOT NULL,
  avatar_url VARCHAR(500) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS professional_services (
  professional_id CHAR(36) NOT NULL,
  service_id CHAR(36) NOT NULL,
  PRIMARY KEY (professional_id, service_id),
  CONSTRAINT fk_professional_services_professional FOREIGN KEY (professional_id) REFERENCES professionals(id),
  CONSTRAINT fk_professional_services_service FOREIGN KEY (service_id) REFERENCES services(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS business_hours (
  weekday TINYINT UNSIGNED NOT NULL PRIMARY KEY COMMENT '0=domingo ... 6=sábado',
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  start_time TIME NULL,
  end_time TIME NULL,
  break_start TIME NULL,
  break_end TIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_business_hours_weekday CHECK (weekday BETWEEN 0 AND 6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS date_blocks (
  id CHAR(36) NOT NULL PRIMARY KEY,
  blocked_date DATE NOT NULL,
  start_time TIME NULL COMMENT 'NULL com end_time NULL significa dia todo',
  end_time TIME NULL,
  reason VARCHAR(160) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_date_blocks_date (blocked_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS professional_blocks (
  id CHAR(36) NOT NULL PRIMARY KEY,
  professional_id CHAR(36) NOT NULL,
  blocked_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason VARCHAR(160) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_professional_blocks_date (professional_id, blocked_date),
  CONSTRAINT fk_professional_blocks_professional FOREIGN KEY (professional_id) REFERENCES professionals(id),
  CONSTRAINT chk_professional_blocks_range CHECK (end_time > start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_groups (
  id CHAR(36) NOT NULL PRIMARY KEY,
  public_code CHAR(10) NOT NULL UNIQUE,
  customer_id CHAR(36) NOT NULL,
  booking_date DATE NOT NULL COMMENT 'Data local da barbearia',
  status ENUM('confirmed','cancelled','completed','no_show') NOT NULL DEFAULT 'confirmed',
  total_price_cents INT UNSIGNED NOT NULL DEFAULT 0,
  whatsapp_confirmation_marked_at DATETIME NULL,
  whatsapp_confirmation_marked_by VARCHAR(80) NULL COMMENT 'ID administrativo; sem segredos',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  cancelled_at DATETIME NULL,
  completed_at DATETIME NULL,
  INDEX idx_booking_groups_date_status (booking_date, status),
  INDEX idx_booking_groups_customer_date (customer_id, booking_date),
  CONSTRAINT fk_booking_groups_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  booking_group_id CHAR(36) NOT NULL,
  service_id CHAR(36) NOT NULL,
  professional_id CHAR(36) NOT NULL,
  service_name_snapshot VARCHAR(120) NOT NULL,
  professional_name_snapshot VARCHAR(100) NOT NULL,
  promotion_name_snapshot VARCHAR(120) NULL,
  price_cents INT UNSIGNED NOT NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  starts_at DATETIME NOT NULL COMMENT 'UTC; conversão de timezone acontece no backend',
  ends_at DATETIME NOT NULL COMMENT 'UTC',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_booking_items_group (booking_group_id),
  INDEX idx_booking_items_professional_starts (professional_id, starts_at, ends_at),
  INDEX idx_booking_items_time_range (starts_at, ends_at),
  CONSTRAINT fk_booking_items_group FOREIGN KEY (booking_group_id) REFERENCES booking_groups(id),
  CONSTRAINT fk_booking_items_service FOREIGN KEY (service_id) REFERENCES services(id),
  CONSTRAINT fk_booking_items_professional FOREIGN KEY (professional_id) REFERENCES professionals(id),
  CONSTRAINT chk_booking_items_duration CHECK (duration_minutes > 0),
  CONSTRAINT chk_booking_items_range CHECK (ends_at > starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Coordenador de transação para serializar criação/alteração de reservas na primeira versão.
-- Todos os caminhos que mudam a agenda devem pegar este lock dentro da mesma transação.
CREATE TABLE IF NOT EXISTS booking_mutex (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  note VARCHAR(80) NOT NULL DEFAULT 'Booking transaction lock'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO booking_mutex (id) VALUES (1);

-- Controle financeiro inicial do P15 (sem integração bancária automática).
CREATE TABLE IF NOT EXISTS financial_entries (
  id CHAR(36) NOT NULL PRIMARY KEY,
  direction ENUM('income','expense') NOT NULL,
  description VARCHAR(120) NOT NULL,
  category VARCHAR(80) NOT NULL,
  amount_cents BIGINT UNSIGNED NOT NULL,
  movement_date DATE NOT NULL,
  payment_method VARCHAR(60) NOT NULL DEFAULT 'Não informado',
  source_type ENUM('manual','payable_payment','booking_receipt') NOT NULL DEFAULT 'manual',
  source_id CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_financial_entries_source (source_type, source_id),
  INDEX idx_financial_entries_month (movement_date, direction),
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


-- Promoções individuais e combos: o preço aplicado é congelado em booking_items.
CREATE TABLE IF NOT EXISTS promotions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  kind ENUM('service','combo') NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  promo_price_cents INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_promotions_active_dates (active, starts_on, ends_on),
  CONSTRAINT chk_promotions_date_range CHECK (ends_on >= starts_on),
  CONSTRAINT chk_promotions_price CHECK (promo_price_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promotion_services (
  promotion_id CHAR(36) NOT NULL,
  service_id CHAR(36) NOT NULL,
  PRIMARY KEY (promotion_id, service_id),
  INDEX idx_promotion_services_service (service_id),
  CONSTRAINT fk_promotion_services_promotion FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
  CONSTRAINT fk_promotion_services_service FOREIGN KEY (service_id) REFERENCES services(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
