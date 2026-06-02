const fs = require('fs');

let js = fs.readFileSync('js/admin-lokasi-v9.js', 'utf8');

// Find the line where params.instansi_id is set
const oldLine = "const params = {}; if (isSuperAdminUser() && $('adminLokasiInstansiSelect') && $('adminLokasiInstansiSelect').value) params.instansi_id = $('adminLokasiInstansiSelect').value; const res = await apiGet(P.lokasiList, params);";
const newLine = "const params = {}; if (isSuperAdminUser() && $('adminLokasiInstansiSelect') && $('adminLokasiInstansiSelect').value && $('adminLokasiInstansiSelect').value !== 'all') params.instansi_id = $('adminLokasiInstansiSelect').value; const res = await apiGet(P.lokasiList, params);";

if (js.includes(oldLine)) {
    js = js.replace(oldLine, newLine);
    fs.writeFileSync('js/admin-lokasi-v9.js', js, 'utf8');
    console.log('Fixed params.instansi_id logic for loadLokasiAdmin!');
} else {
    // Maybe it's slightly different? Let's use regex
    const regex = /const params = \{\};\s*if\s*\([^)]+\)\s*params\.instansi_id\s*=\s*\$\('adminLokasiInstansiSelect'\)\.value;\s*const res\s*=\s*await apiGet\(P\.lokasiList, params\);/;
    if (regex.test(js)) {
        js = js.replace(regex, newLine);
        fs.writeFileSync('js/admin-lokasi-v9.js', js, 'utf8');
        console.log('Fixed params.instansi_id logic with regex!');
    } else {
        console.log('Could not find the target string to replace.');
    }
}
