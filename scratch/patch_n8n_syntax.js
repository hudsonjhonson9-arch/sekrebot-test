const fs = require('fs');
const path = require('path');

const dir = 'n8n/simapo';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

files.forEach(f => {
  const p = path.join(dir, f);
  let d = JSON.parse(fs.readFileSync(p, 'utf8'));
  let changed = false;

  d.nodes.forEach(n => {
    // Fix Respon Body
    if (n.type === 'n8n-nodes-base.respondToWebhook') {
      if (n.parameters && n.parameters.responseBody === '={{ $json }}') {
        n.parameters.responseBody = '={{ JSON.stringify($json) }}';
        changed = true;
      }
    }
    
    // Fix Code filter
    if (n.type === 'n8n-nodes-base.code' && n.parameters && n.parameters.jsCode) {
      if (n.parameters.jsCode.includes('filter(j => Object.keys(j).length > 0)')) {
        n.parameters.jsCode = n.parameters.jsCode.replace(
          'filter(j => Object.keys(j).length > 0)',
          'filter(j => j && Object.keys(j).length > 0)'
        );
        changed = true;
      }
    }
  });

  if (changed) {
    fs.writeFileSync(p, JSON.stringify(d, null, 2));
    console.log('Fixed syntax in ' + f);
  }
});
