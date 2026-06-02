const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. Insert adminInstansiSection dropdown
const search1 = '<div id="adminMap" style="height:180px;border-radius:12px;margin-bottom:10px;border:1px solid var(--border)">';
const insert1 = `          <div id="adminInstansiSection" style="display: none; margin-bottom: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px; box-sizing: border-box;">
            <div style="font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">🏢 Pilih Instansi (Superadmin)</div>
            <select id="adminInstansiSelect" class="form-input" style="width: 100%; height: 38px; cursor: pointer; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: var(--white); border-radius: 8px; padding: 0 10px;" onchange="if(typeof loadLokasiAdmin === 'function') loadLokasiAdmin()">
              <option value="">- Semua Instansi -</option>
            </select>
          </div>
`;
if (!html.includes('adminInstansiSelect')) {
  html = html.replace(search1, insert1 + search1);
}

// 2. Remove instansiLokasiContainer from index.html
const startTag = '<div id="instansiLokasiContainer"';
const endTagStr = '<!-- Checkboxes will be populated by JS -->\n            </div>\n          </div>';
const idxStart = html.indexOf(startTag);
if (idxStart !== -1) {
  const idxEnd = html.indexOf(endTagStr, idxStart) + endTagStr.length;
  html = html.substring(0, idxStart) + html.substring(idxEnd);
}

fs.writeFileSync('index.html', html, 'utf8');
console.log('index.html done');
