-- P15 migration: promoções/combos, preço promocional congelado e recebimentos vinculados a atendimentos.
-- Execute uma vez em um banco P15 existente após fazer backup. Em bancos novos, use schema.mysql.sql.

ALTER TABLE booking_items
  ADD COLUMN promotion_name_snapshot VARCHAR(120) NULL AFTER professional_name_snapshot;

ALTER TABLE financial_entries
  MODIFY source_type ENUM('manual','payable_payment','booking_receipt') NOT NULL DEFAULT 'manual';

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
