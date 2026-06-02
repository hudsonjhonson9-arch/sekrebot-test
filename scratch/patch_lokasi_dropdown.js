const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. Remove instansiLokasiContainer from index.html
html = html.replace(/<div id="instansiLokasiContainer"[\s\S]*?<\/div>\s*<\/div>/, '');

// 2. Insert adminInstansiSelect right after "LOKASI PRESENSI</div>"
const insertHTML = `
          <div id="adminInstansiSection" style="display: none; margin-bottom: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px; box-sizing: border-box;">
            <div style="font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">🏢 Pilih Instansi (Superadmin)</div>
            <select id="adminInstansiSelect" class="form-input" style="width: 100%; height: 38px; cursor: pointer; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: var(--white); border-radius: 8px; padding: 0 10px;" onchange="if(typeof loadLokasiAdmin === 'function') loadLokasiAdmin()">
              <option value="">- Semua Instansi -</option>
            </select>
          </div>`;

html = html.replace(/(LOKASI PRESENSI<\/div>)/, `$1${insertHTML}`);

fs.writeFileSync('index.html', html, 'utf8');
console.log('index.html patched');

// Modify js/admin-lokasi.js
let js = fs.readFileSync('js/admin-lokasi.js', 'utf8');

// Remove toggleInstansiCheck
js = js.replace(/window\.toggleInstansiCheck = function\(lbl\) \{[\s\S]*?\};\n/, '');

// Inside loadLokasiAdmin, remove the checkbox generation
js = js.replace(/if\s*\(\s*isSuperAdminUser\(\)\s*&&\s*\$\('instansiLokasiContainer'\)\s*\)\s*\{[\s\S]*?\$\('instansiLokasiContainer'\)\.style\.display = 'none';\n\s*\}/, '');

// Inside loadLokasiAdmin, add population of adminInstansiSelect
const loadLokasiAdminRegex = /function loadLokasiAdmin\(\)\s*\{/;
const populateSelect = `
      if (isSuperAdminUser() && $('adminInstansiSection') && $('adminInstansiSelect')) {
        $('adminInstansiSection').style.display = 'block';
        const sel = $('adminInstansiSelect');
        const currentVal = sel.value;
        let opts = '<option value="">- Semua Instansi -</option>';
        if (window.INSTANSI_LIST) {
          window.INSTANSI_LIST.forEach(i => {
            opts += \`<option value="\${i.id}">\${i.nama_instansi}</option>\`;
          });
        }
        sel.innerHTML = opts;
        if (currentVal && opts.includes(\`value="\${currentVal}"\`)) sel.value = currentVal;
      }
`;
js = js.replace(loadLokasiAdminRegex, `function loadLokasiAdmin() {${populateSelect}`);

// Pass the selected instansi to apiGet(P.lokasiList)
// Old: const res = await apiGet(P.lokasiList);
// New: const params = {}; if ($('adminInstansiSelect') && $('adminInstansiSelect').value) params.instansi_id = $('adminInstansiSelect').value; const res = await apiGet(P.lokasiList, params);
js = js.replace(/const res = await apiGet\(P\.lokasiList\);/, `const params = {}; if (isSuperAdminUser() && $('adminInstansiSelect') && $('adminInstansiSelect').value) params.instansi_id = $('adminInstansiSelect').value; const res = await apiGet(P.lokasiList, params);`);

// In handleTambahLokasi, send the selected instansi
// Find: let instansis = [];
// Replace with logic that uses adminInstansiSelect
js = js.replace(/let instansis = \[\];[\s\S]*?\}\s*else\s*\{[\s\S]*?\}/, `
      let instansi_id = 'bapperida';
      if (isSuperAdminUser() && $('adminInstansiSelect') && $('adminInstansiSelect').value) {
        instansi_id = $('adminInstansiSelect').value;
      } else {
        instansi_id = typeof getScopedInstansiId === 'function' ? getScopedInstansiId() : 'bapperida';
      }
      if (!instansi_id) {
        return showAlert('Silakan pilih instansi terlebih dahulu!', 'error');
      }
`);

// Change payload
js = js.replace(/ip_range: ipVal,\n\s*instansis: instansis/, `ip_range: ipVal,\n        instansi_id: instansi_id`);

fs.writeFileSync('js/admin-lokasi.js', js, 'utf8');
console.log('admin-lokasi.js patched');
