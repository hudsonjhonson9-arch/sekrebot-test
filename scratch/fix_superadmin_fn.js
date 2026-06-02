const fs = require('fs');
const filePath = 'd:/Code/absensi_refactored_v6/js/admin-lokasi.js';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the isSuperAdminUser function - replace the broken version with correct one
const brokenFn = `    function isSuperAdminUser() {
      var role = String(window.MY_ROLE || localStorage.getItem('MY_ROLE') || '').replace(/\\\\s/g, '').toUpperCase();
      if (role === 'SUPERADMIN') return true;
      if (role.indexOf('SUPER') >= 0) return true;
      var myNip = String(localStorage.getItem('MY_NIP') || '').trim();
      if (typeof ADMIN_NIPS !== 'undefined' && ADMIN_NIPS.length > 0 && String(ADMIN_NIPS[0]) === myNip) return true;
      if (window.userProfile && String(window.userProfile.role || '').replace(/\\\\s/g, '').toUpperCase() === 'SUPERADMIN') return true;
      return false;
    }`;

const fixedFn = `    function isSuperAdminUser() {
      var role = String(window.MY_ROLE || localStorage.getItem('MY_ROLE') || '').toUpperCase().trim();
      if (role === 'SUPERADMIN' || role === 'SUPER ADMIN') return true;
      if (role.indexOf('SUPER') >= 0) return true;
      var myNip = String(localStorage.getItem('MY_NIP') || '').trim();
      if (typeof ADMIN_NIPS !== 'undefined' && ADMIN_NIPS.length > 0 && String(ADMIN_NIPS[0]) === myNip) return true;
      if (window.userProfile && window.userProfile.role) {
        var profileRole = String(window.userProfile.role).toUpperCase().trim();
        if (profileRole === 'SUPERADMIN' || profileRole === 'SUPER ADMIN' || profileRole.indexOf('SUPER') >= 0) return true;
      }
      return false;
    }`;

if (content.includes(brokenFn)) {
  content = content.replace(brokenFn, fixedFn);
  console.log('Replaced broken function (exact match)');
} else {
  // Try line-by-line replacement
  const lines = content.split('\n');
  const newLines = [];
  let inFunction = false;
  let skipUntilEnd = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === 'function isSuperAdminUser() {') {
      inFunction = true;
      skipUntilEnd = true;
      // Insert the fixed function
      newLines.push('    function isSuperAdminUser() {');
      newLines.push("      var role = String(window.MY_ROLE || localStorage.getItem('MY_ROLE') || '').toUpperCase().trim();");
      newLines.push("      if (role === 'SUPERADMIN' || role === 'SUPER ADMIN') return true;");
      newLines.push("      if (role.indexOf('SUPER') >= 0) return true;");
      newLines.push("      var myNip = String(localStorage.getItem('MY_NIP') || '').trim();");
      newLines.push("      if (typeof ADMIN_NIPS !== 'undefined' && ADMIN_NIPS.length > 0 && String(ADMIN_NIPS[0]) === myNip) return true;");
      newLines.push("      if (window.userProfile && window.userProfile.role) {");
      newLines.push("        var profileRole = String(window.userProfile.role).toUpperCase().trim();");
      newLines.push("        if (profileRole === 'SUPERADMIN' || profileRole === 'SUPER ADMIN' || profileRole.indexOf('SUPER') >= 0) return true;");
      newLines.push("      }");
      newLines.push("      return false;");
      newLines.push("    }");
      continue;
    }
    
    if (skipUntilEnd) {
      // Skip lines until we find the closing brace of the function
      if (lines[i].trim() === '}') {
        skipUntilEnd = false;
        inFunction = false;
      }
      continue;
    }
    
    newLines.push(lines[i]);
  }
  
  content = newLines.join('\n');
  console.log('Replaced broken function (line-by-line)');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('File saved successfully');

// Verify
const verify = fs.readFileSync(filePath, 'utf8');
const fnMatch = verify.match(/function isSuperAdminUser\(\)[^}]+}/);
if (fnMatch) {
  console.log('\nVerification - function content:');
  console.log(fnMatch[0]);
}
