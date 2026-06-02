const fs = require('fs');
const filePath = 'd:/Code/absensi_refactored_v6/n8n/AbsensiBot V.5.1.json';
let content = fs.readFileSync(filePath, 'utf8');

const json = JSON.parse(content);

let found = false;
json.nodes.forEach(node => {
  if (node.name === 'Get Pegawai User-List' && node.parameters && node.parameters.query) {
    let q = node.parameters.query;
    
    // Replace SELECT * FROM public.view_user_mgmt
    // with SELECT v.*, u.role, u.is_admin FROM public.view_user_mgmt v JOIN user_list u ON v.id = u.id
    q = q.replace(/SELECT \* FROM public\.view_user_mgmt/g, 'SELECT v.*, u.role, u.is_admin FROM public.view_user_mgmt v JOIN user_list u ON v.id = u.id');
    
    // We also need to prefix the WHERE columns to avoid ambiguity, specifically instansi_id, "NIP", and "id"
    q = q.replace(/WHERE \n  \(instansi_id/g, 'WHERE \n  (v.instansi_id');
    q = q.replace(/OR \(\"NIP\"/g, 'OR (v."NIP"');
    q = q.replace(/OR \(\"id\"::text/g, 'OR (v."id"::text');
    
    node.parameters.query = q;
    found = true;
  }
});

if (found) {
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
  console.log('Query Get Pegawai User-List patched successfully.');
} else {
  console.log('Node Get Pegawai User-List not found.');
}
