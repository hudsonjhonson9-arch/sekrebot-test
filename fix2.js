const fs = require('fs');
let js = fs.readFileSync('js/admin-lokasi-v9.js', 'utf8');

// 1. Remove style="display:none;" from dropdown-list-wrap
js = js.replace(/id="instansiCheckGrid-list" style="display:none; /g, 'id="instansiCheckGrid-list" style="');
js = js.replace(/id="instansi-grid-\${id}" style="display:none; /g, 'id="instansi-grid-${id}" style="');

// 2. Fix the initial text logic for the list grid (text-instansi-${id})
const oldInitialText = /\$\{instansiArr\.includes\('all'\) \|\| instansiArr\.length === 0 \? 'Semua Instansi' : instansiArr\.length \+ ' Instansi Terpilih'\}/g;
const newInitialText = "${instansiArr.includes('all') || instansiArr.length === 0 ? 'Semua Instansi' : (instansiArr.length === 1 ? ((window.INSTANSI_LIST || []).find(i => i.id === instansiArr[0])?.nama_instansi || '1 Instansi Terpilih') : instansiArr.length + ' Instansi Terpilih')}";
js = js.replace(oldInitialText, newInitialText);

// 3. Fix toggleInstansiCheck text update logic
const oldToggleUpdate = /if \(checked\.length === 0 \|\| \(checked\.length === 1 && checked\[0\]\.value === 'all'\)\) \{[\s\S]*?textEl\.textContent = checked\.length \+ ' Instansi Terpilih';[\s\S]*?\}/m;
const newToggleUpdate = `if (checked.length === 0 || (checked.length === 1 && checked[0].value === 'all')) {
        textEl.textContent = 'Semua Instansi';
      } else if (checked.length === 1) {
        const val = checked[0].value;
        const found = (window.INSTANSI_LIST || []).find(i => i.id === val);
        textEl.textContent = found ? found.nama_instansi : '1 Instansi Terpilih';
      } else {
        textEl.textContent = checked.length + ' Instansi Terpilih';
      }`;
js = js.replace(oldToggleUpdate, newToggleUpdate);

fs.writeFileSync('js/admin-lokasi-v9.js', js, 'utf8');
console.log('Fixed dropdown visibility and text logic!');
