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
    
    // We want to find cases where the user typed: .replace(/'/g, "''")
    // and fix it to valid JSON: .replace(/'/g, \"''\")
    // But we have to be careful. In JS regex, finding literally .replace(/'/g, "''")
    const brokenRegex = /\.replace\(\/'\/g, "''"\)/g;
    
    if (brokenRegex.test(content)) {
      content = content.replace(brokenRegex, '.replace(/\'/g, \\"\'\'\\")');
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed manual JSON break in: ${file}`);
      updatedCount++;
    }
  });
});

console.log(`Total files repaired: ${updatedCount}`);
