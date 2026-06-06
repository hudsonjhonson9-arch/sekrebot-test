const fs = require('fs');

// We need to simulate the environment for renderRekap
const code = fs.readFileSync('../js/rekap.js', 'utf8');

// We will inject some global variables so the code doesn't crash on undefined
const env = `
  const window = { AbsenApp: { rekap: { loaded: false, lastPegawai: [], hariLiburSet: new Set(), hariLiburMap: {}, jamPegawaiMap: {} } } };
  const document = { getElementById: () => ({ innerHTML: '', value: '' }) };
  const $ = document.getElementById;
  
  const JAM_MASUK_MENIT = 450;
  const JAM_PULANG_MENIT = 960;
  const JAM_MASUK_BATAS = "07:30";
  const JAM_PULANG_BATAS = "16:00";
  const toMenitLocal = (s) => 500;
  const toMenit = (s) => 500;
  const toHHMM = (m) => "08:00";
  const getJamForTanggal = () => ({ masuk: "07:30", pulang: "16:00" });
  const countHKRekap = () => 20;

  ${code}

  // Now let's try to call renderRekap
  try {
    console.log("Testing renderRekap with isHarian = true");
    renderRekap([{ nama: "Test", nip: "123", jamMasuk: "08:00", jamPulang: "17:00" }], true, "2023-10-01");
    console.log("SUCCESS isHarian = true");
  } catch(e) {
    console.error("FAIL isHarian = true:", e);
  }

  try {
    console.log("Testing renderRekap with isHarian = false");
    renderRekap([{ nama: "Test", nip: "123", jamMasuk: "08:00", jamPulang: "17:00" }], false, "2023-10-01");
    console.log("SUCCESS isHarian = false");
  } catch(e) {
    console.error("FAIL isHarian = false:", e);
  }
`;

fs.writeFileSync('run_test.js', env);
