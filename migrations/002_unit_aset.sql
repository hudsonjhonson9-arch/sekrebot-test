CREATE SCHEMA IF NOT EXISTS "SIMAPO";

CREATE TABLE IF NOT EXISTS "SIMAPO".unit_aset (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barangid    UUID NOT NULL REFERENCES "SIMAPO".barang(id) ON DELETE CASCADE,
  kodebarang  VARCHAR(50) NOT NULL,
  nomorinventaris VARCHAR(100),
  kondisi     VARCHAR(20) DEFAULT 'BAIK',
  statuspinjam  BOOLEAN DEFAULT false,
  nama_peminjam_saat_ini VARCHAR(255),
  foto        TEXT,
  qr          TEXT UNIQUE,
  isactive    BOOLEAN DEFAULT true,
  createdat   TIMESTAMPTZ DEFAULT NOW(),
  updatedat   TIMESTAMPTZ DEFAULT NOW(),
  instansi_id VARCHAR(50) DEFAULT 'bapperida'
);

CREATE INDEX IF NOT EXISTS idx_unit_aset_qr ON "SIMAPO".unit_aset(qr);
CREATE INDEX IF NOT EXISTS idx_unit_aset_barangid ON "SIMAPO".unit_aset(barangid);
CREATE INDEX IF NOT EXISTS idx_unit_aset_kodebarang ON "SIMAPO".unit_aset(kodebarang);
