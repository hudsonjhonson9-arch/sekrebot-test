-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION 001: Critical Database Fixes
-- Date: 2026-06-07
-- Author: Auto-generated from analysis
-- 
-- Fixes:
--   1. Remove 15 orphan n8n triggers on Log_Absen (keep latest 3)
--   2. Add missing performance indexes on Log_Absen
--   3. Add foreign key constraints for referential integrity
--   4. Add indexes on ket_temp for common queries
--
-- IMPORTANT: Run this in Supabase SQL Editor or via psql.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- 1. REMOVE ORPHAN N8N TRIGGERS ON Log_Absen
--    Keep only the latest 3 (active set):
--      INSERT: n8n_trigger_044feb24_9ad8_4c23_97ab_11a678798f06
--      UPDATE: n8n_trigger_5d35a042_f859_484a_9939_574b0310b8da
--      DELETE: n8n_trigger_9bf03d5c_4092_46d5_8a96_d802b896d1a8
-- ─────────────────────────────────────────────────────────────────

-- Orphan INSERT triggers (4 removed, 1 kept)
DROP TRIGGER IF EXISTS n8n_trigger_a1633f07_462f_473f_97d9_b395f9d48de6 ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_c4c5379a_ebed_4833_b97b_a020a83be986 ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_22d4b7f4_ce61_4a73_9765_2264bdea61aa ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_c069a86e_1f1b_467b_b003_5217d915a9cc ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_dd135398_1d95_492b_9e18_271503c04afe ON "Log_Absen";

-- Orphan UPDATE triggers (4 removed, 1 kept)
DROP TRIGGER IF EXISTS n8n_trigger_e4b26935_4175_40e4_851e_badf2b490e93 ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_774aa9d8_c056_45a4_bb35_cb1823893d6b ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_4ee6611a_9793_4045_bfc4_0dbdaefd6435 ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_6cebb34e_99ab_48b5_89a6_9965ba593934 ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_cc142a57_0943_4888_a0d9_8e5bdcba642f ON "Log_Absen";

-- Orphan DELETE triggers (4 removed, 1 kept)
DROP TRIGGER IF EXISTS n8n_trigger_95f9d18b_1460_42d3_aee6_8c7f314c02fa ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_2c2dd5e1_3330_489c_9d60_dee1bf317074 ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_6f364bfc_29ba_4710_b58c_d0fb40ba30c8 ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_9163835d_477b_47a5_a352_b8902d3f4625 ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_8afd0cb9_28d6_4627_a082_aef11c85a412 ON "Log_Absen";

-- Clean up orphan trigger functions (functions without triggers)
DROP FUNCTION IF EXISTS n8n_trigger_function_a1633f07_462f_473f_97d9_b395f9d48de6() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_c4c5379a_ebed_4833_b97b_a020a83be986() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_22d4b7f4_ce61_4a73_9765_2264bdea61aa() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_c069a86e_1f1b_467b_b003_5217d915a9cc() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_dd135398_1d95_492b_9e18_271503c04afe() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_e4b26935_4175_40e4_851e_badf2b490e93() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_774aa9d8_c056_45a4_bb35_cb1823893d6b() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_4ee6611a_9793_4045_bfc4_0dbdaefd6435() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_6cebb34e_99ab_48b5_89a6_9965ba593934() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_cc142a57_0943_4888_a0d9_8e5bdcba642f() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_95f9d18b_1460_42d3_aee6_8c7f314c02fa() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_2c2dd5e1_3330_489c_9d60_dee1bf317074() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_6f364bfc_29ba_4710_b58c_d0fb40ba30c8() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_9163835d_477b_47a5_a352_b8902d3f4625() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_8afd0cb9_28d6_4627_a082_aef11c85a412() CASCADE;

-- Also clean orphan functions that don't have triggers at all
DROP FUNCTION IF EXISTS n8n_trigger_function_41cc6d43_69d9_4a41_a079_b3b5e566c2a7() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_608c50ba_4108_4e79_94df_fb48984221b9() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_76938b0e_a0b6_4bac_bbbf_937e1b273ad1() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_bdd8cb7c_8b00_4c88_8059_cf904916228f() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_dc905506_3744_4bb4_b6e1_ce4c466ea70b() CASCADE;

-- ─────────────────────────────────────────────────────────────────
-- 2. ADD MISSING PERFORMANCE INDEXES ON Log_Absen
--    These prevent full table scans on common query patterns.
-- ─────────────────────────────────────────────────────────────────

