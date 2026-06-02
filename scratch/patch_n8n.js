const fs = require('fs');

const path = 'n8n/AbsensiBot V.5.1.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// 1. Update Hitung Rekap
const hitungRekapCode = `const queryArr = $('Rekap').all();
const query = (queryArr.length > 0) ? (queryArr[0].json.query || {}) : {};
const dari   = query.dari   || null;
const sampai = query.sampai || null;

// Parse libur & jam periode from query
let hariLiburSet = new Set();
try {
  if (query.libur) {
    const arr = JSON.parse(decodeURIComponent(query.libur));
    if (Array.isArray(arr)) arr.forEach(d => hariLiburSet.add(d));
  }
} catch(e){}

let jamPeriodeList = [];
try {
  if (query.jam_periode) {
    jamPeriodeList = JSON.parse(decodeURIComponent(query.jam_periode));
  }
} catch(e){}

function toMenit(str) {
  if (!str) return null;
  const parts = String(str).split(':').map(Number);
  return (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) ? null : parts[0] * 60 + parts[1];
}

const JAM_MASUK_STANDAR  = toMenit(query.jam_masuk) || (7 * 60 + 15); 
const JAM_PULANG_STANDAR = toMenit(query.jam_pulang) || (14 * 60 + 30); 

function getJamForTanggal(tglStr) {
  const tMs = new Date(tglStr + 'T00:00:00').getTime();
  if (isNaN(tMs)) return { masuk: JAM_MASUK_STANDAR, pulang: JAM_PULANG_STANDAR };

  const periode = jamPeriodeList.find(p => {
    const dariMs = new Date(p.dari + 'T00:00:00').getTime();
    const sampaiMs = new Date(p.sampai + 'T00:00:00').getTime();
    return tMs >= dariMs && tMs <= sampaiMs;
  });

  if (periode && periode.masuk && periode.pulang) {
    return { masuk: toMenit(periode.masuk), pulang: toMenit(periode.pulang) };
  }
  return { masuk: JAM_MASUK_STANDAR, pulang: JAM_PULANG_STANDAR };
}

// 1. Ambil daftar USER_LIST
const userList = $input.all().map((i, idx) => {
  const j = i.json;
  return {
    id: String(j.id || j.ID || j.telegram_id || '').trim(),
    nama: j.nama || j.Nama || j.username || 'Pegawai',
    nip: String(j.nip || j.NIP || '—'),
    jabatan: j.jabatan || j.Jabatan || '',
    pangkat: j.pangkat || j.Pangkat || '',
    jam_masuk: j.jam_masuk || j.Jam_Masuk || null,
    jam_pulang: j.jam_pulang || j.Jam_Pulang || null,
    bidang: String(j.bidang || j.Bidang || '—'),
    nomorhp: j.nomorhp || j.no_hp || '',
    urutan: Number(j.no || j.No || idx)
  };
}).filter(u => u.id);

// 2. Ambil Global Statistik
const gStatsMap = {};
try {
  const gRows = $('Get Statistik Pegawai').all();
  gRows.forEach(r => {
    const rawNip = String(r.json.nip || r.json.NIP || r.json.Nip || '').trim();
    const cleanNip = rawNip.replace(/\\D/g, '');
    if (cleanNip) gStatsMap[cleanNip] = r.json;
    const tid = String(r.json.pegawai_id || r.json.Step_Id || r.json.ID || r.json.id || '').trim();
    if (tid) gStatsMap[tid] = r.json;
  });
} catch(e) { console.warn('Gagal memuat statistik_pegawai', e); }

const map = {};
userList.forEach(u => {
  map[u.id] = {
    ...u, masuk: 0, pulang: 0, di_luar_masuk_periode: 0, di_luar_pulang_periode: 0,
    izin: 0, sakit: 0, tugas: 0, tubel: 0, cuti: 0, alpa: 0,
    menit_terlambat_periode: 0, menit_lebih_awal_periode: 0,
    hadir_dates: new Set(), excused_dates: new Set(), jamHadirMenit: 0,
    jamMasuk: '-', jamPulang: '-',
    _rawMasukLog: null, _rawPulangLog: null, _rawKetLog: null,
    logByDate: {}
  };
});

let rangeDates = [];
let hariKerjaAktif = 0;
if (dari && sampai) {
  let dCur = new Date(dari + 'T00:00:00');
  let dEnd = new Date(sampai + 'T00:00:00');
  while (dCur <= dEnd) {
    const t = dCur.toISOString().split('T')[0];
    const dy = dCur.getDay();
    if (dy !== 0 && dy !== 6 && !hariLiburSet.has(t)) {
      rangeDates.push(t);
      hariKerjaAktif++;
    }
    dCur.setDate(dCur.getDate() + 1);
  }
}
if (hariKerjaAktif === 0) hariKerjaAktif = 1;

// 3. Ambil data LOG
const allLogs = $('Get All Log').all();
for (const r of allLogs) {
  const d = r.json;
  const tid = String(d.ID || d.id || d.telegram_id || '').trim();
  if (!tid || !map[tid]) continue;
  
  const p = map[tid];
  let jenis = String(d['Jenis Absen'] || d.jenis_absen || d.jenis || '').toUpperCase().trim();
  const tglStr = d.tanggal || d.Tanggal || '';
  const tgl = tglStr.substring(0, 10);
  const jamStr = String(d.jam || d.Jam || '').substring(0, 5);
  const jamMenit = toMenit(jamStr);
  
  if (!tgl || jamMenit === null) continue;
  if (!p.logByDate[tgl]) p.logByDate[tgl] = {};

  const pkId = d.ID_Log || d.id_log || d.ID_log || d.Id_Log || null;
  const rawRecord = { ...d, ID_Log: pkId };
  
  const batas = getJamForTanggal(tgl);

  if (jenis === 'MASUK' || jenis === 'DI LUAR JAM MASUK') {
    jenis = (jamMenit > batas.masuk) ? 'DI LUAR JAM MASUK' : 'MASUK';
    p._rawMasukLog = rawRecord;
    p.jamMasuk = jamStr;
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
    if (jenis !== 'PULANG LUAR') {
      jenis = (jamMenit < batas.pulang) ? 'DI LUAR JAM PULANG' : 'PULANG';
    }
    
    p._rawPulangLog = rawRecord;
    p.jamPulang = jamStr;
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
}

// 4. Hitung kompilasi final
const finalPegawai = userList.map(u => {
  const p = map[u.id];
  
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
    if (!p.hadir_dates.has(t) && !p.excused_dates.has(t)) {
      alpaPeriod++;
    }
  }
  
  const totalMasukEntries = p.masuk + p.di_luar_masuk_periode;
  let disiplinPct = 100;
  if (totalMasukEntries > 0) {
    disiplinPct = Math.max(0, Math.round(((totalMasukEntries - p.di_luar_masuk_periode) / totalMasukEntries) * 100));
  } else if (p.hadir_dates.size > 0) { 
    disiplinPct = 100;
  }
  
  const totalKehadiranSah = p.hadir_dates.size + p.tugas + p.sakit + p.tubel + p.cuti;
  let kehadiranPct = Math.round((totalKehadiranSah / hariKerjaAktif) * 100);
  if (kehadiranPct > 100) kehadiranPct = 100; 

  const cleanUserNip = String(u.nip || '').replace(/\\D/g, '');
  const gs = gStatsMap[cleanUserNip] || gStatsMap[u.id] || {};
  const mTerlambatGlobal = parseInt(gs.akum_menit_terlambat || 0);
  const mCepatGlobal     = parseInt(gs.akum_menit_lebih_awal || 0);

  return {
    ...p,
    alpa: alpaPeriod,
    lambat_count: p.di_luar_masuk_periode, 
    pulang_cepat_count: p.di_luar_pulang_periode,
    di_luar_masuk: mTerlambatGlobal, 
    di_luar_pulang: mCepatGlobal,
    menit_terlambat: mTerlambatGlobal, 
    menit_lebih_awal: mCepatGlobal,
    menit_terlambat_periode: p.menit_terlambat_periode,
    menit_lebih_awal_periode: p.menit_lebih_awal_periode,
    ID_Log: p._rawMasukLog?.ID_Log || p._rawPulangLog?.ID_Log || p._rawKetLog?.ID_Log,
    jamHadir: jamHadir.toFixed(1),
    disiplinPct: disiplinPct,
    kehadiranPct: kehadiranPct,
    totalAkkHHMM: Math.floor((p.menit_terlambat_periode + p.menit_lebih_awal_periode)/60) + ':' + String((p.menit_terlambat_periode + p.menit_lebih_awal_periode)%60).padStart(2, '0'),
    hadir_dates: Array.from(p.hadir_dates),
    excused_dates: Array.from(p.excused_dates)
  };
});

const sum = k => finalPegawai.reduce((s, p) => s + (p[k] || 0), 0);

return [{ json: {
  ringkasan: {
    masuk: sum('masuk'), pulang: sum('pulang'), luar: sum('lambat_count') + sum('pulang_cepat_count'),
    izin: sum('izin'), sakit: sum('sakit'), tugas: sum('tugas'), tubel: sum('tubel'), cuti: sum('cuti'), alpa: sum('alpa')
  },
  pegawai: finalPegawai
}}];`;

