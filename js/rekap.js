/* ════ REKAP ════ */
/* ════ REKAP ════ */
let rekapLoaded = false;
// Global state: hari libur & jam per pegawai
let hariLiburSet = new Set(); // Set of 'YYYY-MM-DD' strings
let hariLiburMap = {};        // { 'YYYY-MM-DD': 'nama libur' } untuk label di riwayat absen
let jamPegawaiMap = {};       // { [user_id]: {masuk:'HH:MM', pulang:'HH:MM'} }
let liburLoaded = false;
let userListOrder = [];
let lastRekapPegawai = [];

function setPreset(preset, el) {
  const n = nowWITA(); let dari, sampai;
  document.querySelectorAll('.date-preset').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  switch (preset) {
    case 'today': dari = sampai = fmtD(n); break;
    case 'week': { const d = new Date(n); d.setDate(n.getDate() - n.getDay() || 7); dari = fmtD(d); sampai = fmtD(n); break; }
    case 'month': dari = `${n.getFullYear()}-${p2(n.getMonth() + 1)}-01`; sampai = fmtD(n); break;
    case 'last30': { const d = new Date(n); d.setDate(n.getDate() - 29); dari = fmtD(d); sampai = fmtD(n); break; }
    default: return;
  }
  $('rekapDari').value = dari; $('rekapSampai').value = sampai;
  loadRekap();
}
function onDateRangeChange() {
  document.querySelectorAll('.date-preset').forEach(b => b.classList.remove('active'));
  const c = $('dp-custom'); c.style.display = 'inline-block'; c.classList.add('active');
  loadRekap();
}
(function () { const t = fmtD(nowWITA()); $('rekapDari').value = $('rekapSampai').value = t; })();

async function fetchUserListOrder() {
  if (userListOrder.length > 0) return userListOrder;
  try {
    const res = await apiGet(P.userList + (IS_ADMIN ? '?format=full' : ''));
    if (!res.ok) return [];
    const rows = res.rows || parseApiResponse(res.data) || [];
    userListOrder = rows.map((r, idx) => ({
      id: String(getField(r, 'id', 'ID') || '').trim(),
      nama: getField(r, 'nama', 'Nama', 'username', 'Username') || '',
      jabatan: getField(r, 'jabatan', 'Jabatan') || '',
      pangkat: getField(r, 'pangkat', 'Pangkat') || '',
      nip: getField(r, 'nip', 'NIP') || '',
      urutan: Number(getField(r, 'no', 'No', 'urutan', 'Urutan') || (idx + 1))
    }));
    return userListOrder;
  } catch (e) { return []; }
}

/**
 * Muat data rekap absensi dari server dan render ke UI.
 * Menangani filter bidang, rentang tanggal, dan sorting.
 * @returns {Promise<void>}
 */
async function loadRekap() {
  const dari = $('rekapDari').value, sampai = $('rekapSampai').value;
  if (!dari || !sampai) return;
  rekapLoaded = false;
  const btn = $('btnRekapRefresh'); btn.disabled = true;
  const dlBtn = $('btnDownloadRekap'), pdfBtn = $('btnDownloadPDF');
  if (dlBtn) dlBtn.disabled = true;
  if (pdfBtn) pdfBtn.disabled = true;
  $('rekapRefIcon').outerHTML = '<span class="spin-sm" id="rekapRefIcon"></span>';
  dom.shimmer('pegawaiList', 4);
  resetRekapStats();
  // Fetch hari libur, jam pegawai & jam periode secara paralel
  if (!liburLoaded) fetchLiburForRekap();
  fetchJamPegawai();
  await Promise.all([fetchJamPeriode(), window._jamAbsenReady]); // pastikan JAM & periode sudah siap
  const isHarianLoad = dari === sampai;
  try {
    const orderPromise = fetchUserListOrder();
    let pegawai = [], ringkasan = {};
    let rekapOK = false;

    // ── Selalu coba pakai n8n rekap (harian maupun range) ──
    // n8n Hitung Rekap sudah mengurutkan sesuai user_list dan isi semua pegawai
    try {
      // Kirim juga jam batas aktif (periode khusus atau global) + hari libur ke n8n
      const _jamReq = getJamForTanggal(dari);
      const jamMasukParam = _jamReq.masuk;
      const jamPulangParam = _jamReq.pulang;
      // Hitung hari kerja di frontend (sudah punya hariLiburSet) lalu kirim ke n8n
      function _countHK(d1, d2) {
        let c = 0; const dd = new Date(d1 + 'T00:00:00'), ds = new Date(d2 + 'T00:00:00');
        while (dd <= ds) {
          const dy = dd.getDay(), t = dd.toISOString().split('T')[0];
          if (dy !== 0 && dy !== 6 && !hariLiburSet.has(t)) c++;
          dd.setDate(dd.getDate() + 1);
        }
        return c;
      }
      const hariKerjaParam = _countHK(dari, sampai);
      const liburParam = encodeURIComponent(JSON.stringify([...hariLiburSet].filter(t => t >= dari && t <= sampai)));
      const myNip = localStorage.getItem('MY_NIP') || '';
      const adminParam = IS_ADMIN ? '&is_admin=true' : '';
      const nipQuery = IS_ADMIN ? '&format=full' : `&nip=${myNip}`;
      const res = await apiFetch(`${P.rekap}?dari=${dari}&sampai=${sampai}&jam_masuk=${jamMasukParam}&jam_pulang=${jamPulangParam}&hari_kerja=${hariKerjaParam}&libur=${liburParam}${nipQuery}${adminParam}`, { method: 'GET' });
      if (res.ok) {
        const json = await res.json();
        const d = Array.isArray(json) ? json[0] : json;
        if (d?.pegawai?.length) { 
          ringkasan = d.ringkasan || {}; 
          pegawai = d.pegawai; 
          rekapOK = true; 
        }
      }
    } catch (_) { }

    // ── Fallback frontend jika n8n gagal ──
    if (!rekapOK) {
      let allRowsRaw = [], periodRowsRaw = [];
      try {
        const myNip = localStorage.getItem('MY_NIP') || '';
        const adminParam = IS_ADMIN ? '&is_admin=true' : '';
        // Jika admin, minta format full agar filter NIP di n8n diabaikan
        const nipQuery = IS_ADMIN ? '&format=full' : `&nip=${myNip}`;
        const resAll = await apiGet(`${P.log}?dari=${dari}&sampai=${sampai}${nipQuery}${adminParam}`);
        if (resAll.ok) allRowsRaw = (resAll.rows?.length ?? 0) ? resAll.rows : parseApiResponse(resAll.data);
      } catch (_) { }
      periodRowsRaw = allRowsRaw.filter(r => {
        const t = getField(r, 'Tanggal', 'tanggal');
        return t && t >= dari && t <= sampai;
      });
      const _order = await orderPromise;
      const computed = computeRekap(periodRowsRaw, allRowsRaw, _order, dari, sampai);
      pegawai = computed.pegawai;
      ringkasan = computed.ringkasan;
    }

    // ── Untuk mode HARIAN ──
    // Sekarang n8n Hitung Rekap v18+ sudah mengembalikan detail _rawLog yang lengkap 
    // sehingga kita tidak perlu lagi melakukan "enrichment" manual dari Riwayat.

    $('rsMasuk').textContent = ringkasan.masuk ?? 0;
    $('rsPulang').textContent = ringkasan.pulang ?? 0;
    $('rsPulangLuar').textContent = ringkasan.pulang_luar ?? 0;
    $('rsLuar').textContent = ringkasan.luar ?? 0;
    $('rsIzin').textContent = ringkasan.izin ?? 0;
    $('rsSakit').textContent = ringkasan.sakit ?? 0;
    $('rsTugas').textContent = ringkasan.tugas ?? 0;
    if ($('rsTubel')) $('rsTubel').textContent = ringkasan.tubel ?? 0;
    if ($('rsCuti')) $('rsCuti').textContent = ringkasan.cuti ?? 0;
    $('rsAlpa').textContent = ringkasan.alpa ?? 0;

    const order = await orderPromise;
    // Helper to get field case-insensitively
    const gf = (obj, ...keys) => {
      for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
        const uk = k.toUpperCase(), lk = k.toLowerCase();
        if (obj[uk] !== undefined && obj[uk] !== null && obj[uk] !== '') return obj[uk];
        if (obj[lk] !== undefined && obj[lk] !== null && obj[lk] !== '') return obj[lk];
      }
      return '';
    };

    // Enrich jabatan dari user_list jika belum ada
    if (order.length > 0) {
      pegawai = pegawai.map(p => {
        const pId = gf(p, 'id', 'ID', 'telegram_id');
        const pNama = (gf(p, 'nama', 'Nama') || '').toLowerCase().trim();
        const pNip = gf(p, 'nip', 'NIP');

        const match = order.find(u => {
          const uId = gf(u, 'id', 'ID', 'telegram_id');
          const uNama = (gf(u, 'nama', 'Nama') || '').toLowerCase().trim();
          const uNip = gf(u, 'nip', 'NIP');
          if (pId && uId && String(pId) === String(uId)) return true;
          if (pNip && uNip && pNip === uNip) return true;
          if (pNama && uNama) {
            if (pNama === uNama) return true;
            const strip = (s) => s.replace(/,?\s+(s\.?[a-z]*|m\.?[a-z]*|drs|dra|ir|h\.|hj\.)(\s|$)/gi, '').trim();
            if (strip(pNama) === strip(uNama)) return true;
          }
          return false;
        });

        if (match) {
          return {
            ...p,
            nama: (match.nama && match.nama !== '—') ? match.nama : p.nama,
            nip: (match.nip && match.nip !== '—') ? match.nip : p.nip,
            jabatan: (match.jabatan && match.jabatan !== '—') ? match.jabatan : p.jabatan,
            pangkat: (match.pangkat && match.pangkat !== '—') ? match.pangkat : p.pangkat,
            urutan: match.urutan ?? p.urutan
          };
        }
        return p;
      });
    }

    // Sort strictly by hierarchy
    pegawai.sort((a, b) => {
      if (!a || !b) return 0;
      // 1. Urutkan berdasarkan JABATAN (Kepala > Sekretaris > Kabid > dst)
      const jabA = getJabatanScore(a.jabatan);
      const jabB = getJabatanScore(b.jabatan);
      if (jabA !== jabB) return jabB - jabA;

      // 2. Tipe Pegawai (PNS > PPPK) - Khusus untuk Staff (Jabatan < 70)
      if (jabA < 70) {
        const pA = (a.pangkat || '').toUpperCase();
        const pB = (b.pangkat || '').toUpperCase();
        const isPnsA = pA.includes('/') || pA.includes('JURU') || pA.includes('PENGATUR') || pA.includes('PENATA') || pA.includes('PEMBINA');
        const isPnsB = pB.includes('/') || pB.includes('JURU') || pB.includes('PENGATUR') || pB.includes('PENATA') || pB.includes('PEMBINA');
        if (isPnsA !== isPnsB) return isPnsB ? 1 : -1;
      }

      // 3. Urutkan berdasarkan PANGKAT (Tertinggi IV/E -> Terendah I/A)
      const rankA = getPangkatScore(a.pangkat);
      const rankB = getPangkatScore(b.pangkat);
      if (rankA !== rankB) return rankB - rankA;

      // 4. Urutkan berdasarkan NIP (Seniority: Lower NIP first = Older)
      const nipA = getNipScore(a.nip);
      const nipB = getNipScore(b.nip);
      if (nipA !== nipB) return nipA.localeCompare(nipB);

      // 5. Urutkan berdasarkan Nama (A-Z)
      const namaA = (a.nama || '').toLowerCase().trim();
      const namaB = (b.nama || '').toLowerCase().trim();
      return namaA.localeCompare(namaB, 'id');
    });

    window.userListOrder = pegawai; // Save globally for saveLog() reference


    lastRekapPegawai = pegawai;
    rekapLoaded = true;

    renderRekap(pegawai);
  } catch (e) {
    console.warn('loadRekap error:', e);
    $('pegawaiList').innerHTML = `<div class="empty-state"><div class="empty-icon">🔌</div><div class="empty-text">Gagal memuat rekap</div><div class="empty-sub">Pastikan webhook n8n aktif</div></div>`;
  } finally {
    btn.disabled = false;
    if (dlBtn) dlBtn.disabled = false;
    if (pdfBtn) pdfBtn.disabled = false;
    const s = $('rekapRefIcon'); if (s) s.outerHTML = '<span id="rekapRefIcon">🔄</span>';
  }
}

