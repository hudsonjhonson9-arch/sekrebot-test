-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION 001 (REVISED) — Critical Database Fixes
-- Date: 2026-06-07
-- Target: PostgreSQL via pgAdmin on VPS
--
-- Split into 3 independent parts so each succeeds independently.
-- Run each section one at a time in pgAdmin Query Tool.
-- ═══════════════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  PART 1: REMOVE ORPHAN N8N TRIGGERS                          ║
-- ║  Run this FIRST. Safe — removes dead triggers only.           ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- Keep only the latest active set (highest OID):
--   INSERT: n8n_trigger_044feb24_9ad8_4c23_97ab_11a678798f06
--   UPDATE: n8n_trigger_5d35a042_f859_484a_9939_574b0310b8da
--   DELETE: n8n_trigger_9bf03d5c_4092_46d5_8a96_d802b896d1a8

-- Remove orphan INSERT triggers (5 removed, 1 kept)
DROP TRIGGER IF EXISTS n8n_trigger_a1633f07_462f_473f_97d9_b395f9d48de6 ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_c4c5379a_ebed_4833_b97b_a020a83be986 ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_22d4b7f4_ce61_4a73_9765_2264bdea61aa ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_c069a86e_1f1b_467b_b003_5217d915a9cc ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_dd135398_1d95_492b_9e18_271503c04afe ON "Log_Absen";

-- Remove orphan UPDATE triggers (4 removed, 1 kept)
DROP TRIGGER IF EXISTS n8n_trigger_e4b26935_4175_40e4_851e_badf2b490e93 ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_774aa9d8_c056_45a4_bb35_cb1823893d6b ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_4ee6611a_9793_4045_bfc4_0dbdaefd6435 ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_6cebb34e_99ab_48b5_89a6_9965ba593934 ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_cc142a57_0943_4888_a0d9_8e5bdcba642f ON "Log_Absen";

-- Remove orphan DELETE triggers (4 removed, 1 kept)
DROP TRIGGER IF EXISTS n8n_trigger_95f9d18b_1460_42d3_aee6_8c7f314c02fa ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_2c2dd5e1_3330_489c_9d60_dee1bf317074 ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_6f364bfc_29ba_4710_b58c_d0fb40ba30c8 ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_9163835d_477b_47a5_a352_b8902d3f4625 ON "Log_Absen";
DROP TRIGGER IF EXISTS n8n_trigger_8afd0cb9_28d6_4627_a082_aef11c85a412 ON "Log_Absen";

-- Clean up orphan functions (functions tanpa trigger)
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
DROP FUNCTION IF EXISTS n8n_trigger_function_41cc6d43_69d9_4a41_a079_b3b5e566c2a7() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_608c50ba_4108_4e79_94df_fb48984221b9() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_76938b0e_a0b6_4bac_bbbf_937e1b273ad1() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_bdd8cb7c_8b00_4c88_8059_cf904916228f() CASCADE;
DROP FUNCTION IF EXISTS n8n_trigger_function_dc905506_3744_4bb4_b6e1_ce4c466ea70b() CASCADE;

-- ✅ VERIFY PART 1: Should show exactly 3 n8n triggers + 2 custom triggers
SELECT tgname, tgrelid::regclass as tabel,
  CASE WHEN tgtype & 4 = 4 THEN 'INSERT'
       WHEN tgtype & 8 = 8 THEN 'DELETE'
       WHEN tgtype & 16 = 16 THEN 'UPDATE'
  END as event
FROM pg_trigger
WHERE tgisinternal = false
ORDER BY tgrelid::regclass, tgname;


-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  PART 2: ADD PERFORMANCE INDEXES                              ║
-- ║  Run this SECOND. Safe — only adds indexes, no data changes.  ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- Log_Absen indexes
CREATE INDEX IF NOT EXISTS idx_log_absen_nip 
  ON "Log_Absen" ("NIP");

