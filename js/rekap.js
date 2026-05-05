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
        const res = await apiGet(P.userList);
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
          const res = await apiFetch(`${P.rekap}?dari=${dari}&sampai=${sampai}&jam_masuk=${jamMasukParam}&jam_pulang=${jamPulangParam}&hari_kerja=${hariKerjaParam}&libur=${liburParam}`, { method: 'GET' });
          if (res.ok) {
            const json = await res.json();
            const d = Array.isArray(json) ? json[0] : json;
            if (d?.pegawai?.length) { ringkasan = d.ringkasan || {}; pegawai = d.pegawai; rekapOK = true; }
          }
        } catch (_) { }

        // ── Fallback frontend jika n8n gagal ──
        if (!rekapOK) {
          let allRowsRaw = [], periodRowsRaw = [];
          try {
            const resAll = await apiGet(`${P.log}?dari=${dari}&sampai=${sampai}`);
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
        // Enrich jabatan dari user_list jika belum ada, lalu sort by urutan
        if (order.length > 0) {
          pegawai = pegawai.map(p => {
            const match = order.find(u =>
              u.id === String(p.id || '') ||
              u.nama.toLowerCase().trim() === (p.nama || '').toLowerCase().trim() ||
              (u.nip && u.nip === p.nip));
            return match
              ? {
                ...p,
                nama: p.nama && p.nama !== '—' ? p.nama : match.nama,
                nip: p.nip && p.nip !== '—' ? p.nip : match.nip,
                jabatan: (p.jabatan && p.jabatan !== '—' && p.jabatan.trim() !== '') ? p.jabatan : match.jabatan,
                pangkat: (p.pangkat && p.pangkat !== '—' && p.pangkat.trim() !== '') ? p.pangkat : match.pangkat,
                urutan: p.urutan ?? match.urutan
              }
              : p;
          });
        }
        const getJabatanScore = (j) => {
          if (!j) return 0;
          const s = String(j).toUpperCase();
          if (s.includes('KEPALA DINAS') || s.includes('KEPALA BADAN') || s.includes('KEPALA KANTOR') || s === 'KEPALA') return 100;
          if (s.includes('SEKRETARIS')) return 90;
          if (s.includes('KEPALA BIDANG') || s.includes('KABID')) return 80;
          if (s.includes('KASUBAG') || s.includes('KETUA TIM') || s.includes('KOORDINATOR') || s.includes('SUB KOORDINATOR')) return 70;
          if (s.includes('FUNGSIONAL') || s.includes('AHLI MUDA') || s.includes('AHLI MADYA')) return 60;
          if (s.includes('STAF') || s.includes('PELAKSANA')) return 50;
          if (s.includes('NON ASN') || s.includes('HONORER') || s.includes('THL') || s.includes('KONTRAK')) return 40;
          return 10;
        };

        const getPangkatScore = (p) => {
          if (!p) return 0;
          const s = String(p).toUpperCase();
          if (s.includes('IV/E')) return 17; if (s.includes('IV/D')) return 16;
          if (s.includes('IV/C')) return 15; if (s.includes('IV/B')) return 14;
          if (s.includes('IV/A')) return 13; if (s.includes('III/D')) return 12;
          if (s.includes('III/C')) return 11; if (s.includes('III/B')) return 10;
          if (s.includes('III/A')) return 9;  if (s.includes('II/D')) return 8;
          if (s.includes('II/C')) return 7;  if (s.includes('II/B')) return 6;
          if (s.includes('II/A')) return 5;  if (s.includes('I/D')) return 4;
          if (s.includes('I/C')) return 3;  if (s.includes('I/B')) return 2;
          if (s.includes('I/A')) return 1;
          return 0;
        };

        const getNipScore = (nip) => {
          // NIP BAPPERIDA: 18 digits (YYYYMMDD YYYYMM G SSS)
          // Lower NIP = Older Birth Date/Appointment = Senior
          return String(nip || '999999999999999999').replace(/\D/g, '');
        };

        pegawai.sort((a, b) => {
          // 1. Urutkan berdasarkan JABATAN (Kepala > Sekretaris > Kabid > dst)
          const jabA = getJabatanScore(a.jabatan);
          const jabB = getJabatanScore(b.jabatan);
          if (jabA !== jabB) return jabB - jabA;

          // 2. Urutkan berdasarkan PANGKAT (Tertinggi IV/E -> Terendah I/A)
          const rankA = getPangkatScore(a.pangkat);
          const rankB = getPangkatScore(b.pangkat);
          if (rankA !== rankB) return rankB - rankA;

          // 3. Urutkan berdasarkan NIP (Seniority: Lower NIP first)
          const nipA = getNipScore(a.nip);
          const nipB = getNipScore(b.nip);
          if (nipA !== nipB) return nipA.localeCompare(nipB); 

          // 4. Urutkan berdasarkan Nama (A-Z)
          return (a.nama || '').localeCompare(b.nama || '', 'id');
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

          return `
      <div class="pegawai-card" style="border-color:${cardBorderColor};position:relative;overflow:hidden;padding-bottom:10px; box-shadow: 0 8px 30px rgba(0,0,0,0.12);">
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${cardTopColor}"></div>

        <!-- Header pegawai -->
        <div class="pegawai-top" style="margin-bottom:10px">
          <div class="pegawai-avatar" style="background:linear-gradient(135deg,${cardTopColor},${isAlpa ? '#7f1d1d' : isKet ? '#4c1d95' : '#065f46'});font-size:11px">${idx + 1}</div>
          <div style="flex:1;min-width:0">
            <div class="pegawai-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nama}</div>
            ${jabatanStr}
            <div class="pegawai-jabatan" style="margin-top:2px">NIP: ${nip} · ⏳ ${parseFloat(p.jamHadir || 0).toFixed(1)} Jam</div>
            ${periodeHarianNama ? `<div style="font-size:8px;font-weight:700;color:#a78bfa;margin-top:2px">🌙 ${periodeHarianNama}</div>` : ''}
          </div>
          <!-- Badge status utama -->
          <div style="flex-shrink:0;text-align:right">
            <div style="font-size:16px">${masukIcon}</div>
            <div style="font-size:9px;font-weight:700;color:${masukColor};margin-top:2px;white-space:nowrap">${masukLabel}</div>
          </div>
        </div>

        <!-- ── CARD JAM MASUK / PULANG ── -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">

          <!-- JAM MASUK -->
          <div style="background:${masukBg}; border:1px solid ${masukColor}33; border-radius:10px; padding:10px 12px; position:relative; overflow:hidden;">
            ${IS_ADMIN ? (p._rawMasukLog || p._rawKetLog ? `
              <button onclick="openLogEditor('${p.id}', '${_dari}', ${JSON.stringify(p._rawMasukLog || p._rawKetLog).replace(/"/g, '&quot;')})" 
                      style="position:absolute; top:0; right:0; bottom:0; width:30px; background:rgba(255,255,255,0.05); border:none; border-left:1px solid ${masukColor}22; color:${masukColor}; cursor:pointer; font-size:11px; display:flex; align-items:center; justify-content:center; transition: all 0.2s;"
                      onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'"
                      title="Edit Log Masuk">✏️</button>
            ` : `
              <button onclick="openLogEditor('${p.id}', '${_dari}', null, 'MASUK')" 
                      style="position:absolute; top:0; right:0; bottom:0; width:30px; background:rgba(255,255,255,0.05); border:none; border-left:1px solid ${masukColor}22; color:var(--muted); cursor:pointer; font-size:11px; display:flex; align-items:center; justify-content:center; transition: all 0.2s;"
                      onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'"
                      title="Tambah Log Manual">➕</button>
            `) : ''}
            <div style="font-size:8px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">🟢 Jam Masuk</div>
            ${izin > 0 || sakit > 0 || tugas > 0 || p.tubel > 0 || p.cuti > 0
              ? `<div style="font-size:20px;font-family:'JetBrains Mono',monospace;font-weight:800;color:${masukColor};line-height:1">${masukIcon}</div>
                 <div style="font-size:10px;color:${masukColor};font-weight:700;margin-top:3px">${masukLabel}</div>`
              : rawMasuk
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
              <button onclick="openLogEditor('${p.id}', '${_dari}', ${JSON.stringify(p._rawPulangLog || p._rawKetLog).replace(/"/g, '&quot;')})" 
                      style="position:absolute; top:0; right:0; bottom:0; width:30px; background:rgba(255,255,255,0.05); border:none; border-left:1px solid ${pulangColor}22; color:${pulangColor}; cursor:pointer; font-size:11px; display:flex; align-items:center; justify-content:center; transition: all 0.2s;"
                      onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'"
                      title="Edit Log Pulang">✏️</button>
            ` : `
              <button onclick="openLogEditor('${p.id}', '${_dari}', null, 'PULANG')" 
                      style="position:absolute; top:0; right:0; bottom:0; width:30px; background:rgba(255,255,255,0.05); border:none; border-left:1px solid ${pulangColor}22; color:var(--muted); cursor:pointer; font-size:11px; display:flex; align-items:center; justify-content:center; transition: all 0.2s;"
                      onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'"
                      title="Tambah Log Manual">➕</button>
            `) : ''}
            <div style="font-size:8px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">🔵 Jam Pulang</div>
            ${isKet
              ? `<div style="font-size:20px;font-family:'JetBrains Mono',monospace;font-weight:800;color:${masukColor};line-height:1">—</div>
                 <div style="font-size:9px;color:${masukColor};font-weight:700;margin-top:3px">${masukLabel}</div>`
              : rawPulang
                ? `<div style="font-size:20px;font-family:'JetBrains Mono',monospace;font-weight:800;color:${pulangColor};line-height:1">${rawPulang.slice(0, 5)}</div>
                   <div style="font-size:9px;color:${pulangColor};font-weight:700;margin-top:3px">${pulangIcon} ${pulangLabel}</div>`
                : `<div style="font-size:20px;font-family:'JetBrains Mono',monospace;font-weight:800;color:var(--muted);line-height:1">—:—</div>
                   <div style="font-size:9px;color:${pulangColor};font-weight:700;margin-top:3px">${pulangIcon} ${pulangLabel}</div>`
            }
            <div style="font-size:8px;color:var(--muted);margin-top:3px;opacity:.7">Batas ≥ ${jpBatas}</div>
          </div>
        </div>

        <!-- ── BADGE STATUS BAWAH ── -->
        <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
          ${(function () {
              const mT = p.menit_terlambat ?? p.all_menit_terlambat ?? 0;
              const mC = p.menit_lebih_awal ?? p.all_menit_lebih_awal ?? 0;
              const mAlpa_Total = (p.all_alpa || 0) * 450;
              const mAll = mT + mC + mAlpa_Total;
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

        ${(function () {
              const mT = p.menit_terlambat ?? p.all_menit_terlambat ?? 0;
              const mC = p.menit_lebih_awal ?? p.all_menit_lebih_awal ?? 0;
              const mAlpa_Total = (p.all_alpa || 0) * 450;
              const mAllTotal_Local = mT + mC + mAlpa_Total;
              
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
        const mAlpa = (p.all_alpa || 0) * 450;
        const mAllTotal = mT + mC + mAlpa;

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
              <div class="pegawai-jabatan">NIP: ${nip} · ${totalEntries} catatan · ⏳ ${parseFloat(p.jamHadir || 0).toFixed(1)} Jam</div>
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

          <!-- HIGHLIGHT: Akumulasi Waktu -->
          <div class="rekap-akk-highlight">
            <div class="akk-h-time">${akkTotalWaktuFmt}</div>
            <div class="akk-h-lbl">Akumulasi Jam (All-Time)</div>
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
     * Menggunakan library SheetJS (xlsx).
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
      btn.disabled = true;
      btn.innerHTML = '<span class="spin-sm"></span> Mengirim...';

      // Helper konversi jam string → menit
      const toMenitDl = w => { const [h, m] = (w || '').replace(/\s.*/, '').split(':').map(Number); return (isNaN(h) || isNaN(m)) ? null : h * 60 + m; };

      // Hitung hari kerja: senin-jumat, kurangi libur nasional, opsional batas hari ini
      function countHariKerja(dari, sampai, batasHari) {
        let count = 0;
        const d = new Date(dari + 'T00:00:00');
        const s = new Date(sampai + 'T00:00:00');
        const bts = batasHari ? new Date(batasHari + 'T00:00:00') : s;
        const end = bts < s ? bts : s;
        while (d <= end) {
          const day = d.getDay(), tglStr = d.toISOString().split('T')[0];
          if (day !== 0 && day !== 6 && !hariLiburSet.has(tglStr)) count++;
          d.setDate(d.getDate() + 1);
        }
        return count;
      }

      // Hari ini (WITA)
      const hariIniStr = fmtD(nowWITA());
      // HK penuh periode (tanpa batas)
      const HARI_KERJA_PERIODE = countHariKerja(dari, sampai, null);
      // HK berjalan: s.d. hari ini (untuk periode yang sedang berjalan)
      const HARI_KERJA_BERJALAN = countHariKerja(dari, sampai, hariIniStr);
      // Efektif: gunakan berjalan jika > 0, fallback ke penuh (untuk periode lampau)
      const HK_EFEKTIF = HARI_KERJA_BERJALAN > 0 ? HARI_KERJA_BERJALAN : HARI_KERJA_PERIODE;

      // Jam standar global
      const JAM_MASUK_STANDAR = menitToStr(JAM_MASUK_MENIT);
      const JAM_PULANG_STANDAR = menitToStr(JAM_PULANG_MENIT);
      const mStandarMasuk = JAM_MASUK_MENIT;
      const mStandarPulang = JAM_PULANG_MENIT;
      const JAM_KERJA_WAJIB_MENIT = mStandarPulang - mStandarMasuk;
      const JAM_KERJA_WAJIB_TOTAL = (JAM_KERJA_WAJIB_MENIT / 60) * HK_EFEKTIF;

      // Info hari untuk Excel
      const NAMA_HARI_LIST = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const isHarian = dari === sampai;
      const hariDariJS = new Date(dari + 'T00:00:00').getDay();
      const namaHariDari = NAMA_HARI_LIST[hariDariJS];
      const isWeekendDari = hariDariJS === 0 || hariDariJS === 6;
      const isLiburDari = hariLiburSet.has(dari);
      const labelHariBerjalan = isHarian
        ? (isWeekendDari ? `${namaHariDari} (Akhir Pekan)` : isLiburDari ? `${namaHariDari} (Hari Libur)` : namaHariDari)
        : `${HK_EFEKTIF} HK berjalan dari ${HARI_KERJA_PERIODE} HK total (libur dikecualikan)`;

      const pegawaiPayload = lastRekapPegawai.map((p, i) => {
        const masuk = p.masuk || 0;
        const pulang = p.pulang || 0;
        const lambatCount = p.lambat_count ?? 0;
        const cepatCount = p.pulang_cepat_count ?? 0;
        const izin = p.izin || 0;
        const sakit = p.sakit || 0;
        const tugas = p.tugas || 0;
        const tubel = p.tubel || 0;
        const cuti = p.cuti || 0;

        // Jam per pegawai (prioritas: periode khusus → custom per-pegawai → global)
        const pgwId = String(p.id || '');
        const jpgw = jamPegawaiMap[pgwId];
        const _jamDl = getJamForTanggal(dari); // periode aktif di tanggal "dari"
        const jamMasukBatasStr = _jamDl.nama ? _jamDl.masuk : (jpgw?.masuk || JAM_MASUK_STANDAR);
        const jamPulangBatasStr = _jamDl.nama ? _jamDl.pulang : (jpgw?.pulang || JAM_PULANG_STANDAR);
        const mPgwMasuk = toMenitDl(jamMasukBatasStr) ?? mStandarMasuk;
        const mPgwPulang = toMenitDl(jamPulangBatasStr) ?? mStandarPulang;
        // Jam kerja wajib harian untuk pegawai ini (HK_EFEKTIF: hari belum lewat tidak dihitung)
        const jamKerjaHarianMenit = mPgwPulang - mPgwMasuk;
        const jamKerjaWajibTotal = parseFloat(((jamKerjaHarianMenit / 60) * HK_EFEKTIF).toFixed(1));

        const jamMasuk = p.jamMasuk || '-';
        const jamPulang = p.jamPulang || '-';
        const mMasuk = toMenitDl(jamMasuk);
        const mPulang = toMenitDl(jamPulang);
        const mLambat = (mMasuk !== null && mMasuk > mPgwMasuk) ? mMasuk - mPgwMasuk : 0;
        const mCepat = (mPulang !== null && mPulang < mPgwPulang) ? mPgwPulang - mPulang : 0;
        const ket = tubel > 0 ? 'Tubel' : cuti > 0 ? 'Cuti' : izin > 0 ? 'Izin' : sakit > 0 ? 'Sakit' : tugas > 0 ? 'Tugas/DL' : (masuk + lambatCount) === 0 ? 'TB' : 'Hadir';

        // Jam hadir aktual (hitung dari log masuk+pulang dalam periode)
        const jh = parseFloat(p.jamHadir || 0);
        // jth selalu dihitung ulang dari jamKerjaWajibTotal (periode-aware × HK_EFEKTIF),
        // BUKAN dari p.jamTdkHadir server yang memakai konstanta 150 jam hardcoded.
        const jth = parseFloat(Math.max(0, jamKerjaWajibTotal - jh).toFixed(1));

        // Status keterlambatan / pulang cepat (harian)
        const terlambatMenit = mLambat;
        const cepatMenit = mCepat;
        const terlambatStr = terlambatMenit > 0 ? `Terlambat ${terlambatMenit} menit` : '';
        const cepatStr = cepatMenit > 0 ? `Pulang cepat ${cepatMenit} menit` : '';
        const statusKehadiran = tubel > 0 ? 'Tubel'
          : cuti > 0 ? 'Cuti'
            : izin > 0 ? 'Izin'
              : sakit > 0 ? 'Sakit'
                : tugas > 0 ? 'Tugas/DL'
                  : (masuk + lambatCount) === 0 ? 'TB'
                    : 'Hadir';
        const catatanArr = [terlambatStr, cepatStr].filter(Boolean);
        const catatanStr = catatanArr.length ? catatanArr.join(', ') : '';

        // Info hari untuk kolom Excel
        const isHariTidakKerja = isWeekendDari || isLiburDari;
        const infoHariExcel = isWeekendDari
          ? `${namaHariDari} – Akhir Pekan`
          : isLiburDari
            ? `${namaHariDari} – Hari Libur Nasional`
            : namaHariDari;

        const dataExcelRow = isHarian ? {
          'No': i + 1,
          'Nama': p.nama || '—',
          'NIP': p.nip || '—',
          'Jabatan': p.jabatan || '—',
          'Hari': infoHariExcel,
          'Jam Masuk': jamMasuk !== '-' ? jamMasuk : '—',
          'Jam Pulang': jamPulang !== '-' ? jamPulang : '—',
          'Status': isHariTidakKerja ? 'Libur' : statusKehadiran,
          'Catatan': isHariTidakKerja
            ? (isWeekendDari ? 'Hari libur – akhir pekan' : 'Hari libur nasional')
            : (catatanStr || '—')
        } : {
          'No': i + 1,
          'Nama': p.nama || '—',
          'NIP': p.nip || '—',
          'Jabatan': p.jabatan || '—',
          'HK Total': HARI_KERJA_PERIODE,
          'HK Berjalan': HK_EFEKTIF,
          'Jam Masuk Batas': jamMasukBatasStr,
          'Jam Pulang Batas': jamPulangBatasStr,
          'Jam Kerja Wajib': jamKerjaWajibTotal + ' jam',
          'Jam Hadir': jh.toFixed(1),
          'Jam Tidak Hadir': jth.toFixed(1),
          'Sakit': sakit,
          'Izin': izin,
          'Dinas Luar (DL)': tugas,
          'TB': (p.alpa || 0),
          'Keterangan': [
            masuk > 0 ? `M:${masuk}` : '',
            pulang > 0 ? `P:${pulang}` : '',
            luarMasuk > 0 ? `L:${luarMasuk}` : '',
            luarPulang > 0 ? `C:${luarPulang}` : '',
            izin > 0 ? `I:${izin}` : '',
            sakit > 0 ? `S:${sakit}` : '',
            tugas > 0 ? `DL:${tugas}` : ''
          ].filter(Boolean).join(' ') || 'Tidak Hadir',
          'Info Periode': labelHariBerjalan
        };

        // Override jamTdkHadir & jamKerjaWajib dengan nilai periode-aware yang sudah benar,
        // agar Format Pesan n8n (Telegram) juga memakai nilai ini, bukan konstanta server.
        return {
          ...p, masuk, pulang, lambat: luarMasuk, pulangCepat: luarPulang,
          jamTdkHadir: jth, jamKerjaWajib: jamKerjaWajibTotal, dataExcelRow
        };
      });

      const payload = {
        dari,
        sampai,
        is_harian: isHarian,
        tanggal_label: isHarian
          ? new Date(dari + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          : `${dari} s.d. ${sampai}`,
        hari_kerja_total: HARI_KERJA_PERIODE,
        hari_kerja_berjalan: HK_EFEKTIF,
        is_hari_libur: isHarian ? (isLiburDari || isWeekendDari) : false,
        nama_hari: isHarian ? namaHariDari : null,
        info_periode: labelHariBerjalan,
        chat_id: String(REKAP_CHAT_ID || MY_ID || ''),
        pegawai: pegawaiPayload
      };

      try {
        const { ok: kirimOk, data: kirimData } = await apiPost(P.kirimRekap, payload);
        let d = {}; try { d = kirimData; } catch (_) { }
        if (res.ok) {
          showRekapToast('success', '✅ Rekap berhasil dikirim ke Telegram! Cek bot Anda.');
        } else {
          throw new Error('Server ' + 200);
        }
      } catch (e) {
        console.warn('kirimRekap error:', e);
        showRekapToast('fail', '🔌 Gagal mengirim. Pastikan n8n & bot Telegram aktif.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '📤 Kirim';
      }
    }

