/* ════ MEJA MATCH HANDLER & ADMIN OVERRIDES ════ */
    let _lastMejaTime = 0;

    async function _onMejaAbsenMatchFound(telegramId, descriptor, dataUrl, distance) {
      const sekarang = Date.now();

      // 1. SISTEM ANTI-SPAM (COOLDOWN)
      // Jika orang yang sama di-scan lagi dalam waktu kurang dari 20 detik, abaikan.
      if (telegramId !== 'unknown' && telegramId === _lastMejaId && (sekarang - _lastMejaTime) < 20000) {
        console.log("User sama terdeteksi terlalu cepat, mengabaikan scan ganda.");
        setTimeout(() => {
          _forceResetAiState(true);
          _autoCaptured = false;
          startDetectLoop();
          setCamStatus('ok', '🔍', 'Siap Scan...', 'Posisikan wajah pegawai selanjutnya');
        }, 1500);
        return;
      }

      // 2. LOCK PROSES
      if (window._mejaProcessing) return;
      window._mejaProcessing = true;

      // 3. STOP DETEKSI SEGERA
      // Matikan deteksi wajah agar tidak menumpuk saat proses kirim data
      stopDetectLoop();

      // Update tracker terakhir
      _lastMejaId = telegramId;
      _lastMejaTime = sekarang;

      const overlay = $('mejaOverlayResult');
      overlay.style.display = 'flex';

      // JIKA WAJAH TIDAK DIKENAL
      if (telegramId === 'unknown') {
        $('moIcon').textContent = '❓';
        $('moNama').textContent = 'TIDAK DIKENAL';
        $('moStatus').textContent = 'WAJAH BELUM TERDAFTAR';
        $('moStatus').style.color = 'var(--danger)';
        $('moStatus').style.background = 'rgba(239,68,68,0.2)';
        $('moDetail').textContent = 'Mulai ulang scan dalam 3 detik...';

        _mejaCnt.gagal++;
        _updateMejaCnt();
        _setMejaStatus('active', '⚠️', 'Wajah Tak Dikenal', 'Pegawai tidak terdaftar di sistem');

        setTimeout(() => {
          overlay.style.display = 'none';
          _forceResetAiState(true);
          window._mejaProcessing = false;

          const vid = $('camVideo');
          if (vid && vid.paused) vid.play().catch(() => { });
          startDetectLoop();
        }, 3000);
        return;
      }

      // JIKA WAJAH DIKENAL
      const user = window._mejaUserMap[telegramId] || { nama: 'Pegawai', nip: '-' };
      const score = Math.max(0, Math.round((distance || 0) * 100)); // Arg 'distance' is now passing similarity score (0-1)

      $('moIcon').textContent = '⏳';
      $('moNama').textContent = user.nama;
      $('moStatus').textContent = 'MEMERIKSA STATUS...';
      $('moStatus').style.color = 'var(--gold)';
      $('moStatus').style.background = 'rgba(201,168,76,0.2)';
      $('moDetail').textContent = `Mencocokkan AI: ${score}%`;

      _setMejaStatus('processing', '⏳', `Mencatat: ${user.nama}...`, 'Tunggu konfirmasi server');

      _isSubmitting = true; // LOCK SUBMISSION
      const n = nowWITA();
      const payload = {
        telegram_id: telegramId,
        nama: user.nama,
        nip: user.nip,
        pangkat: user.pangkat || '',
        admin_id: MY_ID,
        jam: `${p2(n.getHours())}:${p2(n.getMinutes())}:${p2(n.getSeconds())} WITA`,
        tanggal_iso: fmtD(n),
        latitude: _mejaGpsLocation?.lat ?? 0,
        longitude: _mejaGpsLocation?.lng ?? 0,
        accuracy: _mejaGpsLocation?.acc ?? 0,
        lokasi_nama: 'Meja Absen',
        face_match: score,
        timestamp: Math.floor(Date.now() / 1000),
        source: 'meja_absen'
      };

      try {
        const { ok: mejaOk, data: res } = await apiPost(P.absen, payload);
        const d = res.catch(() => ({}));

        if (mejaOk && d.ok !== false && d.validasi?.is_valid !== false) {
          const jenis = d.jenis_absen || d.validasi?.jenis_absen || 'ABSEN BERHASIL';
          const ismasuk = jenis.toUpperCase().includes('MASUK');
          if (ismasuk) _mejaCnt.masuk++; else _mejaCnt.pulang++;

          $('moIcon').textContent = '✅';
          $('moStatus').textContent = jenis.toUpperCase();
          $('moStatus').style.color = '#4ade80';
          $('moStatus').style.background = 'rgba(74,222,128,0.2)';
          $('moDetail').textContent = d.validasi?.keterangan || 'Data tercatat di server.';
          _setMejaStatus('active', '✅', `${user.nama} — ${jenis}`, 'Siap scan berikutnya...');
        } else {
          let errMsg = d.message || d.error || 'Ditolak Server';
          if (d.validasi && d.validasi.keterangan) errMsg = d.validasi.keterangan;

          const isSudah = errMsg.toLowerCase().includes('sudah');

          $('moIcon').textContent = isSudah ? 'ℹ️' : '❌';
          $('moStatus').textContent = isSudah ? 'SUDAH ABSEN' : 'GAGAL';
          $('moStatus').style.color = isSudah ? '#60a5fa' : '#f87171';
          $('moStatus').style.background = isSudah ? 'rgba(96,165,250,0.2)' : 'rgba(248,113,113,0.2)';
          $('moDetail').textContent = errMsg;

          if (!isSudah) _mejaCnt.gagal++;
          _setMejaStatus('active', isSudah ? 'ℹ️' : '⚠️', user.nama, errMsg);
        }
      } catch (e) {
        $('moIcon').textContent = '🔌';
        $('moStatus').textContent = 'KONEKSI TERPUTUS';
        $('moStatus').style.color = '#f87171';
        $('moStatus').style.background = 'rgba(248,113,113,0.2)';
        $('moDetail').textContent = 'Gagal menghubungi server absen';
        _mejaCnt.gagal++;
        _setMejaStatus('active', '🔌', 'Server Offline', 'Pastikan n8n berjalan');
      } finally {
        _isSubmitting = false; // UNLOCK SUBMISSION
        _updateMejaCnt();
        setTimeout(() => {
          overlay.style.display = 'none';
          _forceResetAiState(true);
          window._mejaProcessing = false;
          setCamStatus('ok', '🔍', 'Siap Scan...', 'Posisikan wajah pegawai selanjutnya');

          const vid = $('camVideo');
          if (vid && vid.paused) {
            vid.play().catch(e => console.warn('Gagal play video otomatis:', e));
          }
          startDetectLoop();
        }, 3500);
      }
    }

    // ── Override existing openSignaturePad for Admin Support ──
    const _origOpenSignaturePad = openSignaturePad;
    openSignaturePad = function (telegramId, callback) {
      _sigTargetId = telegramId || MY_ID;
      _sigCallback = callback || null;

      const titleEl = $('sigOverlayTitle');
      if (titleEl) {
        const isOwn = String(_sigTargetId) === String(MY_ID);
        if (!isOwn) {
          // Find name from list if admin is capturing for someone else
          titleEl.textContent = `✍️ TTD: ${telegramId}`;
        }
      }
      _origOpenSignaturePad(telegramId, callback);
    };

    // ── Admin: Capture Signature Helper ──
    function adminCaptureSignatureFor(uid, name) {
      openSignaturePad(uid, (dataUrl) => {
        // Optional refresh after save
        loadAdminFaceReg();
      });
      const titleEl = $('sigOverlayTitle');
      if (titleEl) titleEl.textContent = `✍️ TTD: ${name}`;
    }

    // Auto-init Desktop Mode jika di layar laptop/PC
    setTimeout(() => { try { if (typeof initDesktopMode === 'function') initDesktopMode(); } catch (_) { } }, 1000);