CREATE INDEX IF NOT EXISTS idx_log_absen_tanggal 
  ON "Log_Absen" ("Tanggal");

CREATE INDEX IF NOT EXISTS idx_log_absen_instansi 
  ON "Log_Absen" (instansi_id);

CREATE INDEX IF NOT EXISTS idx_log_absen_instansi_tanggal 
  ON "Log_Absen" (instansi_id, "Tanggal");

CREATE INDEX IF NOT EXISTS idx_log_absen_instansi_nip 
  ON "Log_Absen" (instansi_id, "NIP");

CREATE INDEX IF NOT EXISTS idx_log_absen_id 
  ON "Log_Absen" ("ID");

-- ket_temp indexes
CREATE INDEX IF NOT EXISTS idx_ket_temp_pegawai 
  ON ket_temp ("ID_Pegawai");

CREATE INDEX IF NOT EXISTS idx_ket_temp_nip 
  ON ket_temp ("NIP");

CREATE INDEX IF NOT EXISTS idx_ket_temp_status 
  ON ket_temp ("Status");

CREATE INDEX IF NOT EXISTS idx_ket_temp_instansi 
  ON ket_temp (instansi_id);

-- ✅ VERIFY PART 2: Should show new indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('Log_Absen', 'ket_temp')
ORDER BY tablename, indexname;


-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  PART 3: CLEANUP ORPHAN DATA + ADD FOREIGN KEYS              ║
-- ║  Run this LAST. Cleans orphan records first, then adds FKs.   ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- Step 3a: Preview orphan records (check before cleaning)
-- These are log entries from deleted employees
SELECT 'Log_Absen' as tabel, "ID_Log"::text as pk, "ID"::text as orphan_id, "Nama", "Tanggal"
FROM "Log_Absen" 
WHERE "ID" IS NOT NULL 
  AND "ID" NOT IN (SELECT id FROM user_list);

-- Step 3b: SET NULL on orphan references (preserve the log, just unlink the FK)
-- Data tetap ada, hanya kolom ID yang di-null-kan
UPDATE "Log_Absen" 
SET "ID" = NULL 
WHERE "ID" IS NOT NULL 
  AND "ID" NOT IN (SELECT id FROM user_list);

-- Step 3c: Clean orphans in other tables too (if any exist)
DELETE FROM ket_temp 
WHERE "ID_Pegawai" IS NOT NULL 
  AND "ID_Pegawai" NOT IN (SELECT id FROM user_list);

DELETE FROM tanda_tangan 
WHERE telegram_id IS NOT NULL 
  AND telegram_id NOT IN (SELECT id FROM user_list);

DELETE FROM admin_list 
WHERE telegram_id IS NOT NULL 
  AND telegram_id NOT IN (SELECT id FROM user_list);

-- Step 3d: Now add FK constraints (will succeed because orphans are cleaned)
ALTER TABLE "Log_Absen"
  ADD CONSTRAINT fk_log_absen_user
  FOREIGN KEY ("ID") REFERENCES user_list(id)
  ON DELETE SET NULL;

ALTER TABLE ket_temp
  ADD CONSTRAINT fk_ket_temp_user
  FOREIGN KEY ("ID_Pegawai") REFERENCES user_list(id)
  ON DELETE CASCADE;

ALTER TABLE tanda_tangan
  ADD CONSTRAINT fk_tanda_tangan_user
  FOREIGN KEY (telegram_id) REFERENCES user_list(id)
  ON DELETE CASCADE;

ALTER TABLE admin_list
  ADD CONSTRAINT fk_admin_list_user
  FOREIGN KEY (telegram_id) REFERENCES user_list(id)
  ON DELETE CASCADE;

-- ✅ VERIFY PART 3: Should show 4 foreign keys
SELECT conname as constraint_name, 
       conrelid::regclass as from_table, 
       confrelid::regclass as to_table
FROM pg_constraint 
WHERE contype = 'f' 
  AND connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass;
