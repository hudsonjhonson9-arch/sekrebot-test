const fs = require('fs');
const lines = fs.readFileSync('d:/Code/n8n_workflows/Ket absensi wf.json', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('"name": "Validasi & Cek Bukti"'));
if (idx !== -1) {
    console.log('Definition Line:', idx + 1);
    // Find jsCode line relative to definition
    for (let i = idx; i > idx - 100; i--) {
        if (lines[i].includes('"jsCode":')) {
            console.log('jsCode Line:', i + 1);
            break;
        }
    }
}
