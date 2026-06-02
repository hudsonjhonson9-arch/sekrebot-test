const fs = require('fs');
let js = fs.readFileSync('js/admin-lokasi-v9.js', 'utf8');

// Add global listener at the top
if (!js.includes("document.addEventListener('click', function(e) {")) {
  js = `document.addEventListener('click', function(e) {
  if (!e.target.closest('.custom-search-dropdown')) {
    document.querySelectorAll('.dropdown-list-wrap').forEach(el => {
      if (el.id.startsWith('instansi')) el.style.display = 'none';
    });
  }
});\n\n` + js;
}

// Update trigger onclick
const oldOnclick = /onclick="this\.parentElement\.classList\.toggle\('open'\)"/g;
const newOnclick = `onclick="const list = this.nextElementSibling; document.querySelectorAll('#instansiCheckGrid-list, [id^=instansi-grid-]').forEach(el => { if (el !== list) el.style.display = 'none'; }); list.style.display = (list.style.display === 'none' || !list.style.display) ? 'flex' : 'none';"`;
js = js.replace(oldOnclick, newOnclick);

// Make sure dropdown lists start with display:none
const oldStyle = /box-shadow:0 10px 25px rgba\(0,0,0,0\.5\); display:flex; flex-direction:column; gap:4px;"/g;
const newStyle = `box-shadow:0 10px 25px rgba(0,0,0,0.5); display:none; flex-direction:column; gap:4px;"`;
js = js.replace(oldStyle, newStyle);

fs.writeFileSync('js/admin-lokasi-v9.js', js, 'utf8');
console.log('Fixed dropdown visibility toggling!');
