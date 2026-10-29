-- Tracking table for the guarded one-time import from data/local-db.json.
-- This migration is safe to run once on a dedicated P14 MySQL database. It does not read or alter customer data.
CREATE TABLE IF NOT EXISTS p14_local_json_imports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  source_sha256 CHAR(64) NOT NULL UNIQUE,
  source_file VARCHAR(255) NOT NULL,
  row_counts JSON NOT NULL,
  imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