function sortByUserList(pegawai, order) {
  if (!order.length) return [...pegawai].sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'));
  const idMap = {}, namaMap = {}, nipMap = {};
  order.forEach(u => {
    if (u.id) idMap[u.id] = u.urutan;
    if (u.nama) namaMap[u.nama.toLowerCase().trim()] = u.urutan;
    if (u.nip) nipMap[u.nip] = u.urutan;
  });
  return [...pegawai].sort((a, b) => {
    const posA = idMap[String(a.id || '')] ?? namaMap[(a.nama || '').toLowerCase().trim()] ?? nipMap[a.nip || ''] ?? 9999;
    const posB = idMap[String(b.id || '')] ?? namaMap[(b.nama || '').toLowerCase().trim()] ?? nipMap[b.nip || ''] ?? 9999;
    if (posA !== posB) return posA - posB;
    return (a.nama || '').localeCompare(b.nama || '', 'id');
  });
}

/* ════ COMPUTE REKAP (fallback) — v2 dengan all-time accumulation ════ */
/**
 * Hitung rekap absensi per pegawai dari raw log data.
 * Menghitung: total masuk, pulang, izin, sakit, tugas, alpa, terlambat, dll.
 * @param {Object[]} rows - Baris log absensi dari server
 * @param {Object[]|null} allRowsParam - Semua baris untuk akumulasi all-time
 * @param {Object[]|null} userSeed - Daftar pegawai untuk inisialisasi (termasuk yg tidak absen)
 * @param {string|null} dari - Tanggal mulai filter YYYY-MM-DD
 * @param {string|null} sampai - Tanggal akhir filter YYYY-MM-DD
 * @returns {Object[]} Array data rekap per pegawai
 */
