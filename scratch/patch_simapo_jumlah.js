const fs = require('fs');
const path = require('path');

const dir = 'n8n/simapo';

// 1. Patch Kategori
const katPath = path.join(dir, '06_kategori_barang.json');
let katData = JSON.parse(fs.readFileSync(katPath, 'utf8'));
katData.nodes.forEach(n => {
  if (n.name === 'PG Kat Save' && n.parameters && typeof n.parameters.query === 'string') {
    if (!n.parameters.query.includes('ALTER TABLE')) {
      n.parameters.query = `ALTER TABLE "SIMAPO".kategori_barang ADD COLUMN IF NOT EXISTS instansi_id VARCHAR(100) DEFAULT 'bapperida';\n` + n.parameters.query;
    }
  }
});
fs.writeFileSync(katPath, JSON.stringify(katData, null, 2));
console.log('Patched 06_kategori_barang.json');

// 2. Patch Peminjaman
const pinjamPath = path.join(dir, '02_peminjaman.json');
let pinjamData = JSON.parse(fs.readFileSync(pinjamPath, 'utf8'));
pinjamData.nodes.forEach(n => {
  // Update node Agg (JS Code) to include jumlah
  if (n.name === 'Agg' && n.parameters && n.parameters.jsCode) {
    if (!n.parameters.jsCode.includes('jumlah: b.jumlah')) {
      n.parameters.jsCode = n.parameters.jsCode.replace(
        "tanggalselesai: b.tanggalselesai,",
        "tanggalselesai: b.tanggalselesai,\n  jumlah: b.jumlah || 1,"
      );
    }
  }
  
  // Update PG Simpan (INSERT) to include ALTER TABLE and jumlah
  if (n.name === 'PG Simpan' && n.parameters && typeof n.parameters.query === 'string') {
    let q = n.parameters.query;
    if (!q.includes('ALTER TABLE')) {
      q = `ALTER TABLE "SIMAPO".peminjaman ADD COLUMN IF NOT EXISTS jumlah INT DEFAULT 1;\n` + q;
    }
    if (!q.includes(', jumlah,')) {
      q = q.replace(
        'tanggalselesai, status,',
        'tanggalselesai, jumlah, status,'
      );
      q = q.replace(
        `'{{ ($json.tanggalselesai).toString().replace(/'/g, "''") }}', 'MENUNGGU',`,
        `'{{ ($json.tanggalselesai).toString().replace(/'/g, "''") }}', {{ $json.jumlah || 1 }}, 'MENUNGGU',`
      );
    }
    n.parameters.query = q;
  }

  // Update PG List (SELECT for User)
  if (n.name === 'PG List' && n.parameters && typeof n.parameters.query === 'string') {
    let q = n.parameters.query;
    if (!q.includes('p.jumlah')) {
      q = q.replace(
        'p.tujuanpeminjaman,',
        'p.tujuanpeminjaman, COALESCE(p.jumlah, 1) as jumlah,'
      );
    }
    n.parameters.query = q;
  }

  // Update PG Admin List (SELECT for Admin)
  if (n.name === 'PG Admin List' && n.parameters && typeof n.parameters.query === 'string') {
    let q = n.parameters.query;
    if (!q.includes('p.jumlah')) {
      q = q.replace(
        'p.tujuanpeminjaman,',
        'p.tujuanpeminjaman, COALESCE(p.jumlah, 1) as jumlah,'
      );
    }
    n.parameters.query = q;
  }
});
fs.writeFileSync(pinjamPath, JSON.stringify(pinjamData, null, 2));
console.log('Patched 02_peminjaman.json');
