const fs = require('fs');
let js = fs.readFileSync('js/admin-lokasi-v9.js', 'utf8');

const regex = /window\.toggleInstansiCheck = function\(cb, textId\) \{[\s\S]*?^\s*\};/m;
const newFunc = `window.toggleInstansiCheck = function(cb, textId) {
    const grid = cb.closest('.dropdown-list-wrap');
    if (!grid) return;
    
    if (cb.value === 'all' && cb.checked) {
      grid.querySelectorAll('input').forEach(i => {
        if (i !== cb) { i.checked = false; }
      });
    } else if (cb.checked) {
      const allCb = grid.querySelector('input[value="all"]');
      if (allCb && allCb.checked) { allCb.checked = false; }
    }
    
    // Update custom UI classes
    grid.querySelectorAll('.custom-checkbox-lbl').forEach(lbl => {
      const input = lbl.querySelector('input');
      const box = lbl.querySelector('.checkbox-box');
      const mark = lbl.querySelector('.check-mark');
      const span = lbl.querySelector('span');
      if (input.checked) {
        lbl.style.background = 'rgba(212,175,55,0.1)';
        lbl.style.borderLeft = '3px solid var(--gold)';
        box.style.borderColor = 'var(--gold)';
        box.style.background = 'rgba(212,175,55,0.1)';
        mark.style.opacity = '1';
        mark.style.transform = 'scale(1)';
        span.style.fontWeight = '600';
      } else {
        lbl.style.background = 'transparent';
        lbl.style.borderLeft = '3px solid transparent';
        box.style.borderColor = 'rgba(255,255,255,0.3)';
        box.style.background = 'transparent';
        mark.style.opacity = '0';
        mark.style.transform = 'scale(0)';
        span.style.fontWeight = 'normal';
      }
    });
    
    // Update text
    const textEl = document.getElementById(textId);
    if (textEl) {
      const checked = Array.from(grid.querySelectorAll('input:checked'));
      if (checked.length === 0 || (checked.length === 1 && checked[0].value === 'all')) {
        textEl.textContent = 'Semua Instansi';
      } else if (checked.length === 1) {
        const val = checked[0].value;
        const found = (window.INSTANSI_LIST || []).find(i => i.id === val);
        textEl.textContent = found ? found.nama_instansi : '1 Instansi Terpilih';
      } else {
        textEl.textContent = checked.length + ' Instansi Terpilih';
      }
    }
  };`;

js = js.replace(regex, newFunc);
fs.writeFileSync('js/admin-lokasi-v9.js', js, 'utf8');
console.log('Replaced function');
