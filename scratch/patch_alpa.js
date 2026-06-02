const fs = require('fs');
const path = require('path');

const file = 'n8n/AbsensiBot V.5.1.json';
let data = JSON.parse(fs.readFileSync(file, 'utf8'));

data.nodes.forEach(n => {
  if (n.name === 'Hitung Rekap') {
    let js = n.parameters.jsCode;
    
    // Add TB to categories
    js = js.replace(
      "['IZIN', 'SAKIT', 'TUGAS', 'DL', 'TUBEL', 'CUTI'].includes(jenis)",
      "['IZIN', 'SAKIT', 'TUGAS', 'DL', 'TUBEL', 'CUTI', 'TB', 'TANPA BERITA', 'ALPA'].includes(jenis)"
    );

    // Increment alpa when TB
    js = js.replace(
      "else if (jenis === 'CUTI') p.cuti++;\n    else p.tugas++;",
      "else if (jenis === 'CUTI') p.cuti++;\n    else if (['TB', 'TANPA BERITA', 'ALPA'].includes(jenis)) p.alpa++;\n    else p.tugas++;"
    );

    // Remove dynamic alpa calculation
    const alpaLogic = `  let alpaPeriod = 0;
  for (const t of rangeDates) {
    if (!p.hadir_dates.has(t) && !p.excused_dates.has(t)) {
      alpaPeriod++;
    }
  }`;
    js = js.replace(alpaLogic, "  let alpaPeriod = p.alpa;");

    n.parameters.jsCode = js;
  }
});

fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('Patched Hitung Rekap');
