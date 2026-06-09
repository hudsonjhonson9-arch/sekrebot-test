-- 1. Tambah kolom nip di tabel tanda_tangan
ALTER TABLE tanda_tangan ADD COLUMN IF NOT EXISTS nip text;

-- 2. Lakukan migrasi data dari tabel user_list ke tabel tanda_tangan
UPDATE tanda_tangan
SET nip = user_list."NIP"
FROM user_list
WHERE tanda_tangan.telegram_id = user_list.id;

-- 3. Hapus duplikat nip (jika ada) sebelum menerapkan UNIQUE constraint
-- Ini menghapus data lama dan mempertahankan data terbaru berdasarkan updated_at
DELETE FROM tanda_tangan
WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() over (partition by nip order by updated_at desc) as rn
    FROM tanda_tangan
    WHERE nip IS NOT NULL
  ) t WHERE rn > 1
);

-- 4. Terapkan UNIQUE constraint ke kolom nip agar UPSERT berfungsi
ALTER TABLE tanda_tangan DROP CONSTRAINT IF EXISTS tanda_tangan_nip_key;
ALTER TABLE tanda_tangan ADD CONSTRAINT tanda_tangan_nip_key UNIQUE (nip);

-- 5. Perbarui view_user_mgmt agar menggunakan relasi nip
DROP VIEW IF EXISTS view_user_mgmt;
CREATE OR REPLACE VIEW view_user_mgmt AS
SELECT id,
       username,
       "NIP",
       "Jabatan",
       "Status",
       tgl_pangkat,
       tgl_berkala,
       face_histogram,
       face_saved_at,
       no,
       face_photo,
       face_model,
       bidang,
       instansi_id,
       pangkat,
       nomorhp,
       role,
       is_admin,
       (face_histogram IS NOT NULL AND face_histogram <> '[]'::text AND face_histogram <> ''::text) AS has_face,
       (EXISTS ( SELECT 1
              FROM tanda_tangan
             WHERE tanda_tangan.nip = user_list."NIP")) AS has_signature
FROM user_list;
