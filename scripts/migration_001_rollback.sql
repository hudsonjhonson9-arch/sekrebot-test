-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK for MIGRATION 001
-- Use this to undo the changes if something goes wrong.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- Rollback: Remove indexes (safe — n8n doesn't depend on indexes)
DROP INDEX IF EXISTS idx_log_absen_nip;
DROP INDEX IF EXISTS idx_log_absen_tanggal;
DROP INDEX IF EXISTS idx_log_absen_instansi;
DROP INDEX IF EXISTS idx_log_absen_instansi_tanggal;
DROP INDEX IF EXISTS idx_log_absen_instansi_nip;
DROP INDEX IF EXISTS idx_log_absen_id;
DROP INDEX IF EXISTS idx_ket_temp_pegawai;
DROP INDEX IF EXISTS idx_ket_temp_nip;
DROP INDEX IF EXISTS idx_ket_temp_status;
DROP INDEX IF EXISTS idx_ket_temp_instansi;

-- Rollback: Remove foreign keys
ALTER TABLE "Log_Absen" DROP CONSTRAINT IF EXISTS fk_log_absen_user;
ALTER TABLE ket_temp DROP CONSTRAINT IF EXISTS fk_ket_temp_user;
ALTER TABLE tanda_tangan DROP CONSTRAINT IF EXISTS fk_tanda_tangan_user;
ALTER TABLE admin_list DROP CONSTRAINT IF EXISTS fk_admin_list_user;

-- Note: Orphan triggers CANNOT be restored (they were dead weight).
-- N8n will recreate its own triggers if the workflow is re-activated.

COMMIT;
