const fs = require('fs');
let js = fs.readFileSync('js/admin-lokasi-v9.js', 'utf8');

// 1. Fix syncInstansiList filter
js = js.split('.filter(i => i.id || i.ID)').join('.filter(i => i.id || i.ID || i.instansi_id)');

// 2. Fix lokasi-item overflow
js = js.split('margin-bottom:8px;">').join('margin-bottom:8px; overflow:visible!important; position:relative; z-index:100;">');

// 3. Fix Tambah Lokasi fallback
js = js.split('var instList = window.INSTANSI_LIST || [').join('var instList = window.INSTANSI_LIST && window.INSTANSI_LIST.length > 0 ? window.INSTANSI_LIST : [');

// 4. Fix value attribute in mapping
js = js.split('value="${ins.id}"').join('value="${ins.id || ins.ID || ins.instansi_id || \'\'}"');

fs.writeFileSync('js/admin-lokasi-v9.js', js, 'utf8');
console.log('All remaining fixes applied via split-join!');
