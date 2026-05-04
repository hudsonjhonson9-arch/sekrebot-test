/* ════ MEJA ABSEN (1:N MATCHING) ════ */
    /* ════ MEJA ABSEN (1:N matching) ════ */
    window._isMejaMode = false;
    window._mejaProcessing = false;
    let _blinkDetected = false;
    let _lastEyeRatio = 0;
    let _allFaceDescriptors = [];
    let _mejaGpsLocation = null;
    let _mejaCnt = { masuk: 0, pulang: 0, gagal: 0 };

    // Passive Liveness State
    let _livenessScore = 0;
    let _livenessHistory = [];
    let _lastLandmarks = null;
    let _isLive = false;

    function _setMejaStatus(mode, icon, text, sub) {
      const dot = $('mejaStatusDot');
      const ico = $('mejaStatusIcon');
      const txt = $('mejaStatusText');
      const stxt = $('mejaStatusSub');
      if (dot) { dot.className = 'meja-status-dot' + (mode === 'active' ? ' active' : mode === 'processing' ? ' processing' : ''); }
      if (ico) ico.textContent = icon;
      if (txt) txt.textContent = text;
      if (stxt) stxt.textContent = sub || '';
    }

    function _updateMejaCnt() {
      const msk = $('mejaCntMasuk'); if (msk) msk.textContent = _mejaCnt.masuk;
      const plg = $('mejaCntPulang'); if (plg) plg.textContent = _mejaCnt.pulang;
      const ggl = $('mejaCntGagal'); if (ggl) ggl.textContent = _mejaCnt.gagal;
    }

    function _showMejaResult(type, msg) {
      const el = $('mejaResultCard');
      if (!el) return;
      el.className = 'meja-result-card ' + type;
      el.textContent = msg;
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, 4000);
    }

    async function _getMejaGps() {
      return new Promise(resolve => {
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
          pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
          () => resolve(null),
          { timeout: 8000, maximumAge: 30000, enableHighAccuracy: true }
        );
      });
    }
    /* ════ CATATAN: handleMejaLogic telah digantikan oleh logika passive liveness 
       di dalam startDetectLoop untuk akurasi yang lebih baik ════ */

    /**
     * Mulai mode Meja Absen: buka kamera, ambil GPS, dan mulai loop deteksi 1:N.
     * Identifikasi pegawai otomatis tanpa perlu input manual.
     * @returns {Promise<void>}
     */
        async function startMejaAbsen() {
      // 0. RESET TOTAL STATE (Mencegah residu deteksi sebelumnya)
      _lastMejaId = null;
      _lastMejaTime = 0;
      _autoCaptured = false;
      _mejaProcessing = false;
      _mejaStartTime = Date.now(); // Catat waktu mulai
      _mejaCnt = { masuk: 0, pulang: 0, gagal: 0 };
      _updateMejaCnt();

      const btn = $('btnMejaAbsen');
      if (btn) { btn.disabled = true; $('btnMejaText').textContent = '⏳ Memuat Data...'; }
      _setMejaStatus('processing', '⏳', 'Sinkronisasi Sistem...', 'Memuat data & lokasi');

      // 1 & 2. Optimasi: Ambil GPS dan Database secara PARALEL untuk kecepatan maksimal
      try {
        const [gps, res] = await Promise.all([
          _getMejaGps(),
          apiGet(P.faceGetAll)
        ]);

        _mejaGpsLocation = gps;
        const locEl = $('mejaLocVal');
        const accEl = $('mejaLocAccuracy');
        if (_mejaGpsLocation && locEl) {
          locEl.textContent = `${_mejaGpsLocation.lat.toFixed(6)}, ${_mejaGpsLocation.lng.toFixed(6)}`;
          if (accEl) accEl.textContent = `±${Math.round(_mejaGpsLocation.acc)}m`;
        } else if (locEl) {
          locEl.textContent = 'Lokasi GPS Meja Tidak Tersedia';
        }

        if (!res.ok) throw new Error('HTTP ' + res.status);
        const list = parseApiResponse(res.data);

        window._mejaUserMap = {};
        _allFaceDescriptors = list.filter(f => {
          const rawDesc = f.face_histogram || f.descriptor;
          if (!rawDesc) return false;
          let desc;
          try { desc = typeof rawDesc === 'string' ? JSON.parse(rawDesc) : rawDesc; } catch (e) { return false; }
          const dLen = Array.isArray(desc) ? desc.length : 0;

          // Enhanced Matching logic for 1024 dimensions
          const isHumanData = (f.face_model === 'human' || dLen >= 512);
          const isFaceApiData = (f.face_model === 'faceapi' || dLen === 128);

          // Allow all for visibility, we handle mismatch in matching loop
          return dLen === 128 || dLen === 512 || dLen === 1024;
        }).map(f => {
          const rawDesc = f.face_histogram || f.descriptor;
          let desc;
          try { desc = typeof rawDesc === 'string' ? JSON.parse(rawDesc) : rawDesc; } catch (e) { desc = []; }
          const tid = String(f.telegram_id || f.id || '');
          const dLen = desc.length;

          window._mejaUserMap[tid] = {
            nama: f.nama || f.Nama || tid,
            nip: f.nip || f.NIP || '-',
            pangkat: f.pangkat || '',
            engine: f.face_model || (dLen >= 512 ? 'human' : 'faceapi'),
            dim: dLen
          };

          return { id: tid, descriptor: desc, engine: f.face_model || (dLen >= 512 ? 'human' : 'faceapi') };
        });

        if (!_allFaceDescriptors.length) {
          _setMejaStatus('idle', '⚠️', 'Tidak Ada Data Wajah', 'Daftarkan wajah pegawai terlebih dahulu');
          if (btn) { btn.disabled = false; $('btnMejaText').textContent = 'Mulai Meja Absen'; }
          return;
        }

        window._isMejaMode = true; // Set Global State
        window._aiEngine = 'human'; // Force Human-AI for matching accuracy
        _isMejaAbsen = true;

        _setMejaStatus('active', '🔍', `Siap Scan (${_allFaceDescriptors.length} Pegawai)`, 'Menjalankan Kamera...');

        if (btn) btn.style.display = 'none';
        const btnStop = $('btnMejaStop');
        if (btnStop) btnStop.style.display = 'flex';

        // Buka Kamera
        openCamOverlay('meja');
        $('btnCapture').style.display = 'none'; // Sembunyikan tombol capture
        $('livenessMini').style.display = 'block'; // Tampilkan instruksi kedip
        $('camHeaderTitle').textContent = '🖥️ Meja Absen Berjalan...';

      } catch (e) {
        _setMejaStatus('idle', '❌', 'Gagal memuat data wajah', e.message || 'Coba lagi');
        if (btn) { btn.disabled = false; $('btnMejaText').textContent = 'Mulai Meja Absen'; }
      }
    }

    /**
     * Hentikan mode Meja Absen dan tutup kamera.
     * @returns {Promise<void>}
     */
        async function stopMejaAbsen() {
      window._isMejaMode = false;
      _isMejaAbsen = false;
      window._mejaProcessing = false;
      _allFaceDescriptors = [];

      closeCamOverlay(false); // Mematikan kamera & stream (programmatic, bukan oleh user)

      _setMejaStatus('idle', '🖥️', 'Sesi Dihentikan', 'Counter tersimpan di atas');
      const btnStart = $('btnMejaAbsen');
      const btnStop = $('btnMejaStop');
      if (btnStart) { btnStart.style.display = 'flex'; btnStart.disabled = false; $('btnMejaText').textContent = 'Mulai Meja Absen'; }
      if (btnStop) btnStop.style.display = 'none';
    }

