const fs = require('fs');
const path = require('path');

const dir = 'n8n/simapo';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

files.forEach(f => {
  const p = path.join(dir, f);
  let d = JSON.parse(fs.readFileSync(p, 'utf8'));
  let changed = false;

  d.nodes.forEach(n => {
    // 1. Wrap Postgres SELECT queries
    if (n.type === 'n8n-nodes-base.postgres' && n.parameters && n.parameters.operation === 'executeQuery' && n.parameters.query) {
      let q = n.parameters.query.trim();
      if (q.toUpperCase().startsWith('SELECT') && !q.toUpperCase().includes('RETURNING') && !q.includes('json_agg')) {
        // Hapus titik koma di akhir
        if (q.endsWith(';')) q = q.slice(0, -1);
        
        n.parameters.query = `SELECT COALESCE(json_agg(t.*), '[]'::json) as items FROM (\n${q}\n) t;`;
        changed = true;
      }
    }

    // 2. Update Code nodes (Aggregator)
    if (n.type === 'n8n-nodes-base.code' && n.name.startsWith('Agg ')) {
      if (n.parameters && n.parameters.jsCode) {
        // Ubah logika agregasi agar langsung mengambil properti .items dari json_agg
        n.parameters.jsCode = "return [{ json: { data: $input.all()[0].json.items || [] } }];";
        changed = true;
      }
    }
  });

  if (changed) {
    fs.writeFileSync(p, JSON.stringify(d, null, 2));
    console.log('Fixed Postgres & Agg in ' + f);
  }
});
