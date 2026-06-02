const fs = require('fs');

function patchFile(filepath) {
    if (!fs.existsSync(filepath)) return;
    let js = fs.readFileSync(filepath, 'utf8');
    const search = "localStorage.setItem('absen_instansi_map', JSON.stringify(instMap));";
    const replace = search + "\n          window.INSTANSI_LIST = Object.keys(instMap).map(k => instMap[k]);";
    
    if (js.includes(search) && !js.includes('window.INSTANSI_LIST = Object.keys(instMap)')) {
        js = js.replace(search, replace);
        fs.writeFileSync(filepath, js, 'utf8');
        console.log('Patched ' + filepath);
    }
}

patchFile('js/admin.js');
patchFile('js/admin-libur.js');
patchFile('js/weather.js'); // Just in case it's here too
patchFile('js/config.js'); // Or here
