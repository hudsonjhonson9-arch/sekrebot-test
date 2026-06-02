const fs = require('fs');
const path = require('path');

const dir = 'n8n/simapo';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

files.forEach(f => {
  const p = path.join(dir, f);
  let d = JSON.parse(fs.readFileSync(p, 'utf8'));
  let changed = false;

  d.nodes.forEach(n => {
    if (n.type === 'n8n-nodes-base.respondToWebhook') {
      if (n.parameters) {
        n.parameters.respondWith = 'text';
        n.parameters.responseBody = '={{ JSON.stringify($json) }}';
        if (!n.parameters.options) n.parameters.options = {};
        n.parameters.options.responseHeaders = {
          entries: [
            { name: "Content-Type", value: "application/json" }
          ]
        };
        changed = true;
      }
    }
  });

  if (changed) {
    fs.writeFileSync(p, JSON.stringify(d, null, 2));
    console.log('Fixed Respond Node in ' + f);
  }
});
