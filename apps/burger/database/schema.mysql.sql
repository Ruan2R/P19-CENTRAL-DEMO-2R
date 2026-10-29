-- P16 — ADEGA DO COPÃO
-- Schema inicial para revisão. Não aplicar em produção até validar regras, backup e compatibilidade MySQL.
-- Valores monetários usam centavos inteiros; quantidades usam milésimos da unidade/base unitária.

CREATE TABLE IF NOT EXISTS admin_users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  login_id VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('finance', 'full') NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_admin_users_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_sessions_user_expiry (user_id, expires_at),
  CONSTRAINT fk_admin_sessions_user FOREIGN KEY (user_id) REFERENCES admin_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(80) NOT NULL,
  unit ENUM('un', 'kg', 'g', 'l', 'ml', 'porcao') NOT NULL DEFAULT 'un',
  cost_cents BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Custo por unidade/base unitária em centavos',
  price_cents BIGINT UNSIGNED NOT NULL COMMENT 'Preço de venda por unidade/base unitária em centavos',
  stock_milli BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '1000 = 1,000 unidade/base unitária',
  stock_minimum_milli BIGINT UNSIGNED NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_active_name (active, name),
  INDEX idx_products_category (category),
  CONSTRAINT chk_products_name CHECK (CHAR_LENGTH(name) BETWEEN 2 AND 120),
  CONSTRAINT chk_products_price CHECK (price_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_movements (
  id CHAR(36) NOT NULL PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  movement_type ENUM('purchase', 'sale', 'order_consumption', 'adjustment_in', 'adjustment_out', 'waste', 'return') NOT NULL,
  quantity_milli BIGINT UNSIGNED NOT NULL,
  unit_cost_cents BIGINT UNSIGNED NULL,
  source_type ENUM('manual', 'order', 'supplier_purchase', 'return', 'other') NOT NULL DEFAULT 'manual',
  source_id CHAR(36) NULL,
  reason VARCHAR(240) NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stock_movements_product_date (product_id, created_at),
  INDEX idx_stock_movements_source (source_type, source_id),
  UNIQUE KEY uq_stock_movement_source (source_type, source_id, product_id, movement_type),
  CONSTRAINT fk_stock_movements_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_stock_movements_user FOREIGN KEY (created_by) REFERENCES admin_users(id),
  CONSTRAINT chk_stock_movements_quantity CHECK (quantity_milli > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS financial_entries (
  id CHAR(36) NOT NULL PRIMARY KEY,
  direction ENUM('income', 'expense') NOT NULL,
  description VARCHAR(120) NOT NULL,
  category VARCHAR(80) NOT NULL,
  amount_cents BIGINT UNSIGNED NOT NULL,
  movement_date DATE NOT NULL COMMENT 'Data do dinheiro efetivamente recebido/pago',
  payment_method ENUM('Pix', 'Dinheiro', 'Cartão', 'Transferência', 'Não informado') NOT NULL DEFAULT 'Não informado',
  source_type ENUM('manual', 'payable_payment', 'receivable_receipt', 'order_payment') NOT NULL DEFAULT 'manual',
  source_id CHAR(36) NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_financial_entry_source (source_type, source_id),
  INDEX idx_financial_entries_date_direction (movement_date, direction),
  INDEX idx_financial_entries_category_date (category, movement_date),
  CONSTRAINT fk_financial_entries_user FOREIGN KEY (created_by) REFERENCES admin_users(id),
  CONSTRAINT chk_financial_entries_amount CHECK (amount_cents > 0),
  CONSTRAINT chk_financial_entries_description CHECK (CHAR_LENGTH(description) BETWEEN 2 AND 120)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payables (
  id CHAR(36) NOT NULL PRIMARY KEY,
  description VARCHAR(120) NOT NULL,
  category VARCHAR(80) NOT NULL,
  amount_cents BIGINT UNSIGNED NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('pending', 'paid', 'cancelled') NOT NULL DEFAULT 'pending',
  paid_at DATETIME NULL,
  expense_entry_id CHAR(36) NULL UNIQUE,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payables_status_due (status, due_date),
  CONSTRAINT fk_payables_expense_entry FOREIGN KEY (expense_entry_id) REFERENCES financial_entries(id),
  CONSTRAINT fk_payables_user FOREIGN KEY (created_by) REFERENCES admin_users(id),
  CONSTRAINT chk_payables_amount CHECK (amount_cents > 0),
  CONSTRAINT chk_payables_description CHECK (CHAR_LENGTH(description) BETWEEN 2 AND 120)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS receivables (
  id CHAR(36) NOT NULL PRIMARY KEY,
  description VARCHAR(120) NOT NULL,
  counterparty VARCHAR(120) NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'Outros',
  amount_cents BIGINT UNSIGNED NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('pending', 'received', 'cancelled') NOT NULL DEFAULT 'pending',
  received_at DATETIME NULL,
  income_entry_id CHAR(36) NULL UNIQUE,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_receivables_status_due (status, due_date),
  CONSTRAINT fk_receivables_income_entry FOREIGN KEY (income_entry_id) REFERENCES financial_entries(id),
  CONSTRAINT fk_receivables_user FOREIGN KEY (created_by) REFERENCES admin_users(id),
  CONSTRAINT chk_receivables_amount CHECK (amount_cents > 0),
  CONSTRAINT chk_receivables_description CHECK (CHAR_LENGTH(description) BETWEEN 2 AND 120)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_number INT UNSIGNED NOT NULL,
  business_date DATE NOT NULL,
  customer_label VARCHAR(120) NOT NULL DEFAULT 'Balcão',
  status ENUM('received', 'preparing', 'ready', 'delivered', 'cancelled') NOT NULL DEFAULT 'received',
  total_cents BIGINT UNSIGNED NOT NULL DEFAULT 0,
  notes VARCHAR(500) NULL,
  ready_at DATETIME NULL,
  delivered_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  cancellation_reason VARCHAR(240) NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_orders_number_date (business_date, order_number),
  INDEX idx_orders_status_date (business_date, status),
  CONSTRAINT fk_orders_user FOREIGN KEY (created_by) REFERENCES admin_users(id),
  CONSTRAINT chk_orders_number CHECK (order_number > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  product_name_snapshot VARCHAR(120) NOT NULL,
  quantity_milli BIGINT UNSIGNED NOT NULL,
  unit_price_cents BIGINT UNSIGNED NOT NULL,
  unit_cost_cents BIGINT UNSIGNED NOT NULL DEFAULT 0,
  line_total_cents BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_items_order (order_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT chk_order_items_quantity CHECK (quantity_milli > 0),
  CONSTRAINT chk_order_items_price CHECK (unit_price_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_payments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  amount_cents BIGINT UNSIGNED NOT NULL,
  payment_method ENUM('Pix', 'Dinheiro', 'Cartão', 'Transferência', 'Não informado') NOT NULL DEFAULT 'Não informado',
  payment_date DATE NOT NULL,
  financial_entry_id CHAR(36) NULL UNIQUE,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_payments_order_date (order_id, payment_date),
  CONSTRAINT fk_order_payments_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_order_payments_entry FOREIGN KEY (financial_entry_id) REFERENCES financial_entries(id),
  CONSTRAINT fk_order_payments_user FOREIGN KEY (created_by) REFERENCES admin_users(id),
  CONSTRAINT chk_order_payments_amount CHECK (amount_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id CHAR(36) NULL,
  details_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_logs_entity_date (entity_type, entity_id, created_at),
  INDEX idx_audit_logs_user_date (user_id, created_at),
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES admin_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
