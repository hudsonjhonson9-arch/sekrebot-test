-- PATCH MULTI-TENANCY SIMAPO
-- Menambahkan kolom instansi_id ke tabel-tabel SIMAPO yang terlewat agar mencegah data bocor (data leak) antar dinas.

ALTER TABLE "SIMAPO".bidang ADD COLUMN IF NOT EXISTS instansi_id VARCHAR(50) DEFAULT 'bapperida';
ALTER TABLE "SIMAPO".users ADD COLUMN IF NOT EXISTS instansi_id VARCHAR(50) DEFAULT 'bapperida';
ALTER TABLE "SIMAPO".unit_aset ADD COLUMN IF NOT EXISTS instansi_id VARCHAR(50) DEFAULT 'bapperida';
ALTER TABLE "SIMAPO".stock_opname ADD COLUMN IF NOT EXISTS instansi_id VARCHAR(50) DEFAULT 'bapperida';
ALTER TABLE "SIMAPO".detail_opname ADD COLUMN IF NOT EXISTS instansi_id VARCHAR(50) DEFAULT 'bapperida';
ALTER TABLE "SIMAPO".request_barang ADD COLUMN IF NOT EXISTS instansi_id VARCHAR(50) DEFAULT 'bapperida';
ALTER TABLE "SIMAPO".detail_request ADD COLUMN IF NOT EXISTS instansi_id VARCHAR(50) DEFAULT 'bapperida';
ALTER TABLE "SIMAPO".riwayat_pemeliharaan ADD COLUMN IF NOT EXISTS instansi_id VARCHAR(50) DEFAULT 'bapperida';
ALTER TABLE "SIMAPO".detail_pemeliharaan ADD COLUMN IF NOT EXISTS instansi_id VARCHAR(50) DEFAULT 'bapperida';
ALTER TABLE "SIMAPO".detail_distribusi_aset ADD COLUMN IF NOT EXISTS instansi_id VARCHAR(50) DEFAULT 'bapperida';
ALTER TABLE "SIMAPO".jadwal_maintenance ADD COLUMN IF NOT EXISTS instansi_id VARCHAR(50) DEFAULT 'bapperida';
ALTER TABLE "SIMAPO".mutasi_barang ADD COLUMN IF NOT EXISTS instansi_id VARCHAR(50) DEFAULT 'bapperida';

-- Tambahan untuk stock opname agar mengetahui siapa yang membuat
ALTER TABLE "SIMAPO".stock_opname ADD COLUMN IF NOT EXISTS createdbyid TEXT;

-- Tambahkan index agar pencarian per instansi menjadi cepat
CREATE INDEX IF NOT EXISTS idx_barang_instansi ON "SIMAPO".barang(instansi_id);
CREATE INDEX IF NOT EXISTS idx_mutasi_instansi ON "SIMAPO".mutasi_barang(instansi_id);
CREATE INDEX IF NOT EXISTS idx_peminjaman_instansi ON "SIMAPO".peminjaman(instansi_id);
CREATE INDEX IF NOT EXISTS idx_tiket_instansi ON "SIMAPO".tiket_kerusakan(instansi_id);
CREATE INDEX IF NOT EXISTS idx_opname_instansi ON "SIMAPO".stock_opname(instansi_id);
