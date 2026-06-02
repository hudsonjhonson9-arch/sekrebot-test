const fs = require('fs');

let lok = fs.readFileSync('js/admin-lokasi-v9.js', 'utf8');

// Add populateAdminLokasiInstansiSelect globally
const populateCode = `
window.populateAdminLokasiInstansiSelect = function() {
    if (typeof isSuperAdminUser === 'function' && isSuperAdminUser() && document.getElementById('adminLokasiInstansiSection') && document.getElementById('adminLokasiInstansiSelect')) {
        document.getElementById('adminLokasiInstansiSection').style.display = 'block';
        const sel = document.getElementById('adminLokasiInstansiSelect');
        const currentVal = sel.value;
        let opts = '<option value="all">- Semua Instansi -</option>';
        if (window.INSTANSI_LIST) {
            window.INSTANSI_LIST.forEach(i => {
                const id = i.id || i.ID || i.instansi_id || '';
                const name = i.nama_instansi || i.header || i.nama || i.Nama_Instansi || "Instansi";
                if (id) opts += \`<option value="\${id}">\${name}</option>\`;
            });
        }
        sel.innerHTML = opts;
        if (currentVal && opts.includes(\`value="\${currentVal}"\`)) sel.value = currentVal;
    }
};
`;

if (!lok.includes('window.populateAdminLokasiInstansiSelect')) {
    lok = lok.replace('function syncInstansiList() {', populateCode + '\nfunction syncInstansiList() {');
}

lok = lok.replace(
    /syncInstansiList\(\);/g,
    'syncInstansiList();\nif(typeof window.populateAdminLokasiInstansiSelect === "function") window.populateAdminLokasiInstansiSelect();'
);

// Remove the old population code inside loadLokasiAdmin
lok = lok.replace(
    /if\s*\(\s*isSuperAdminUser\(\)\s*&&\s*\$\('adminLokasiInstansiSection'\)\s*&&\s*\$\('adminLokasiInstansiSelect'\)\s*\)\s*\{[\s\S]*?sel\.innerHTML\s*=\s*opts;[\s\S]*?if\s*\(currentVal[^)]*\)\s*sel\.value\s*=\s*currentVal;\s*\}/,
    'if(typeof window.populateAdminLokasiInstansiSelect === "function") window.populateAdminLokasiInstansiSelect();'
);

fs.writeFileSync('js/admin-lokasi-v9.js', lok);

let libur = fs.readFileSync('js/admin-libur.js', 'utf8');
if (!libur.includes('window.populateAdminLokasiInstansiSelect()')) {
    libur = libur.replace(
        /if\s*\(typeof\s*loadLokasiAdmin\s*===\s*'function'\)\s*loadLokasiAdmin\(\);/g,
        "if (typeof window.populateAdminLokasiInstansiSelect === 'function') window.populateAdminLokasiInstansiSelect();\n            if (typeof loadLokasiAdmin === 'function') loadLokasiAdmin();"
    );
    fs.writeFileSync('js/admin-libur.js', libur);
}

console.log('Patch applied successfully.');
