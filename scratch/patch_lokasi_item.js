const fs = require('fs');

let js = fs.readFileSync('js/admin-lokasi.js', 'utf8');

// Inside loadLokasiAdmin, remove the generation of checkboxes for each location item
// Find the block:
// ${isSuperAdminUser() ? `...<div id="instansi-grid-${id}"...` : `<input type="hidden" id="instansi-input-${id}" value="${instansiVal}" />`}
js = js.replace(/\$\{isSuperAdminUser\(\)\s*\?\s*`[\s\S]*?`\s*:\s*`<input type="hidden" id="instansi-input-\$\{id\}" value="\$\{instansiVal\}" \/>`\}/g, 
  `<input type="hidden" id="instansi-input-\${id}" value="\${instansiVal}" />`
);

// Inside simpanPerubahanLokasi, simplify getting instansi_id
// Find:
// let instansi_id = 'bapperida';
// if (isSuperAdminUser() && $(`instansi-grid-${id}`)) { ... } else { ... }
js = js.replace(/let instansi_id = 'bapperida';\s*if \(isSuperAdminUser\(\) && \$\(`instansi-grid-\$\{id\}`\)\) \{[\s\S]*?\} else \{[\s\S]*?\}/g, 
  `let instansi_id = $(` + '`instansi-input-${id}`' + `)?.value || 'bapperida';`
);

fs.writeFileSync('js/admin-lokasi.js', js, 'utf8');
console.log('admin-lokasi.js item UI patched');
