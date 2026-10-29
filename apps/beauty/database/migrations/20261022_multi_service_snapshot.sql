-- P17 v0.3.0: snapshot of all procedures in one appointment.
-- Run once on an existing MySQL database before deploying this version.
ALTER TABLE appointments ADD COLUMN service_snapshot JSON NULL AFTER service_id;
