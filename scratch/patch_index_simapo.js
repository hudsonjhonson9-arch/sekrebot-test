const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

// Replace standard CRLF just in case
c = c.replace(/\r\n/g, '\n');

const target = `<div class="rekap-title">📦 Sistem Inventaris (SIMAPO)</div>\n      </div>`;

const replacement = `<div class="rekap-title">📦 Sistem Inventaris (SIMAPO)</div>
      </div>
      
      <!-- Filter Instansi SIMAPO (Only visible to Superadmin) -->
      <div id="simapoInstansiSection" style="display: none; margin-bottom: 15px; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);">
        <div class="form-label" style="margin-bottom: 4px; font-weight:800; color:var(--gold);">🏢 Pilih Instansi (Superadmin)</div>
        <select id="simapoInstansiSelect" class="form-input" style="width: 100%; height: 38px; cursor: pointer; background: var(--card); color: var(--white); border: 1px solid var(--border); border-radius: 12px;"
          onchange="onSimapoInstansiChange()">
          <option value="">— Pilih Instansi —</option>
        </select>
      </div>`;

if (c.includes('simapoInstansiSection')) {
  console.log('Already patched!');
} else {
  c = c.replace(target, replacement);
  fs.writeFileSync('index.html', c);
  console.log('Patched index.html successfully!');
}
