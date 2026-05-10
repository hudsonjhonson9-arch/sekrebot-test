/* ════ UI — TABS, CLOCK, JAM UTILS ════ */
    /* ════ ADMIN TAB SETUP ════ */
    // Dipanggil oleh _applyAdminUI() setelah ADMIN_IDS dimuat dari server
    function setupAdminTab() {
      const existing = document.querySelector('.nav-item[data-tab="admin"]');
      if (existing) return;
      const btn = document.createElement('button');
      btn.className = 'nav-item admin-tab';
      btn.setAttribute('data-tab', 'admin');
      btn.innerHTML = '<i class="fas fa-cog"></i><span>Admin</span>';
      btn.onclick = () => switchTab('admin');
      $('tabsBar').appendChild(btn);
    }

    /**
     * Aktifkan section dalam panel admin.
     * @param {string} sectionId - ID section: 'ops' | 'libur' | 'lokasi' | 'jam' | dll
     */
        function switchAdminSection(sectionId) {
      if (!sectionId) sectionId = localStorage.getItem('absen_last_admin_section') || 'ops';
      localStorage.setItem('absen_last_admin_section', sectionId);

      // Hide all sections
      document.querySelectorAll('.admin-section').forEach(s => {
        if (s) s.style.display = 'none';
      });
      // Show Target
      const target = $('admin-section-' + sectionId);
      if (target) {
        target.style.display = 'block';
        target.style.animation = 'fadeIn 0.4s ease forwards';
      }

      // Update Button State
      document.querySelectorAll('.admin-nav-btn').forEach(btn => {
        if (btn) btn.classList.remove('active');
        if (btn && btn.id === 'btn-nav-' + sectionId) btn.classList.add('active');
      });

      // Special handling for specific sections
      if (sectionId === 'ops') {
        loadKonfirmasiAdmin();
        if (typeof adminLoadKetPegawai === 'function') adminLoadKetPegawai();
      }
      if (sectionId === 'user') loadAdminFaceReg();

      // Fix Leaflet Map rendering if switching to Config
      if (sectionId === 'config' && typeof adminMap !== 'undefined' && adminMap) {
        setTimeout(() => adminMap.invalidateSize(), 50);
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }



    async function checkHumanJsCache() {
      const statusEl = $('humanJsStatus');
      const btnEl = $('btnDownloadHumanJs');
      if (statusEl) statusEl.textContent = 'Memeriksa...';

      let cached = null;
      try {
        cached = await idb.get('master_data', 'human_script');
      } catch (e) {
        console.warn('Gagal memeriksa cache Human.js:', e);
      }

      if (cached && cached.blob) {
        if (statusEl) { statusEl.textContent = '✅ Tersedia (Offline Ready)'; statusEl.style.color = 'var(--success)'; }
        if (btnEl) btnEl.style.display = 'none';
        if ($('btnClearHumanJs')) dom.show('btnClearHumanJs', 'flex');
        return true;
      } else {
        if (statusEl) { statusEl.textContent = '❌ Belum Didownload'; statusEl.style.color = 'var(--warning)'; }
        if (btnEl) btnEl.style.display = 'flex';
        if ($('btnClearHumanJs')) dom.hide('btnClearHumanJs');
        return false;
      }
    }

    async function clearHumanJsCache() {
      if (confirm('Hapus file Human.js dari cache lokal? Anda harus download ulang jika ingin menggunakannya tanpa internet.')) {
        await idb.delete('master_data', 'human_script');
        alert('File lokal berhasil dihapus!');
        await checkHumanJsCache();
      }
    }

    async function downloadHumanJsOffline() {
      const btn = $('btnDownloadHumanJs');
      if (btn) { btn.innerHTML = '⏳ Mendownload... (0%)'; btn.disabled = true; }
      try {
        const response = await fetch(HUMAN_CDN);
        if (!response.ok) throw new Error('Response tidak OK');

        const contentLength = response.headers.get('content-length');
        if (!contentLength) {
          const blob = await response.blob();
          await idb.set('master_data', { key: 'human_script', blob: blob });
        } else {
          const total = parseInt(contentLength, 10);
          let loaded = 0;
          const reader = response.body.getReader();
          const chunks = [];

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            const progress = Math.round((loaded / total) * 100);
            if (btn) btn.innerHTML = `⏳ Mendownload... (${progress}%)`;
          }
          const blob = new Blob(chunks, { type: 'application/javascript' });
          await idb.set('master_data', { key: 'human_script', blob: blob });
        }

        alert('✅ Human.js berhasil didownload dan disimpan ke penyimpanan lokal perangkat!');
        await checkHumanJsCache();
      } catch (err) {
        alert('❌ Gagal mendownload Human.js: ' + err.message);
        if (btn) { btn.innerHTML = '📥 Coba Lagi Download (Offline)'; btn.disabled = false; }
      }
    }


    // Sembunyikan panel admin dulu sampai ADMIN_IDS dimuat
    if ($('panel-admin')) dom.hide('panel-admin');

    /* ════ TABS ════ */
    function getAllTabs() { 
      const tabs = ['absen', 'ket', 'rekap', 'profil'];
      if (IS_ADMIN) tabs.push('admin');
      // Always allow checking, visibility is handled via checkTugasLemburAccess
      tabs.push('tugas', 'lembur');
      return tabs;
    }
    /**
     * Aktifkan tab panel berdasarkan nama tab.
     * @param {string} tab - Nama tab: 'absen' | 'ket' | 'rekap' | 'profil' | 'admin'
     */
        function switchTab(tab) {
      if (!tab) tab = localStorage.getItem('absen_last_tab') || 'absen';
      const T = getAllTabs();
      if (!T.includes(tab)) tab = 'absen';

      localStorage.setItem('absen_last_tab', tab);
      window.scrollTo(0, 0);
      document.querySelectorAll('.nav-item').forEach((t) => {
        if (t) t.classList.toggle('active', t.getAttribute('data-tab') === tab);
      });
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      const el = $('panel-' + tab); if (el) el.classList.add('active');

      if (tab === 'absen') {
        updateClock(); // refresh notif & batas jam periode segera
        if (!networkInfo.checked) cekJaringan(); // auto cek jaringan saat buka tab absen
      }
      if (tab === 'ket' && !ketStatusLoaded) loadKetStatus();
      if (tab === 'profil' && !logLoaded) loadLog();
      if (tab === 'profil' && !dokumenLoaded) loadDokumen();
      if (tab === 'rekap' && !rekapLoaded) loadRekap();
      if (tab === 'admin' && IS_ADMIN) {
        // Remove forced section reset to 'ops' to preserve user context
        initAdminMap(); initJamAdminUI(); _initPeriodeListeners();
        if (!adminLoaded) {
          adminLoaded = true;
          loadKonfirmasiAdmin(); loadLiburAdmin();
          loadJamPeriodeAdmin(); loadAdminMgmt();
          setTimeout(() => switchFaceSigTab('data'), 300);
          loadFaceStatusAdmin();

          // Initialize Human.js Cache Check
          checkHumanJsCache();
        }
        setTimeout(() => {
          if (typeof loadAdminFaceReg === 'function') loadAdminFaceReg();
          if (typeof loadAdminSigStatus === 'function') loadAdminSigStatus();
          // Ensure Admin UI elements are fully applied after render
          if (typeof _applyAdminUIExtended === 'function') _applyAdminUIExtended();
        }, 50); // Reduced delay for better responsiveness

        // Immediate check as well
        if (typeof _applyAdminUIExtended === 'function') _applyAdminUIExtended();
      }
      // Auto-load tanda tangan saat buka tab profil
      if (tab === 'profil') {
        if (typeof loadMySignature === 'function') loadMySignature();
      }

      if (tab === 'tugas') {
        if (typeof initTugasMap === 'function') {
          initTugasMap();
          // Ensure map renders correctly if it was hidden
          setTimeout(() => { if (typeof _tugasMap !== 'undefined' && _tugasMap) _tugasMap.invalidateSize(); }, 300);
        }
      }
      if (tab === 'lembur') {
        // init lembur logic if needed
      }

      // Re-apply role based visibility on every switch to ensure consistency
      if (typeof checkTugasLemburAccess === 'function') checkTugasLemburAccess();
    }

    /* ════ JAM ABSEN GLOBAL (bisa diubah admin) ════ */
    // Default: masuk ≤ 08:00, pulang ≥ 14:30
    // JAM_MASUK_MENIT dan JAM_PULANG_MENIT sudah di-declare di constants.js
    // Di-override lewat loadJamFromStorage() & loadJamAbsen()
    function toMenitStr(str) { const [h, m] = (str || '').split(':').map(Number); return (isNaN(h) || isNaN(m)) ? null : h * 60 + m; }
    function menitToStr(m) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }

    /* ════ JAM PERIODE KHUSUS (Ramadan, dll) ════ */
    let jamPeriodeList = []; // [{id, nama, dari:'YYYY-MM-DD', sampai:'YYYY-MM-DD', masuk:'HH:MM', pulang:'HH:MM'}]

    function normToISO(tgl) {
      if (!tgl) return '';
      const s = String(tgl).trim();
      // DD/MM/YYYY → YYYY-MM-DD
      const dm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (dm) return `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
      // DD-MM-YYYY → YYYY-MM-DD  (pisah dash, bukan YYYY-MM-DD)
      const dd = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (dd) return `${dd[3]}-${dd[2].padStart(2, '0')}-${dd[1].padStart(2, '0')}`;
      // Strip time component: "YYYY-MM-DDTHH:MM..." atau "YYYY-MM-DD HH:MM..."
      const dt = s.match(/^(\d{4}-\d{2}-\d{2})[T ].*$/);
      if (dt) return dt[1];
      // Sudah ISO date (YYYY-MM-DD) — validasi format ketat
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      return ''; // format tidak dikenal → kembalikan kosong agar tidak lolos guard
    }

    // Regex untuk validasi tanggal ISO final setelah normalisasi
    const _ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

    /**
     * Dapatkan jam masuk & pulang yang berlaku untuk tanggal tertentu.
     * Mempertimbangkan periode khusus (Ramadan, dll) dan jam default.
     * @param {string} tglStr - Tanggal format YYYY-MM-DD
     * @returns {{masuk: string, pulang: string, nama: string|null}}
     */
        function getJamForTanggal(tglStr) {
      // Prioritas: 1) Periode khusus aktif di tanggal tsb → 2) Global default
      const t = normToISO(tglStr);
      if (!t || !_ISO_RE.test(t)) return { masuk: menitToStr(JAM_MASUK_MENIT), pulang: menitToStr(JAM_PULANG_MENIT), nama: null };

      // Konversi ke timestamp numerik untuk perbandingan yang akurat (hindari string comparison bug)
      const tMs = new Date(t + 'T00:00:00').getTime();
      if (isNaN(tMs)) return { masuk: menitToStr(JAM_MASUK_MENIT), pulang: menitToStr(JAM_PULANG_MENIT), nama: null };

      const periode = jamPeriodeList.find(p => {
        // Normalisasi ulang untuk jaga-jaga jika data dari server belum ter-normalisasi
        const dari = _ISO_RE.test(p.dari) ? p.dari : normToISO(p.dari || '');
        const sampai = _ISO_RE.test(p.sampai) ? p.sampai : normToISO(p.sampai || '');
        // Guard ketat: wajib format YYYY-MM-DD valid & tidak kosong
        if (!dari || !sampai || !_ISO_RE.test(dari) || !_ISO_RE.test(sampai)) return false;
        // Gunakan perbandingan numerik (timestamp) agar tidak ada bug string comparison
        const dariMs = new Date(dari + 'T00:00:00').getTime();
        const sampaiMs = new Date(sampai + 'T00:00:00').getTime();
        if (isNaN(dariMs) || isNaN(sampaiMs)) return false;
        // Tanggal harus benar-benar di DALAM range [dari, sampai] (inklusif)
        return tMs >= dariMs && tMs <= sampaiMs;
      });

      if (periode && periode.masuk && periode.pulang) {
        return { masuk: periode.masuk, pulang: periode.pulang, nama: periode.nama };
      }
      // Tidak ada periode yang cocok → gunakan jam global
      return { masuk: menitToStr(JAM_MASUK_MENIT), pulang: menitToStr(JAM_PULANG_MENIT), nama: null };
    }

    async function fetchJamPeriode() {
      try {
        const { ok: jpOk, data: json } = await apiGet(P.jamPeriodeList);
        if (!jpOk) return;
        const list = json?.data || json?.list || parseApiResponse(json);
        jamPeriodeList = list.map(p => ({
          id: p.id || p.ID || p.Id || '',
          nama: p.nama || p.Nama || p.name || p.Name || '',
          dari: normToISO(p.dari || p.Dari || p.dari_tanggal || p.start_date || p.startDate || ''),
          sampai: normToISO(p.sampai || p.Sampai || p.sampai_tanggal || p.end_date || p.endDate || ''),
          masuk: (p.masuk || p.Masuk || p.jam_masuk || p.jamMasuk || '').toString().trim(),
          pulang: (p.pulang || p.Pulang || p.jam_pulang || p.jamPulang || '').toString().trim(),
        })).filter(p => {
          // Filter ketat: dari & sampai wajib valid ISO, masuk & pulang wajib ada & format HH:MM
          if (!_ISO_RE.test(p.dari) || !_ISO_RE.test(p.sampai)) return false;
          if (!p.masuk || !p.pulang) return false;
          // Validasi format waktu HH:MM (dengan toleransi H:MM)
          if (!/^\d{1,2}:\d{2}$/.test(p.masuk) || !/^\d{1,2}:\d{2}$/.test(p.pulang)) return false;
          // Pastikan dari <= sampai (periode tidak terbalik)
          const dariMs = new Date(p.dari + 'T00:00:00').getTime();
          const sampaiMs = new Date(p.sampai + 'T00:00:00').getTime();
          if (isNaN(dariMs) || isNaN(sampaiMs) || dariMs > sampaiMs) return false;
          return true;
        });
      } catch (_) { }
      // Debug: log periode yang berhasil dimuat (bisa dilihat di Console browser)
      if (jamPeriodeList.length) {
        console.log('[JamPeriode] Loaded', jamPeriodeList.length, 'periode:', jamPeriodeList.map(p => `${p.nama}: ${p.dari}→${p.sampai} (masuk:${p.masuk}, pulang:${p.pulang})`));
      } else {
        console.log('[JamPeriode] Kosong / tidak ada periode aktif');
      }
    }

    // Load dari localStorage jika admin pernah simpan
    (function loadJamFromStorage() {
      try {
        const s = localStorage.getItem('jam_absen_bapperida');
        if (s) {
          const j = JSON.parse(s);
          if (j.masuk) JAM_MASUK_MENIT = toMenitStr(j.masuk) ?? JAM_MASUK_MENIT;
          if (j.pulang) JAM_PULANG_MENIT = toMenitStr(j.pulang) ?? JAM_PULANG_MENIT;
        }
      } catch (_) { }
    })();
    /**
     * Update tampilan jam dan tanggal di clock card secara real-time.
     * Dipanggil setiap detik via setInterval.
     */
        function updateClock() {
      const n = nowWITA(), h = n.getDay(), tot = n.getHours() * 60 + n.getMinutes();
      $('clockTime').innerHTML = `${p2(n.getHours())}<span>:</span>${p2(n.getMinutes())}<span>:</span>${p2(n.getSeconds())}`;
      $('clockDate').textContent = n.toLocaleDateString('id-ID', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const _hEl = $('hariIni'); if (_hEl) _hEl.textContent = H_DISP[h];

      // ── Gunakan jam periode aktif hari ini (bukan selalu jam global) ──
      const _tglHari = n.toLocaleDateString('sv-SE', { timeZone: TZ }); // YYYY-MM-DD
      const _jamHari = getJamForTanggal(_tglHari);
      const _jamMasukHari = toMenitStr(_jamHari.masuk) ?? JAM_MASUK_MENIT;
      const _jamPulangHari = toMenitStr(_jamHari.pulang) ?? JAM_PULANG_MENIT;
      const jmStr = _jamHari.masuk, jpStr = _jamHari.pulang;

      let jenis = '', batas = '';
      if (tot <= _jamMasukHari) { jenis = `🟢 Waktu Absen Masuk${_jamHari.nama ? ' 🌙 ' + _jamHari.nama : ''}`; batas = `Masuk ≤ ${jmStr}` }
      else if (tot >= _jamPulangHari) { jenis = '🔵 Waktu Absen Pulang'; batas = `Pulang ≥ ${jpStr}` }
      else if (tot < 720) { jenis = '🔴 Di luar jam masuk'; batas = 'Terlambat' }
      else { jenis = '🟡 Belum Waktunya Pulang'; batas = `Pulang ≥ ${jpStr}` }
      $('jenisAbsen').textContent = jenis;
      $('batasAbsen').textContent = batas;
      const isJamPulang = tot >= _jamPulangHari;
      const btnPL = $('btnPulangLuar'), formPL = $('pulangLuarForm');
      if (btnPL) btnPL.classList.toggle('show', isJamPulang && !btnPL.disabled);
      if (formPL) formPL.classList.toggle('show', isJamPulang && !$('btnPulangLuar')?.disabled);
      const lh = LOK_DEF[H_ID[h]] || [];
      $('lokasiList').innerHTML = lh.length
        ? lh.map(l => `<div class="lokasi-item"><div class="lokasi-dot"></div><div class="lokasi-name">${l}</div></div>`).join('')
        : `<div class="lokasi-item"><div class="lokasi-dot" style="background:var(--danger)"></div><div class="lokasi-name" style="color:var(--muted)">Tidak ada lokasi aktif hari ini</div></div>`;
    }
    updateClock(); setInterval(updateClock, 1000);

    // Setiap menit: cek ulang periode jam (jika berganti periode, re-enable tombol jika belum absen di periode baru)
    // Inisialisasi dengan nilai aktual saat ini agar interval pertama tidak langsung memanggil loadTodayHistory()
    function _hitungJenisPeriode() {
      const _n = nowWITA();
      const _tot = _n.getHours() * 60 + _n.getMinutes();
      const _tgl = _n.toLocaleDateString('sv-SE', { timeZone: TZ });
      const _jH = getJamForTanggal(_tgl);
      const _jmH = toMenitStr(_jH.masuk) ?? JAM_MASUK_MENIT;
      const _jpH = toMenitStr(_jH.pulang) ?? JAM_PULANG_MENIT;
      if (_tot <= _jmH) return 'MASUK';
      else if (_tot < 720) return 'DI LUAR JAM MASUK';
      else if (_tot < _jpH) return 'DI LUAR JAM PULANG';
      else return 'PULANG';
    }
    let _lastJenisPeriode = _hitungJenisPeriode(); // nilai awal = kondisi saat halaman dimuat
    setInterval(() => {
      const j = _hitungJenisPeriode();
      if (j !== _lastJenisPeriode) {
        _lastJenisPeriode = j;
        // Periode berubah — reload history agar tombol dievaluasi ulang
        if (typeof loadTodayHistory === 'function') loadTodayHistory();
      }
    }, 30000); // cek tiap 30 detik

