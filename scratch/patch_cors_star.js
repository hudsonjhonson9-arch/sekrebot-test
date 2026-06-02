const fs = require('fs');
const path = require('path');

const dir = 'n8n/simapo';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

files.forEach(f => {
  const p = path.join(dir, f);
  let d = JSON.parse(fs.readFileSync(p, 'utf8'));
  let changed = false;

  d.nodes.forEach(n => {
    if (n.type === 'n8n-nodes-base.webhook') {
      if (n.parameters && n.parameters.options) {
        if (n.parameters.options.allowedOrigins !== '*') {
          n.parameters.options.allowedOrigins = '*';
          changed = true;
        }
      } else if (n.parameters) {
        n.parameters.options = { allowedOrigins: '*' };
        changed = true;
      }
    }
  });

  if (changed) {
    fs.writeFileSync(p, JSON.stringify(d, null, 2));
    console.log('Fixed CORS in ' + f);
  }
});
