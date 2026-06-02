const fs = require('fs');

let js = fs.readFileSync('js/admin-lokasi-v9.js', 'utf8');

const syncCode = `// Sync window.INSTANSI_LIST with localStorage
function syncInstansiList() {
    try {
        const cached = localStorage.getItem('absen_instansi_map');
        if (cached) {
            const map = JSON.parse(cached);
            window.INSTANSI_LIST = Object.keys(map).map(k => map[k]).filter(i => i.id || i.ID);
        } else {
            window.INSTANSI_LIST = [
                { id: 'bapperida', nama_instansi: 'BAPPERIDA' },
                { id: 'inspektorat', nama_instansi: 'INSPEKTORAT' }
            ];
        }
    } catch(e) {
        window.INSTANSI_LIST = [];
    }
}
syncInstansiList();

`;

if (!js.includes('function syncInstansiList()')) {
    js = syncCode + js;
    fs.writeFileSync('js/admin-lokasi-v9.js', js, 'utf8');
    console.log('Added syncInstansiList to admin-lokasi-v9.js');
} else {
    console.log('syncInstansiList already exists');
}
