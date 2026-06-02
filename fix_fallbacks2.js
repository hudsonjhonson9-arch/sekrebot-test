const fs = require('fs');

let lok = fs.readFileSync('js/admin-lokasi-v9.js', 'utf8');

// Replace syncInstansiList fallback
lok = lok.replace(
  /const fallback = \[\s*\{\s*id:\s*'bapperida'[\s\S]*?\];/g,
  'const fallback = [];'
);

lok = lok.replace(
  /var instList = window\.INSTANSI_LIST && window\.INSTANSI_LIST\.length > 0 \? window\.INSTANSI_LIST : \[\s*\{\s*id:\s*'bapperida'[\s\S]*?\];/g,
  'var instList = window.INSTANSI_LIST && window.INSTANSI_LIST.length > 0 ? window.INSTANSI_LIST : [];'
);

lok = lok.replace(
  /\$\{\(window\.INSTANSI_LIST && window\.INSTANSI_LIST\.length > 0 \? window\.INSTANSI_LIST : \[\s*\{\s*id:\s*'bapperida'[\s\S]*?\]\)\.map\(ins => \{/g,
  '${(window.INSTANSI_LIST && window.INSTANSI_LIST.length > 0 ? window.INSTANSI_LIST : []).map(ins => {'
);

fs.writeFileSync('js/admin-lokasi-v9.js', lok);

let adm = fs.readFileSync('js/admin.js', 'utf8');
adm = adm.replace(
  /if \(\!window\.INSTANSI_LIST \|\| window\.INSTANSI_LIST\.length === 0\) \{\s*window\.INSTANSI_LIST = \[\s*\{\s*id:\s*'bapperida'[\s\S]*?\];\s*\}/g,
  ''
);
fs.writeFileSync('js/admin.js', adm);
console.log('Removed fallbacks successfully.');
