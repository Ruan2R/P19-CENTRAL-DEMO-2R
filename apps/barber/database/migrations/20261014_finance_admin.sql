-- P15: habilita movimentações financeiras manuais e contas a pagar.
-- Aplicar uma vez ao banco existente do P15, depois de backup e teste em base descartável.
-- Não grava pagamentos automaticamente ao concluir agendamentos; as entradas são manuais.

CREATE TABLE IF NOT EXISTS financial_entries (
  id CHAR(36) NOT NULL PRIMARY KEY,
  direction ENUM('income','expense') NOT NULL,
  description VARCHAR(120) NOT NULL,
  category VARCHAR(80) NOT NULL,
  amount_cents BIGINT UNSIGNED NOT NULL,
  movement_date DATE NOT NULL,
  payment_method VARCHAR(60) NOT NULL DEFAULT 'Não informado',
  source_type ENUM('manual','payable_payment') NOT NULL DEFAULT 'manual',
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
