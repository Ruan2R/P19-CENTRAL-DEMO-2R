-- Add the ledger source used when the remaining balance of an appointment is received.
-- Safe to run after 20261011_finance_basic.sql; it preserves existing entries.
ALTER TABLE financial_entries
  MODIFY source_type ENUM('manual','appointment_deposit','appointment_balance','payable_payment') NOT NULL DEFAULT 'manual';
