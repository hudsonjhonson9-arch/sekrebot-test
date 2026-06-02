const fs = require('fs');
let js = fs.readFileSync('js/admin-lokasi.js', 'utf8');

// 1. Remove toggleInstansiCheck
js = js.replace(/window\.toggleInstansiCheck = function\(lbl\) \{[\s\S]*?\};\n/g, '');

// 2. Remove the old instansiLokasiContainer logic inside loadLokasiAdmin
const remove1 = `if (isSuperAdminUser() && $('instansiLokasiContainer')) {
            $('instansiLokasiContainer').style.display = 'block';
            var instList = window.INSTANSI_LIST || [
              { id: 'bapperida', nama_instansi: 'BAPPERIDA' },
              { id: 'inspektorat', nama_instansi: 'INSPEKTORAT' }
            ];
            var gridHtml = '<label class="hari-check-label checked" onclick="toggleInstansiCheck(this)"><input type="checkbox" value="all" checked style="display:none">Semua</label>';
            instList.forEach(function(ins) {
              gridHtml += '<label class="hari-check-label" onclick="toggleInstansiCheck(this)"><input type="checkbox" value="' + ins.id + '" style="display:none">' + ins.nama_instansi + '</label>';
            });
            $('instansiCheckGrid').innerHTML = gridHtml;
          }`;
js = js.replace(remove1, '');

// 3. Add adminInstansiSelect logic inside loadLokasiAdmin
const loadLokasiMatch = 'function loadLokasiAdmin() {\n';
const populateSelect = `      if (isSuperAdminUser() && $('adminInstansiSection') && $('adminInstansiSelect')) {
        $('adminInstansiSection').style.display = 'block';
        const sel = $('adminInstansiSelect');
        const currentVal = sel.value;
        let opts = '<option value="">- Semua Instansi -</option>';
        if (window.INSTANSI_LIST) {
          window.INSTANSI_LIST.forEach(i => {
            opts += \`<option value="\${i.id}">\${i.nama_instansi}</option>\`;
          });
        }
        sel.innerHTML = opts;
        if (currentVal && opts.includes(\`value="\${currentVal}"\`)) sel.value = currentVal;
      }\n`;
js = js.replace(loadLokasiMatch, loadLokasiMatch + populateSelect);

// 4. Update the apiGet call in loadLokasiAdmin
js = js.replace('const res = await apiGet(P.lokasiList);', `const params = {}; if (isSuperAdminUser() && $('adminInstansiSelect') && $('adminInstansiSelect').value) params.instansi_id = $('adminInstansiSelect').value; const res = await apiGet(P.lokasiList, params);`);

// 5. Update handleTambahLokasi
const remove2 = `let instansi_id = 'bapperida';
        if (isSuperAdminUser() && $('instansiLokasiContainer') && $('instansiLokasiContainer').style.display !== 'none') {
          const checked = Array.from($('instansiCheckGrid').querySelectorAll('input:checked')).map(cb => cb.value);
          if (checked.length) instansi_id = checked.join(',');
          else instansi_id = 'all'; // fallback to all if empty
        } else {
          instansi_id = localStorage.getItem('MY_INSTANSI') || 'bapperida';
        }`;
const insert2 = `let instansi_id = 'bapperida';
        if (isSuperAdminUser() && $('adminInstansiSelect') && $('adminInstansiSelect').value) {
          instansi_id = $('adminInstansiSelect').value;
        } else {
          instansi_id = typeof getScopedInstansiId === 'function' ? getScopedInstansiId() : 'bapperida';
        }`;
js = js.replace(remove2, insert2);

// 6. Remove checkboxes from item render
const itemRenderMatch = `\`\n            <div style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">🏢 Akses Instansi</div>
              <div style="background:rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.05);border-radius:8px;padding:8px">
                <div id="instansi-grid-\${id}" style="display:flex; flex-wrap:wrap; gap:6px;">
                  \${[{id:'all',nama_instansi:'Semua'}].concat(window.INSTANSI_LIST || [
                    { id: 'bapperida', nama_instansi: 'BAPPERIDA' },
                    { id: 'inspektorat', nama_instansi: 'INSPEKTORAT' }
                  ]).map(ins => \`<label class="hari-check-label \${instansiArr.includes(ins.id) ? 'checked' : ''}" onclick="toggleInstansiCheck(this)"><input type="checkbox" value="\${ins.id}" \${instansiArr.includes(ins.id)?'checked':''} style="display:none">\${ins.nama_instansi}</label>\`).join('')}
                </div>
              </div>
            \` : \`<input type="hidden" id="instansi-input-\${id}" value="\${instansiVal}" />\``;
const itemRenderInsert = `\`<input type="hidden" id="instansi-input-\${id}" value="\${instansiVal}" />\` : \`<input type="hidden" id="instansi-input-\${id}" value="\${instansiVal}" />\``;
js = js.replace(itemRenderMatch, itemRenderInsert);

// 7. Update simpanPerubahanLokasi
const remove3 = `let instansi_id = 'bapperida';
        if (isSuperAdminUser() && $(\`instansi-grid-\${id}\`)) {
          const checked = Array.from($(\`instansi-grid-\${id}\`).querySelectorAll('input:checked')).map(cb => cb.value);
          if (checked.length) instansi_id = checked.join(',');
          else instansi_id = 'all'; // fallback
        } else {
          instansi_id = $(\`instansi-input-\${id}\`)?.value || 'bapperida';
        }`;
const insert3 = `let instansi_id = $(\`instansi-input-\${id}\`)?.value || 'bapperida';`;
js = js.replace(remove3, insert3);

fs.writeFileSync('js/admin-lokasi.js', js, 'utf8');
console.log('admin-lokasi.js done');