-- Index for filtering by employee NIP (rekap per pegawai)
CREATE INDEX IF NOT EXISTS idx_log_absen_nip 
  ON "Log_Absen" ("NIP");

-- Index for filtering by date (rekap per period)
CREATE INDEX IF NOT EXISTS idx_log_absen_tanggal 
  ON "Log_Absen" ("Tanggal");

-- Index for multi-tenant scoping
CREATE INDEX IF NOT EXISTS idx_log_absen_instansi 
  ON "Log_Absen" (instansi_id);

-- Composite index for the most common query pattern: rekap per instansi + period
CREATE INDEX IF NOT EXISTS idx_log_absen_instansi_tanggal 
  ON "Log_Absen" (instansi_id, "Tanggal");

-- Composite index for per-employee history within an instansi
CREATE INDEX IF NOT EXISTS idx_log_absen_instansi_nip 
  ON "Log_Absen" (instansi_id, "NIP");

-- Index for user ID (telegram_id) lookups
CREATE INDEX IF NOT EXISTS idx_log_absen_id 
  ON "Log_Absen" ("ID");

-- ─────────────────────────────────────────────────────────────────
-- 3. ADD INDEXES ON ket_temp FOR COMMON QUERIES
-- ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ket_temp_pegawai 
  ON ket_temp ("ID_Pegawai");

CREATE INDEX IF NOT EXISTS idx_ket_temp_nip 
  ON ket_temp ("NIP");

CREATE INDEX IF NOT EXISTS idx_ket_temp_status 
  ON ket_temp ("Status");

CREATE INDEX IF NOT EXISTS idx_ket_temp_instansi 
  ON ket_temp (instansi_id);

-- ─────────────────────────────────────────────────────────────────
-- 4. ADD FOREIGN KEY CONSTRAINTS
--    Using NOT VALID to avoid locking existing rows during creation.
--    Then VALIDATE separately.
-- ─────────────────────────────────────────────────────────────────

-- Log_Absen.ID → user_list.id (Telegram ID)
-- Note: Using ON DELETE SET NULL so deleting a user doesn't remove history
ALTER TABLE "Log_Absen"
  ADD CONSTRAINT fk_log_absen_user
  FOREIGN KEY ("ID") REFERENCES user_list(id)
  ON DELETE SET NULL
  NOT VALID;

-- ket_temp.ID_Pegawai → user_list.id
ALTER TABLE ket_temp
  ADD CONSTRAINT fk_ket_temp_user
  FOREIGN KEY ("ID_Pegawai") REFERENCES user_list(id)
  ON DELETE CASCADE
  NOT VALID;

-- tanda_tangan.telegram_id → user_list.id
ALTER TABLE tanda_tangan
  ADD CONSTRAINT fk_tanda_tangan_user
  FOREIGN KEY (telegram_id) REFERENCES user_list(id)
  ON DELETE CASCADE
  NOT VALID;

-- admin_list.telegram_id → user_list.id
ALTER TABLE admin_list
  ADD CONSTRAINT fk_admin_list_user
  FOREIGN KEY (telegram_id) REFERENCES user_list(id)
  ON DELETE CASCADE
  NOT VALID;

-- Now validate the constraints (this checks existing data but doesn't lock)
ALTER TABLE "Log_Absen" VALIDATE CONSTRAINT fk_log_absen_user;
ALTER TABLE ket_temp VALIDATE CONSTRAINT fk_ket_temp_user;
ALTER TABLE tanda_tangan VALIDATE CONSTRAINT fk_tanda_tangan_user;
ALTER TABLE admin_list VALIDATE CONSTRAINT fk_admin_list_user;

COMMIT;

-- ─────────────────────────────────────────────────────────────────
-- VERIFICATION: Run these queries to confirm fixes
-- ─────────────────────────────────────────────────────────────────

-- Check remaining triggers (should be exactly 3 n8n + 2 custom)
-- SELECT tgname, tgrelid::regclass 
-- FROM pg_trigger 
-- WHERE tgisinternal = false 
-- ORDER BY tgrelid::regclass, tgname;

-- Check indexes on Log_Absen
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'Log_Absen' 
-- ORDER BY indexname;

-- Check foreign keys
-- SELECT conname, conrelid::regclass, confrelid::regclass 
-- FROM pg_constraint 
-- WHERE contype = 'f' AND connamespace = 'public'::regnamespace;
