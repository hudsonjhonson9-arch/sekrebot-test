const fs = require('fs');
const path = require('path');

const dir = 'n8n/simapo';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

files.forEach(f => {
  const p = path.join(dir, f);
  let d = JSON.parse(fs.readFileSync(p, 'utf8'));
  let changed = false;

  d.nodes.forEach(n => {
    if (n.type === 'n8n-nodes-base.postgres') {
      if (n.parameters && typeof n.parameters.query === 'string') {
        if (f === '06_kategori_barang.json') {
          // INSERT
          if (n.parameters.query.includes('INSERT INTO "SIMAPO".kategori_barang')) {
            n.parameters.query = n.parameters.query.replace(', isactive', '');
            n.parameters.query = n.parameters.query.replace(', true', '');
            changed = true;
          }
          // UPDATE
          if (n.parameters.query.includes('UPDATE "SIMAPO".kategori_barang SET isactive = false')) {
            n.parameters.query = n.parameters.query.replace('UPDATE "SIMAPO".kategori_barang SET isactive = false', 'DELETE FROM "SIMAPO".kategori_barang');
            changed = true;
          }
        }
      }
    }
  });

  if (changed) {
    fs.writeFileSync(p, JSON.stringify(d, null, 2));
    console.log('Patched ' + f);
  }
});
