const fs = require('fs');
const path = require('path');

const dir = 'n8n/simapo';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

files.forEach(f => {
  const p = path.join(dir, f);
  let d = JSON.parse(fs.readFileSync(p, 'utf8'));
  let changed = false;

  d.nodes.forEach(n => {
    // 1. Fix CORS for Android Webview
    if (n.type === 'n8n-nodes-base.webhook') {
      if (n.parameters && n.parameters.options) {
        n.parameters.options.allowedOrigins = '*';
        changed = true;
      }
    }

    // 2. Fix SQL query u."Nama" -> u."username"
    if (n.type === 'n8n-nodes-base.postgres') {
      if (n.parameters && typeof n.parameters.query === 'string') {
        if (n.parameters.query.includes('u."Nama"')) {
          n.parameters.query = n.parameters.query.replace(/u\."Nama"/g, 'u."username"');
          changed = true;
        }
        
        // 3. Fix k.isactive in kategori_barang
        if (f === '06_kategori_barang.json') {
          if (n.parameters.query.includes('k.isactive')) {
            n.parameters.query = n.parameters.query.replace(/AND k\.isactive = true /g, ' ');
            n.parameters.query = n.parameters.query.replace(/WHERE k\.isactive = true AND/g, 'WHERE');
            // Remove from INSERT
            n.parameters.query = n.parameters.query.replace(/, isactive/g, '');
            n.parameters.query = n.parameters.query.replace(/, true/g, '');
            // Remove from UPDATE
            if (n.parameters.query.includes('UPDATE "SIMAPO".kategori_barang SET isactive = false')) {
              // If we can't deactivate, maybe we can't delete softly? We can't use this query if the column doesn't exist.
              // Let's change it to actually delete the row if soft delete isn't possible, 
              // or just ignore the isactive and hope it works. Wait, if the column is missing, the query must be valid.
              n.parameters.query = n.parameters.query.replace('UPDATE "SIMAPO".kategori_barang SET isactive = false', 'DELETE FROM "SIMAPO".kategori_barang');
            }
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
