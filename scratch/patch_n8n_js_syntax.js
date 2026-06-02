const fs = require('fs');
const path = require('path');

const dir = 'n8n/simapo';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

files.forEach(f => {
  const p = path.join(dir, f);
  let d = JSON.parse(fs.readFileSync(p, 'utf8'));
  let changed = false;

  d.nodes.forEach(n => {
    if (n.type === 'n8n-nodes-base.postgres' && n.parameters && n.parameters.query) {
      let q = n.parameters.query;
      
      // Fix syntax error inside {{ ... }}
      // Replace ''bapperida'' with 'bapperida'
      if (q.includes("''bapperida''")) {
        q = q.replace(/''bapperida''/g, "'bapperida'");
        changed = true;
      }
      
      // Replace replace(/'/g, '''') with replace(/'/g, "''")
      if (q.includes("replace(/'/g, '''')")) {
        q = q.replace(/replace\(\/'\/g, ''''\)/g, "replace(/'/g, \"''\")");
        changed = true;
      }

      n.parameters.query = q;
    }
  });

  if (changed) {
    fs.writeFileSync(p, JSON.stringify(d, null, 2));
    console.log('Fixed syntax in ' + f);
  }
});
