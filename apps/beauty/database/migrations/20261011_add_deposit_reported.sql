-- Apply once to an existing MySQL database before deploying the Pix-reporting flow.
-- Fresh installations already receive this column from database/schema.mysql.sql.
ALTER TABLE appointments
  ADD COLUMN deposit_reported TINYINT(1) NOT NULL DEFAULT 0
  COMMENT 'Cliente informou que pagou; não equivale a recebimento validado'
  AFTER deposit_received;
