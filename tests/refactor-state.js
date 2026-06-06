const fs = require('fs');
const path = require('path');

const dir = 'd:\\Code\\absensi_refactored_v6\\js';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'admin.legacy_backup.js');

for (const f of files) {
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');
  let original = content;

  // Add window.AbsenApp namespace init at the very top of state.js
  if (f === 'state.js') {
    if (!content.includes('window.AbsenApp = window.AbsenApp')) {
      content = content.replace('/* ════ STATE GLOBAL (MUTABLE) ════ */', '/* ════ STATE GLOBAL (MUTABLE) ════ */\nwindow.AbsenApp = window.AbsenApp || { rekap: { loaded: false, hariLiburSet: new Set(), lastPegawai: [] }, keterangan: { cache: [], loaded: false } };');
    }
  }
  
  if (f === 'rekap.js') {
    content = content.replace(/let rekapLoaded = false;/g, '');
    content = content.replace(/let hariLiburSet = new Set\(\);[^\n]*\n/g, '');
    content = content.replace(/let lastRekapPegawai = \[\];/g, '');
  }

  if (f === 'keterangan.js') {
    content = content.replace(/let ketStatusCache = \[\], ketStatusLoaded = false;/g, '');
  }

  content = content.replace(/\bketStatusLoaded\b/g, 'window.AbsenApp.keterangan.loaded');
  content = content.replace(/\bketStatusCache\b/g, 'window.AbsenApp.keterangan.cache');
  content = content.replace(/\brekapLoaded\b/g, 'window.AbsenApp.rekap.loaded');
  content = content.replace(/\blastRekapPegawai\b/g, 'window.AbsenApp.rekap.lastPegawai');
  content = content.replace(/\bhariLiburSet\b/g, 'window.AbsenApp.rekap.hariLiburSet');
  
  if (content !== original) {
    fs.writeFileSync(p, content);
    console.log('Modified', f);
  }
}
