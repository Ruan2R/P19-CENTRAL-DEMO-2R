-- Execute uma única vez em bancos MySQL existentes antes de publicar a versão com Promoções.
-- O price_cents de cada agendamento continua sendo o preço final aplicado e não é recalculado quando a campanha termina.

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

ALTER TABLE appointments
  ADD COLUMN promotion_id CHAR(36) NULL COMMENT 'Snapshot da campanha aplicada no momento da reserva' AFTER service_id,
  ADD COLUMN promotion_name VARCHAR(100) NULL COMMENT 'Nome da campanha guardado para histórico' AFTER promotion_id,
  ADD COLUMN regular_price_cents INT UNSIGNED NULL COMMENT 'Preço normal congelado para exibir o desconto histórico' AFTER price_cents;

UPDATE appointments SET regular_price_cents = price_cents WHERE regular_price_cents IS NULL;