function computeRekap(rows, allRowsParam = null, userSeed = null, dari = null, sampai = null) {
  // Jam batas GLOBAL (default)
  const JAM_MASUK_BATAS = JAM_MASUK_MENIT;
  const JAM_PULANG_BATAS = JAM_PULANG_MENIT;
  // Helper: jam batas per pegawai + per tanggal (periode khusus mengalahkan per-pegawai yg mengalahkan global)
  function getMasukBatas(id, tgl) {
    if (tgl) { const p = getJamForTanggal(tgl); if (p.nama) return toMenit(p.masuk) ?? JAM_MASUK_BATAS; }
    return jamPegawaiMap[id]?.masukMenit ?? JAM_MASUK_BATAS;
  }
  function getPulangBatas(id, tgl) {
    if (tgl) { const p = getJamForTanggal(tgl); if (p.nama) return toMenit(p.pulang) ?? JAM_PULANG_BATAS; }
    return jamPegawaiMap[id]?.pulangMenit ?? JAM_PULANG_BATAS;
  }

  function toMenit(jamStr) {
    const s = String(jamStr || '').replace(/\s.*/, '').split(':');
    if (s.length < 2) return null;
    const h = parseInt(s[0]), m = parseInt(s[1]);
    return (isNaN(h) || isNaN(m)) ? null : h * 60 + m;
  }

  // Calculate HK Periode (Working Days)
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

  // Pre-populate dari userSeed agar semua pegawai tampil meski tidak absen
  (userSeed || []).forEach((u, idx) => {
    const id = String(u.id || '').trim();
    if (!id) return;
    map[id] = {
      id,
      nama: u.nama || '—', nip: u.nip || '—', jabatan: u.jabatan || '', urutan: u.urutan ?? idx,
      masuk: 0, pulang: 0, pulang_luar: 0, di_luar_masuk: 0, di_luar_pulang: 0,
      izin: 0, sakit: 0, tugas: 0, tubel: 0, cuti: 0,
      menit_terlambat: 0, menit_lebih_awal: 0,
      jamMasuk: '-', jamPulang: '-',
      _rawMasukLog: null, _rawPulangLog: null,
      all_menit_terlambat: 0, all_menit_lebih_awal: 0,
      all_di_luar_masuk: 0, all_di_luar_pulang: 0, all_masuk: 0,
      all_izin: 0, all_sakit: 0, all_tugas: 0, all_tubel: 0, all_cuti: 0, all_alpa: 0
    };
  });

  // Process periode (filtered rows)
  rows.forEach(r => {
    const id = String(getField(r, 'ID', 'id') || '').trim();
    if (!id) return;
    const nama = getField(r, 'Nama', 'nama') || '—';
    const nip = getField(r, 'NIP', 'nip') || '—';
    const tgl = normToISO(getField(r, 'Tanggal', 'tanggal') || '');
    const jenis = (getField(r, 'Jenis Absen', 'jenis', 'Jenis', 'JenisAbsen', 'jenis_absen') || '').toUpperCase().trim();
    const jamStr = getField(r, 'Jam', 'jam') || '';
    const id_log = r.ID_Log || r.id_log || r.id || ''; // Capture the primary key
    if (!map[id]) map[id] = {
      id, nama, nip, jabatan: '', urutan: 9999,
      masuk: 0, pulang: 0, pulang_luar: 0, di_luar_masuk: 0, di_luar_pulang: 0,
      izin: 0, sakit: 0, tugas: 0, tubel: 0, cuti: 0,
      menit_terlambat: 0, menit_lebih_awal: 0,
      jamMasuk: '-', jamPulang: '-',
      _rawMasukLog: null, _rawPulangLog: null,
      all_menit_terlambat: 0, all_menit_lebih_awal: 0,
      all_di_luar_masuk: 0, all_di_luar_pulang: 0, all_masuk: 0,
      all_izin: 0, all_sakit: 0, all_tugas: 0, all_tubel: 0, all_cuti: 0, all_alpa: 0
    };
    const curNama = getField(r, 'Nama', 'nama') || '';
    if (curNama.length > map[id].nama.length) map[id].nama = curNama;
    if (nip && map[id].nip === '—') map[id].nip = nip;
    const jam = toMenit(jamStr);
    if (jenis === 'MASUK') {
      map[id].masuk++;
      if (jamStr) {
        map[id].jamMasuk = jamStr.replace(/\s*WITA\s*/i, '').trim();
        map[id]._rawMasukLog = { ...r, ID_Log: id_log }; // Store row with PK
      }
    }
    else if (jenis.includes('LUAR') && (jenis.includes('MASUK') || !jenis.includes('PULANG'))) {
      map[id].di_luar_masuk++;
      if (jamStr) {
        map[id].jamMasuk = jamStr.replace(/\s*WITA\s*/i, '').trim();
        map[id]._rawMasukLog = { ...r, ID_Log: id_log };
      }
      if (jam !== null && jam > getMasukBatas(id, tgl)) map[id].menit_terlambat += (jam - getMasukBatas(id, tgl));
    }
    else if (jenis === 'PULANG') {
      map[id].pulang++;
      if (jamStr) {
        map[id].jamPulang = jamStr.replace(/\s*WITA\s*/i, '').trim();
        map[id]._rawPulangLog = { ...r, ID_Log: id_log };
      }
    }
    else if (jenis.includes('LUAR') && jenis.includes('PULANG')) {
      map[id].di_luar_pulang++;
      if (jamStr) {
        map[id].jamPulang = jamStr.replace(/\s*WITA\s*/i, '').trim();
        map[id]._rawPulangLog = { ...r, ID_Log: id_log };
      }
      if (jam !== null && jam < getPulangBatas(id, tgl)) map[id].menit_lebih_awal += (getPulangBatas(id, tgl) - jam);
    }
    else if (jenis === 'PULANG LUAR') {
      map[id].pulang_luar++;
      if (jamStr) {
        map[id].jamPulang = jamStr.replace(/\s*WITA\s*/i, '').trim();
        map[id]._rawPulangLog = { ...r, ID_Log: id_log };
      }
    }
    else if (jenis.includes('LUAR')) { map[id].di_luar_masuk++; }
    else if (jenis === 'IZIN') { map[id].izin++; map[id]._rawKetLog = { ...r, ID_Log: id_log }; }
    else if (jenis === 'SAKIT') { map[id].sakit++; map[id]._rawKetLog = { ...r, ID_Log: id_log }; }
    else if (jenis === 'TUGAS') { map[id].tugas++; map[id]._rawKetLog = { ...r, ID_Log: id_log }; }
    else if (jenis === 'TUBEL') { map[id].tubel++; map[id]._rawKetLog = { ...r, ID_Log: id_log }; }
    else if (jenis === 'CUTI') { map[id].cuti++; map[id]._rawKetLog = { ...r, ID_Log: id_log }; }
  });

  // Process ALL-TIME rows (if provided)
  const allRows = allRowsParam || rows; // fallback to same rows if no allRows
  allRows.forEach(r => {
    const id = String(getField(r, 'ID', 'id') || '').trim();
    if (!id || !map[id]) return; // only process existing employees
    const tglA = normToISO(getField(r, 'Tanggal', 'tanggal') || '');
    const jenis = (getField(r, 'Jenis Absen', 'jenis', 'Jenis', 'JenisAbsen', 'jenis_absen') || '').toUpperCase().trim();
    const jamStr = getField(r, 'Jam', 'jam') || '';
    const jam = toMenit(jamStr);
    if (jenis === 'MASUK') { map[id].all_masuk++; }
    else if (jenis.includes('LUAR') && (jenis.includes('MASUK') || !jenis.includes('PULANG'))) {
      map[id].all_di_luar_masuk++;
      if (jam !== null && jam > getMasukBatas(id, tglA)) map[id].all_menit_terlambat += (jam - getMasukBatas(id, tglA));
    }
    else if (jenis.includes('LUAR') && jenis.includes('PULANG')) {
      map[id].all_di_luar_pulang++;
      if (jam !== null && jam < getPulangBatas(id, tglA)) map[id].all_menit_lebih_awal += (getPulangBatas(id, tglA) - jam);
    }
    else if (jenis === 'IZIN') { map[id].all_izin++; }
    else if (jenis === 'SAKIT') { map[id].all_sakit++; }
    else if (jenis === 'TUGAS') { map[id].all_tugas++; }
    else if (jenis === 'TUBEL') { map[id].all_tubel++; }
    else if (jenis === 'CUTI') { map[id].all_cuti++; }
    else if (jenis === 'TANPA BERITA') { map[id].all_alpa++; }
  });

  // Special handling: Calculate "Periode Alpa" counts for each employee
  // if not provided by n8n.
  if (rows.length > 0 && rangeDates.length > 0) {
    // Check presence per employee per date
    const rowSet = new Set(rows.map(r => String(getField(r, 'ID', 'id')) + '|' + normToISO(getField(r, 'Tanggal', 'tanggal'))));
    Object.keys(map).forEach(uid => {
      let c = 0;
      rangeDates.forEach(tgl => { if (!rowSet.has(uid + '|' + tgl)) c++; });
      map[uid].alpa = c; // count for this period
    });
  }

  const pegawai = Object.values(map).map(p => {
    // Discipline calculation
    const totalEntries = p.masuk + p.di_luar_masuk;
    const disiplinPct = totalEntries > 0 ? Math.round((p.masuk / totalEntries) * 100) : null;
    let disiplinLabel = '', disiplinLevel = 0;
    if (disiplinPct !== null) {
      if (disiplinPct >= 95) { disiplinLabel = 'Sangat Disiplin'; disiplinLevel = 4; }
      else if (disiplinPct >= 80) { disiplinLabel = 'Disiplin'; disiplinLevel = 3; }
      else if (disiplinPct >= 60) { disiplinLabel = 'Cukup'; disiplinLevel = 2; }
      else { disiplinLabel = 'Kurang'; disiplinLevel = 1; }
    }
    // All-time discipline
    const totalAll = p.all_masuk + p.all_di_luar_masuk;
    const disiplinAllPct = totalAll > 0 ? Math.round((p.all_masuk / totalAll) * 100) : null;
    return {
      ...p,
      lambat: p.di_luar_masuk,
      pulangCepat: p.di_luar_pulang,
      pulang_luar: p.pulang_luar || 0,
      luar: p.di_luar_masuk + p.di_luar_pulang,
      // Period HH:MM
      akkLambatHHMM: toHHMM(p.menit_terlambat),
      akkCepatHHMM: toHHMM(p.menit_lebih_awal),
      akkAlpaHHMM: toHHMM((p.alpa || 0) * 450),
      totalAkkHHMM: toHHMM(p.menit_terlambat + p.menit_lebih_awal + ((p.alpa || 0) * 450)),
      totalAkkMenit: p.menit_terlambat + p.menit_lebih_awal + ((p.alpa || 0) * 450),
      // Estimated jamHadir for fallback (Work hours minus penalties)
      jamHadir: Math.max(0, ((HK_PERIODE * 450) - (p.menit_terlambat + p.menit_lebih_awal + ((p.alpa || 0) * 450))) / 60),
      // Discipline period
      disiplinPct, disiplinLabel, disiplinLevel,
      // All-time HH:MM
      totalLambatAllHHMM: toHHMM(p.all_menit_terlambat),
      totalCepatAllHHMM: toHHMM(p.all_menit_lebih_awal),
      totalAlpaAllHHMM: toHHMM((p.all_alpa || 0) * 450),
      totalAkkAllHHMM: toHHMM(p.all_menit_terlambat + p.all_menit_lebih_awal + ((p.all_alpa || 0) * 450)),
      totalAkkAllMenit: p.all_menit_terlambat + p.all_menit_lebih_awal + ((p.all_alpa || 0) * 450),
      disiplinAllPct,
      // Legacy
      akumulasi_terlambat: p.menit_terlambat > 0 ? toHHMM(p.menit_terlambat) + ' terlambat' : '',
      akumulasi_lebih_awal: p.menit_lebih_awal > 0 ? toHHMM(p.menit_lebih_awal) + ' lebih awal' : ''
    };
  });
  const sum = k => pegawai.reduce((s, p) => s + (p[k] || 0), 0);
  return {
    pegawai,
    ringkasan: {
      masuk: sum('masuk'),
      pulang: sum('pulang'),
      pulang_luar: sum('pulang_luar'),
      luar: sum('di_luar_masuk') + sum('di_luar_pulang'),
      izin: sum('izin'),
      sakit: sum('sakit'),
      tugas: sum('tugas'),
      tubel: sum('tubel'),
      cuti: sum('cuti')
    }
  };
}

