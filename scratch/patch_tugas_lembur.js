const fs = require('fs');
const path = require('path');

const wfPath = path.join('d:', 'Code', 'absensi_refactored_v6', 'n8n', 'tugas_lembur_wf.json');
let content = fs.readFileSync(wfPath, 'utf8');
let wf = JSON.parse(content);

wf.nodes.forEach(node => {
  if (node.type === 'n8n-nodes-base.postgres' && node.parameters && node.parameters.query) {
    let q = node.parameters.query;

    if (node.name === 'Postgres: Select Penugasan') {
      // Add instansi_id to select
      // Original: `SELECT * FROM penugasan WHERE created_by_nip = '${$json.query.created_by_nip}' ORDER BY tanggal DESC LIMIT ${$json.query.limit || 30};` : 
      // Replace with properly sanitized query and instansi_id filtering
      q = ` {{ (() => {
  const q = $json.query || {};
  const instansi = (q.instansi_id || 'bapperida').replace(/'/g, "''");
  const limit = parseInt(q.limit) || 100;
  
  if (q.created_by_nip) {
    return \\\`SELECT * FROM penugasan WHERE created_by_nip = '\\\${q.created_by_nip.replace(/'/g, "''")}' AND instansi_id = '\\\${instansi}' ORDER BY tanggal DESC LIMIT \\\${limit};\\\`;
  }
  if (q.nip === 'all' || !q.nip) {
    return \\\`SELECT * FROM penugasan WHERE instansi_id = '\\\${instansi}' ORDER BY tanggal DESC LIMIT \\\${limit};\\\`;
  }
  return \\\`SELECT * FROM penugasan WHERE nip = '\\\${q.nip.replace(/'/g, "''")}' AND instansi_id = '\\\${instansi}' ORDER BY tanggal DESC LIMIT \\\${limit};\\\`;
})() }}`;
    }

    if (node.name === 'Postgres: Save/Update' || node.name === 'Postgres: Try Direct Save') {
      q = ` {{ (() => {
  const b = $json.body || {};
  const q = $json.query || {};
  const instansi = (b.instansi_id || q.instansi_id || 'bapperida').replace(/'/g, "''");
  
  if (b.id) {
    return \\\`UPDATE penugasan SET status = '\\\${(b.status || '').replace(/'/g, "''")}', bukti = '\\\${(b.bukti || '').replace(/'/g, "''")}', lat_pengerjaan = \\\${b.actual_lat || 0}, lon_pengerjaan = \\\${b.actual_lon || 0}, instansi_id = '\\\${instansi}' WHERE id = '\\\${b.id.replace(/'/g, "''")}' RETURNING *;\\\`;
  } else {
    return \\\`INSERT INTO penugasan (user_id, nama, nip, tanggal, lat, lon, keterangan, created_by, created_by_nip, radius, instansi_id) VALUES ('\\\${(b.user_id || '').replace(/'/g, "''")}', '\\\${(b.nama || '').replace(/'/g, "''")}', '\\\${(b.nip || '').replace(/'/g, "''")}', '\\\${(b.tanggal || '').replace(/'/g, "''")}', \\\${b.lat || 0}, \\\${b.lon || 0}, '\\\${(b.keterangan || '').replace(/'/g, "''")}', '\\\${(b.created_by || '').replace(/'/g, "''")}', '\\\${(b.created_by_nip || '').replace(/'/g, "''")}', \\\${b.radius || 100}, '\\\${instansi}') RETURNING *;\\\`;
  }
})() }}`;
    }

    node.parameters.query = q;
  }
});

fs.writeFileSync(wfPath, JSON.stringify(wf, null, 2));
console.log('tugas_lembur_wf.json successfully patched!');
