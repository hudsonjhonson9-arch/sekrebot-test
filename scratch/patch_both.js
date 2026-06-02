const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// Insert adminInstansiSelect dropdown right above adminMap
const search1 = '<div id="adminMap"';
const insert1 = `          <div id="adminInstansiSection" style="display: none; margin-bottom: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px; box-sizing: border-box;">
            <div style="font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">🏢 Pilih Instansi (Superadmin)</div>
            <select id="adminInstansiSelect" class="form-input" style="width: 100%; height: 38px; cursor: pointer; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: var(--white); border-radius: 8px; padding: 0 10px;" onchange="if(typeof loadLokasiAdmin === 'function') loadLokasiAdmin()">
              <option value="">- Semua Instansi -</option>
            </select>
          </div>
`;
if (!html.includes('adminInstansiSelect')) {
  html = html.replace(search1, insert1 + search1);
}

fs.writeFileSync('index.html', html, 'utf8');
console.log('index.html patched with BOTH dropdown and checkboxes');

// Now for admin-lokasi.js
let js = fs.readFileSync('js/admin-lokasi.js', 'utf8');

// Inside loadLokasiAdmin, add population of adminInstansiSelect
const loadLokasiMatch = 'function loadLokasiAdmin() {\n';
const populateSelect = `      if (isSuperAdminUser() && $('adminInstansiSection') && $('adminInstansiSelect')) {
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
      }\n`;
if (!js.includes('adminInstansiSection')) {
  js = js.replace(loadLokasiMatch, loadLokasiMatch + populateSelect);
}

// Inside loadLokasiAdmin, pass the selected instansi to apiGet(P.lokasiList)
const getOld = 'const res = await apiGet(P.lokasiList);';
const getNew = `const params = {}; if (isSuperAdminUser() && $('adminInstansiSelect') && $('adminInstansiSelect').value) params.instansi_id = $('adminInstansiSelect').value; const res = await apiGet(P.lokasiList, params);`;
if (!js.includes('params.instansi_id =')) {
  js = js.replace(getOld, getNew);
}

fs.writeFileSync('js/admin-lokasi.js', js, 'utf8');
console.log('admin-lokasi.js patched to include BOTH');
