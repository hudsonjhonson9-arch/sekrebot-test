const fs = require('fs');
const path = require('path');

const dir = 'n8n/simapo';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

const allowed = 'https://absensi.mindcloud.my.id,https://sekrebot.vercel.app';

files.forEach(f => {
  const p = path.join(dir, f);
  let d = JSON.parse(fs.readFileSync(p, 'utf8'));
  let changed = false;

  d.nodes.forEach(n => {
    if (n.type === 'n8n-nodes-base.webhook') {
      if (!n.parameters) n.parameters = {};
      if (!n.parameters.options) n.parameters.options = {};
      
      // 1. Set specific allowed origins
      n.parameters.options.allowedOrigins = allowed;
      
      // 2. Enable Header Auth
      n.parameters.authentication = 'headerAuth';
      
      // 3. Link credential
      if (!n.credentials) n.credentials = {};
      n.credentials.httpHeaderAuth = {
        id: "simapo-auth",
        name: "SIMAPO Token"
      };
      
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(p, JSON.stringify(d, null, 2));
    console.log('Applied Auth & CORS to ' + f);
  }
});
