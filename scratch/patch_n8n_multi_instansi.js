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
    if (node.type === 'n8n-nodes-base.postgres') {
      let query = node.parameters.query || '';
      
      // Update location fetching query
      if (query.includes("OR instansi_id = '{{ ($json.query.instansi_id).toString().replace(/'/g, \\\"''\\\") }}' OR instansi_id = 'all'")) {
        query = query.replace(
          "OR instansi_id = '{{ ($json.query.instansi_id).toString().replace(/'/g, \\\"''\\\") }}'",
          "OR instansi_id LIKE '%{{ ($json.query.instansi_id).toString().replace(/'/g, \\\"''\\\") }}%'"
        );
        node.parameters.query = query;
        updated = true;
      }
    }
  });
  
  if (updated) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Updated n8n workflow: ${file}`);
  }
});
