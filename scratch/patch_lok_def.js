const fs = require('fs');
const path = require('path');

const dir = path.join('d:', 'Code', 'absensi_refactored_v6', 'js');
const files = ['admin.js', 'admin-face.js'];

files.forEach(file => {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = false;
  
  const searchPattern = /const hariRaw = \(l\.hari \|\| 'senin,selasa,rabu,kamis,jumat'\)\.toLowerCase\(\);\s+hariRaw\.split\(\',\’\).map\(h => h\.trim\(\)\)\.filter\(Boolean\)\.forEach\(h => \{\s+if \(!newLOK\[h\]\) newLOK\[h\] = \[\];\s+if \(!newLOK\[h\]\.includes\(nama\)\) newLOK\[h\]\.push\(nama\);\s+\}\);/g;

  // Since regex replace with multiline can be tricky, I'll use string replace
  const target = `const hariRaw = (l.hari || 'senin,selasa,rabu,kamis,jumat').toLowerCase();
            hariRaw.split(',').map(h => h.trim()).filter(Boolean).forEach(h => {
              if (!newLOK[h]) newLOK[h] = [];
              if (!newLOK[h].includes(nama)) newLOK[h].push(nama);
            });`;
  const replacement = `const hariRaw = (l.hari || '').toLowerCase();
            if (hariRaw) {
              hariRaw.split(',').map(h => h.trim()).filter(Boolean).forEach(h => {
                if (!newLOK[h]) newLOK[h] = [];
                if (!newLOK[h].includes(nama)) newLOK[h].push(nama);
              });
            }`;

  let oldContent = content;
  content = content.split(`const hariRaw = (l.hari || 'senin,selasa,rabu,kamis,jumat').toLowerCase();\n            hariRaw.split(',').map(h => h.trim()).filter(Boolean).forEach(h => {\n              if (!newLOK[h]) newLOK[h] = [];\n              if (!newLOK[h].includes(nama)) newLOK[h].push(nama);\n            });`).join(
    `const hariRaw = (l.hari || '').toLowerCase();\n            if (hariRaw) {\n              hariRaw.split(',').map(h => h.trim()).filter(Boolean).forEach(h => {\n                if (!newLOK[h]) newLOK[h] = [];\n                if (!newLOK[h].includes(nama)) newLOK[h].push(nama);\n              });\n            }`
  );
  
  content = content.split(`const hariRaw = (l.hari || 'senin,selasa,rabu,kamis,jumat').toLowerCase();\n          hariRaw.split(',').map(h => h.trim()).filter(Boolean).forEach(h => {\n            if (!newLOK[h]) newLOK[h] = [];\n            if (!newLOK[h].includes(nama)) newLOK[h].push(nama);\n          });`).join(
    `const hariRaw = (l.hari || '').toLowerCase();\n          if (hariRaw) {\n            hariRaw.split(',').map(h => h.trim()).filter(Boolean).forEach(h => {\n              if (!newLOK[h]) newLOK[h] = [];\n              if (!newLOK[h].includes(nama)) newLOK[h].push(nama);\n            });\n          }`
  );

  if (oldContent !== content) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
