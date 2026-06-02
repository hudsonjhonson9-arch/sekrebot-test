const fs = require('fs');

let js = fs.readFileSync('js/admin-lokasi.js', 'utf8');

const match = 'async function loadLokasiAdmin() {';
const inject = `
      if (isSuperAdminUser() && $('adminLokasiInstansiSection') && $('adminLokasiInstansiSelect')) {
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
      }
`;

if (!js.includes('adminLokasiInstansiSection')) {
  js = js.replace(match, match + inject);
}

const getOld = 'const res = await apiGet(P.lokasiList);';
const getNew = `const params = {}; if (isSuperAdminUser() && $('adminLokasiInstansiSelect') && $('adminLokasiInstansiSelect').value) params.instansi_id = $('adminLokasiInstansiSelect').value; const res = await apiGet(P.lokasiList, params);`;
if (js.includes(getOld)) {
  js = js.replace(getOld, getNew);
} else if (!js.includes('params.instansi_id =')) {
  console.log("Could not find apiGet to replace");
}

fs.writeFileSync('js/admin-lokasi.js', js, 'utf8');
console.log('admin-lokasi.js successfully patched!');
