const fs = require('fs');

const path = 'js/rekap.js';
let content = fs.readFileSync(path, 'utf8');

// Update line 155 (payload url)
content = content.replace(
  "const res = await apiFetch(`${P.rekap}?dari=${dari}&sampai=${sampai}&jam_masuk=${jamMasukParam}&jam_pulang=${jamPulangParam}&hari_kerja=${hariKerjaParam}&libur=${liburParam}${nipQuery}${adminParam}${instansiParam}`, { method: 'GET' });",
  "const jamPeriodeParam = encodeURIComponent(JSON.stringify(typeof jamPeriodeList !== 'undefined' ? jamPeriodeList : []));\n      const res = await apiFetch(`${P.rekap}?dari=${dari}&sampai=${sampai}&jam_masuk=${jamMasukParam}&jam_pulang=${jamPulangParam}&hari_kerja=${hariKerjaParam}&libur=${liburParam}&jam_periode=${jamPeriodeParam}${nipQuery}${adminParam}${instansiParam}`, { method: 'GET' });"
);

// We need to replace the entire computeRekap function. 
// computeRekap starts at line 330 and ends around line 548.
const startMarker = "function computeRekap(rows, allRowsParam = null, userSeed = null, dari = null, sampai = null) {";
const endMarker = "function resetRekapStats() {";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const newComputeRekap = `function computeRekap(rows, allRowsParam = null, userSeed = null, dari = null, sampai = null) {
  const JAM_MASUK_BATAS = JAM_MASUK_MENIT;
  const JAM_PULANG_BATAS = JAM_PULANG_MENIT;
  
  function toMenit(jamStr) {
    const s = String(jamStr || '').replace(/\\s.*/, '').split(':');
    if (s.length < 2) return null;
    const h = parseInt(s[0]), m = parseInt(s[1]);
    return (isNaN(h) || isNaN(m)) ? null : h * 60 + m;
  }

  function getJamForTanggalBatas(id, tglStr) {
    if (tglStr) {
      const p = getJamForTanggal(tglStr); 
      if (p && p.nama) return { masuk: toMenit(p.masuk), pulang: toMenit(p.pulang) };
    }
    return { 
      masuk: jamPegawaiMap[id]?.masukMenit ?? JAM_MASUK_BATAS,
      pulang: jamPegawaiMap[id]?.pulangMenit ?? JAM_PULANG_BATAS
    };
  }

  const rangeDates = [];
  if (dari && sampai) {
    let dCur = new Date(dari + 'T00:00:00'), dEnd = new Date(sampai + 'T00:00:00');
    while (dCur <= dEnd) {
      const t = dCur.toISOString().split('T')[0], dy = dCur.getDay();
      if (dy !== 0 && dy !== 6 && !hariLiburSet.has(t)) rangeDates.push(t);
      dCur.setDate(dCur.getDate() + 1);
    }
  }
  const HK_PERIODE = rangeDates.length || 1;

  const map = {};

  (userSeed || []).forEach((u, idx) => {
    const id = String(u.id || '').trim();
    if (!id) return;
    map[id] = {
      id,
      nama: u.nama || '—', nip: u.nip || '—', jabatan: u.jabatan || '', pangkat: u.pangkat || '', urutan: u.urutan ?? idx,
      masuk: 0, pulang: 0, di_luar_masuk_periode: 0, di_luar_pulang_periode: 0,
      izin: 0, sakit: 0, tugas: 0, tubel: 0, cuti: 0, alpa: 0,
      menit_terlambat_periode: 0, menit_lebih_awal_periode: 0,
      hadir_dates: new Set(), excused_dates: new Set(),
      jamMasuk: '-', jamPulang: '-',
      _rawMasukLog: null, _rawPulangLog: null,
      logByDate: {},
      // global stats from allRows
      all_menit_terlambat: 0, all_menit_lebih_awal: 0, all_masuk: 0, all_di_luar_masuk: 0,
      all_di_luar_pulang: 0, all_izin: 0, all_sakit: 0, all_tugas: 0, all_tubel: 0, all_cuti: 0, all_alpa: 0
    };
  });

  rows.forEach(r => {
    const id = String(getField(r, 'ID', 'id') || '').trim();
    if (!id) return;
    const nama = getField(r, 'Nama', 'nama') || '—';
    const nip = getField(r, 'NIP', 'nip') || '—';
    let jenis = (getField(r, 'Jenis Absen', 'jenis', 'Jenis', 'JenisAbsen', 'jenis_absen') || '').toUpperCase().trim();
    const tglStr = getField(r, 'Tanggal', 'tanggal') || '';
    const tgl = normToISO(tglStr);
    const jamStr = getField(r, 'Jam', 'jam') || '';
    const id_log = r.ID_Log || r.id_log || r.id || ''; 
    const jamMenit = toMenit(jamStr);

    if (!map[id]) map[id] = {
      id, nama, nip, jabatan: '', pangkat: '', urutan: 9999,
      masuk: 0, pulang: 0, di_luar_masuk_periode: 0, di_luar_pulang_periode: 0,
      izin: 0, sakit: 0, tugas: 0, tubel: 0, cuti: 0, alpa: 0,
      menit_terlambat_periode: 0, menit_lebih_awal_periode: 0,
      hadir_dates: new Set(), excused_dates: new Set(),
      jamMasuk: '-', jamPulang: '-',
      _rawMasukLog: null, _rawPulangLog: null, logByDate: {}
    };

    if (!tgl || jamMenit === null) return;
    const p = map[id];
    if (!p.logByDate[tgl]) p.logByDate[tgl] = {};
    
    if (nip && p.nip === '—') p.nip = nip;
    
    const batas = getJamForTanggalBatas(id, tgl);
    const rawRecord = { ...r, ID_Log: id_log };

    if (jenis === 'MASUK' || jenis === 'DI LUAR JAM MASUK') {
      jenis = (jamMenit > batas.masuk) ? 'DI LUAR JAM MASUK' : 'MASUK';
      p._rawMasukLog = rawRecord;
      p.jamMasuk = jamStr.replace(/\\s*WITA\\s*/i, '').trim();
      p.logByDate[tgl].masuk = jamMenit;
      
      if (jenis === 'DI LUAR JAM MASUK') {
        p.di_luar_masuk_periode++;
        p.menit_terlambat_periode += (jamMenit - batas.masuk);
      } else {
        p.masuk++;
      }
      p.hadir_dates.add(tgl);
    } 
    else if (jenis === 'PULANG' || jenis === 'DI LUAR JAM PULANG' || jenis === 'PULANG LUAR') {
      if (jenis !== 'PULANG LUAR') jenis = (jamMenit < batas.pulang) ? 'DI LUAR JAM PULANG' : 'PULANG';
      p._rawPulangLog = rawRecord;
      p.jamPulang = jamStr.replace(/\\s*WITA\\s*/i, '').trim();
      p.logByDate[tgl].pulang = jamMenit;
      
      if (jenis === 'DI LUAR JAM PULANG') {
        p.di_luar_pulang_periode++;
        p.menit_lebih_awal_periode += (batas.pulang - jamMenit);
      } else {
        p.pulang++;
      }
    }
    else if (['IZIN', 'SAKIT', 'TUGAS', 'DL', 'TUBEL', 'CUTI'].includes(jenis)) {
      p._rawKetLog = rawRecord;
      if (jenis === 'IZIN') p.izin++; 
      else if (jenis === 'SAKIT') p.sakit++; 
      else if (jenis === 'TUBEL') p.tubel++;
      else if (jenis === 'CUTI') p.cuti++;
      else p.tugas++;
      p.excused_dates.add(tgl);
    }
  });

  const allRows = allRowsParam || rows;
  allRows.forEach(r => {
    const id = String(getField(r, 'ID', 'id') || '').trim();
    if (!id || !map[id]) return;
    const tglA = normToISO(getField(r, 'Tanggal', 'tanggal') || '');
    const jenis = (getField(r, 'Jenis Absen', 'jenis', 'Jenis', 'JenisAbsen', 'jenis_absen') || '').toUpperCase().trim();
    const jamMenit = toMenit(getField(r, 'Jam', 'jam'));
    const batas = getJamForTanggalBatas(id, tglA);
    if (jenis === 'MASUK') { map[id].all_masuk++; }
    else if (jenis.includes('LUAR') && (jenis.includes('MASUK') || !jenis.includes('PULANG'))) {
      map[id].all_di_luar_masuk++;
      if (jamMenit !== null && jamMenit > batas.masuk) map[id].all_menit_terlambat += (jamMenit - batas.masuk);
    }
    else if (jenis.includes('LUAR') && jenis.includes('PULANG')) {
      map[id].all_di_luar_pulang++;
      if (jamMenit !== null && jamMenit < batas.pulang) map[id].all_menit_lebih_awal += (batas.pulang - jamMenit);
    }
    else if (jenis === 'IZIN') { map[id].all_izin++; }
    else if (jenis === 'SAKIT') { map[id].all_sakit++; }
    else if (jenis === 'TUGAS' || jenis === 'DL') { map[id].all_tugas++; }
    else if (jenis === 'TUBEL') { map[id].all_tubel++; }
    else if (jenis === 'CUTI') { map[id].all_cuti++; }
    else if (jenis === 'TANPA BERITA') { map[id].all_alpa++; }
  });

  const pegawai = Object.values(map).map(p => {
    let jamHadirMenit = 0;
    for (const t of rangeDates) {
      if (p.logByDate[t] && p.logByDate[t].masuk !== undefined && p.logByDate[t].pulang !== undefined) {
        const durasi = p.logByDate[t].pulang - p.logByDate[t].masuk;
        if (durasi > 0) jamHadirMenit += durasi;
      }
    }
    const jamHadir = jamHadirMenit / 60;
    
    let alpaPeriod = 0;
    for (const t of rangeDates) {
      if (!p.hadir_dates.has(t) && !p.excused_dates.has(t)) alpaPeriod++;
    }
    
    const totalMasukEntries = p.masuk + p.di_luar_masuk_periode;
    let disiplinPct = 100;
    if (totalMasukEntries > 0) {
      disiplinPct = Math.max(0, Math.round(((totalMasukEntries - p.di_luar_masuk_periode) / totalMasukEntries) * 100));
    }
    
    let disiplinLabel = '', disiplinLevel = 0;
    if (disiplinPct >= 95) { disiplinLabel = 'Sangat Disiplin'; disiplinLevel = 4; }
    else if (disiplinPct >= 80) { disiplinLabel = 'Disiplin'; disiplinLevel = 3; }
    else if (disiplinPct >= 60) { disiplinLabel = 'Cukup'; disiplinLevel = 2; }
    else { disiplinLabel = 'Kurang'; disiplinLevel = 1; }

    const totalKehadiranSah = p.hadir_dates.size + p.tugas + p.sakit + p.tubel + p.cuti;
    let kehadiranPct = Math.round((totalKehadiranSah / HK_PERIODE) * 100);
    if (kehadiranPct > 100) kehadiranPct = 100;

    return {
      ...p,
      alpa: alpaPeriod,
      lambat_count: p.di_luar_masuk_periode, 
      pulang_cepat_count: p.di_luar_pulang_periode,
      di_luar_masuk: p.all_menit_terlambat, 
      di_luar_pulang: p.all_menit_lebih_awal,
      menit_terlambat: p.all_menit_terlambat,
      menit_lebih_awal: p.all_menit_lebih_awal,
      menit_terlambat_periode: p.menit_terlambat_periode,
      menit_lebih_awal_periode: p.menit_lebih_awal_periode,
      jamHadir: jamHadir.toFixed(1),
      disiplinPct, disiplinLabel, disiplinLevel, kehadiranPct,
      totalAkkHHMM: toHHMM(p.menit_terlambat_periode + p.menit_lebih_awal_periode),
      hadir_dates: Array.from(p.hadir_dates),
      excused_dates: Array.from(p.excused_dates)
    };
  });

  const sum = k => pegawai.reduce((s, p) => s + (p[k] || 0), 0);
  return {
    pegawai,
    ringkasan: {
      masuk: sum('masuk'),
      pulang: sum('pulang'),
      luar: sum('lambat_count') + sum('pulang_cepat_count'),
      izin: sum('izin'), sakit: sum('sakit'), tugas: sum('tugas'), tubel: sum('tubel'), cuti: sum('cuti'), alpa: sum('alpa')
    }
  };
}

`;
  
  const finalContent = content.substring(0, startIndex) + newComputeRekap + content.substring(endIndex);
  fs.writeFileSync(path, finalContent);
  console.log('Rekap JS patched!');
} else {
  console.log('Markers not found!');
}
