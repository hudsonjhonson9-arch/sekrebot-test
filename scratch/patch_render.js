const fs = require('fs');

const path = 'js/rekap.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "    const hariHadir = (p.masuk || 0) + (lambatCount || 0) + (p.izin || 0) + (p.sakit || 0) + (p.tugas || 0) + (p.tubel || 0) + (p.cuti || 0);\n    const hadirPct = hariKerjaPeriode > 0 ? Math.min(100, Math.round(hariHadir / hariKerjaPeriode * 100)) : 0;",
  "    const hadirPct = p.kehadiranPct ?? 0;"
);

content = content.replace(
  '<div class="stat-box-small"><span class="stat-box-val" style="color:var(--warning)">${izin}</span><span class="stat-box-lbl">Izin</span></div>',
  '<div class="stat-box-small"><span class="stat-box-val" style="color:var(--warning)">${izin}</span><span class="stat-box-lbl">Izin</span>${izin > 0 ? `<div style="font-size:7px;color:var(--warning);margin-top:2px;line-height:1;text-align:center">Ingat ini izin saja</div>` : ""}</div>'
);

// We should also replace the variables 'luarMasuk' and 'luarPulang' in renderRekap to use the period counts, not the global minutes for the main display!
// In renderRekap around line 609:
content = content.replace(
  "const luarMasuk = p.di_luar_masuk ?? 0; // Minutes\n    const luarPulang = p.di_luar_pulang ?? 0; // Minutes\n    const lambatCount = p.lambat_count ?? 0; // Count from server\n    const cepatCount = p.pulang_cepat_count ?? 0; // Count from server",
  "const luarMasuk = p.menit_terlambat_periode ?? 0; // Minutes period\n    const luarPulang = p.menit_lebih_awal_periode ?? 0; // Minutes period\n    const lambatCount = p.lambat_count ?? 0; // Count from server\n    const cepatCount = p.pulang_cepat_count ?? 0; // Count from server"
);

// And update the highlight display to show period instead of all-time if it makes more sense, 
// But the user didn't ask to change the highlight, just to separate global vs period.
// We'll leave the highlight as all-time since it says "Seluruh Waktu".

fs.writeFileSync(path, content);
console.log('renderRekap patched!');
