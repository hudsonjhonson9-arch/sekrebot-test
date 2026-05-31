const fs = require('fs');
const path = require('path');

const p = path.join('n8n/simapo', '01_katalog_master_barang.json');
let data = JSON.parse(fs.readFileSync(p, 'utf8'));
data.nodes.forEach(n => {
  if (n.name === 'Agg' && n.parameters && n.parameters.jsCode) {
    if (!n.parameters.jsCode.includes('jenisbarang: b.jenisbarang')) {
      n.parameters.jsCode = n.parameters.jsCode.replace(
        "satuan: b.satuan || 'Unit',",
        "satuan: b.satuan || 'Unit',\n  jenisbarang: b.jenisbarang || 'Aset Tetap',"
      );
    }
  }
  
  if (n.name === 'PG Simpan' && n.parameters && typeof n.parameters.query === 'string') {
    let q = n.parameters.query;
    if (!q.includes('jenisbarang')) {
      q = q.replace(
        'satuan, spesifikasi',
        'satuan, jenisbarang, spesifikasi'
      );
      q = q.replace(
        `'{{ ($json.satuan).toString().replace(/'/g, "''") }}',`,
        `'{{ ($json.satuan).toString().replace(/'/g, "''") }}', '{{ ($json.jenisbarang).toString().replace(/'/g, "''") }}',`
      );
      q = q.replace(
        'satuan=EXCLUDED.satuan,',
        'satuan=EXCLUDED.satuan, jenisbarang=EXCLUDED.jenisbarang,'
      );
      n.parameters.query = q;
    }
  }

  // PG List and Admin List: SELECT jenisbarang
  if ((n.name === 'PG List' || n.name === 'PG Admin List') && n.parameters && typeof n.parameters.query === 'string') {
    let q = n.parameters.query;
    if (!q.includes('b.jenisbarang')) {
      q = q.replace(
        'b.satuan,',
        'b.satuan, b.jenisbarang,'
      );
      n.parameters.query = q;
    }
  }
});
fs.writeFileSync(p, JSON.stringify(data, null, 2));
console.log('Patched 01_katalog_master_barang.json');