function resetRekapStats() { ['rsMasuk', 'rsPulang', 'rsPulangLuar', 'rsLuar', 'rsIzin', 'rsSakit', 'rsTugas', 'rsAlpa'].forEach(id => { const el = $(id); if (el) el.textContent = '—'; }); }

/* ════ RENDER REKAP — dengan discipline, HH:MM badge, all-time accumulation ════ */
/**
 * Render tabel rekap absensi ke DOM.
 * @param {Object[]} pg - Array data rekap dari computeRekap()
 */
function renderRekap(pg) {
  const el = $('pegawaiList');
  if (!pg?.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">Belum ada data pegawai</div><div class="empty-sub">Coba pilih rentang tanggal lain</div></div>`;
    return;
  }

  const _dari = $('rekapDari')?.value || '';
  const _sampai = $('rekapSampai')?.value || '';
  const isHarian = _dari && _sampai && _dari === _sampai;

  // ── Client-side filtering by Bidang ──
  const filterBidang = $('rekapBidang')?.value || 'Semua';
  let filteredPg = pg;
  if (filterBidang !== 'Semua') {
    filteredPg = pg.filter(p => (p.bidang || p.Bidang || '') === filterBidang);
  }

  if (!filteredPg.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">Tidak ada pegawai di bidang ini</div><div class="empty-sub">Coba pilih bidang lain atau tampilkan semua</div></div>`;
    return;
  }

  // ── Hitung hari kerja periode (senin-jumat, kurangi libur) ──
  function countHKRekap(dari, sampai) {
    let count = 0;
    const d = new Date(dari + 'T00:00:00'), s = new Date(sampai + 'T00:00:00');
    while (d <= s) {
      const day = d.getDay(), tgl = d.toISOString().split('T')[0];
      if (day !== 0 && day !== 6 && !hariLiburSet.has(tgl)) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  }
  const hariKerjaPeriode = (_dari && _sampai && !isHarian) ? countHKRekap(_dari, _sampai) : 1;

  // Format tanggal harian untuk header
  let tanggalLabel = '';
  if (isHarian && _dari) {
    const d = new Date(_dari + 'T00:00:00');
    tanggalLabel = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  el.innerHTML = filteredPg.map((p, idx) => {
    const nama = p.nama || '—';
    const nip = p.nip || '—';
    const jabatan = p.jabatan || '';
    const masuk = p.masuk || 0;
    const pulang = p.pulang || 0;
    const pulangLuar = p.pulang_luar || 0;
    const luarMasuk = p.di_luar_masuk ?? 0; // Minutes
    const luarPulang = p.di_luar_pulang ?? 0; // Minutes
    const lambatCount = p.lambat_count ?? 0; // Count from server
    const cepatCount = p.pulang_cepat_count ?? 0; // Count from server
    const izin = p.izin || 0;
    const sakit = p.sakit || 0;
    const tugas = p.tugas || 0;
    const tubel = p.tubel || 0;
    const cuti = p.cuti || 0;

    const jabatanStr = jabatan
      ? `<div style="font-size:9px;color:var(--gold);margin-top:1px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${jabatan}</div>`
      : '';

    /* ─────────────────────────────────────────
       TAMPILAN HARIAN — CARD JAM PER PEGAWAI
       ───────────────────────────────────────── */
    if (isHarian) {
      // Ambil jam dari data
      const rawMasuk = ((p.jamMasuk || '').replace(/\s*WITA\s*/i, '').trim()).replace(/^-+$/, '').replace(/Alpa|Alpha|Tanpa Berita/i, '') || null;
      const rawPulang = ((p.jamPulang || '').replace(/\s*WITA\s*/i, '').trim()).replace(/^-+$/, '') || null;

      // Helper menit
      const toMenitLocal = s => {
        if (!s || s === '-') return null;
        const parts = s.split(':').map(Number);
        return isNaN(parts[0]) ? null : parts[0] * 60 + (parts[1] || 0);
      };
      const pgwId = String(p.id || '');
      const jpgw = jamPegawaiMap[pgwId];
      // Prioritas: 1) Periode khusus di tanggal tsb → 2) Jam per-pegawai → 3) Global
      const _jamHarian = getJamForTanggal(_dari);
      const jmBatas = _jamHarian.nama ? _jamHarian.masuk : (jpgw?.masuk || menitToStr(JAM_MASUK_MENIT));
      const jpBatas = _jamHarian.nama ? _jamHarian.pulang : (jpgw?.pulang || menitToStr(JAM_PULANG_MENIT));
      const periodeHarianNama = _jamHarian.nama;
      const mMasukBatas = toMenitLocal(jmBatas);
      const mPulangBatas = toMenitLocal(jpBatas);
      const mMasuk = toMenitLocal(rawMasuk);
      const mPulang = toMenitLocal(rawPulang);

      // Status masuk
      const terlambatMnt = (mMasuk !== null && mMasukBatas !== null && mMasuk > mMasukBatas)
        ? mMasuk - mMasukBatas : 0;
      const cepatMnt = (mPulang !== null && mPulangBatas !== null && mPulang < mPulangBatas)
        ? mPulangBatas - mPulang : 0;

      // Label & warna jam masuk
      let masukLabel = '', masukColor = '', masukBg = '', masukIcon = '';
      if (izin > 0) { masukLabel = 'Izin'; masukColor = 'var(--warning)'; masukBg = 'rgba(245,158,11,.12)'; masukIcon = '🙏'; }
      else if (sakit > 0) { masukLabel = 'Sakit'; masukColor = 'var(--danger)'; masukBg = 'rgba(239,68,68,.12)'; masukIcon = '🤒'; }
      else if (tugas > 0) { masukLabel = 'Tugas'; masukColor = '#8b5cf6'; masukBg = 'rgba(139,92,246,.12)'; masukIcon = '💼'; }
      else if (p.tubel > 0) { masukLabel = 'Tubel'; masukColor = '#6366f1'; masukBg = 'rgba(99,102,241,.12)'; masukIcon = '🎓'; }
      else if (p.cuti > 0) { masukLabel = 'Cuti'; masukColor = '#14b8a6'; masukBg = 'rgba(20,184,166,.12)'; masukIcon = '🏖️'; }
      else if (!rawMasuk) { masukLabel = 'TB'; masukColor = 'var(--muted)'; masukBg = 'rgba(255,255,255,.04)'; masukIcon = '❌'; }
      else if (terlambatMnt > 0) { masukLabel = `Terlambat ${terlambatMnt}m`; masukColor = 'var(--warning)'; masukBg = 'rgba(245,158,11,.08)'; masukIcon = '⏰'; }
      else { masukLabel = 'Tepat Waktu'; masukColor = 'var(--success)'; masukBg = 'rgba(34,197,94,.08)'; masukIcon = '✅'; }

      // Label & warna jam pulang
      let pulangLabel = '', pulangColor = '', pulangIcon = '';
      if (izin > 0 || sakit > 0 || tugas > 0 || p.tubel > 0 || p.cuti > 0) { pulangLabel = '—'; pulangColor = 'var(--muted)'; pulangIcon = '—'; }
      else if (!rawPulang && !rawMasuk) { pulangLabel = 'Belum'; pulangColor = 'var(--muted)'; pulangIcon = '⏳'; }
      else if (!rawPulang) { pulangLabel = 'Belum Absen'; pulangColor = 'var(--warning)'; pulangIcon = '⏳'; }
      else if (cepatMnt > 0) { pulangLabel = `Cepat ${cepatMnt}m`; pulangColor = '#f97316'; pulangIcon = '🏃'; }
      else if (pulangLuar > 0) { pulangLabel = 'Lapangan'; pulangColor = '#f59e0b'; pulangIcon = '🏃'; }
      else { pulangLabel = 'Tepat'; pulangColor = 'var(--info)'; pulangIcon = '🔵'; }

      // Kehadiran overall status untuk warna border card
      const isHadir = (masuk + lambatCount) > 0 || !!p._rawMasukLog || !!p._rawPulangLog;
      const isKet = izin > 0 || sakit > 0 || tugas > 0 || p.tubel > 0 || p.cuti > 0;
      const isAlpa = !isHadir && !isKet;
      const cardBorderColor = isKet ? (p.tubel > 0 ? 'rgba(99,102,241,.25)' : p.cuti > 0 ? 'rgba(20,184,166,.25)' : 'rgba(139,92,246,.25)')
        : isAlpa ? 'rgba(239,68,68,.2)'
          : terlambatMnt > 0 || cepatMnt > 0 ? 'rgba(245,158,11,.3)'
            : 'rgba(34,197,94,.2)';
      const cardTopColor = isKet ? '#8b5cf6'
        : isAlpa ? 'var(--danger)'
          : terlambatMnt > 0 || cepatMnt > 0 ? 'var(--warning)'
            : 'var(--success)';

      // Serialize pins for map initialization
      const parsePin = (log, label, color) => {
        if(!log) return null;
        let lat = parseFloat(log.latitude || log.Latitude || log.lat || '');
        let lng = parseFloat(log.longitude || log.Longitude || log.lng || '');
        const koor = log.koordinat || log.Koordinat || '';
        if (koor && koor !== '-') {
          const parts = koor.split(',');
          if (parts.length >= 2) { lat = parseFloat(parts[0]); lng = parseFloat(parts[1]); }
        }
        if(!lat || !lng) return null;
        return { lat, lng, label, color };
      };
      const pinsData = [parsePin(p._rawMasukLog, 'M', '#10b981'), parsePin(p._rawPulangLog, 'P', '#3b82f6')].filter(Boolean);

      return `
      <div class="pegawai-card" style="border-color:${cardBorderColor};position:relative;overflow:hidden;padding-bottom:10px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); cursor:pointer;" 
           onclick="if(window.toggleRekapMap) window.toggleRekapMap(this, ${JSON.stringify(pinsData).replace(/"/g, '&quot;')}); else { const d=this.querySelector('.lokasi-detail'); if(d) d.style.display = d.style.display==='none'?'block':'none'; }">
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${cardTopColor}"></div>

        <!-- Header pegawai -->
        <div class="pegawai-top" style="margin-bottom:10px">
          <div class="pegawai-avatar" style="background:linear-gradient(135deg,${cardTopColor},${isAlpa ? '#7f1d1d' : isKet ? '#4c1d95' : '#065f46'});font-size:11px">${idx + 1}</div>
          <div style="flex:1;min-width:0">
            <div class="pegawai-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nama}</div>
            ${jabatanStr}
            <div class="pegawai-jabatan" style="margin-top:2px">NIP: ${nip} · ${p.pangkat || '—'} · ⏳ ${parseFloat(p.jamHadir || 0).toFixed(1)} Jam</div>
            ${periodeHarianNama ? `<div style="font-size:8px;font-weight:700;color:#a78bfa;margin-top:2px">🌙 ${periodeHarianNama}</div>` : ''}
          </div>
          <!-- Badge status utama -->
          <div style="flex-shrink:0;text-align:right">
            <div style="font-size:16px">${masukIcon}</div>
            <div style="font-size:9px;font-weight:700;color:${masukColor};margin-top:2px;white-space:nowrap">${masukLabel}</div>
          </div>
        </div>

        <!-- ── CARD JAM MASUK / PULANG ── -->
        ${isKet ? `
          <div style="background:${masukBg}; border:1px solid ${masukColor}33; border-radius:10px; padding:10px 12px; position:relative; overflow:hidden; margin-bottom:8px;">
            ${IS_ADMIN && p._rawKetLog ? `
              <button onclick="event.stopPropagation(); openLogEditor('${p.id}', '${_dari}', ${JSON.stringify(p._rawKetLog).replace(/"/g, '&quot;')})" 
                      style="position:absolute; top:0; right:0; bottom:0; width:30px; background:rgba(255,255,255,0.05); border:none; border-left:1px solid ${masukColor}22; color:${masukColor}; cursor:pointer; font-size:11px; display:flex; align-items:center; justify-content:center; transition: all 0.2s;"
                      onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'"
                      title="Edit Log Keterangan">✏️</button>
            ` : ''}
            <div style="display:flex;align-items:center;gap:10px">
              <div style="font-size:32px;line-height:1">${masukIcon}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:14px;font-weight:800;color:${masukColor}">${masukLabel}</div>
                <div style="font-size:10px;color:var(--muted);margin-top:2px;line-height:1.4;white-space:pre-wrap;">${(p._rawKetLog?.Ket || p._rawKetLog?.ket || 'Keterangan').trim()}</div>
              </div>
            </div>
          </div>
        ` : `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">

          <!-- JAM MASUK -->
          <div style="background:${masukBg}; border:1px solid ${masukColor}33; border-radius:10px; padding:10px 12px; position:relative; overflow:hidden;">
            ${IS_ADMIN ? (p._rawMasukLog || p._rawKetLog ? `
              <button onclick="event.stopPropagation(); openLogEditor('${p.id}', '${_dari}', ${JSON.stringify(p._rawMasukLog || p._rawKetLog).replace(/"/g, '&quot;')})" 
                      style="position:absolute; top:0; right:0; bottom:0; width:30px; background:rgba(255,255,255,0.05); border:none; border-left:1px solid ${masukColor}22; color:${masukColor}; cursor:pointer; font-size:11px; display:flex; align-items:center; justify-content:center; transition: all 0.2s;"
                      onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'"
                      title="Edit Log Masuk">✏️</button>
            ` : `
              <button onclick="event.stopPropagation(); openLogEditor('${p.id}', '${_dari}', null, 'MASUK')" 
                      style="position:absolute; top:0; right:0; bottom:0; width:30px; background:rgba(255,255,255,0.05); border:none; border-left:1px solid ${masukColor}22; color:var(--muted); cursor:pointer; font-size:11px; display:flex; align-items:center; justify-content:center; transition: all 0.2s;"
                      onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'"
                      title="Tambah Log Manual">➕</button>
            `) : ''}
            <div style="font-size:8px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">🟢 Jam Masuk</div>
            ${rawMasuk
            ? `<div style="font-size:20px;font-family:'JetBrains Mono',monospace;font-weight:800;color:${masukColor};line-height:1">${rawMasuk.slice(0, 5)}</div>
                   <div style="font-size:9px;color:${masukColor};font-weight:700;margin-top:3px">${masukLabel}</div>`
            : `<div style="font-size:20px;font-family:'JetBrains Mono',monospace;font-weight:800;color:var(--muted);line-height:1">—:—</div>
                   <div style="font-size:9px;color:var(--muted);font-weight:700;margin-top:3px">${masukLabel}</div>`
        }
            <div style="font-size:8px;color:var(--muted);margin-top:3px;opacity:.7">Batas ≤ ${jmBatas}</div>
          </div>

          <!-- JAM PULANG -->
          <div style="background:${isKet ? masukBg : 'rgba(96,165,250,.07)'}; border:1px solid ${isKet ? masukColor + '33' : 'rgba(96,165,250,.2)'}; border-radius:10px; padding:10px 12px; position:relative; overflow:hidden;">
            ${IS_ADMIN ? (p._rawPulangLog || p._rawKetLog ? `
              <button onclick="event.stopPropagation(); openLogEditor('${p.id}', '${_dari}', ${JSON.stringify(p._rawPulangLog || p._rawKetLog).replace(/"/g, '&quot;')})" 
                      style="position:absolute; top:0; right:0; bottom:0; width:30px; background:rgba(255,255,255,0.05); border:none; border-left:1px solid ${pulangColor}22; color:${pulangColor}; cursor:pointer; font-size:11px; display:flex; align-items:center; justify-content:center; transition: all 0.2s;"
                      onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'"
                      title="Edit Log Pulang">✏️</button>
            ` : `
              <button onclick="event.stopPropagation(); openLogEditor('${p.id}', '${_dari}', null, 'PULANG')" 
                      style="position:absolute; top:0; right:0; bottom:0; width:30px; background:rgba(255,255,255,0.05); border:none; border-left:1px solid ${pulangColor}22; color:var(--muted); cursor:pointer; font-size:11px; display:flex; align-items:center; justify-content:center; transition: all 0.2s;"
                      onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'"
                      title="Tambah Log Manual">➕</button>
            `) : ''}
            <div style="font-size:8px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">🔵 Jam Pulang</div>
            ${rawPulang
            ? `<div style="font-size:20px;font-family:'JetBrains Mono',monospace;font-weight:800;color:${pulangColor};line-height:1">${rawPulang.slice(0, 5)}</div>
                   <div style="font-size:9px;color:${pulangColor};font-weight:700;margin-top:3px">${pulangIcon} ${pulangLabel}</div>`
            : `<div style="font-size:20px;font-family:'JetBrains Mono',monospace;font-weight:800;color:var(--muted);line-height:1">—:—</div>
                   <div style="font-size:9px;color:${pulangColor};font-weight:700;margin-top:3px">${pulangIcon} ${pulangLabel}</div>`
        }
            <div style="font-size:8px;color:var(--muted);margin-top:3px;opacity:.7">Batas ≥ ${jpBatas}</div>
          </div>
        </div>
        `}

        <!-- ── BADGE STATUS BAWAH ── -->
        <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
          ${(function () {
          const mT = p.menit_terlambat ?? p.all_menit_terlambat ?? 0;
          const mC = p.menit_lebih_awal ?? p.all_menit_lebih_awal ?? 0;
          const mAll = mT + mC;
          if (mAll === 0) return '';
          const h = Math.floor(mAll / 60), m = mAll % 60;
          const fmt = h > 0 ? `${h}j ${m}m` : `${m}m`;
          return `<span class="pbar-item" style="background:rgba(245,158,11,.15);color:var(--warning);font-weight:800">⚠️ Akumulasi Jam: ${fmt}</span>`;
        })()}
          ${masuk > 0 ? `<span class="pbar-item pb-masuk"     >✅ Masuk</span>` : ''}
          ${lambatCount > 0 ? `<span class="pbar-item pb-luar-masuk">⏰ Terlambat: ${lambatCount}×</span>` : ''}
          ${pulang > 0 ? `<span class="pbar-item pb-pulang"    >🔵 Pulang</span>` : ''}
          ${cepatCount > 0 ? `<span class="pbar-item pb-luar-pulang">🏃 Pulang Cepat: ${cepatCount}×</span>` : ''}
          ${pulangLuar > 0 ? `<span class="pbar-item" style="background:rgba(245,158,11,.15);color:#f59e0b">🏃 Lapangan</span>` : ''}
          ${izin > 0 ? `<span class="pbar-item pb-izin"      >🙏 Izin</span>` : ''}
          ${sakit > 0 ? `<span class="pbar-item pb-sakit"     >🤒 Sakit</span>` : ''}
          ${tugas > 0 ? `<span class="pbar-item pb-tugas"     >💼 Tugas/DL</span>` : ''}
          ${p.tubel > 0 ? `<span class="pbar-item pb-tubel"     >🎓 Tubel</span>` : ''}
          ${p.cuti > 0 ? `<span class="pbar-item pb-cuti"      >🏖️ Cuti</span>` : ''}
          ${isAlpa ? `<span class="pbar-item" style="background:rgba(239,68,68,.15);color:var(--danger)">❌ TB</span>` : ''}
          ${terlambatMnt > 0 ? `<span class="pbar-item pb-total-akk" style="font-family:'JetBrains Mono',monospace">⏱ +${terlambatMnt}m</span>` : ''}
          ${cepatMnt > 0 ? `<span class="pbar-item pb-luar-pulang" style="font-family:'JetBrains Mono',monospace">🏃 -${cepatMnt}m</span>` : ''}
        </div>

        <!-- ── LOKASI DETAIL ── -->
        <div class="lokasi-detail" onclick="event.stopPropagation()" style="display:none; margin-top:10px; padding-top:10px; border-top:1px dashed rgba(255,255,255,0.1); font-size:10px; color:var(--muted); text-align:left; line-height:1.4;">
          ${(function() {
            const parseLog = (log) => {
              if(!log) return null;
              let lat = parseFloat(log.latitude || log.Latitude || log.lat || '');
              let lng = parseFloat(log.longitude || log.Longitude || log.lng || '');
              const koor = log.koordinat || log.Koordinat || '';
              if (koor && koor !== '-') {
                const parts = koor.split(',');
                if (parts.length >= 2) { lat = parseFloat(parts[0]); lng = parseFloat(parts[1]); }
              }
              const loc = log.Lokasi || log.lokasi || '';
              return { lat, lng, loc, raw: log };
            };
            const m = parseLog(p._rawMasukLog);
            const pu = parseLog(p._rawPulangLog);
            const k = parseLog(p._rawKetLog);
            
            let html = '';
            const renderLocText = (title, color, loc) => {
               if(!loc) return '';
               return `<div style="margin-bottom:8px;padding:8px 10px;background:rgba(255,255,255,.04);border-radius:8px;"><strong style="color:${color}">${title}:</strong> <span style="color:rgba(255,255,255,.75)">${loc}</span></div>`;
            };

            const pins = [];
            if (m && m.lat && m.lng) {
              pins.push({ lat: m.lat, lng: m.lng, color: '#10b981', label: 'M' });
              html += `<div style="margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;"><div style="color:var(--success);font-weight:700;font-size:11px;">🟢 Masuk</div><a href="https://www.google.com/maps?q=${m.lat},${m.lng}" target="_blank" onclick="event.stopPropagation()" style="font-size:8px;font-weight:700;color:#60a5fa;background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.25);border-radius:5px;padding:3px 8px;text-decoration:none;">🗺 Buka Map ↗</a></div>`;
              if(m.loc) html += `<div style="font-size:9px;opacity:0.75;margin-bottom:8px;">📍 ${m.loc}</div>`;
            } else if (m) {
              html += renderLocText('🟢 Masuk', 'var(--success)', m.loc);
            }

            if (pu && pu.lat && pu.lng) {
              pins.push({ lat: pu.lat, lng: pu.lng, color: '#3b82f6', label: 'P' });
              html += `<div style="margin-bottom:4px;margin-top:10px;display:flex;justify-content:space-between;align-items:center;"><div style="color:var(--info);font-weight:700;font-size:11px;">🔵 Pulang</div><a href="https://www.google.com/maps?q=${pu.lat},${pu.lng}" target="_blank" onclick="event.stopPropagation()" style="font-size:8px;font-weight:700;color:#60a5fa;background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.25);border-radius:5px;padding:3px 8px;text-decoration:none;">🗺 Buka Map ↗</a></div>`;
              if(pu.loc) html += `<div style="font-size:9px;opacity:0.75;margin-bottom:8px;">📍 ${pu.loc}</div>`;
            } else if (pu) {
              html += renderLocText('🔵 Pulang', 'var(--info)', pu.loc);
            }

            if (k) {
               html += renderLocText('📝 Ket', masukColor, k.loc);
            }

            if (pins.length > 0) {
              let linkUrl = pins.length === 2 
                ? `https://www.google.com/maps/dir/${pins[0].lat},${pins[0].lng}/${pins[1].lat},${pins[1].lng}` 
                : `https://www.google.com/maps?q=${pins[0].lat},${pins[0].lng}`;

              html += `
                <div style="margin-top:12px;display:flex;justify-content:center;">
                  <a href="${linkUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="font-size:9px;font-weight:700;color:#f59e0b;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);border-radius:5px;padding:4px 10px;text-decoration:none;">
                    📍 Buka Rute di Google Maps
                  </a>
                </div>
                <div class="rekap-map-container" style="width:100%;height:160px;border-radius:10px;margin-top:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.2);"></div>
              `;
            }

            if(!html) return `<div style="text-align:center;font-style:italic;opacity:0.6;padding:10px 0;">Tidak ada info lokasi GPS</div>`;
            return html;
          })()}
        </div>

        ${(function () {
          const mT = p.menit_terlambat ?? p.all_menit_terlambat ?? 0;
          const mC = p.menit_lebih_awal ?? p.all_menit_lebih_awal ?? 0;
          const mAllTotal_Local = mT + mC;

          const aLambat = toHHMM(mT);
          const aCepat = toHHMM(mC);
          const aTotal = toHHMM(mAllTotal_Local);

          if (mAllTotal_Local === 0 && (!p.all_izin && !p.all_sakit && !p.all_tugas && !p.all_alpa)) return '';
          return '<div class="akk-all-row" style="margin-top:8px">'
            + '<span class="akk-all-label">📈 Akumulasi Keseluruhan (All-Time)</span>'
            + (mT > 0 ? '<span class="akk-badge akk-lambat">⏰ Lambat: ' + aLambat + '</span>' : '')
            + (mC > 0 ? '<span class="akk-badge akk-cepat">🏃 Cepat: ' + aCepat + '</span>' : '')
            + (p.all_alpa > 0 ? '<span class="akk-badge" style="background:rgba(239,68,68,.12);color:var(--danger)">❌ TB: ' + toHHMM(p.all_alpa * 450) + '</span>' : '')
            + (mAllTotal_Local > 0 ? '<span class="akk-badge akk-total">Σ Total: ' + aTotal + '</span>' : '')
            + (p.all_izin > 0 ? '<span class="akk-badge" style="background:rgba(245,158,11,.1);color:var(--warning)">🙏 ' + p.all_izin + '×</span>' : '')
            + (p.all_sakit > 0 ? '<span class="akk-badge" style="background:rgba(239,68,68,.1);color:var(--danger)">🤒 ' + p.all_sakit + '×</span>' : '')
            + (p.all_tugas > 0 ? '<span class="akk-badge" style="background:rgba(139,92,246,.1);color:#a78bfa">💼 ' + p.all_tugas + '×</span>' : '')
            + (p.all_tubel > 0 ? '<span class="akk-badge" style="background:rgba(99,102,241,.1);color:#818cf8">🎓 ' + p.all_tubel + '×</span>' : '')
            + (p.all_cuti > 0 ? '<span class="akk-badge" style="background:rgba(20,184,166,.1);color:#2dd4bf">🏖️ ' + p.all_cuti + '×</span>' : '')
            + (p.all_alpa > 0 ? '<span class="akk-badge" style="background:rgba(239,68,68,.1);color:var(--danger)">❌ TB All: ' + p.all_alpa + '×</span>' : '')
            + '</div>';
        })()}
      </div>`;
    }

    /* ─────────────────────────────────────────
       TAMPILAN RANGE — KARTU PREMIUM (V2)
       ───────────────────────────────────────── */
    // ── Akumulasi Waktu (All-Time) ──
    const mT = p.menit_terlambat ?? p.all_menit_terlambat ?? 0;
    const mC = p.menit_lebih_awal ?? p.all_menit_lebih_awal ?? 0;
    const mAllTotal = mT + mC;

    const akkTotalWaktuFmt = (function () {
      const h = Math.floor(mAllTotal / 60), m = mAllTotal % 60;
      return h > 0 ? `${h}j ${m}m` : `${m}m`;
    })();

    // ── Kedisiplinan masuk ──
    const dPct = p.disiplinPct ?? 0;
    let dLabel = p.disiplinLabel;
    let dLevel = p.disiplinLevel;

    if (dLevel === undefined || dLevel === null) {
      if (dPct >= 95) { dLabel = 'Sangat Disiplin'; dLevel = 4; }
      else if (dPct >= 80) { dLabel = 'Disiplin'; dLevel = 3; }
      else if (dPct >= 60) { dLabel = 'Cukup'; dLevel = 2; }
      else { dLabel = 'Kurang'; dLevel = 1; }
    }

    const dAllPct = p.disiplinAllPct ?? null;
    const dIcon = dLevel === 4 ? '🌟' : dLevel === 3 ? '👍' : dLevel === 2 ? '⚠️' : '🔴';
    const dColor = dLevel === 4 ? 'var(--success)' : dLevel === 3 ? 'var(--info)' : dLevel === 2 ? 'var(--warning)' : 'var(--danger)';

    // ── Kehadiran vs hari kerja ──
    const hariHadir = (p.masuk || 0) + (lambatCount || 0) + (p.izin || 0) + (p.sakit || 0) + (p.tugas || 0) + (p.tubel || 0) + (p.cuti || 0);
    const hadirPct = hariKerjaPeriode > 0 ? Math.min(100, Math.round(hariHadir / hariKerjaPeriode * 100)) : 0;
    const hadirColor = hadirPct >= 90 ? 'var(--success)' : hadirPct >= 75 ? 'var(--info)' : hadirPct >= 60 ? 'var(--warning)' : 'var(--danger)';

    const totalEntries = masuk + pulang + pulangLuar + lambatCount + cepatCount + izin + sakit + tugas + (p.tubel || 0) + (p.cuti || 0);

    // ── All-Time Footer ──
    const allTimeFooter = mAllTotal > 0 || p.all_alpa > 0 ? `
          <div class="rekap-footer-all">
            <span class="all-time-title">📈 Ringkasan Seluruh Waktu</span>
            <div class="all-time-badges">
              ${mT > 0 ? `<span class="badge-all">⏰ Lambat: ${toHHMM(mT)}</span>` : ''}
              ${mC > 0 ? `<span class="badge-all">🏃 Cepat: ${toHHMM(mC)}</span>` : ''}
              ${p.all_alpa > 0 ? `<span class="badge-all" style="color:var(--danger)">❌ TB: ${p.all_alpa}×</span>` : ''}
              ${dAllPct !== null ? `<span class="badge-all">🎯 Disiplin: ${dAllPct}%</span>` : ''}
              ${p.all_izin > 0 ? `<span class="badge-all">🙏 Izin: ${p.all_izin}</span>` : ''}
              ${p.all_sakit > 0 ? `<span class="badge-all">🤒 Sakit: ${p.all_sakit}</span>` : ''}
              ${p.all_tugas > 0 ? `<span class="badge-all">💼 Tugas: ${p.all_tugas}</span>` : ''}
              ${p.all_tubel > 0 ? `<span class="badge-all">🎓 Tubel: ${p.all_tubel}</span>` : ''}
              ${p.all_cuti > 0 ? `<span class="badge-all">🏖️ Cuti: ${p.all_cuti}</span>` : ''}
            </div>
          </div>
        ` : '';

    return `
        <div class="rekap-card-v2">
          <!-- TOP: Profile & Badge -->
          <div class="pegawai-top" style="margin-bottom:12px">
            <div class="pegawai-avatar" style="background:linear-gradient(135deg, var(--gold), #9b6e1a); box-shadow:0 2px 8px rgba(201,168,76,0.3)">${idx + 1}</div>
            <div style="flex:1;min-width:0">
              <div class="pegawai-name">${nama}</div>
              ${jabatanStr}
              <div class="pegawai-jabatan">NIP: ${nip} · ${p.pangkat || '—'} · ${totalEntries} catatan · ⏳ ${parseFloat(p.jamHadir || 0).toFixed(1)} Jam</div>
            </div>
          </div>

          <!-- HERO: Kehadiran & Disiplin -->
          <div class="rekap-hero-section">
            <div class="hero-metric-box">
              <div class="hero-val" style="color:${hadirColor}">${hadirPct}%</div>
              <div class="hero-lbl">Kehadiran</div>
            </div>
            <div class="hero-metric-box">
              <div class="hero-val" style="color:${dColor}">${dPct}%</div>
              <div class="hero-lbl">${dIcon} ${dLabel}</div>
            </div>
          </div>

          <!-- HIGHLIGHT: Akumulasi Waktu (Periode) -->
          <div class="rekap-akk-highlight" style="background:linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05)); border:1px solid rgba(245,158,11,0.3)">
            <div class="akk-h-time" style="color:var(--warning)">${toHHMM(mT + mC)}</div>
            <div class="akk-h-lbl">Total Akumulasi Pelanggaran (Seluruh Waktu)</div>
          </div>

          <!-- GRID: Statistik Periode -->
          <div class="rekap-stats-grid">
            <div class="stat-box-small"><span class="stat-box-val" style="color:var(--success)">${masuk}</span><span class="stat-box-lbl">Masuk</span></div>
            <div class="stat-box-small"><span class="stat-box-val" style="color:var(--info)">${pulang}</span><span class="stat-box-lbl">Pulang</span></div>
            <div class="stat-box-small"><span class="stat-box-val" style="color:var(--warning)">${luarMasuk}</span><span class="stat-box-lbl">Lambat</span></div>
            <div class="stat-box-small"><span class="stat-box-val" style="color:#f59e0b">${luarPulang}</span><span class="stat-box-lbl">Cepat</span></div>
            <div class="stat-box-small"><span class="stat-box-val" style="color:var(--warning)">${izin}</span><span class="stat-box-lbl">Izin</span></div>
            <div class="stat-box-small"><span class="stat-box-val" style="color:var(--danger)">${sakit}</span><span class="stat-box-lbl">Sakit</span></div>
            <div class="stat-box-small"><span class="stat-box-val" style="color:#a78bfa">${tugas}</span><span class="stat-box-lbl">Tugas</span></div>
            <div class="stat-box-small"><span class="stat-box-val" style="color:var(--danger)">${p.alpa || 0}</span><span class="stat-box-lbl">TB/Alpa</span></div>
          </div>

          <!-- FOOTER: All Time -->
          ${allTimeFooter}
        </div>`;
  }).join('');
}

/* ════ DOWNLOAD REKAP (Excel) ════ */
/* ════ KIRIM REKAP KE TELEGRAM via n8n webhook ════ */
function showRekapToast(type, msg) {
  const el = $('rekapToast');
  if (!el) return;
  const cfg = {
    success: { bg: 'rgba(34,197,94,.12)', border: 'rgba(34,197,94,.3)', color: 'var(--success)' },
    fail: { bg: 'rgba(239,68,68,.12)', border: 'rgba(239,68,68,.3)', color: 'var(--danger)' },
    loading: { bg: 'rgba(201,168,76,.1)', border: 'rgba(201,168,76,.3)', color: 'var(--gold)' }
  };
  const c = cfg[type] || cfg.loading;
  el.style.cssText = `display:block;background:${c.bg};border:1px solid ${c.border};color:${c.color}`;
  el.innerHTML = msg;
  if (type !== 'loading') setTimeout(() => { el.style.display = 'none'; }, 5000);
}

/**
 * Ekspor rekap absensi ke file Excel (.xlsx).
 * Menggunakan library SheetJS (xlsx) untuk download langsung.
 * @returns {Promise<void>}
 */
async function downloadRekap() {
  const dari = $('rekapDari').value;
  const sampai = $('rekapSampai').value;
  if (!lastRekapPegawai.length) {
    showRekapToast('fail', '⚠️ Belum ada data. Muat rekap terlebih dahulu.');
    return;
  }

  const btn = $('btnDownloadRekap');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin-sm"></span> Memproses...';

  try {
    // 1. Persiapan Data & Perhitungan HK
    const hariIniStr = fmtD(nowWITA());
    
    function countHK(dStart, dEnd, bts) {
      let c = 0;
      let d = new Date(dStart + 'T00:00:00');
      let s = new Date(dEnd + 'T00:00:00');
      let limit = bts ? new Date(bts + 'T00:00:00') : s;
      let finalEnd = limit < s ? limit : s;
      while (d <= finalEnd) {
        const day = d.getDay(), t = d.toISOString().split('T')[0];
        if (day !== 0 && day !== 6 && !hariLiburSet.has(t)) c++;
        d.setDate(d.getDate() + 1);
      }
      return c;
    }

    const HK_TOTAL = countHK(dari, sampai, null);
    const HK_BERJALAN = countHK(dari, sampai, hariIniStr);
    const HK_EFEKTIF = HK_BERJALAN > 0 ? HK_BERJALAN : HK_TOTAL;

    const isHarian = dari === sampai;
    const tglLabel = isHarian 
      ? new Date(dari + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : `${dari} s.d. ${sampai}`;

    // 2. Mapping Data ke format Excel
    const rowsExcel = lastRekapPegawai.map((p, i) => {
      const masuk = p.masuk || 0;
      const lambat = p.lambat_count ?? 0;
      const cepat = p.pulang_cepat_count ?? 0;
      const hHadir = (p.masuk || 0) + (p.lambat_count || 0);

      // Detail per kolom
      const data = {
        'No': i + 1,
        'Nama Pegawai': p.nama || '—',
        'NIP': p.nip || '—',
        'Bidang': p.bidang || '—',
        'Jabatan': p.jabatan || '—'
      };

      if (isHarian) {
        data['Jam Masuk'] = p.jamMasuk || '—';
        data['Jam Pulang'] = p.jamPulang || '—';
        data['Status'] = (p.izin > 0) ? 'Izin' : (p.sakit > 0) ? 'Sakit' : (p.tugas > 0) ? 'Tugas' : (hHadir > 0) ? 'Hadir' : 'TB';
        data['Keterangan'] = p.keterangan_log || '—';
        
        // Tambahkan info akumulasi harian
        const mTerlambat = p.menit_terlambat || 0;
        const mCepat = p.menit_lebih_awal || 0;
        if (mTerlambat > 0) data['Terlambat (Menit)'] = mTerlambat;
        if (mCepat > 0) data['Pulang Cepat (Menit)'] = mCepat;
      } else {
        const mT_p = p.menit_terlambat || 0;
        const mC_p = p.menit_lebih_awal || 0;
        const mAlpa_p = (p.alpa || 0) * 450;
        const totalM_p = mT_p + mC_p + mAlpa_p;
        
        data['HK Efektif'] = HK_EFEKTIF;
        data['Hadir (Tepat)'] = p.masuk || 0;
        data['Terlambat (Frekuensi)'] = lambat;
        data['Terlambat (Menit)'] = mT_p;
        data['Pulang Cepat (Frekuensi)'] = cepat;
        data['Pulang Cepat (Menit)'] = mC_p;
        data['Izin/Sakit/Tugas'] = (p.izin || 0) + (p.sakit || 0) + (p.tugas || 0);
        data['Alpa/TB'] = p.alpa || 0;
        data['Total Akumulasi (Jam:Menit)'] = toHHMM(totalM_p);
        data['Total Jam Hadir'] = parseFloat(p.jamHadir || 0).toFixed(1);
      }
      return data;
    });

    // 3. Generate File via SheetJS (XLSX)
    if (typeof XLSX === 'undefined') throw new Error('Library XLSX belum dimuat.');
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rowsExcel);
    
    // Set column widths
    const wscols = [
      {wch: 4}, {wch: 30}, {wch: 20}, {wch: 20}, {wch: 25}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}
    ];
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, "Rekap Absensi");
    const filename = `Rekap_Absensi_${isHarian ? dari : dari + '_sd_' + sampai}.xlsx`;
    XLSX.writeFile(wb, filename);

    showRekapToast('success', `✅ Excel berhasil diunduh: ${filename}`);

    // 4. (Optional) Backup: Tetap kirim ke Telegram jika diperlukan
    try {
      const payload = {
        dari, sampai, nip: localStorage.getItem('MY_NIP') || '',
        is_harian: isHarian, tanggal_label: tglLabel,
        chat_id: String(REKAP_CHAT_ID || MY_ID || ''),
        pegawai: lastRekapPegawai
      };
      apiPost(P.kirimRekap, payload); // Fire and forget
    } catch(e) { console.warn('Backup Telegram failed', e); }

  } catch (e) {
    console.error('Download Excel Error:', e);
    showRekapToast('fail', '❌ Gagal membuat Excel: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// Global function to toggle and initialize Leaflet map for each card
window.toggleRekapMap = function(cardEl, pins) {
  const d = cardEl.querySelector('.lokasi-detail'); 
  if(!d) return;
  const isHidden = d.style.display === 'none';
  d.style.display = isHidden ? 'block' : 'none';
  if (isHidden && window.L) {
    const mc = d.querySelector('.rekap-map-container');
    if (mc && !mc.dataset.init) {
      mc.dataset.init = '1';
      setTimeout(() => {
        if(!pins || !pins.length) return;
        const map = L.map(mc, { zoomControl: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map);
        const bounds = [];
        pins.forEach(pin => {
          bounds.push([pin.lat, pin.lng]);
          L.marker([pin.lat, pin.lng], {
            icon: L.divIcon({
              className: 'custom-pin',
              html: `<div style="background:${pin.color};width:24px;height:24px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);">${pin.label}</div>`,
              iconSize: [24, 24], iconAnchor: [12, 12]
            })
          }).addTo(map);
        });
        if(bounds.length > 1) map.fitBounds(bounds, { padding: [20,20], maxZoom: 16 });
        else map.setView(bounds[0], 16);
      }, 100);
    }
  }
};
