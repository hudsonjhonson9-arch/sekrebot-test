const fs = require('fs');
let js = fs.readFileSync('js/admin-lokasi-v9.js', 'utf8');

// 1. Change 'bapperida' fallback to 'all'
js = js.replace(/let instansi_id = 'bapperida';/g, "let instansi_id = 'all';");
js = js.replace(/instansi_id = localStorage\.getItem\('MY_INSTANSI'\) \|\| 'bapperida';/g, "instansi_id = localStorage.getItem('MY_INSTANSI') || 'all';");
js = js.replace(/instansiVal = l\.instansi_id \|\| 'bapperida';/g, "instansiVal = l.instansi_id || 'all';");
js = js.replace(/instansi_id = \$\(`instansi-input-\$\{id\}`\)\?\.value \|\| 'bapperida';/g, "instansi_id = $(`instansi-input-${id}`)?.value || 'all';");

// 2. Remove overflow:hidden from lokasi-item
js = js.replace(/overflow:hidden">/g, '">');

// 3. Update the dropdown list wrap HTML to use custom checkbox UI
// First, update the Tambah Lokasi grid
const oldAddGrid = `<div class="dropdown-list-wrap" id="instansiCheckGrid-list" style="position:absolute; top:100%; left:0; width:100%; max-height:200px; overflow-y:auto; background:var(--navy); border:1px solid var(--border); border-radius:8px; margin-top:4px; z-index:100; padding:8px; flex-direction:column; gap:4px;">
                  <label style="display:flex; align-items:center; gap:8px; padding:6px; cursor:pointer; font-size:11px; color:var(--white);"><input type="checkbox" value="all" checked onchange="toggleInstansiCheck(this, 'text-instansi-tambah')"> Semua Instansi</label>
            \`;
            instList.forEach(function(ins) {
              gridHtml += \`<label style="display:flex; align-items:center; gap:8px; padding:6px; cursor:pointer; font-size:11px; color:var(--white);"><input type="checkbox" value="\${ins.id}" onchange="toggleInstansiCheck(this, 'text-instansi-tambah')"> \${ins.nama_instansi}</label>\`;
            });
            gridHtml += \`</div></div>\`;`;

const newAddGrid = `<div class="dropdown-list-wrap" id="instansiCheckGrid-list" style="position:absolute; top:100%; left:0; width:100%; max-height:200px; overflow-y:auto; background:rgba(15, 23, 42, 0.95); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.1); border-radius:12px; margin-top:6px; z-index:9999; padding:6px; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                  <label class="dropdown-item custom-checkbox-lbl" style="display:flex; align-items:center; gap:10px; padding:10px 12px; cursor:pointer; font-size:11px; color:var(--white); border-radius:8px; transition:all 0.2s; margin-bottom:2px; background:rgba(212,175,55,0.1); border-left:3px solid var(--gold);">
                    <div class="checkbox-box" style="width:16px;height:16px;border:1px solid var(--gold);border-radius:4px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;background:rgba(212,175,55,0.1);">
                      <i class="fas fa-check check-mark" style="font-size:10px;color:var(--gold);opacity:1;transform:scale(1);transition:all 0.2s;"></i>
                    </div>
                    <input type="checkbox" value="all" checked onchange="toggleInstansiCheck(this, 'text-instansi-tambah')" style="display:none;"> 
                    <span style="font-weight:600;">Semua Instansi</span>
                  </label>
            \`;
            instList.forEach(function(ins) {
              gridHtml += \`<label class="dropdown-item custom-checkbox-lbl" style="display:flex; align-items:center; gap:10px; padding:10px 12px; cursor:pointer; font-size:11px; color:var(--white); border-radius:8px; transition:all 0.2s; margin-bottom:2px; background:transparent; border-left:3px solid transparent;">
                    <div class="checkbox-box" style="width:16px;height:16px;border:1px solid rgba(255,255,255,0.3);border-radius:4px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;background:transparent;">
                      <i class="fas fa-check check-mark" style="font-size:10px;color:var(--gold);opacity:0;transform:scale(0);transition:all 0.2s;"></i>
                    </div>
                    <input type="checkbox" value="\${ins.id}" onchange="toggleInstansiCheck(this, 'text-instansi-tambah')" style="display:none;"> 
                    <span>\${ins.nama_instansi}</span>
                  </label>\`;
            });
            gridHtml += \`</div></div>\`;`;

js = js.replace(oldAddGrid, newAddGrid);

// Second, update the Edit Lokasi grid
const oldListGrid = `<div class="dropdown-list-wrap" id="instansi-grid-\${id}" style="position:absolute; top:100%; left:0; width:100%; max-height:200px; overflow-y:auto; background:var(--navy); border:1px solid var(--border); border-radius:8px; margin-top:4px; z-index:100; padding:8px; flex-direction:column; gap:4px;">
                  <label style="display:flex; align-items:center; gap:8px; padding:6px; cursor:pointer; font-size:11px; color:var(--white);"><input type="checkbox" value="all" \${instansiArr.includes('all')?'checked':''} onchange="toggleInstansiCheck(this, 'text-instansi-\${id}')"> Semua Instansi</label>
                  \${(window.INSTANSI_LIST || [
                    { id: 'bapperida', nama_instansi: 'BAPPERIDA' },
                    { id: 'inspektorat', nama_instansi: 'INSPEKTORAT' }
                  ]).map(ins => \`<label style="display:flex; align-items:center; gap:8px; padding:6px; cursor:pointer; font-size:11px; color:var(--white);"><input type="checkbox" value="\${ins.id}" \${instansiArr.includes(ins.id)?'checked':''} onchange="toggleInstansiCheck(this, 'text-instansi-\${id}')"> \${ins.nama_instansi}</label>\`).join('')}
                </div>`;

const newListGrid = `<div class="dropdown-list-wrap" id="instansi-grid-\${id}" style="position:absolute; top:100%; left:0; width:100%; max-height:200px; overflow-y:auto; background:rgba(15, 23, 42, 0.95); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.1); border-radius:12px; margin-top:6px; z-index:9999; padding:6px; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                  <label class="dropdown-item custom-checkbox-lbl" style="display:flex; align-items:center; gap:10px; padding:10px 12px; cursor:pointer; font-size:11px; color:var(--white); border-radius:8px; transition:all 0.2s; margin-bottom:2px; \${instansiArr.includes('all')?'background:rgba(212,175,55,0.1);border-left:3px solid var(--gold);':'background:transparent;border-left:3px solid transparent;'}">
                    <div class="checkbox-box" style="width:16px;height:16px;border:1px solid \${instansiArr.includes('all')?'var(--gold)':'rgba(255,255,255,0.3)'};border-radius:4px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;background:\${instansiArr.includes('all')?'rgba(212,175,55,0.1)':'transparent'};">
                      <i class="fas fa-check check-mark" style="font-size:10px;color:var(--gold);transition:all 0.2s;\${instansiArr.includes('all')?'opacity:1;transform:scale(1);':'opacity:0;transform:scale(0);'}"></i>
                    </div>
                    <input type="checkbox" value="all" \${instansiArr.includes('all')?'checked':''} onchange="toggleInstansiCheck(this, 'text-instansi-\${id}')" style="display:none;"> 
                    <span style="\${instansiArr.includes('all')?'font-weight:600;':''}">Semua Instansi</span>
                  </label>
                  \${(window.INSTANSI_LIST || [
                    { id: 'bapperida', nama_instansi: 'BAPPERIDA' },
                    { id: 'inspektorat', nama_instansi: 'INSPEKTORAT' }
                  ]).map(ins => {
                    const isChecked = instansiArr.includes(ins.id);
                    return \`<label class="dropdown-item custom-checkbox-lbl" style="display:flex; align-items:center; gap:10px; padding:10px 12px; cursor:pointer; font-size:11px; color:var(--white); border-radius:8px; transition:all 0.2s; margin-bottom:2px; \${isChecked?'background:rgba(212,175,55,0.1);border-left:3px solid var(--gold);':'background:transparent;border-left:3px solid transparent;'}">
                      <div class="checkbox-box" style="width:16px;height:16px;border:1px solid \${isChecked?'var(--gold)':'rgba(255,255,255,0.3)'};border-radius:4px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;background:\${isChecked?'rgba(212,175,55,0.1)':'transparent'};">
                        <i class="fas fa-check check-mark" style="font-size:10px;color:var(--gold);transition:all 0.2s;\${isChecked?'opacity:1;transform:scale(1);':'opacity:0;transform:scale(0);'}"></i>
                      </div>
                      <input type="checkbox" value="\${ins.id}" \${isChecked?'checked':''} onchange="toggleInstansiCheck(this, 'text-instansi-\${id}')" style="display:none;"> 
                      <span style="\${isChecked?'font-weight:600;':''}">\${ins.nama_instansi}</span>
                    </label>\`;
                  }).join('')}
                </div>`;

js = js.replace(oldListGrid, newListGrid);

// 4. Update toggleInstansiCheck logic to ALSO update the UI colors
const oldToggleUpdate = `window.toggleInstansiCheck = function(cb, textId) {
    const grid = cb.closest('.dropdown-list-wrap');
    if (!grid) return;
    
    if (cb.value === 'all' && cb.checked) {
      grid.querySelectorAll('input').forEach(i => {
        if (i !== cb) { i.checked = false; }
      });
    } else if (cb.checked) {
      const allCb = grid.querySelector('input[value="all"]');
      if (allCb && allCb.checked) { allCb.checked = false; }
    }`;

const newToggleUpdate = `window.toggleInstansiCheck = function(cb, textId) {
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
    
    // Update custom UI classes
    grid.querySelectorAll('.custom-checkbox-lbl').forEach(lbl => {
      const input = lbl.querySelector('input');
      const box = lbl.querySelector('.checkbox-box');
      const mark = lbl.querySelector('.check-mark');
      const span = lbl.querySelector('span');
      if (input.checked) {
        lbl.style.background = 'rgba(212,175,55,0.1)';
        lbl.style.borderLeft = '3px solid var(--gold)';
        box.style.borderColor = 'var(--gold)';
        box.style.background = 'rgba(212,175,55,0.1)';
        mark.style.opacity = '1';
        mark.style.transform = 'scale(1)';
        span.style.fontWeight = '600';
      } else {
        lbl.style.background = 'transparent';
        lbl.style.borderLeft = '3px solid transparent';
        box.style.borderColor = 'rgba(255,255,255,0.3)';
        box.style.background = 'transparent';
        mark.style.opacity = '0';
        mark.style.transform = 'scale(0)';
        span.style.fontWeight = 'normal';
      }
    });`;

js = js.replace(oldToggleUpdate, newToggleUpdate);

fs.writeFileSync('js/admin-lokasi-v9.js', js, 'utf8');
console.log('Fixed dropdown UX and fallback logic!');
