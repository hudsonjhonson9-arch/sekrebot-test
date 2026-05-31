const fs = require('fs');
const path = require('path');

const p = path.join('n8n/simapo', '02_peminjaman.json');
let data = JSON.parse(fs.readFileSync(p, 'utf8'));
data.nodes.forEach(n => {
  if (n.name === 'PG List' && n.parameters && typeof n.parameters.query === 'string') {
    let q = n.parameters.query;
    if (!q.includes('b.jenisbarang')) {
      q = q.replace(
        'b.kodebarang,',
        'b.kodebarang, b.jenisbarang,'
      );
      n.parameters.query = q;
    }
  }

  if (n.name === 'PG Admin List' && n.parameters && typeof n.parameters.query === 'string') {
    let q = n.parameters.query;
    if (!q.includes('b.jenisbarang')) {
      q = q.replace(
        'b.kodebarang,',
        'b.kodebarang, b.jenisbarang,'
      );
      n.parameters.query = q;
    }
  }

  if (n.name === 'PG Admin Pinjam Action' && n.parameters && typeof n.parameters.query === 'string') {
    if (!n.parameters.query.includes('WITH p_old AS')) {
      n.parameters.query = `WITH p_old AS (
  SELECT id, unitasetid, COALESCE(jumlah, 1) as jumlah, status FROM "SIMAPO".peminjaman WHERE id = '{{ ($json.body.id).toString().replace(/'/g, "''") }}'
),
p_upd AS (
  UPDATE "SIMAPO".peminjaman 
  SET status = '{{ ($json.body.status).toString().replace(/'/g, "''") }}', updatedat = NOW() 
  WHERE id = '{{ ($json.body.id).toString().replace(/'/g, "''") }}' 
  RETURNING id, status, unitasetid, COALESCE(jumlah, 1) as jumlah
),
b_upd AS (
  UPDATE "SIMAPO".barang b
  SET stok_saat_ini = b.stok_saat_ini + 
      CASE 
          WHEN p_old.status = 'MENUNGGU' AND p_upd.status IN ('DIPINJAM', 'SELESAI') THEN -p_upd.jumlah
          WHEN (p_old.status = 'DIPINJAM' OR p_old.status = 'MENUNGGU') AND p_upd.status IN ('DIKEMBALIKAN', 'KEMBALI') THEN p_upd.jumlah
          ELSE 0
      END
  FROM p_old, p_upd
  WHERE b.id = p_upd.unitasetid
)
SELECT id, status FROM p_upd;`;
    }
  }
});

fs.writeFileSync(p, JSON.stringify(data, null, 2));
console.log('Patched 02_peminjaman.json logic stok');
