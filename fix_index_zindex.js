const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Find the Lokasi card which has: <!-- 📍 LOKASI --> or something similar, and `<div id="lokasiMgmtList" style="margin-top:12px"></div>`
// Since that's hard to target cleanly, I'll inject a global CSS rule at the end of the <style> block, or just before </head>

let css = `
<style>
/* Fix overlapping dropdowns by establishing higher z-index for the Lokasi card */
#admin-section-config > .card:nth-child(1) {
    position: relative;
    z-index: 50;
    overflow: visible !important;
}
#admin-section-config > .card:nth-child(2) {
    position: relative;
    z-index: 10;
}
/* Ensure the location item parent does not clip */
#lokasiMgmtList {
    overflow: visible !important;
}
</style>
</head>`;

html = html.replace('</head>', css);

fs.writeFileSync('index.html', html, 'utf8');
console.log('Injected global CSS to fix z-index stacking context between cards.');
