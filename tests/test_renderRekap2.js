const fs = require('fs');

const constants = fs.readFileSync('../js/constants.js', 'utf8');
const code = fs.readFileSync('../js/rekap.js', 'utf8');

const env = `
  const window = { AbsenApp: { rekap: { loaded: false, lastPegawai: [], hariLiburSet: new Set(), hariLiburMap: {}, jamPegawaiMap: {} } } };
  const document = { getElementById: () => ({ innerHTML: '', value: '' }) };
  const $ = document.getElementById;
  
  ${constants}
  
  const getJamForTanggal = () => ({ masuk: "07:30", pulang: "16:00" });
  const countHKRekap = () => 20;

  ${code}

  try {
    console.log("Testing renderRekap with isHarian = true");
    renderRekap([{ nama: "Test", nip: "123", jamMasuk: "08:00", jamPulang: "17:00", alpa: 0, lambat_count: 0 }], true, "2023-10-01");
    console.log("SUCCESS isHarian = true");
  } catch(e) {
    console.error("FAIL isHarian = true:", e);
  }

  try {
    console.log("Testing renderRekap with isHarian = false");
    renderRekap([{ nama: "Test", nip: "123", jamMasuk: "08:00", jamPulang: "17:00", alpa: 0, lambat_count: 0 }], false, "2023-10-01");
    console.log("SUCCESS isHarian = false");
  } catch(e) {
    console.error("FAIL isHarian = false:", e);
  }
`;

fs.writeFileSync('run_test2.js', env);
