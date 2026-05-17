const fs = require('fs');
const path = 'd:/Code/n8n_workflows/Ket absensi wf.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

data.nodes.forEach(n => {
  if (n.name === 'Validasi & Cek Bukti') {
    if (!n.parameters.jsCode.includes('request_id:body.request_id||')) {
      n.parameters.jsCode = n.parameters.jsCode.replace(
        'keterangan:body.keterangan.trim(), timestamp:ts',
        'keterangan:body.keterangan.trim(), request_id:body.request_id||\'\', timestamp:ts'
      );
    }
  }
  
  if (n.name === 'Expand Auto Ada Bukti') {
    n.parameters.jsCode = `const driveLink = $input.first().json.webViewLink || $input.first().json.webContentLink || '';\nconst d = $('Validasi & Cek Bukti').first().json;\nconst prefixMap = { SAKIT: 'SKT', TUGAS: 'TGS' };\nconst prefix = prefixMap[d.jenis] || d.jenis.slice(0, 3).toUpperCase();\nconst tglKey = (d.tgl_mulai || '').replace(/-/g, '');\nreturn d.dates.map((tgl, i) => ({\n  json: {\n    ...d,\n    tanggal: tgl,\n    drive_link: driveLink,\n    id_ket: \`\${prefix}\${tglKey}_\${d.user_id}_\${String(i+1).padStart(2,'0')}\`,\n    request_id: (d.request_id || '') + '_' + tgl.replace(/-/g, '')\n  }\n}));`;
  }

  if (n.name === 'Expand Auto Tanpa Bukti') {
    n.parameters.jsCode = `const d = $input.first().json;\nconst prefixMap = { SAKIT: 'SKT', TUGAS: 'TGS' };\nconst prefix = prefixMap[d.jenis] || d.jenis.slice(0, 3).toUpperCase();\nconst tglKey = (d.tgl_mulai || '').replace(/-/g, '');\nreturn d.dates.map((tgl, i) => ({\n  json: {\n    ...d,\n    tanggal: tgl,\n    drive_link: '',\n    id_ket: \`\${prefix}\${tglKey}_\${d.user_id}_\${String(i+1).padStart(2,'0')}\`,\n    request_id: (d.request_id || '') + '_' + tgl.replace(/-/g, '')\n  }\n}));`;
  }

  if (n.name === 'Expand Log Approve') {
    n.parameters.jsCode = `const d = $input.first().json;\n\nconst dates = (d.dates && d.dates.length) ? d.dates : [d.row_tgl_mulai].filter(Boolean);\nif (!dates.length) return [{json:{...d, tanggal_this:'', id_ket: (d.target_id_ket||'UNK') + '_01'}}];\n\nconst prefixMap = { IZIN:'IZN', SAKIT:'SKT', TUGAS:'TGS' };\nconst jenisBase = (d.row_jenis_base||'').toUpperCase();\nconst prefix = prefixMap[jenisBase] || jenisBase.slice(0,3);\nconst tglKey = (d.row_tgl_mulai||'').replace(/-/g,'');\n\nconst out = [];\ndates.forEach((tgl, i) => {\n  const suffix = String(i+1).padStart(2,'0');\n  const tglSuffix = tgl.replace(/-/g, '');\n  // 1. Catat Keterangan Utama (IZIN/SAKIT/TUGAS)\n  out.push({\n    json: {\n      ...d,\n      tanggal_this: tgl,\n      id_ket: \`\${prefix}\${tglKey}_\${d.row_id}_\${suffix}\`,\n      request_id: (d.request_id || '') + '_' + tglSuffix + suffix\n    }\n  });\n\n  // 2. Jika IZIN dan Selesai >= 14:30, Otomatis Catat PULANG\n  const jamSelesai = d.row_jam_selesai || '';\n  if (jenisBase === 'IZIN' && jamSelesai >= '14:30') {\n    out.push({\n      json: {\n        ...d,\n        tanggal_this: tgl,\n        row_jenis_base: 'PULANG',\n        row_jam: jamSelesai,\n        row_ket: \`\${d.row_ket} (Auto Pulang dari Izin Jam)\`,\n        id_ket: \`PLG\${tglKey}_\${d.row_id}_\${suffix}\`,\n        request_id: (d.request_id || '') + '_' + tglSuffix + suffix + '_PLG'\n      }\n    });\n  }\n});\nreturn out;`;
  }
});

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('Successfully updated nodes in Ket absensi wf.json');
