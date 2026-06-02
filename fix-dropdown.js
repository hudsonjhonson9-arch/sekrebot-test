const fs = require('fs');
let js = fs.readFileSync('js/admin-lokasi-v9.js', 'utf8');

// 1. Replace toggleInstansiCheck
js = js.replace(/window\.toggleInstansiCheck = function\(lbl\) \{[\s\S]*?^\s*\};\s*$/m, `window.toggleInstansiCheck = function(cb, textId) {
    const grid = cb.closest('.dropdown-list-wrap');
    if (!grid) return;
    
    if (cb.value === 'all' && cb.checked) {
      grid.querySelectorAll('input').forEach(i => {
        if (i !== cb) { i.checked = false; }
      });
    } else if (cb.checked) {
      const allCb = grid.querySelector('input[value="all"]');
      if (allCb && allCb.checked) { allCb.checked = false; }
    }
    
    // Update text
    const textEl = document.getElementById(textId);
    if (textEl) {
      const checked = Array.from(grid.querySelectorAll('input:checked'));
      if (checked.length === 0 || (checked.length === 1 && checked[0].value === 'all')) {
        textEl.textContent = 'Semua Instansi';
      } else {
        textEl.textContent = checked.length + ' Instansi Terpilih';
      }
    }
  };`);

// 2. Replace instansiCheckGrid (for Tambah Lokasi)
const oldGridHtml = `              var gridHtml = '<label class="hari-check-label checked" onclick="toggleInstansiCheck(this)"><input type="checkbox" value="all" checked style="display:none">Semua</label>';
              instList.forEach(function(ins) {
                gridHtml += '<label class="hari-check-label" onclick="toggleInstansiCheck(this)"><input type="checkbox" value="' + ins.id + '" style="display:none">' + ins.nama_instansi + '</label>';
              });
              $('instansiCheckGrid').innerHTML = gridHtml;`;

const newGridHtml = `              var gridHtml = \`
                <div class="custom-search-dropdown" style="width:100%; margin-top:4px;">
                  <div class="dropdown-trigger" onclick="this.parentElement.classList.toggle('open')" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); border-radius:8px; cursor:pointer;">
                    <span class="selected-text" id="text-instansi-tambah" style="font-size:11px; color:var(--white); font-weight:700;">Semua Instansi</span>
                    <i class="fas fa-chevron-down arrow-icon" style="color:var(--muted); font-size:10px;"></i>
                  </div>
                  <div class="dropdown-list-wrap" id="instansiCheckGrid-list" style="display:none; position:absolute; top:100%; left:0; width:100%; max-height:200px; overflow-y:auto; background:var(--navy); border:1px solid var(--border); border-radius:8px; margin-top:4px; z-index:100; padding:8px; flex-direction:column; gap:4px;">
                    <label style="display:flex; align-items:center; gap:8px; padding:6px; cursor:pointer; font-size:11px; color:var(--white);"><input type="checkbox" value="all" checked onchange="toggleInstansiCheck(this, 'text-instansi-tambah')"> Semua Instansi</label>
              \`;
              instList.forEach(function(ins) {
                gridHtml += \`<label style="display:flex; align-items:center; gap:8px; padding:6px; cursor:pointer; font-size:11px; color:var(--white);"><input type="checkbox" value="\${ins.id}" onchange="toggleInstansiCheck(this, 'text-instansi-tambah')"> \${ins.nama_instansi}</label>\`;
              });
              gridHtml += \`</div></div>\`;
              $('instansiCheckGrid').innerHTML = gridHtml;
              $('instansiCheckGrid').style.display = 'block';
              $('instansiCheckGrid').classList.remove('gap:6px');`;

js = js.replace(oldGridHtml, newGridHtml);

// 3. Update data retrieval for instansiCheckGrid in loadLokasiAdmin
js = js.replace(/const checked = Array\.from\(\$\('instansiCheckGrid'\)\.querySelectorAll\('input:checked'\)\)\.map\(cb => cb\.value\);/g, `const checked = Array.from($('instansiCheckGrid').querySelectorAll('input:checked')).map(cb => cb.value);`);

// 4. Replace instansi-grid-\${id} (for List Lokasi)
const oldListHtml = `              <div id="instansi-grid-\${id}" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:4px;">
                  <label class="hari-check-label \${instansiArr.includes('all') ? 'checked' : ''}" onclick="toggleInstansiCheck(this)"><input type="checkbox" value="all" \${instansiArr.includes('all')?'checked':''} style="display:none">Semua</label>
                  \${(window.INSTANSI_LIST || [
                    { id: 'bapperida', nama_instansi: 'BAPPERIDA' },
                    { id: 'inspektorat', nama_instansi: 'INSPEKTORAT' }
                  ]).map(ins => \`<label class="hari-check-label \${instansiArr.includes(ins.id) ? 'checked' : ''}" onclick="toggleInstansiCheck(this)"><input type="checkbox" value="\${ins.id}" \${instansiArr.includes(ins.id)?'checked':''} style="display:none">\${ins.nama_instansi}</label>\`).join('')}
                </div>`;

const newListHtml = `              <div class="custom-search-dropdown" style="width:100%; margin-top:4px;">
                  <div class="dropdown-trigger" onclick="this.parentElement.classList.toggle('open')" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); border-radius:8px; cursor:pointer;">
                    <span class="selected-text" id="text-instansi-\${id}" style="font-size:11px; color:var(--white); font-weight:700;">\${instansiArr.includes('all') || instansiArr.length === 0 ? 'Semua Instansi' : instansiArr.length + ' Instansi Terpilih'}</span>
                    <i class="fas fa-chevron-down arrow-icon" style="color:var(--muted); font-size:10px;"></i>
                  </div>
                  <div class="dropdown-list-wrap" id="instansi-grid-\${id}" style="display:none; position:absolute; top:100%; left:0; width:100%; max-height:200px; overflow-y:auto; background:var(--navy); border:1px solid var(--border); border-radius:8px; margin-top:4px; z-index:100; padding:8px; flex-direction:column; gap:4px;">
                    <label style="display:flex; align-items:center; gap:8px; padding:6px; cursor:pointer; font-size:11px; color:var(--white);"><input type="checkbox" value="all" \${instansiArr.includes('all')?'checked':''} onchange="toggleInstansiCheck(this, 'text-instansi-\${id}')"> Semua Instansi</label>
                    \${(window.INSTANSI_LIST || [
                      { id: 'bapperida', nama_instansi: 'BAPPERIDA' },
                      { id: 'inspektorat', nama_instansi: 'INSPEKTORAT' }
                    ]).map(ins => \`<label style="display:flex; align-items:center; gap:8px; padding:6px; cursor:pointer; font-size:11px; color:var(--white);"><input type="checkbox" value="\${ins.id}" \${instansiArr.includes(ins.id)?'checked':''} onchange="toggleInstansiCheck(this, 'text-instansi-\${id}')"> \${ins.nama_instansi}</label>\`).join('')}
                  </div>
                </div>`;

js = js.replace(oldListHtml, newListHtml);

fs.writeFileSync('js/admin-lokasi-v9.js', js, 'utf8');
console.log('Done replacing admin-lokasi-v9.js');
