const fs = require('fs');

function patchFile(filepath) {
    if (!fs.existsSync(filepath)) return;
    let js = fs.readFileSync(filepath, 'utf8');
    const search = "if (typeof initSuperadminLemburScoping === 'function') initSuperadminLemburScoping();";
    const replace = search + "\n          if (typeof loadLokasiAdmin === 'function') loadLokasiAdmin();";
    
    if (js.includes(search) && !js.includes('loadLokasiAdmin()')) {
        js = js.replace(search, replace);
        fs.writeFileSync(filepath, js, 'utf8');
        console.log('Patched ' + filepath);
    }
}

patchFile('js/admin.js');
patchFile('js/admin-libur.js');
