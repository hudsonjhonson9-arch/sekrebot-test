const fs = require('fs');
const path = require('path');

const dir = 'd:\\Code\\absensi_refactored_v6\\js';

function refactorFile(filename, replacements) {
  const p = path.join(dir, filename);
  if (!fs.existsSync(p)) return;
  let content = fs.readFileSync(p, 'utf8');
  let original = content;

  for (const r of replacements) {
    if (r.type === 'regex') {
      content = content.replace(r.from, r.to);
    } else {
      content = content.split(r.from).join(r.to);
    }
  }

  if (content !== original) {
    fs.writeFileSync(p, content);
    console.log(`Updated ${filename}`);
  }
}

// 1. Update state.js to register namespaces
refactorFile('state.js', [
  {
    type: 'regex',
    from: /window\.AbsenApp = window\.AbsenApp \|\| \{.*?\};/,
    to: `window.AbsenApp = window.AbsenApp || { 
  rekap: { loaded: false, hariLiburSet: new Set(), lastPegawai: [], hariLiburMap: {}, jamPegawaiMap: {}, userListOrder: [], fp: null }, 
  keterangan: { cache: [], loaded: false },
  simapo: { katalogData: [], masterEditId: null, allPinjamData: [], allTiketData: [], allMasterData: [], cache: {} },
  tugasLembur: { allPegawaiTugas: [], allPegawaiLembur: [], selectedLemburPegawai: [], selectedTugasPegawai: [], tugasMap: null, tugasMarker: null, activeTugasData: null, activeMonitoringTasks: [], activeMyTasks: [] }
};`
  }
]);

// 2. simapo.js
refactorFile('simapo.js', [
  { type: 'string', from: 'let simapoKatalogData = [];', to: 'window.AbsenApp.simapo.katalogData = [];' },
  { type: 'string', from: 'let simapoKatalogData', to: 'window.AbsenApp.simapo.katalogData' },
  { type: 'regex', from: /\bsimapoKatalogData\b/g, to: 'window.AbsenApp.simapo.katalogData' }
]);

// 3. simapo-ext.js
refactorFile('simapo-ext.js', [
  { type: 'string', from: 'window._simapoMasterEditId = null;', to: 'window.AbsenApp.simapo.masterEditId = null;' },
  { type: 'regex', from: /\bwindow\._simapoMasterEditId\b/g, to: 'window.AbsenApp.simapo.masterEditId' },
  
  { type: 'string', from: 'window._allPinjamData = [];', to: 'window.AbsenApp.simapo.allPinjamData = [];' },
  { type: 'regex', from: /\bwindow\._allPinjamData\b/g, to: 'window.AbsenApp.simapo.allPinjamData' },
  
  { type: 'string', from: 'window._allTiketData = [];', to: 'window.AbsenApp.simapo.allTiketData = [];' },
  { type: 'regex', from: /\bwindow\._allTiketData\b/g, to: 'window.AbsenApp.simapo.allTiketData' },
  
  { type: 'string', from: 'window._allMasterData = [];', to: 'window.AbsenApp.simapo.allMasterData = [];' },
  { type: 'regex', from: /\bwindow\._allMasterData\b/g, to: 'window.AbsenApp.simapo.allMasterData' },
  
  { type: 'string', from: 'window._simapoCache = {', to: 'window.AbsenApp.simapo.cache = {' },
  { type: 'regex', from: /\bwindow\._simapoCache\b/g, to: 'window.AbsenApp.simapo.cache' }
]);

// 4. tugas_lembur.js
const tugasVars = [
  { old: '_allPegawaiTugas', new: 'allPegawaiTugas' },
  { old: '_allPegawaiLembur', new: 'allPegawaiLembur' },
  { old: '_selectedLemburPegawai', new: 'selectedLemburPegawai' },
  { old: '_selectedTugasPegawai', new: 'selectedTugasPegawai' },
  { old: '_tugasMap', new: 'tugasMap' },
  { old: '_tugasMarker', new: 'tugasMarker' },
  { old: '_activeTugasData', new: 'activeTugasData' },
  { old: '_activeMonitoringTasks', new: 'activeMonitoringTasks' },
  { old: '_activeMyTasks', new: 'activeMyTasks' }
];

let tugasReplacements = [];
for (const v of tugasVars) {
  tugasReplacements.push({ type: 'regex', from: new RegExp(`let ${v.old}(\\s*=\\s*.*?;)`, 'g'), to: `window.AbsenApp.tugasLembur.${v.new}$1` });
  tugasReplacements.push({ type: 'regex', from: new RegExp(`let ${v.old}`, 'g'), to: `window.AbsenApp.tugasLembur.${v.new}` });
  tugasReplacements.push({ type: 'regex', from: new RegExp(`\\b${v.old}\\b`, 'g'), to: `window.AbsenApp.tugasLembur.${v.new}` });
}
refactorFile('tugas_lembur.js', tugasReplacements);

// 5. rekap.js
const rekapVars = [
  { old: 'hariLiburMap', new: 'hariLiburMap' },
  { old: 'jamPegawaiMap', new: 'jamPegawaiMap' },
  { old: 'liburLoaded', new: 'liburLoaded' },
  { old: 'userListOrder', new: 'userListOrder' },
  { old: '_rekapFp', new: 'fp' }
];

let rekapReplacements = [];
for (const v of rekapVars) {
  rekapReplacements.push({ type: 'regex', from: new RegExp(`let ${v.old}(\\s*=\\s*.*?;)`, 'g'), to: `window.AbsenApp.rekap.${v.new}$1` });
  rekapReplacements.push({ type: 'regex', from: new RegExp(`let ${v.old}`, 'g'), to: `window.AbsenApp.rekap.${v.new}` });
  rekapReplacements.push({ type: 'regex', from: new RegExp(`\\b${v.old}\\b`, 'g'), to: `window.AbsenApp.rekap.${v.new}` });
}
refactorFile('rekap.js', rekapReplacements);

console.log('Refactoring Area 5 complete.');
