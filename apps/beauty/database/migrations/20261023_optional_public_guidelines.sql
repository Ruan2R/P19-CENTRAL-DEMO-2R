-- P17 v0.4.0: orientações públicas opcionais e controladas individualmente.
-- Aplicar UMA vez somente em bancos existentes que ainda não possuem estas quatro colunas.
-- O schema.mysql.sql já inclui as colunas para instalações novas.

ALTER TABLE business_policies
  ADD COLUMN show_lateness_policy TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN show_cancellation_policy TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN show_companion_policy TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN show_no_show_policy TINYINT(1) NOT NULL DEFAULT 0;
