const fs = require('fs');
const path = require('path');

const n8nDir = path.join('d:', 'Code', 'absensi_refactored_v6', 'n8n');
const dirsToScan = [n8nDir, path.join(n8nDir, 'simapo')];

let updatedCount = 0;

dirsToScan.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    if (!file.endsWith('.json')) return;
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix the broken JSON double quotes
    // We are looking for: .replace(/'/g, "''")
    // And replacing it with: .replace(/'/g, \"''\")
    if (content.includes('.replace(/\'/g, "\'\'")')) {
      content = content.replace(/\.replace\(\/'\/g, "''"\)/g, '.replace(/\'/g, \\"\'\'\\")');
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed JSON syntax in: ${file}`);
      updatedCount++;
    }
  });
});

console.log(`Total files fixed for JSON syntax: ${updatedCount}`);
