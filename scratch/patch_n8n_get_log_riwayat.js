const fs = require('fs');
const filePath = 'd:/Code/absensi_refactored_v6/n8n/AbsensiBot V.5.1.json';
let content = fs.readFileSync(filePath, 'utf8');

const json = JSON.parse(content);

let found = false;
json.nodes.forEach(node => {
  if (node.name === 'Get Log Riwayat' && node.parameters && node.parameters.query) {
    let q = node.parameters.query;
    // We want to rewrite the query completely
    q = `SELECT * FROM "Log_Absen" WHERE 1=1 {{ $node["Riwayat"].json["query"]["nip"] ? "AND \\"NIP\\" = '" + $node["Riwayat"].json["query"]["nip"].toString().replace(/'/g, "''") + "'" : "" }} {{ $node["Riwayat"].json["query"]["user_id"] ? "AND \\"ID\\" = '" + $node["Riwayat"].json["query"]["user_id"].toString().replace(/'/g, "''") + "'" : "" }} {{ $node["Riwayat"].json["query"]["tanggal"] ? "AND \\"Tanggal\\" = '" + $node["Riwayat"].json["query"]["tanggal"].substring(0, 10).replace(/'/g, "''") + "'" : "" }} {{ $node["Riwayat"].json["query"]["dari"] && $node["Riwayat"].json["query"]["sampai"] ? "AND \\"Tanggal\\" >= '" + $node["Riwayat"].json["query"]["dari"].substring(0, 10).replace(/'/g, "''") + "' AND \\"Tanggal\\" <= '" + $node["Riwayat"].json["query"]["sampai"].substring(0, 10).replace(/'/g, "''") + "'" : "" }} {{ (!$node["Riwayat"].json["query"]["nip"] && !$node["Riwayat"].json["query"]["user_id"] && !$node["Riwayat"].json["query"]["tanggal"] && !($node["Riwayat"].json["query"]["dari"] && $node["Riwayat"].json["query"]["sampai"])) ? "AND \\"Tanggal\\" = (NOW() AT TIME ZONE 'Asia/Makassar')::date" : "" }} ORDER BY "Tanggal" DESC, "Jam" DESC`;
    
    node.parameters.query = q;
    found = true;
  }
});

if (found) {
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
  console.log('Query Get Log Riwayat patched successfully.');
} else {
  console.log('Node Get Log Riwayat not found.');
}
