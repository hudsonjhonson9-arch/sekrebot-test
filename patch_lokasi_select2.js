const fs = require('fs');
let lok = fs.readFileSync('js/admin-lokasi-v9.js', 'utf8');

const regex = /if\s*\(\s*isSuperAdminUser\(\)\s*&&\s*\$\('adminLokasiInstansiSection'\)\s*&&\s*\$\('adminLokasiInstansiSelect'\)\s*\)\s*\{[\s\S]*?sel\.innerHTML\s*=\s*opts;[\s\S]*?if\s*\(currentVal[^)]*\)\s*sel\.value\s*=\s*currentVal;\s*\}/;

lok = lok.replace(regex, 'if(typeof window.populateAdminLokasiInstansiSelect === "function") window.populateAdminLokasiInstansiSelect();');

fs.writeFileSync('js/admin-lokasi-v9.js', lok);
console.log('Patch 2 applied successfully.');
