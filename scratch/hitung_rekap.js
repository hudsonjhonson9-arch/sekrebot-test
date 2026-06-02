// ╔══════════════════════════════════════════════════════════════════════╗
// ║         HITUNG REKAP v18.3 — BAPPERIDA Sumba Barat               ║
// ║  - Optimasi: Koreksi Presence Detection (Count vs Minutes)       ║
// ║  - Luar Masuk/Pulang: Menit Akumulasi Global                    ║
// ║  - Count Luar: Untuk deteksi kehadiran di UI                     ║
// ║  - Normalisasi: NIP-based Sync dengan Fallback Telegram ID       ║
// ║  - Preserved: Jabatan, Pangkat, Jam Masuk/Pulang & Nomor HP      ║
// ╚══════════════════════════════════════════════════════════════════════╝

const queryArr = $('Rekap').all();
const query = (queryArr.length > 0) ? (queryArr[0].json.query || {}) : {};
const dari   = query.dari   || null;
const sampai = query.sampai || null;

function parseJam(str, fallback) {
  if (!str) return fallback;
  const parts = str.split(':').map(Number);
  return (parts.length < 2) ? fallback : parts[0] * 60 + parts[1];
}
const JAM_MASUK_STANDAR  = parseJam(query.jam_masuk,  7 * 60 + 15); 
const JAM_PULANG_STANDAR = parseJam(query.jam_pulang, 14 * 60 + 30); 

let HARI_KERJA_PERIODE = parseInt(query.hari_kerja) || 0;

const JAM_PER_HARI    = (JAM_PULANG_STANDAR - (7 * 60)) / 60; 
const JAM_KERJA_WAJIB = parseFloat((JAM_PER_HARI * HARI_KERJA_PERIODE).toFixed(1));

