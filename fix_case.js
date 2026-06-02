const fs = require('fs');
let js = fs.readFileSync('js/admin-lokasi-v9.js', 'utf8');

js = js.split('const isChecked = instansiArr.includes(ins.id);').join('const insId = (ins.id || ins.ID || ins.instansi_id || "").toLowerCase(); const isChecked = instansiArr.some(a => a.toLowerCase() === insId);');

fs.writeFileSync('js/admin-lokasi-v9.js', js, 'utf8');
console.log('Fixed case sensitivity for includes check!');
