const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// Insert adminLokasiInstansiSection right above adminMap
const search1 = '<div id="adminMap"';
const insert1 = `          <div id="adminLokasiInstansiSection" style="display: none; margin-bottom: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px; box-sizing: border-box;">
            <div style="font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">🏢 Pilih Instansi (Superadmin)</div>
            <select id="adminLokasiInstansiSelect" class="form-input" style="width: 100%; height: 38px; cursor: pointer; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: var(--white); border-radius: 8px; padding: 0 10px;" onchange="if(typeof loadLokasiAdmin === 'function') loadLokasiAdmin()">
              <option value="">- Semua Instansi -</option>
            </select>
          </div>
`;
if (!html.includes('adminLokasiInstansiSelect')) {
  html = html.replace(search1, insert1 + search1);
}

fs.writeFileSync('index.html', html, 'utf8');
console.log('index.html patched with UNIQUE ID');

// Now for admin-lokasi.js
let js = fs.readFileSync('js/admin-lokasi.js', 'utf8');

// Inside loadLokasiAdmin, add population of adminLokasiInstansiSelect
const loadLokasiMatch = 'function loadLokasiAdmin() {\n';
const populateSelect = `      if (isSuperAdminUser() && $('adminLokasiInstansiSection') && $('adminLokasiInstansiSelect')) {
        $('adminLokasiInstansiSection').style.display = 'block';
        const sel = $('adminLokasiInstansiSelect');
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
if (!js.includes('adminLokasiInstansiSection')) {
  js = js.replace(loadLokasiMatch, loadLokasiMatch + populateSelect);
}

// Inside loadLokasiAdmin, pass the selected instansi to apiGet(P.lokasiList)
const getOld = `const params = {}; if (isSuperAdminUser() && $('adminInstansiSelect') && $('adminInstansiSelect').value) params.instansi_id = $('adminInstansiSelect').value; const res = await apiGet(P.lokasiList, params);`;
const getNew = `const params = {}; if (isSuperAdminUser() && $('adminLokasiInstansiSelect') && $('adminLokasiInstansiSelect').value) params.instansi_id = $('adminLokasiInstansiSelect').value; const res = await apiGet(P.lokasiList, params);`;
if (js.includes(getOld)) {
  js = js.replace(getOld, getNew);
} else {
  // Try the original
  const getOrig = `const res = await apiGet(P.lokasiList);`;
  if (js.includes(getOrig)) {
    js = js.replace(getOrig, getNew);
  }
}

// Clean up the wrong patch if it exists in admin-lokasi.js
const badPatch = `      if (isSuperAdminUser() && $('adminInstansiSection') && $('adminInstansiSelect')) {
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
js = js.replace(badPatch, '');

fs.writeFileSync('js/admin-lokasi.js', js, 'utf8');
console.log('admin-lokasi.js patched with UNIQUE ID');
