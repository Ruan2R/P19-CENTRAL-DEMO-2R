-- P18: support administrative appointments entered without a phone number.
-- BACK UP THE DATABASE FIRST. Apply exactly once to an existing database before deployment.
-- Public booking validation continues to require a valid phone number.
-- Customer profiles without a phone store NULL; multiple NULL values are allowed by the
-- existing UNIQUE index so separate customers can exist without an invented phone number.

ALTER TABLE customers
  MODIFY COLUMN phone VARCHAR(15) NULL
    COMMENT 'Telefone brasileiro normalizado, somente dígitos; NULL quando não informado',
  DROP CONSTRAINT chk_customers_phone,
  ADD CONSTRAINT chk_customers_phone CHECK (
    phone IS NULL OR CHAR_LENGTH(phone) BETWEEN 10 AND 11
  );

ALTER TABLE appointments
  DROP CONSTRAINT chk_appointments_phone,
  ADD CONSTRAINT chk_appointments_phone CHECK (
    CHAR_LENGTH(customer_phone) = 0
    OR CHAR_LENGTH(customer_phone) BETWEEN 10 AND 15
  );

-- Recover customer profiles for administrative appointments without a phone that already
-- exist in the database. Appointments with the same name and no phone share one profile.
INSERT INTO customers (id, name, phone, require_deposit, internal_note, created_at, updated_at)
SELECT UUID(), pending.customer_name, NULL, 0, '', UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM (
  SELECT customer_name
  FROM appointments
  WHERE customer_phone = ''
  GROUP BY customer_name
) AS pending
LEFT JOIN customers AS existing
  ON existing.phone IS NULL AND existing.name = pending.customer_name
WHERE existing.id IS NULL;
