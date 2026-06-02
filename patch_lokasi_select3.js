const fs = require('fs');
let lok = fs.readFileSync('js/admin-lokasi-v9.js', 'utf8');

const regex = /if\s*\(\s*isSuperAdminUser\(\)\s*&&\s*\$\('adminLokasiInstansiSection'\)\s*&&\s*\$\('adminLokasiInstansiSelect'\)\s*\)\s*\{[\s\S]*?sel\.value\s*=\s*currentVal;\s*\}/;

const replaced = lok.replace(regex, 'if(typeof window.populateAdminLokasiInstansiSelect === "function") window.populateAdminLokasiInstansiSelect();');

fs.writeFileSync('js/admin-lokasi-v9.js', replaced);
console.log('Replaced using more robust regex.');