function toMenit(jamStr) {
  if (!jamStr) return null;
  const s = String(jamStr).split(':');
  return (s.length < 2) ? null : parseInt(s[0]) * 60 + parseInt(s[1]);
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

// 2. Ambil Global Statistik (Map by NIP & Telegram ID) untuk penalti menit
const gStatsMap = {};
try {
  const gRows = $('Get Statistik Pegawai').all();
  gRows.forEach(r => {
    // Normalisasi NIP untuk pencocokan yang kokoh
    const rawNip = String(r.json.nip || r.json.NIP || r.json.Nip || '').trim();
    const cleanNip = rawNip.replace(/\D/g, '');
    if (cleanNip) {
      gStatsMap[cleanNip] = r.json;
    }
    // Fallback: juga petakan berdasarkan pegawai_id (Telegram ID)
    const tid = String(r.json.pegawai_id || r.json.Step_Id || r.json.ID || r.json.id || '').trim();
    if (tid) {
      gStatsMap[tid] = r.json;
    }
  });
} catch(e) { console.warn('Gagal memuat statistik_pegawai', e); }

const map = {};
userList.forEach(u => {
  map[u.id] = {
    ...u, masuk: 0, pulang: 0, di_luar_masuk: 0, di_luar_pulang: 0,
    izin: 0, sakit: 0, tugas: 0, tubel: 0, cuti: 0, alpa: 0, menit_terlambat: 0, menit_lebih_awal: 0,
    hadir_dates: new Set(), excused_dates: new Set(), jamMasuk: '-', jamPulang: '-',
    _rawMasukLog: null, _rawPulangLog: null, _rawKetLog: null
  };
});

// 3. Ambil data LOG yang sudah difilter SQL
const allLogs = $('Get All Log').all();
for (const r of allLogs) {
  const d = r.json;
  const tid = String(d.ID || d.id || d.telegram_id || '').trim();
  if (!tid || !map[tid]) continue;
  
  const p = map[tid];
  const jenis = String(d['Jenis Absen'] || d.jenis_absen || d.jenis || '').toUpperCase().trim();
  const jamStr = String(d.jam || d.Jam || '').substring(0, 5);
  
  // Dapatkan ID_Log asli dari Database (Primary Key)
  const pkId = d.ID_Log || d.id_log || d.ID_log || d.Id_Log || null;
  const rawRecord = { ...d, ID_Log: pkId };

  if (jenis === 'MASUK' || jenis === 'DI LUAR JAM MASUK') {
    p._rawMasukLog = rawRecord;
    p.jamMasuk = jamStr;
    if (jenis === 'MASUK') p.masuk++; else p.di_luar_masuk++;
    p.hadir_dates.add(d.tanggal || d.Tanggal);
  } 
  else if (jenis === 'PULANG' || jenis === 'DI LUAR JAM PULANG' || jenis === 'PULANG LUAR') {
    p._rawPulangLog = rawRecord;
    p.jamPulang = jamStr;
    p.pulang++;
    if (jenis === 'DI LUAR JAM PULANG') p.di_luar_pulang++;
  }
  else if (['IZIN', 'SAKIT', 'TUGAS', 'DL', 'TUBEL', 'CUTI'].includes(jenis)) {
    p._rawKetLog = rawRecord;
    if (jenis === 'IZIN') p.izin++; 
    else if (jenis === 'SAKIT') p.sakit++; 
    else if (jenis === 'TUBEL') p.tubel++;
    else if (jenis === 'CUTI') p.cuti++;
    else p.tugas++;
    p.excused_dates.add(d.tanggal || d.Tanggal);
  }
}

const finalPegawai = userList.map(u => {
  const p = map[u.id];
  
  // Pencocokan Global Statistik: prioritas NIP (dibersihkan dari non-digit), fallback Telegram ID (u.id)
  const cleanUserNip = String(u.nip || '').replace(/\D/g, '');
  const gs = gStatsMap[cleanUserNip] || gStatsMap[u.id] || {};
  
  const mTerlambatGlobal = parseInt(gs.akum_menit_terlambat || 0);
  const mCepatGlobal     = parseInt(gs.akum_menit_lebih_awal || 0);

  // Perhitungan Alpa khusus periode ini
  const daysHadirPeriod = p.hadir_dates.size;
  const daysExcusedPeriod = p.excused_dates.size;
  const alpaPeriod = Math.max(0, HARI_KERJA_PERIODE - (daysHadirPeriod + daysExcusedPeriod));

  // Jam Hadir mengacu pada Log_Absen (hari hadir) dikurangi akumulasi menit
  const jamHadir = Math.max(0, (daysHadirPeriod * JAM_PER_HARI) - ((mTerlambatGlobal + mCepatGlobal) / 60));

  return {
    ...p,
    alpa: alpaPeriod,
    
    // Simpan hitungan asli (counts) untuk presence check di UI
    lambat_count: p.di_luar_masuk,
    pulang_cepat_count: p.di_luar_pulang,

    // Sesuai permintaan: Luar diisi akumulasi menit global untuk display
    di_luar_masuk: mTerlambatGlobal,
    di_luar_pulang: mCepatGlobal,
    
    // Metadata penalti menit
    menit_terlambat: mTerlambatGlobal,
    menit_lebih_awal: mCepatGlobal,
    
    ID_Log: p._rawMasukLog?.ID_Log || p._rawPulangLog?.ID_Log || p._rawKetLog?.ID_Log,
    jamHadir: jamHadir.toFixed(1),
    jamTdkHadir: Math.max(0, JAM_KERJA_WAJIB - jamHadir).toFixed(1),
    disiplinPct: daysHadirPeriod > 0 ? Math.round((p.masuk / daysHadirPeriod) * 100) : 100,
    totalAkkHHMM: Math.floor((mTerlambatGlobal + mCepatGlobal)/60) + ':' + String((mTerlambatGlobal + mCepatGlobal)%60).padStart(2, '0'),
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
}}];