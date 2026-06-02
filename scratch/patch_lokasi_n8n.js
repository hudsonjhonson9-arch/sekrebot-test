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
      // Update Lokasi Add
      if (query.includes('INSERT INTO "lokasiabsen" ("Nama_Lokasi", "latitude", "longitude", "hari", "radius", "ip_range") VALUES')) {
        query = query.replace(
          'INSERT INTO "lokasiabsen" ("Nama_Lokasi", "latitude", "longitude", "hari", "radius", "ip_range") VALUES',
          'INSERT INTO "lokasiabsen" ("Nama_Lokasi", "latitude", "longitude", "hari", "radius", "ip_range", "instansi_id") VALUES'
        );
        query = query.replace(
          ') RETURNING *',
          ", '{{ ($('Lokasi-Add').item.json.body.instansi_id || \"bapperida\").toString().replace(/'/g, \\\"''\\\") }}') RETURNING *"
        );
        node.parameters.query = query;
        updated = true;
      }
      
      // Update Lokasi Update
      if (query.includes('UPDATE "lokasiabsen" SET "hari" =') && !query.includes('instansi_id" =')) {
        query = query.replace(
          'WHERE "id" =',
          `, "instansi_id" = '{{ ($json.instansi_id || "bapperida").toString().replace(/'/g, \\"''\\") }}' WHERE "id" =`
        );
        node.parameters.query = query;
        updated = true;
      }
    }
    
    // Update Validasi Absen (JS Node)
    if (node.name === 'Validasi Absen' || node.name === 'Validasi Absen V2' || node.type === 'n8n-nodes-base.code') {
      let jsCode = node.parameters.jsCode || '';
      if (jsCode.includes('// 1. Cek hari (wajib untuk semua lokasi, termasuk WFH)')) {
        if (!jsCode.includes('if (!hariStr) continue; // If no days are assigned')) {
          jsCode = jsCode.replace(
            "const hariStr = String(lok.hari || '').toLowerCase();\n    if (hariStr) {",
            "const hariStr = String(lok.hari || '').toLowerCase();\n    if (!hariStr) continue; // If no days are assigned, skip this location\n    if (hariStr) {"
          );
          node.parameters.jsCode = jsCode;
          updated = true;
        }
      }
    }
  });
  
  if (updated) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Updated n8n workflow: ${file}`);
  }
});
