-- Menambahkan Index untuk mempercepat query pencarian dan relasi di skema "SIMAPO" berdasarkan skema asli

-- 1. Index pada tabel barang
CREATE INDEX IF NOT EXISTS idx_barang_nama ON "SIMAPO".barang (nama);
CREATE INDEX IF NOT EXISTS idx_barang_kode ON "SIMAPO".barang (kodebarang);
CREATE INDEX IF NOT EXISTS idx_barang_kat ON "SIMAPO".barang (kategoriid);
CREATE INDEX IF NOT EXISTS idx_barang_active ON "SIMAPO".barang (isactive);

-- 2. Index pada tabel peminjaman
CREATE INDEX IF NOT EXISTS idx_pinjam_userid ON "SIMAPO".peminjaman (userid);
CREATE INDEX IF NOT EXISTS idx_pinjam_unitasetid ON "SIMAPO".peminjaman (unitasetid);
CREATE INDEX IF NOT EXISTS idx_pinjam_status ON "SIMAPO".peminjaman (status);

-- 3. Index pada tabel tiket_kerusakan
CREATE INDEX IF NOT EXISTS idx_tiket_userid ON "SIMAPO".tiket_kerusakan (userid);
CREATE INDEX IF NOT EXISTS idx_tiket_status ON "SIMAPO".tiket_kerusakan (status);

-- 4. Index pada tabel mutasi_barang
CREATE INDEX IF NOT EXISTS idx_mutasi_masuk ON "SIMAPO".mutasi_barang (barangmasukid);
CREATE INDEX IF NOT EXISTS idx_mutasi_keluar ON "SIMAPO".mutasi_barang (barangkeluarid);
CREATE INDEX IF NOT EXISTS idx_mutasi_date ON "SIMAPO".mutasi_barang (tanggal DESC);

-- 5. Index pada detail_opname
CREATE INDEX IF NOT EXISTS idx_opname_barang ON "SIMAPO".detail_opname (barangid);
CREATE INDEX IF NOT EXISTS idx_opname_head ON "SIMAPO".detail_opname (opnameid);

-- Analyze
ANALYZE "SIMAPO".barang;
ANALYZE "SIMAPO".peminjaman;
ANALYZE "SIMAPO".tiket_kerusakan;
ANALYZE "SIMAPO".mutasi_barang;
ANALYZE "SIMAPO".detail_opname;
