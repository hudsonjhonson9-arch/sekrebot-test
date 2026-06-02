const fs = require('fs');
const path = require('path');

// Patch 04_mutasi_stok.json
const p4 = 'n8n/simapo/04_mutasi_stok.json';
let d4 = JSON.parse(fs.readFileSync(p4, 'utf8'));

d4.nodes.forEach(n => {
  if (n.name === 'Calc Mutasi') {
    if (!n.parameters.jsCode.includes('instansi_id:')) {
      n.parameters.jsCode = n.parameters.jsCode.replace(
        "tanggal: new Date().toISOString()",
        "tanggal: new Date().toISOString(),\n  instansi_id: b.instansi_id || $input.item.json.query?.instansi_id || 'bapperida'"
      );
    }
  }
  if (n.name === 'PG Save Mutasi') {
    if (!n.parameters.query.includes('instansi_id')) {
      n.parameters.query = n.parameters.query.replace(
        "(id, barangmasukid, barangkeluarid, createdbyid, jumlah, keterangan, tanggal)",
        "(id, barangmasukid, barangkeluarid, createdbyid, jumlah, keterangan, tanggal, instansi_id)"
      ).replace(
        "'{{ ($json.tanggal).toString().replace(/'/g, \"''\") }}')",
        "'{{ ($json.tanggal).toString().replace(/'/g, \"''\") }}', '{{ ($json.instansi_id || \"bapperida\").toString().replace(/'/g, \"''\") }}')"
      );
    }
  }
  if (n.name === 'PG Mutasi List') {
    if (!n.parameters.query.includes('m.instansi_id')) {
      n.parameters.query = n.parameters.query.replace(
        "ORDER BY m.tanggal DESC",
        "WHERE m.instansi_id = '{{ ($json.query.instansi_id || ''bapperida'').toString().replace(/'/g, '''') }}' ORDER BY m.tanggal DESC"
      );
    }
  }
});
fs.writeFileSync(p4, JSON.stringify(d4, null, 2));
console.log('Patched ' + p4);

// Patch 05_stok_opname.json
const p5 = 'n8n/simapo/05_stok_opname.json';
let d5 = JSON.parse(fs.readFileSync(p5, 'utf8'));

d5.nodes.forEach(n => {
  if (n.name === 'Insert Opname Head') {
    if (!n.parameters.query.includes('instansi_id')) {
      n.parameters.query = n.parameters.query.replace(
        "(id, nomoropname, tanggal, status, createdat, updatedat)",
        "(id, nomoropname, tanggal, status, createdat, updatedat, instansi_id, createdbyid)"
      ).replace(
        "NOW(), NOW())",
        "NOW(), NOW(), '{{ ($json.body.instansi_id || $json.query.instansi_id || \"bapperida\").toString().replace(/'/g, \"''\") }}', '{{ ($json.headers[\"x-nip\"] || $json.body.nip || \"ADMIN\").toString().replace(/'/g, \"''\") }}')"
      );
    }
  }
  if (n.name === 'Prepare Details') {
    if (!n.parameters.jsCode.includes('instansi_id')) {
       // Also pass instansi_id to details so they can save it
       n.parameters.jsCode = n.parameters.jsCode.replace(
        "opnameid, ",
        "opnameid,\n  instansi_id: b.instansi_id || $input.item.json.query?.instansi_id || 'bapperida',"
       );
    }
  }
  if (n.name === 'PG Insert Detail & Update') {
    if (!n.parameters.query.includes('instansi_id')) {
      n.parameters.query = n.parameters.query.replace(
        "(id, opnameid, barangid, stoksistem, stokfisik, selisih)",
        "(id, opnameid, barangid, stoksistem, stokfisik, selisih, instansi_id)"
      ).replace(
        "{{ ($json.selisih).toString().replace(/'/g, \"''\") }});",
        "{{ ($json.selisih).toString().replace(/'/g, \"''\") }}, '{{ ($json.instansi_id || \"bapperida\").toString().replace(/'/g, \"''\") }}');"
      );
    }
  }
});
fs.writeFileSync(p5, JSON.stringify(d5, null, 2));
console.log('Patched ' + p5);
