const fs = require('fs');
let js = fs.readFileSync('js/admin-lokasi-v9.js', 'utf8');

js = js.split('(window.INSTANSI_LIST || [').join('(window.INSTANSI_LIST && window.INSTANSI_LIST.length > 0 ? window.INSTANSI_LIST : [');
js = js.split('>${ins.nama_instansi}<').join('>${ins.nama_instansi || ins.header || ins.nama || ins.Nama_Instansi || ins.id || "Instansi"}<');

fs.writeFileSync('js/admin-lokasi-v9.js', js, 'utf8');
console.log('Fixed fallbacks using split-join');
