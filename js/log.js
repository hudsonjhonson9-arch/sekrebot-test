/* ════ RIWAYAT / LOG ════ */
    /* ════ RIWAYAT ════ */
    let allLogs = [], logLoaded = false;
    // shimmerRows() digantikan oleh dom.shimmer() dari dom.js


    /**
     * Ambil dan filter log absensi user dari server.
     * Fungsi data-only — tidak menyentuh DOM.
     * @param {number|null} userId - ID user. Jika null, ambil semua.
     * @returns {Promise<Object[]>} Array baris log, sudah difilter & diurutkan
     */
    async function fetchLogData(userId) {
      const res = await apiFetch(`${P.log}?user_id=${userId || ''}`, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      let rows = parseApiResponse(json);
      if (userId) { rows = rows.filter(r => Number(getField(r, 'ID', 'id')) === userId); }
      rows.sort((a, b) => {
        const ta = getField(a, 'Tanggal', 'tanggal'), tb = getField(b, 'Tanggal', 'tanggal');
        if (ta !== tb) return tb.localeCompare(ta);
        return getField(b, 'Jam', 'jam').localeCompare(getField(a, 'Jam', 'jam'));
      });
      return rows;
    }

    async function loadLog() {
      const btn = $('btnRefresh'); btn.disabled = true;
      $('rIcon2').outerHTML = '<span class="spin-sm" id="rIcon2"></span>';
      dom.shimmer('logList');
      try {
        // Reset cache jam agar selalu dapat data terbaru dari server
        _resetJamAbsenCache();
        // Jalankan fetch data & metadata secara paralel
        const [rows] = await Promise.all([
          fetchLogData(MY_ID),
          fetchJamPeriode(),
          loadJamAbsen(),
          liburLoaded ? Promise.resolve() : fetchLiburForRekap()
        ]);
        allLogs = rows;
        logLoaded = true;
        renderLog(allLogs);
        updateLogStats(allLogs);
      } catch (e) {
        console.error('[Fetch Log Error]', e);
        dom.errorState('logList', `Gagal memuat data — ${e.message || 'Network Error'}`);
      }
      finally { btn.disabled = false; const s = $('rIcon2'); if (s) s.outerHTML = '<span id="rIcon2">🔄</span>'; }
    }
    function getLC(j) {
      const x = (j || '').toUpperCase().trim();
      if (x === 'MASUK') return { cls: 'l-masuk', icon: '🟢', lbl: 'MASUK' };
      if (x === 'PULANG') return { cls: 'l-pulang', icon: '🔵', lbl: 'PULANG' };
      if (x === 'PULANG LUAR') return { cls: 'l-pulang-luar', icon: '🏃', lbl: 'PULANG LAPANGAN' };
      if (x.includes('LUAR') && x.includes('MASUK')) return { cls: 'l-luar', icon: '⚠️', lbl: 'LUAR JAM MASUK' };
      if (x.includes('LUAR') && x.includes('PULANG')) return { cls: 'l-luar', icon: '🏃', lbl: 'PULANG CEPAT' };
      if (x.includes('LUAR')) return { cls: 'l-luar', icon: '⚠️', lbl: 'DI LUAR JAM' };
      if (x === 'IZIN') return { cls: 'l-izin', icon: '🙏', lbl: 'IZIN' };
      if (x === 'SAKIT') return { cls: 'l-sakit', icon: '🤒', lbl: 'SAKIT' };
      if (x === 'TUGAS') return { cls: 'l-tugas', icon: '💼', lbl: 'TUGAS' };
      if (x === 'IZIN PENDING') return { cls: 'l-pending', icon: '⏳', lbl: 'IZIN (Menunggu)' };
      if (x === 'SAKIT PENDING') return { cls: 'l-pending', icon: '⏳', lbl: 'SAKIT (Menunggu)' };
      if (x === 'TUGAS PENDING') return { cls: 'l-pending', icon: '⏳', lbl: 'TUGAS (Menunggu)' };
      if (x === 'TANPA BERITA') return { cls: 'l-alpa', icon: '❌', lbl: 'TANPA BERITA' };
      return { cls: 'l-pulang', icon: '📋', lbl: j || '—' };
    }
    function renderLog(logs) {
      const el = $('logList');
      if (!logs?.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">Belum ada data</div><div class="empty-sub">Data muncul setelah Anda absen</div></div>`; return; }

      // Group by tanggal
      const byDate = {};
      logs.forEach(r => {
        const tgl = getField(r, 'Tanggal', 'tanggal') || '—';
        if (!byDate[tgl]) byDate[tgl] = [];
        byDate[tgl].push(r);
      });

      const toMenit = s => { if (!s || s === '-') return null; const p = s.replace(/\s*WITA\s*/i, '').trim().split(':').map(Number); return isNaN(p[0]) ? null : p[0] * 60 + (p[1] || 0); };

      const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const BULAN_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

      el.innerHTML = Object.entries(byDate).map(([tgl, rows]) => {
        // ── Jam batas per tanggal (periode khusus atau global) ──
        const _jamTgl = getJamForTanggal(tgl);
        const jmBatas = _jamTgl.masuk;
        const jpBatas = _jamTgl.pulang;
        const mMasukBatas = toMenit(jmBatas);
        const mPulangBatas = toMenit(jpBatas);
        const periodeNama = _jamTgl.nama; // null jika global

        // ── Deteksi hari libur & akhir pekan ──
        let _dayIdx = -1;
        try { _dayIdx = new Date(tgl + 'T00:00:00').getDay(); } catch (_) { }
        const isWeekend = _dayIdx === 0 || _dayIdx === 6;
        const isLiburNasional = hariLiburSet.has(tgl);
        const isLibur = isWeekend || isLiburNasional;
        const namaLibur = isLiburNasional ? (hariLiburMap[tgl] || 'Hari Libur')
          : isWeekend ? (_dayIdx === 0 ? 'Minggu' : 'Sabtu')
            : null;

        // Pisahkan per jenis
        const rMasuk = rows.find(r => { const j = (getField(r, 'Jenis Absen', 'jenis', 'Jenis') || '').toUpperCase(); return j === 'MASUK' || j.includes('LUAR JAM MASUK') || j.includes('LUAR MASUK'); });
        const rPulang = rows.find(r => { const j = (getField(r, 'Jenis Absen', 'jenis', 'Jenis') || '').toUpperCase(); return j === 'PULANG' || j === 'PULANG LUAR' || j.includes('LUAR JAM PULANG') || j.includes('LUAR PULANG'); });
        const rIzin = rows.find(r => (getField(r, 'Jenis Absen', 'jenis', 'Jenis') || '').toUpperCase().includes('IZIN'));
        const rSakit = rows.find(r => (getField(r, 'Jenis Absen', 'jenis', 'Jenis') || '').toUpperCase().includes('SAKIT'));
        const rTugas = rows.find(r => (getField(r, 'Jenis Absen', 'jenis', 'Jenis') || '').toUpperCase().includes('TUGAS'));
        const rAlpa = rows.find(r => (getField(r, 'Jenis Absen', 'jenis', 'Jenis') || '').toUpperCase() === 'TANPA BERITA');

        const jamMasuk = rMasuk ? (getField(rMasuk, 'Jam', 'jam') || '').replace(/\s*WITA\s*/i, '').trim() : null;
        const jamPulang = rPulang ? (getField(rPulang, 'Jam', 'jam') || '').replace(/\s*WITA\s*/i, '').trim() : null;
        const isKet = !!(rIzin || rSakit || rTugas);
        const isAlpa = !!rAlpa;

        // Lokasi dari masuk, atau pulang, atau baris pertama
        const lokasiRaw = rMasuk ? getField(rMasuk, 'Lokasi', 'lokasi')
          : rPulang ? getField(rPulang, 'Lokasi', 'lokasi')
            : getField(rows[0], 'Lokasi', 'lokasi');
        const lokasi = (lokasiRaw || '').trim() || '—';

        // Status masuk
        const mMasuk = toMenit(jamMasuk);
        const mPulang = toMenit(jamPulang);
        const terlambatMnt = (mMasuk !== null && mMasukBatas !== null && mMasuk > mMasukBatas) ? mMasuk - mMasukBatas : 0;
        const cepatMnt = (mPulang !== null && mPulangBatas !== null && mPulang < mPulangBatas) ? mPulangBatas - mPulang : 0;

        let masukLabel, masukColor, masukBg, masukIcon;
        if (rIzin) { masukLabel = 'Izin'; masukColor = 'var(--warning)'; masukBg = 'rgba(245,158,11,.12)'; masukIcon = '🙏'; }
        else if (rSakit) { masukLabel = 'Sakit'; masukColor = 'var(--danger)'; masukBg = 'rgba(239,68,68,.12)'; masukIcon = '🤒'; }
        else if (rTugas) { masukLabel = 'Tugas/DL'; masukColor = '#8b5cf6'; masukBg = 'rgba(139,92,246,.12)'; masukIcon = '💼'; }
        else if (isAlpa) { masukLabel = 'Tanpa Berita'; masukColor = 'var(--danger)'; masukBg = 'rgba(239,68,68,.08)'; masukIcon = '❌'; }
        else if (!jamMasuk) { masukLabel = 'Tidak Masuk'; masukColor = 'var(--muted)'; masukBg = 'rgba(255,255,255,.04)'; masukIcon = '—'; }
        else if (terlambatMnt > 0) { masukLabel = `+${terlambatMnt}m`; masukColor = 'var(--warning)'; masukBg = 'rgba(245,158,11,.08)'; masukIcon = '⏰'; }
        else { masukLabel = 'Tepat Waktu'; masukColor = 'var(--success)'; masukBg = 'rgba(34,197,94,.08)'; masukIcon = '✅'; }

        let pulangLabel, pulangColor, pulangIcon;
        if (isKet) { pulangLabel = '—'; pulangColor = 'var(--muted)'; pulangIcon = '—'; }
        else if (!jamPulang) { pulangLabel = 'Belum Absen'; pulangColor = 'var(--warning)'; pulangIcon = '⏳'; }
        else if (cepatMnt > 0) { pulangLabel = `-${cepatMnt}m`; pulangColor = '#f97316'; pulangIcon = '🏃'; }
        else if (rPulang && (getField(rPulang, 'Jenis Absen', 'jenis', 'Jenis') || '').toUpperCase() === 'PULANG LUAR') { pulangLabel = 'Lapangan'; pulangColor = '#f59e0b'; pulangIcon = '🏃'; }
        else { pulangLabel = 'Tepat'; pulangColor = 'var(--info)'; pulangIcon = '🔵'; }

        const cardBorder = isKet ? 'rgba(139,92,246,.3)'
          : isAlpa ? 'rgba(239,68,68,.3)'
            : terlambatMnt > 0 || cepatMnt > 0 ? 'rgba(245,158,11,.3)'
              : !jamMasuk ? 'rgba(255,255,255,.1)'
                : 'rgba(34,197,94,.25)';
        const cardTop = isKet ? '#8b5cf6'
          : isAlpa ? 'var(--danger)'
            : terlambatMnt > 0 || cepatMnt > 0 ? 'var(--warning)'
              : !jamMasuk ? 'var(--muted)'
                : 'var(--success)';

        // Format tanggal cantik
        let tglLabel = tgl;
        try { const d = new Date(tgl + 'T00:00:00'); if (!isNaN(d)) { tglLabel = `${HARI_ID[d.getDay()]}, ${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`; } } catch (_) { }

        // Ket teks (izin/sakit/tugas)
        const ketRow = rIzin || rSakit || rTugas;
        const ketTeks = ketRow ? (getField(ketRow, 'Ket', 'ket') || '').trim() : '';

        const rKet = rIzin || rSakit || rTugas;
        return `<div class="log-item" style="display:block;padding:0;border-color:${cardBorder};position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${cardTop}"></div>
      <!-- Header tanggal -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px 6px">
        <div>
          <div style="font-size:10px;font-weight:800;color:var(--white)">${tglLabel}</div>
          ${periodeNama ? `<div style="font-size:8px;font-weight:700;color:#a78bfa;margin-top:2px">🌙 ${periodeNama}</div>` : ''}
          ${isLibur ? `<div style="font-size:8px;font-weight:700;color:${isLiburNasional ? '#f87171' : 'var(--muted)'};margin-top:2px;background:${isLiburNasional ? 'rgba(239,68,68,.10)' : 'rgba(255,255,255,.05)'};border:1px solid ${isLiburNasional ? 'rgba(239,68,68,.25)' : 'rgba(255,255,255,.1)'};border-radius:5px;padding:1px 6px;display:inline-block">${isLiburNasional ? '🎉' : '📅'} ${namaLibur}</div>` : ''}
        </div>
        <div style="font-size:16px">${masukIcon}</div>
      </div>
      <!-- Grid jam masuk/pulang -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:0 10px 8px">
        <div style="background:${masukBg};border:1px solid ${masukColor}44;border-radius:9px;padding:7px 9px">
          <div style="font-size:7.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">🟢 Jam Masuk</div>
          ${isKet
            ? `<div style="font-size:18px;font-family:'JetBrains Mono',monospace;font-weight:800;color:${masukColor};line-height:1">${masukIcon}</div>
               <div style="font-size:9px;color:${masukColor};font-weight:700;margin-top:2px">${masukLabel}</div>`
            : `<div style="font-size:18px;font-family:'JetBrains Mono',monospace;font-weight:800;color:${masukColor};line-height:1">${jamMasuk ? jamMasuk.slice(0, 5) : '—:—'}</div>
               <div style="font-size:9px;color:${masukColor};font-weight:700;margin-top:2px">${masukLabel}</div>`
          }
          <div style="font-size:7.5px;color:var(--muted);margin-top:3px;opacity:.7">Batas ≤ ${jmBatas}${periodeNama ? "" : " (Global)"}</div>
        </div>
        <div style="background:${isKet ? masukBg : 'rgba(96,165,250,.06)'};border:1px solid ${isKet ? masukColor + '44' : 'rgba(96,165,250,.2)'};border-radius:9px;padding:7px 9px">
          <div style="font-size:7.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">🔵 Jam Pulang</div>
          ${isKet
            ? `<div style="font-size:18px;font-family:'JetBrains Mono',monospace;font-weight:800;color:${masukColor};line-height:1">—</div>
               <div style="font-size:9px;color:${masukColor};font-weight:700;margin-top:2px">${masukLabel}</div>`
            : `<div style="font-size:18px;font-family:'JetBrains Mono',monospace;font-weight:800;color:${pulangColor};line-height:1">${jamPulang ? jamPulang.slice(0, 5) : '—:—'}</div>
               <div style="font-size:9px;color:${pulangColor};font-weight:700;margin-top:2px">${pulangIcon} ${pulangLabel}</div>`
          }
          <div style="font-size:7.5px;color:var(--muted);margin-top:3px;opacity:.7">Batas ≥ ${jpBatas}${periodeNama ? "" : " (Global)"}</div>
        </div>
      </div>
      <!-- Footer: lokasi + ket -->
      <div style="padding:0 10px 9px;display:flex;flex-direction:column;gap:3px">
        <div style="font-size:9px;color:var(--muted);display:flex;align-items:center;gap:5px">
          <span>📍</span><span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lokasi}</span>
        </div>
        ${ketTeks ? `<div style="font-size:9px;color:rgba(255,255,255,.5);display:flex;align-items:flex-start;gap:5px"><span>📝</span><span style="flex:1">${ketTeks.length > 60 ? ketTeks.slice(0, 60) + '…' : ketTeks}</span></div>` : ''}
      </div>
    </div>`;
      }).join('');
    }
    function updateLogStats(l) {
      // ── Statistik sederhana dihapus (sudah ada di Akumulasi) ──

      // ══ AKUMULASI WAKTU ══
      const toMnt = s => {
        if (!s || s === '-') return null;
        const p = s.replace(/\s*WITA\s*/i, '').trim().split(':').map(Number);
        return isNaN(p[0]) ? null : p[0] * 60 + (p[1] || 0);
      };
      const fmtMnt = m => {
        if (m === null || isNaN(m) || m < 0) return '—';
        const h = Math.floor(m / 60), mn = m % 60;
        return h > 0 ? `${h}j ${mn}m` : `${mn}m`;
      };
      const fmtJam = m => {
        if (m === null || isNaN(m)) return '—';
        return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      };

      // Group by tanggal
      const byDate = {};
      l.forEach(r => {
        const tgl = getField(r, 'Tanggal', 'tanggal') || '—';
        if (!byDate[tgl]) byDate[tgl] = [];
        byDate[tgl].push(r);
      });

      let hariHadir = 0, hariTerlambat = 0, hariCepat = 0;
      let totalLambatMnt = 0, totalCepatMnt = 0;
      let sumMasukMnt = 0, countMasuk = 0;
      let sumPulangMnt = 0, countPulang = 0;
      let sumKerjaMnt = 0, countKerja = 0;

      Object.entries(byDate).forEach(([tgl, rows]) => {
        // Jam batas per tanggal (pakai periode khusus jika ada)
        const _jamTgl = getJamForTanggal(tgl);
        const mMasukBatas = toMnt(_jamTgl.masuk);
        const mPulangBatas = toMnt(_jamTgl.pulang);

        const jenisList = rows.map(r => (getField(r, 'Jenis Absen', 'jenis', 'Jenis') || '').toUpperCase().trim());
        const rMasuk = rows.find(r => { const j = (getField(r, 'Jenis Absen', 'jenis', 'Jenis') || '').toUpperCase(); return j === 'MASUK' || j.includes('LUAR JAM MASUK') || j.includes('LUAR MASUK'); });
        const rPulang = rows.find(r => { const j = (getField(r, 'Jenis Absen', 'jenis', 'Jenis') || '').toUpperCase(); return j === 'PULANG' || j === 'PULANG LUAR' || j.includes('LUAR JAM PULANG') || j.includes('LUAR PULANG'); });
        const isKet = jenisList.some(j => j === 'IZIN' || j === 'SAKIT' || j === 'TUGAS');

        if (isKet) { hariHadir++; return; }
        if (!rMasuk) return;

        hariHadir++;

        const jamMasuk = rMasuk ? (getField(rMasuk, 'Jam', 'jam') || '').replace(/\s*WITA\s*/i, '').trim() : null;
        const jamPulang = rPulang ? (getField(rPulang, 'Jam', 'jam') || '').replace(/\s*WITA\s*/i, '').trim() : null;
        const mM = toMnt(jamMasuk);
        const mP = toMnt(jamPulang);

        if (mM !== null) {
          sumMasukMnt += mM; countMasuk++;
          const lambat = mM - mMasukBatas;
          if (lambat > 0) { hariTerlambat++; totalLambatMnt += lambat; }
        }
        if (mP !== null) {
          sumPulangMnt += mP; countPulang++;
          const cepat = mPulangBatas - mP;
          if (cepat > 0) { hariCepat++; totalCepatMnt += cepat; }
        }
        if (mM !== null && mP !== null && mP > mM) {
          sumKerjaMnt += (mP - mM); countKerja++;
        }
      });

      const avgMasukMnt = countMasuk ? Math.round(sumMasukMnt / countMasuk) : null;
      const avgPulangMnt = countPulang ? Math.round(sumPulangMnt / countPulang) : null;
      const avgKerjaMnt = countKerja ? Math.round(sumKerjaMnt / countKerja) : null;

      // Disiplin score: persentase hari tanpa terlambat & tanpa pulang cepat dari total hadir
      const disiplinDays = hariHadir - hariTerlambat - hariCepat + Math.min(hariTerlambat, hariCepat); // hari yg keduanya ok
      // Cara lebih tepat: hitung per hari
      let hariDisiplin = 0;
      Object.entries(byDate).forEach(([tgl, rows]) => {
        const _jamTgl2 = getJamForTanggal(tgl);
        const mMasukBatas2 = toMnt(_jamTgl2.masuk);
        const mPulangBatas2 = toMnt(_jamTgl2.pulang);
        const jenisList = rows.map(r => (getField(r, 'Jenis Absen', 'jenis', 'Jenis') || '').toUpperCase().trim());
        const isKet = jenisList.some(j => j === 'IZIN' || j === 'SAKIT' || j === 'TUGAS');
        if (isKet) { hariDisiplin++; return; }
        const rM = rows.find(r => { const j = (getField(r, 'Jenis Absen', 'jenis', 'Jenis') || '').toUpperCase(); return j === 'MASUK' || j.includes('LUAR JAM MASUK'); });
        const rP = rows.find(r => { const j = (getField(r, 'Jenis Absen', 'jenis', 'Jenis') || '').toUpperCase(); return j === 'PULANG' || j === 'PULANG LUAR' || j.includes('LUAR JAM PULANG'); });
        if (!rM) return;
        const mM2 = toMnt((getField(rM, 'Jam', 'jam') || '').replace(/\s*WITA\s*/i, '').trim());
        const mP2 = rP ? toMnt((getField(rP, 'Jam', 'jam') || '').replace(/\s*WITA\s*/i, '').trim()) : null;
        const tepat = (mM2 === null || mM2 <= mMasukBatas2) && (mP2 === null || mP2 >= mPulangBatas2);
        if (tepat) hariDisiplin++;
      });
      const pct = hariHadir > 0 ? Math.round(hariDisiplin / hariHadir * 100) : null;
      const disiplinColor = pct === null ? 'var(--info)' : pct >= 90 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--danger)';

      // Update DOM
      const box = $('akumulasiBox');
      if (box && hariHadir > 0) {
        box.style.display = 'block';
        $('akHadir').textContent = hariHadir;
        $('akTerlambat').textContent = hariTerlambat;
        $('akCepat').textContent = hariCepat;
        $('akTotalLambat').textContent = totalLambatMnt > 0 ? fmtMnt(totalLambatMnt) : '0m';
        $('akTotalCepat').textContent = totalCepatMnt > 0 ? fmtMnt(totalCepatMnt) : '0m';
        $('akEfisiensi').textContent = pct !== null ? pct + '%' : '—';
        $('akEfisiensi').style.color = disiplinColor;
        $('akAvgMasuk').textContent = fmtJam(avgMasukMnt);
        $('akAvgPulang').textContent = fmtJam(avgPulangMnt);
        $('akTotalKerja').textContent = avgKerjaMnt ? fmtMnt(avgKerjaMnt) + '/hr' : '—';
      } else if (box) {
        box.style.display = 'none';
      }
    }
    function filterLog(f, el) {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active')); el.classList.add('active');
      // Untuk card per-hari, filter berdasarkan tanggal yang memenuhi kriteria
      if (f === 'SEMUA') { renderLog(allLogs); return; }
      // Group by tanggal dulu, filter per hari
      const byDate = {};
      allLogs.forEach(r => {
        const tgl = getField(r, 'Tanggal', 'tanggal') || '—';
        if (!byDate[tgl]) byDate[tgl] = [];
        byDate[tgl].push(r);
      });
      const filtered = [];
      Object.entries(byDate).forEach(([tgl, rows]) => {
        const jenis = rows.map(r => (getField(r, 'Jenis Absen', 'jenis', 'Jenis') || '').toUpperCase().trim());
        const adaMasuk = jenis.some(j => j === 'MASUK' || j.includes('LUAR JAM MASUK') || j.includes('LUAR MASUK'));
        const adaIzin = jenis.some(j => j.includes('IZIN'));
        const adaSakit = jenis.some(j => j.includes('SAKIT'));
        const adaTugas = jenis.some(j => j.includes('TUGAS'));
        const adaTubel = jenis.some(j => j.includes('TUBEL'));
        const adaCuti = jenis.some(j => j.includes('CUTI'));
        const adaLapangan = jenis.some(j => j === 'PULANG LUAR');
        const adaAlpa = jenis.some(j => j === 'TANPA BERITA');
        const hadir = adaMasuk || adaIzin || adaSakit || adaTugas || adaTubel || adaCuti;
        if (f === 'HADIR' && hadir) filtered.push(...rows);
        if (f === 'IZIN' && adaIzin) filtered.push(...rows);
        if (f === 'SAKIT' && adaSakit) filtered.push(...rows);
        if (f === 'TUGAS' && adaTugas) filtered.push(...rows);
        if (f === 'TUBEL' && adaTubel) filtered.push(...rows);
        if (f === 'CUTI' && adaCuti) filtered.push(...rows);
        if (f === 'PULANG LUAR' && adaLapangan) filtered.push(...rows);
        if (f === 'TB' && adaAlpa) filtered.push(...rows);
        if (f === 'LIBUR') {
          let _di = -1; try { _di = new Date(tgl + 'T00:00:00').getDay(); } catch (_) { }
          const adaLibur = hariLiburSet.has(tgl) || _di === 0 || _di === 6;
          if (adaLibur) filtered.push(...rows);
        }
      });
      renderLog(filtered);
    }

