const fs = require('fs');
const path = require('path');

const n8nDir = path.join('d:', 'Code', 'absensi_refactored_v6', 'n8n');
const files = ['AbsensiBot V.5.1.json', 'AbsensiBot V.5.1.backup.json'];

files.forEach(file => {
  const filePath = path.join(n8nDir, file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let data = JSON.parse(content);
  
  let updated = false;
  
  data.nodes.forEach(node => {
    if (node.type === 'n8n-nodes-base.code' || node.name.includes('Code') || node.name.includes('Map')) {
      let jsCode = node.parameters.jsCode || '';
      
      // Look for the default fallback in object building (Add logic)
      if (jsCode.includes("body.hari || 'senin,selasa,rabu,kamis,jumat'")) {
        jsCode = jsCode.replace(
          "body.hari || 'senin,selasa,rabu,kamis,jumat'",
          "body.hari || ''"
        );
        node.parameters.jsCode = jsCode;
        updated = true;
      }
      
      // Look for the default fallback in response mapping (Get logic)
      if (jsCode.includes("r.json.hari     || r.json.Hari     || 'senin,selasa,rabu,kamis,jumat'")) {
        jsCode = jsCode.replace(
          "r.json.hari     || r.json.Hari     || 'senin,selasa,rabu,kamis,jumat'",
          "r.json.hari     || r.json.Hari     || ''"
        );
        node.parameters.jsCode = jsCode;
        updated = true;
      }
    }
  });
  
  if (updated) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Updated n8n workflow: ${file}`);
  }
});