// 2. Update Sync Statistik Pegawai
const syncSql = `INSERT INTO statistik_pegawai (
    nip, 
    instansi_id, 
    total_masuk, 
    total_pulang, 
    total_terlambat, 
    total_lebih_awal,
    akum_menit_terlambat,
    akum_menit_lebih_awal,
    total_izin, 
    total_sakit, 
    total_tugas,
    total_tubel,
    total_cuti,
    total_alpa,
    updated_at
)
SELECT 
    '{{ ($json.payload.NIP || $json.payload.nip).toString().replace(/'/g, "''") }}',
    COALESCE(
        (SELECT instansi_id FROM user_list WHERE "NIP" = '{{ ($json.payload.NIP || $json.payload.nip).toString().replace(/'/g, "''") }}' LIMIT 1),
        (SELECT instansi_id FROM user_list WHERE id::text = '{{ ($json.payload.ID || $json.payload.id || $json.payload.pegawai_id).toString().replace(/'/g, "''") }}' LIMIT 1),
        'bapperida'
    ),
    COUNT(*) FILTER (WHERE "Jenis Absen" IN ('MASUK', 'DI LUAR JAM MASUK')),
    COUNT(*) FILTER (WHERE "Jenis Absen" IN ('PULANG', 'DI LUAR JAM PULANG', 'PULANG LUAR')),
    
    COUNT(*) FILTER (
        WHERE "Jenis Absen" = 'DI LUAR JAM MASUK' 
        OR "Jenis Absen" = 'TANPA BERITA'
    ),
    
    COUNT(*) FILTER (
        WHERE "Jenis Absen" = 'DI LUAR JAM PULANG' 
    ),
    
    COALESCE(SUM(
        CASE 
            WHEN "Jenis Absen" = 'TANPA BERITA' THEN 450
            WHEN "Jenis Absen" = 'DI LUAR JAM MASUK'
            THEN GREATEST(0, EXTRACT(EPOCH FROM ("Jam"::time - (
                COALESCE((SELECT masuk::time FROM jam_periode WHERE "Log_Absen"."Tanggal"::date BETWEEN dari_tanggal::date AND sampai_tanggal::date LIMIT 1), '07:15:00'::time)
            ))) / 60)
            ELSE 0 
        END
    ), 0)::integer,

    COALESCE(SUM(
        CASE 
            WHEN "Jenis Absen" = 'DI LUAR JAM PULANG'
            THEN GREATEST(0, EXTRACT(EPOCH FROM (
                COALESCE((SELECT pulang::time FROM jam_periode WHERE "Log_Absen"."Tanggal"::date BETWEEN dari_tanggal::date AND sampai_tanggal::date LIMIT 1), '14:30:00'::time)
                - "Jam"::time
            )) / 60)
            ELSE 0 
        END
    ), 0)::integer,

    COUNT(*) FILTER (WHERE "Jenis Absen" = 'IZIN'),
    COUNT(*) FILTER (WHERE "Jenis Absen" = 'SAKIT'),
    COUNT(*) FILTER (WHERE "Jenis Absen" IN ('TUGAS', 'DL')),
    COUNT(*) FILTER (WHERE "Jenis Absen" = 'TUBEL'),
    COUNT(*) FILTER (WHERE "Jenis Absen" = 'CUTI'),
    COUNT(*) FILTER (WHERE "Jenis Absen" = 'TANPA BERITA'),
    NOW()
FROM "Log_Absen"
WHERE "NIP" = '{{ ($json.payload.NIP || $json.payload.nip).toString().replace(/'/g, "''") }}'
ON CONFLICT (nip) 
DO UPDATE SET 
    total_masuk = EXCLUDED.total_masuk,
    total_pulang = EXCLUDED.total_pulang,
    total_terlambat = EXCLUDED.total_terlambat,
    total_lebih_awal = EXCLUDED.total_lebih_awal,
    akum_menit_terlambat = EXCLUDED.akum_menit_terlambat,
    akum_menit_lebih_awal = EXCLUDED.akum_menit_lebih_awal,
    total_izin = EXCLUDED.total_izin,
    total_sakit = EXCLUDED.total_sakit,
    total_tugas = EXCLUDED.total_tugas,
    total_tubel = EXCLUDED.total_tubel,
    total_cuti = EXCLUDED.total_cuti,
    total_alpa = EXCLUDED.total_alpa,
    updated_at = NOW();`;

// Apply patches
const hitungNode = data.nodes.find(n => n.name === 'Hitung Rekap');
if (hitungNode) hitungNode.parameters.jsCode = hitungRekapCode;

const syncNode = data.nodes.find(n => n.name === 'Sync Statistik Pegawai');
if (syncNode) syncNode.parameters.query = syncSql;

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('Patch success!');
