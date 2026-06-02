const fs = require('fs');
const path = require('path');

const dir = 'n8n/simapo';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

files.forEach(f => {
  const p = path.join(dir, f);
  let d = JSON.parse(fs.readFileSync(p, 'utf8'));
  let changed = false;

  d.nodes.forEach(n => {
    // 1. Set alwaysOutputData: true for Postgres nodes that perform SELECT
    if (n.type === 'n8n-nodes-base.postgres' && n.parameters && n.parameters.query && n.parameters.query.trim().toUpperCase().startsWith('SELECT')) {
      if (!n.alwaysOutputData) {
        n.alwaysOutputData = true;
        changed = true;
      }
    }

    // 2. Patch Code nodes that aggregate data to filter out empty objects {}
    if (n.type === 'n8n-nodes-base.code' && n.parameters && n.parameters.jsCode) {
      if (n.parameters.jsCode.includes('map(i => i.json)') && !n.parameters.jsCode.includes('filter(')) {
        n.parameters.jsCode = n.parameters.jsCode.replace(
          'map(i => i.json)',
          'map(i => i.json).filter(j => Object.keys(j).length > 0)'
        );
        changed = true;
      }
    }
  });

  if (changed) {
    fs.writeFileSync(p, JSON.stringify(d, null, 2));
    console.log('Patched ' + f);
  }
});
