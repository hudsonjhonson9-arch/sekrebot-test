const fs = require('fs');
const path = require('path');

const dir = 'd:\\Code\\absensi_refactored_v6\\js';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

let totalReplaced = 0;

for (const f of files) {
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');
  let original = content;

  // Regex to match empty catch blocks: catch (_) { } or catch { }
  // We handle optional spaces.
  const regex1 = /catch\s*\(\s*_\s*\)\s*\{\s*\}/g;
  const regex2 = /catch\s*\{\s*\}/g;

  content = content.replace(regex1, `catch (e) { console.warn('[${f}] Operasi gagal:', e.message); }`);
  content = content.replace(regex2, `catch (e) { console.warn('[${f}] Operasi gagal:', e.message); }`);

  if (content !== original) {
    fs.writeFileSync(p, content);
    console.log(`Updated ${f}`);
    totalReplaced++;
  }
}

console.log(`Refactoring complete. Updated ${totalReplaced} files.`);
