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

  // LOCK PROSES
  if (window._mejaProcessing) return;
  window._mejaProcessing = true;

  // Safety net: Paksa unlock setelah 15 detik jika terjadi hang
  const safetyTimer = setTimeout(() => {
    console.warn('[Meja] Safety timeout! Force-releasing all locks.');
    _isSubmitting = false;
    window._mejaProcessing = false;
    _forceResetAiState(true);
    if ($('mejaOverlayResult')) $('mejaOverlayResult').style.display = 'none';
    _setMejaStatus('active', '⚠️', 'Timeout', 'Server tidak merespons, coba scan ulang');
    startDetectLoop();
  }, 15000);

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

  // JIKA WAJAH DIKENAL (telegramId sekarang berisi NIP dari meja.js)
  const user = window._mejaUserMap[telegramId] || { nama: 'Pegawai', nip: telegramId };
  const score = Math.max(0, Math.round((distance || 0) * 100));

  if ($('moIcon')) $('moIcon').textContent = '⏳';
  if ($('moNama')) $('moNama').textContent = user.nama;
  if ($('moStatus')) {
    $('moStatus').textContent = 'MEMERIKSA STATUS...';
    $('moStatus').style.color = 'var(--gold)';
    $('moStatus').style.background = 'rgba(201,168,76,0.2)';
  }
  if ($('moDetail')) $('moDetail').textContent = `Mencocokkan AI: ${score}%`;

  // ── START SUBMISSION PROCESS ──
  _isSubmitting = true; 
  _setMejaStatus('processing', '⏳', `Mencatat: ${user.nama}...`, 'Tunggu konfirmasi server');

  try {
    const n = nowWITA();
    const payload = {
      telegram_id: user.telegram_id || '', // Tetap kirim telegram_id jika ada
      nama: user.nama,
      nip: user.nip,
      pangkat: user.pangkat || '',
      admin_id: typeof MY_ID !== 'undefined' ? MY_ID : null,
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

    // Paksa NIP masuk ke URL query agar n8n lebih mudah memproses
    const targetPath = P.absen + (P.absen.includes('?') ? '&' : '?') + 'nip=' + encodeURIComponent(user.nip);
    console.log('[Meja] Sending Payload to n8n:', targetPath, payload);

    const { ok: mejaOk, data: d } = await apiPost(targetPath, payload);
    console.log('[Meja] Server Response:', { mejaOk, data: d });

    if (mejaOk && d && d.ok !== false && d.validasi?.is_valid !== false) {
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
      let errMsg = (d && (d.message || d.error)) || 'Ditolak Server';
      if (d && d.validasi && d.validasi.keterangan) errMsg = d.validasi.keterangan;

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
    console.error('[Meja] Submission Fatal Error:', e);
    $('moIcon').textContent = '🔌';
    $('moStatus').textContent = 'GAGAL PROSES';
    $('moStatus').style.color = '#f87171';
    $('moStatus').style.background = 'rgba(248,113,113,0.2)';
    $('moDetail').textContent = e.message || 'Terjadi kesalahan sistem';
    _mejaCnt.gagal++;
    _setMejaStatus('active', '🔌', 'System Error', e.message);
  } finally {
    clearTimeout(safetyTimer); 
    _isSubmitting = false; 
    _updateMejaCnt();
    setTimeout(() => {
      if ($('mejaOverlayResult')) $('mejaOverlayResult').style.display = 'none';
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
