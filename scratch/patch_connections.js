const fs = require('fs');
const path = require('path');

const wfPath = path.join('d:', 'Code', 'absensi_refactored_v6', 'n8n', 'tugas_lembur_wf.json');
let content = fs.readFileSync(wfPath, 'utf8');
let wf = JSON.parse(content);

if (wf.connections && wf.connections['Check Ada Bukti'] && wf.connections['Check Ada Bukti'].main) {
  // Ubah output ke-2 (index 1 / false) agar mengarah ke "Prepare Direct Save"
  wf.connections['Check Ada Bukti'].main[1] = [
    {
      "node": "Prepare Direct Save",
      "type": "main",
      "index": 0
    }
  ];
}

fs.writeFileSync(wfPath, JSON.stringify(wf, null, 2));
console.log('Koneksi tugas_lembur_wf.json berhasil diperbaiki!');
