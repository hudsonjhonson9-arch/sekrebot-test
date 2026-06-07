-- migration_002_security_fk.sql
-- Menambahkan Foreign Key untuk integritas data absensi

BEGIN;

-- 1. Hapus data yatim (orphan) jika ada, agar constraint FK tidak error
DELETE FROM "Log_Absen" WHERE "ID" NOT IN (SELECT id FROM user_list) AND "ID" IS NOT NULL;
DELETE FROM ket_temp WHERE "ID_Pegawai" NOT IN (SELECT id FROM user_list) AND "ID_Pegawai" IS NOT NULL;
DELETE FROM tanda_tangan WHERE telegram_id NOT IN (SELECT id FROM user_list);

-- 2. Tambahkan constraint Foreign Key (Idempotent)
ALTER TABLE "Log_Absen" DROP CONSTRAINT IF EXISTS fk_log_absen_user;
ALTER TABLE "Log_Absen"
ADD CONSTRAINT fk_log_absen_user 
FOREIGN KEY ("ID") 
REFERENCES user_list (id) 
ON DELETE CASCADE;

ALTER TABLE ket_temp DROP CONSTRAINT IF EXISTS fk_ket_temp_user;
ALTER TABLE ket_temp
ADD CONSTRAINT fk_ket_temp_user 
FOREIGN KEY ("ID_Pegawai") 
REFERENCES user_list (id) 
ON DELETE CASCADE;

ALTER TABLE tanda_tangan DROP CONSTRAINT IF EXISTS fk_tanda_tangan_user;
ALTER TABLE tanda_tangan
ADD CONSTRAINT fk_tanda_tangan_user 
FOREIGN KEY (telegram_id) 
REFERENCES user_list (id) 
ON DELETE CASCADE;

-- 3. Hapus trigger lama N8n jika terdeteksi lebih dari 3 (opsional pembersihan)
DO $$ 
DECLARE
    r RECORD;
    trigger_count INT;
BEGIN
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'Log_Absen' AND trigger_name LIKE 'n8n_trigger_%';
    IF trigger_count > 3 THEN
        FOR r IN SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'Log_Absen' AND trigger_name LIKE 'n8n_trigger_%'
        LOOP
            EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON "Log_Absen"';
        END LOOP;
        RAISE NOTICE 'Semua trigger n8n pada Log_Absen dihapus. N8n akan membuatnya ulang saat node aktif dijalankan.';
    END IF;
END $$;

COMMIT;
