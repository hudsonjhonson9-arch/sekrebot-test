const fs = require('fs');
let js = fs.readFileSync('js/admin-lokasi-v9.js', 'utf8');

js = js.split('opts += `<option value="${i.id}">${i.nama_instansi}</option>`;').join('opts += `<option value="${i.id || i.ID || i.instansi_id || \'\'}">${i.nama_instansi || i.header || i.nama || i.Nama_Instansi || "Instansi"}</option>`;');

fs.writeFileSync('js/admin-lokasi-v9.js', js, 'utf8');
console.log('Fixed opts value mapping!');
