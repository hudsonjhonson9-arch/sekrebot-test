/* ════ FACE RECOGNITION & CAMERA ════ */
    /* ════════════════════════════════════════════════════════════════
       SISTEM VERIFIKASI WAJAH & SERAGAM — BAPPERIDA Sumba Barat v1.0
       ════════════════════════════════════════════════════════════════
       Alur:
       1. handleAbsen() → buka modal kamera → openCamOverlay()
       2. Muat model BlazeFace (cached setelah pertama kali)
       3. Loop deteksi: wajah → liveness (kedip + geleng) → warna baju
       4. doCapture() → ambil foto → encode base64
       5. Lanjutkan GPS + kirim payload dengan foto
       ════════════════════════════════════════════════════════════════ */



    let _camStream = null;
    let _blazeModel = null;
    let _modelLoading = false;
    let _detectLoop = null;
    let _liveMatchTimer = null; // interval untuk live face match di overlay kamera
    let _autoCaptured = false; // flag agar auto-capture hanya sekali per sesi
    let _lastHumanScore = '0.00'; // Untuk debugging liveness score Human.js
    let _faceHistory = [];   // riwayat posisi hidung untuk deteksi geleng
    let _eyeHistory = [];   // riwayat eye aspect ratio untuk deteksi kedip
    let _noseYHistory = [];   // riwayat posisi hidung vertikal untuk deteksi angguk
    let _livenessState = { faceOk: false, ch1: false, ch2: false };
    let _captureData = null; // { dataUrl, faceOk, livenessOk, faceMatchScore }
    let _absenCallbackAfterCam = null; // fungsi yang dipanggil setelah kamera selesai
    let _skipVerifikasi = false;

    // Tantangan liveness ditiadakan sesuai permintaan
    function pickRandomChallenges() { return []; }
    function buildLivenessStepsUI() { }

    // ── Face Recognition helpers (face-api.js descriptor-based) ──
    const FACE_STORE_KEY = STORAGE_KEYS.FACE_REF;  // v2: descriptor-based
    const FACE_STORE_KEY_OLD = 'face_ref_bapperida'; // v1 histogram (for cleanup)
    let FACE_RECOGNITION_ENABLED = true; // default aktif, diupdate dari server via admin toggle

    function getFaceRef() {
      try {
        if (window._faceRefCache && window._faceRefCache[String(MY_ID || '')]) {
          return window._faceRefCache[String(MY_ID || '')];
        }
        const raw = localStorage.getItem(FACE_STORE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return data[String(MY_ID || '')] || null;
      } catch (_) { return null; }
    }

    function _writeFaceRefLocal(uid, faceData) {
      if (!uid) return;
      try {
        // Jangan simpan dataUrl (foto base64) di localStorage untuk hemat ruang
        const storageData = { ...faceData };
        delete storageData.dataUrl;
        delete storageData.foto_base64;

        const raw = localStorage.getItem(FACE_STORE_KEY);
        const data = raw ? JSON.parse(raw) : {};
        data[uid] = storageData;
        localStorage.setItem(FACE_STORE_KEY, JSON.stringify(data));
      } catch (_) { }

      // Tetap simpan lengkap di RAM cache untuk tampilan saat ini
      if (!window._faceRefCache) window._faceRefCache = {};
      window._faceRefCache[uid] = faceData;
    }

    // ── Extract face descriptor menggunakan Human.js ──
    async function getFaceDescriptor(input) {
      let waitStart = Date.now();
      while (_isDetecting && (Date.now() - waitStart < 3000)) {
        await new Promise(r => setTimeout(r, 50));
      }
      const prevDetectState = _isDetecting;
      _isDetecting = true;
      try {
        if (!HumanInstance) return null;
        const res = await _detectWithTimeout(input, 8000);
        return (res && res.face && res.face.length > 0) ? res.face[0].embedding : null;
      } catch (e) {
        if (e.message === 'AI_TIMEOUT') setCamStatus('warn', '⚠️', 'AI Terlalu Lambat', '...');
        return null;
      } finally {
        _isDetecting = prevDetectState;
      }
    }

    // ── Extract descriptor from dataUrl (dengan retry 3x) ──
    async function getDescriptorFromDataUrl(dataUrl) {
      if (!dataUrl) return null;
      const extract = async () => {
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          const timeout = setTimeout(() => resolve(null), 15000); // 15 detik
          img.onload = async () => {
            clearTimeout(timeout);
            const cnv = document.createElement('canvas');
            cnv.width = img.width; cnv.height = img.height;
            cnv.getContext('2d').drawImage(img, 0, 0);
            const descriptor = await getFaceDescriptor(img);
            resolve(descriptor);
          };
          img.onerror = () => { clearTimeout(timeout); resolve(null); };
          img.src = dataUrl;
        });
      };
      // Retry 3x
      for (let i = 0; i < 3; i++) {
        const d = await extract();
        if (d) return d;
        await new Promise(r => setTimeout(r, 500));
      }
      return null;
    }

    async function syncFaceToServer(uid, dataUrl, descriptorArray, nama, savedAt) {
      if (!uid || uid === 'null' || uid === '') return false;
      const dLen = (descriptorArray && Array.isArray(descriptorArray)) ? descriptorArray.length : 0;
      const actualModel = dLen >= 512 ? 'human' : 'faceapi';

      const payload = {
        user_id: uid,
        nip: localStorage.getItem('MY_NIP') || '',
        nama: nama || 'Pegawai',
        foto_base64: dataUrl,
        face_descriptor: descriptorArray,
        face_model: actualModel, // Detect from dimension to avoid fallback-induced mismatch
        saved_at: savedAt || new Date().toISOString(),
        savedBy: MY_ID,
        savedByName: (tgUser && tgUser.first_name) || 'System'
      };

      try {
        const { ok: faceRegOk, data: res } = await apiPost(P.faceRegister, payload);
        
        console.log(`[AI] Sync Response Status: ${200}`);
        
        if (faceRegOk) {
          try {
            const json = res;
            // Upate local cache (memory only for image)
            _writeFaceRefLocal(uid, {
              dataUrl: json.dataUrl || dataUrl,
              descriptor: descriptorArray,
              savedAt: payload.saved_at
            });
            if (typeof loadAdminFaceReg === 'function' && IS_ADMIN) {
              loadAdminFaceReg();
            }
            return true;
          } catch (e) {
            console.error('[AI] JSON Parse Error:', e);
            return true;
          }
        } else {
          try {
            const errJson = res;
            console.error('[AI] Sync Failed Detail:', errJson);
            window._lastAiError = errJson.message || errJson.error || `HTTP ${200}`;
          } catch (_) {
            window._lastAiError = `Server Error (HTTP ${200})`;
          }
          return false;
        }
      } catch (e) {
        console.warn('Sync face server error:', e);
        // Optimasi: Simpan error di window agar bisa dibaca caller jika butuh detail
        window._lastAiError = e.message;
        return false;
      }
    }

    /**
     * Simpan referensi wajah user sendiri ke server dan localStorage.
     * @param {string} dataUrl - Foto wajah (data URL)
     * @param {number[]|Float32Array} descriptor - Descriptor vektor wajah
     * @returns {Promise<void>}
     */
        async function saveFaceRef(dataUrl, descriptor) {
      try {
        const uid = String(MY_ID || '');
        const savedAt = new Date().toISOString();
        let descriptorToSave = descriptor ? Array.from(descriptor) : null;

        if (!descriptorToSave && dataUrl) {
          setCamStatus('ok', '🔍', 'Verifikasi data wajah...', 'Sedang mencocokkan AI');
          const desc = await getDescriptorFromDataUrl(dataUrl);
          if (desc) descriptorToSave = Array.from(desc);
        }

        if (!descriptorToSave) {
          setCamStatus('bad', '❌', 'Wajah Tidak Jelas', 'Pastikan wajah menghadap lurus ke kamera');
          return false;
        }

        setCamStatus('ok', '📡', 'Mengirim...', 'Menyimpan ke server');
        const ok = await syncFaceToServer(uid, dataUrl, descriptorToSave, tgUser.first_name, savedAt);
        if (ok) {
          updateProfilFaceUI();
        } else {
          setCamStatus('bad', '❌', 'Gagal Simpan', window._lastAiError || 'Server tidak merespons');
        }
        return ok;
      } catch (err) { 
        setCamStatus('bad', '❌', 'Error', err.message);
        return false; 
      }
    }

    async function loadFaceFromServer() {
      const uid = await waitForMyId();
      if (!uid) return;
      const uidStr = String(uid);
      try {
        const res = await apiGet(P.faceGet, { user_id: uidStr });
        if (!res.ok) return;
        // data may be object {face_photo, descriptor} or wrapped in array
        const rawFace = res.rows.length ? res.rows[0] : res.data;
        const json = Array.isArray(rawFace) ? rawFace[0] : (rawFace ?? {});
        const photo = json.face_photo || json.dataUrl || json.foto_base64 || null;
        const descriptor = json.face_histogram || json.face_descriptor || json.descriptor || json.histogram || null;
        const savedAt = json.face_saved_at || json.saved_at || json.savedAt || new Date().toISOString();
        const faceModel = json.face_model || (descriptor && JSON.parse(descriptor).length >= 512 ? 'human' : 'faceapi');

        if (photo) {
          _writeFaceRefLocal(uidStr, { dataUrl: photo, descriptor, savedAt, faceModel });
          updateProfilFaceUI();
          updateFaceRegUI();
        }
      } catch (_) { }
    }

    // ── Euclidean distance between two 128-d descriptors ──
    /**
     * Hitung Euclidean distance antara dua descriptor wajah.
     * Semakin kecil nilai, semakin mirip (0 = identik).
     * @param {number[]|Float32Array} desc1
     * @param {number[]|Float32Array} desc2
     * @returns {number} jarak (0.0 – ~1.5)
     */
        function euclideanDistance(desc1, desc2) {
      if (!desc1 || !desc2) return 999;
      // Handle TypedArrays or standard Arrays
      const d1 = Array.isArray(desc1) ? desc1 : Array.from(desc1);
      const d2 = Array.isArray(desc2) ? desc2 : Array.from(desc2);
      if (d1.length !== d2.length || d1.length === 0) return 999;

      let sum = 0;
      for (let i = 0; i < d1.length; i++) {
        const d = d1[i] - d2[i];
        sum += d * d;
      }
      return Math.sqrt(sum);
    }

    /**
     * Pencocokan 1-ke-Banyak (Identification) untuk Meja Absen.
     * Mencari kandidat terbaik dari _allFaceDescriptors.
     */
    /**
     * Cocokkan descriptor wajah dengan seluruh database pegawai (1:N matching).
     * Dipakai oleh Meja Absen untuk mengidentifikasi pegawai tanpa input manual.
     * @param {Float32Array|number[]} capturedDesc - Descriptor wajah dari kamera
     * @returns {Promise<{id: string, score: number}|null>} ID pegawai terbaik & skor kemiripan
     */
        async function matchMejaCandidate(capturedDesc) {
      if (!capturedDesc || !_allFaceDescriptors.length) return { id: 'unknown', score: 0 };

      let bestMatch = { id: 'unknown', score: 0 };
      const capDim = capturedDesc.length;
      const engine = window._aiEngine || 'faceapi';

      for (const ref of _allFaceDescriptors) {
        const refDesc = ref.descriptor;
        const refDim = (refDesc && Array.isArray(refDesc)) ? refDesc.length : 0;
        let similarity = 0;

        if (engine === 'human' && HumanInstance && capDim >= 512 && refDim >= 512) {
          // Human to Human similarity (0 to 1)
          similarity = HumanInstance.match.similarity(refDesc, capturedDesc);
        } else if (capDim === 128 && refDim === 128) {
          // Face-API Euclidean fallback (higher dist = lower similarity)
          const dist = euclideanDistance(refDesc, capturedDesc);
          // Convert distance to pseudo-similarity (0 to 1). 0.55 threshold => ~0.73 score
          similarity = Math.max(0, 1 - (dist / 1.5)); 
        } else {
          // Dimension mismatch - skip candidate
          continue;
        }

        if (similarity > bestMatch.score) {
          bestMatch = { id: ref.id, score: similarity };
        }
      }

      // Thresholding (0.55 for similarity is standard for Human)
      // PENTING: Untuk Meja Absen (1:N), gunakan threshold 0.55 agar lebih toleran terhadap noise
      const threshold = FACE_THRESHOLD;
      if (bestMatch.score < threshold) {
        return { id: 'unknown', score: bestMatch.score };
      }

      return bestMatch;
    }

    /**
     * Mencocokkan wajah dari foto yang diambil kamera dengan referensi tersimpan.
     * @param {string} capturedDataUrl - Data URL gambar dari kamera
     * @param {Float32Array|null} preDescriptor - Descriptor yang sudah dihitung sebelumnya (opsional)
     * @returns {Promise<{matched: boolean, score: number, message: string}>}
     */
    async function matchFace(capturedDataUrl, preDescriptor = null) {
      const ref = getFaceRef();
      if (!ref) return { score: -1, label: 'Belum ada data', cls: 'face-match-skip', capturedDescriptor: null };

      let refDesc = ref.descriptor;
      if (typeof refDesc === 'string') {
        try { refDesc = JSON.parse(refDesc); } catch (e) { refDesc = null; }
      }

      let capturedDescArr = preDescriptor;
      if (!capturedDescArr && capturedDataUrl) {
        const raw = await getDescriptorFromDataUrl(capturedDataUrl);
        capturedDescArr = raw ? Array.from(raw) : null;
      }

      if (refDesc && capturedDescArr && HumanInstance) {
        const refDim = refDesc.length;
        const capDim = capturedDescArr.length;

        if (refDim >= 512 && capDim >= 512) {
          const sim = HumanInstance.match.similarity(refDesc, capturedDescArr);
          const score = Math.round(sim * 100);
          const threshold = FACE_THRESHOLD;
          let label, cls;
          if (sim >= threshold) { label = `✅ Cocok ${score}%`; cls = 'face-match-ok'; }
          else if (sim >= threshold - 0.1) { label = `⚠️ Mirip ${score}%`; cls = 'face-match-warn'; }
          else { label = `❌ Tidak Cocok ${score}%`; cls = 'face-match-warn'; }
          return { score, label, cls, similarity: sim, capturedDescriptor: capturedDescArr };
        }

        // Dimensi tidak cocok (descriptor lama format face-api 128-dim)
        return {
          score: 0,
          label: `⚠️ Data wajah lama — silakan daftarkan ulang`,
          cls: 'face-match-warn',
          capturedDescriptor: capturedDescArr,
          needsUpdate: true
        };
      }

      return { score: 0, label: '⚠️ Gagal ekstrak wajah', cls: 'face-match-warn', capturedDescriptor: capturedDescArr };
    }

    function updateFaceRegUI() {
      const ref = getFaceRef();
      const card = $('faceRegCard'); if (!card) return;
      const thumb = $('faceRegThumb');
      const thumbEmpty = $('faceRegThumbEmpty');
      const status = $('faceRegStatus');
      const sub = $('faceRegSub');
      const btn = $('btnRegisterFace');

      const descLen = (ref && ref.descriptor) ? (Array.isArray(ref.descriptor) ? ref.descriptor.length : 0) : 0;
      const hasDescriptor = descLen >= 128;
      const isHuman = ref?.faceModel === 'human' || descLen >= 512;

      if (ref) {
        if (thumb && ref.dataUrl) { thumb.src = ref.dataUrl; thumb.style.display = 'block'; }
        else if (thumb) { thumb.style.display = 'none'; }
        if (thumbEmpty) thumbEmpty.style.display = 'none';

        const d = new Date(ref.savedAt);
        const tgl = isNaN(d) ? '—' : `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

        if (status) {
          status.textContent = hasDescriptor ? (isHuman ? '🛡️ Data Wajah Human Aktif' : '✅ Data Wajah AI Tersimpan') : '⚠️ Perlu Didaftarkan Ulang';
          status.style.color = hasDescriptor ? 'var(--success)' : 'var(--warning)';
        }
        if (sub) {
          sub.textContent = hasDescriptor ? `Didaftarkan: ${tgl} · Face AI ${isHuman ? 'Human' : 'Standard'}` : `Format lama — daftarkan ulang untuk AI`;
        }
        if (btn) {
          btn.textContent = hasDescriptor ? '🔄 Perbarui' : '📷 Daftarkan Ulang';
        }
      } else {
        if (thumb) thumb.style.display = 'none';
        if (thumbEmpty) thumbEmpty.style.display = 'flex';
        if (status) {
          status.textContent = 'Belum ada data wajah';
          status.style.color = 'var(--muted)';
        }
        if (sub) {
          sub.textContent = 'Daftarkan wajah untuk pengenalan AI otomatis';
        }
        if (btn) {
          btn.textContent = '📷 Daftarkan';
        }
      }
    }

    function registerFaceFromPreview() {
      openCamOverlay({
        onDone: async (cap) => {
          if (!cap?.dataUrl) return;
          // btnCapture di doCapture sudah disabled & ganti spinner
          const ok = await saveFaceRef(cap.dataUrl, cap.descriptor);
          if (ok) {
            updateFaceRegUI();
            updateProfilFaceUI();
            setCamStatus('ok', '🧠', 'Data Wajah AI Tersimpan!', 'Wajah Anda berhasil didaftarkan dengan Face AI');
            // Biarkan tombol Ambil Foto berubah jadi Selesai atau Tutup
            const btn = $('btnCapture');
            if (btn) {
              btn.disabled = false;
              btn.innerHTML = '✅ Selesai';
              btn.onclick = () => closeCamOverlay(false);
            }
          } else {
            // Error sudah dihandle oleh saveFaceRef via setCamStatus
            const btn = $('btnCapture');
            if (btn) {
              btn.disabled = false;
              btn.innerHTML = '📸 Coba Lagi';
              btn.onclick = () => doCapture();
            }
          }
        }, onCancel: () => { }, isRegister: true
      });
    }

    function updateProfilFaceUI() {
      const ref = getFaceRef();
      const thumb = $('profilFaceThumb');
      const empty = $('profilFaceEmpty');
      const status = $('profilFaceStatus');
      const sub = $('profilFaceSub');
      const btn = $('btnProfilRegFace');
      if (!status) return;
      const descLen = (ref && ref.descriptor) ? (Array.isArray(ref.descriptor) ? ref.descriptor.length : 0) : 0;
      const hasDescriptor = descLen >= 128;
      const isHuman = descLen >= 512;
      if (ref) {
        if (thumb) { if (ref.dataUrl) { thumb.src = ref.dataUrl; thumb.style.display = 'block'; } else { thumb.style.display = 'none'; } }
        if (empty) empty.style.display = 'none';
        const d = new Date(ref.savedAt);
        const tgl = isNaN(d) ? '—' : `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
        status.textContent = hasDescriptor ? (isHuman ? '🛡️ Face AI: Human' : '✅ Data Wajah AI Tersimpan') : '⚠️ Format Lama — Perlu Didaftarkan Ulang';
        status.style.color = hasDescriptor ? 'var(--success)' : 'var(--warning)';
        if (sub) sub.textContent = hasDescriptor
          ? `Didaftarkan: ${tgl} · Face AI ${isHuman ? 'Advanced' : 'Standard'} aktif`
          : `Daftarkan ulang untuk mengaktifkan AI Face Recognition`;
        if (btn) btn.textContent = hasDescriptor ? '🔄 Perbarui' : '📷 Daftarkan Ulang';
      } else {
        if (thumb) thumb.style.display = 'none';
        if (empty) empty.style.display = 'flex';
        status.textContent = 'Belum ada data wajah';
        status.style.color = 'var(--muted)';
        if (sub) sub.textContent = 'Daftarkan wajah Anda untuk pengenalan AI otomatis saat absen';
        if (btn) btn.textContent = '📷 Daftarkan';
      }
    }


    // ── KONTROL ZOOM KAMERA ──
    async function setCamZoom(val) {
      _camZoomLevel = parseFloat(val);
      const valEl = $('camZoomVal');
      if (valEl) valEl.textContent = _camZoomLevel.toFixed(1) + 'x';

      const vid = $('camVideo');
      if (!vid) return;

      // 1. Coba Hardare Zoom (Track Constraint)
      if (window._camVideoTrack) {
        try {
          const caps = window._camVideoTrack.getCapabilities();
          if (caps.zoom) {
            await window._camVideoTrack.applyConstraints({
              advanced: [{ zoom: _camZoomLevel }]
            });
            // Jika hardware zoom berhasil, pastikan CSS scale netral
            vid.style.transform = 'scaleX(-1)'; 
            return;
          }
        } catch (e) {
          console.warn('[AI] Hardware zoom failed, using CSS fallback:', e);
        }
      }

      // 2. Fallback: Software Zoom (CSS Scale)
      // Mirroring scaleX(-1) dikombinasikan dengan scale(...)
      vid.style.transform = `scaleX(-1) scale(${_camZoomLevel})`;
    }

    /* ── Konfigurasi AI Engine (Human.js ONLY) ── */
    const HUMAN_CDN = 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.2.1/dist/human.js';
    const HUMAN_MODELS = 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.2.1/models/';

    // Paksa selalu Human — hapus nilai lama jika sebelumnya faceapi
    if (localStorage.getItem(STORAGE_KEYS.AI_ENGINE) === 'faceapi') {
      localStorage.setItem(STORAGE_KEYS.AI_ENGINE, 'human');
    }
    window._aiEngine = 'human';
    let _humanLoaded = false;
    let HumanInstance = null;
    let _isDetecting = false; // Flag Pengaman Loop Deteksi
    let _aiProcessing = false; // Flag Pengaman Ekstraksi
    let _isLoopEnabled = false; // Flag Kontrol Loop Absolut

    // Fungsi Pengaman untuk Reset Total State AI jika terjadi Stuck
    let _matchSessionToken = 0; // Token untuk memvalidasi async result agar tidak leak
    let _matchStabilityCount = 0; // Menghitung berapa frame ID yang sama terdeteksi
    let _mejaStartTime = 0; // Waktu mulai Meja Absen untuk startup delay
    let _camZoomLevel = 1.0;
    window._camVideoTrack = null;

    function _forceResetAiState(includeProcessing = true) {
      _isDetecting = false;
      if (includeProcessing) _aiProcessing = false;
      _autoCaptured = false;
      _captureData = null;
      _lastMejaId = null; // Reset tracker terakhir agar tidak "lengket"
      _lastMejaTime = 0;
      _lastMatchedId = null;
      _matchStabilityCount = 0;
      _camZoomLevel = 1.0;
      const zoomSlider = $('camZoomSlider');
      if (zoomSlider) zoomSlider.value = 1;
      setCamZoom(1.0); // Reset visual zoom
      _matchSessionToken++; // Invalidasi semua pending async match result
      console.log(`[AI] State reset (Proc:${includeProcessing}), Token: ${_matchSessionToken}`);
      
      // Bersihkan UI result jika ada yang nyangkut
      const overlay = $('mejaOverlayResult');
      if (overlay) overlay.style.display = 'none';

      // Bersihkan canvas agar tidak ada sisa frame sebelumnya
      const cnv = $('camCanvas');
      if (cnv) {
        const ctx = cnv.getContext('2d');
        ctx.clearRect(0, 0, cnv.width, cnv.height);
      }

      // Ensure NO hidden element is blocking pointer events
      const camOverlay = $('camOverlay');
      if (camOverlay && camOverlay.classList.contains('hidden')) {
          camOverlay.style.pointerEvents = 'none';
      }
    }

    // Wrapper Timeout untuk menghindari AI Hang selamanya
    async function _detectWithTimeout(source, timeoutMs = 6000) {
      if (!HumanInstance) return null;
      return Promise.race([
        HumanInstance.detect(source),
        new Promise((_, reject) => setTimeout(() => reject(new Error('AI_TIMEOUT')), timeoutMs))
      ]);
    }

    function _refreshAiBadge() {
      const b = $('aiEngineBadge');
      if (!b) return;
      b.textContent = 'Mesin: Human AI (1024-dim)';
      b.style.color = 'var(--info)';
      b.style.opacity = '1';
    }

    /**
     * Deteksi backend terbaik yang didukung perangkat.
     * Urutan: WebGL (tercepat) → WASM (stabil di mobile) → cpu (fallback)
     */
    async function _detectBestBackend() {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (gl) {
          gl.getExtension('WEBGL_lose_context')?.loseContext();
          return 'webgl';
        }
      } catch (_) {}
      return 'wasm';
    }

    /**
     * Deteksi apakah device adalah perangkat mobile/HP dengan resource terbatas.
     * Digunakan untuk menentukan inputSize yang optimal.
     */
    function _isMobileDevice() {
      return (navigator.hardwareConcurrency || 4) <= 4 ||
             /Android|iPhone|iPad/i.test(navigator.userAgent);
    }

    async function _loadHumanScript() {
      if (window.Human || (window.Human && window.Human.default)) { _humanLoaded = true; return; }

      let srcToLoad = HUMAN_CDN;

      try {
        const cached = await idb.get('master_data', 'human_script');
        if (cached && cached.blob) {
          srcToLoad = URL.createObjectURL(cached.blob);
          console.log('[AI] Memuat Human.js dari cache lokal (Offline)');
        }
      } catch (e) {
        console.warn('[AI] Gagal membaca cache Human.js', e);
      }

      // Timeout eksplisit 20 detik untuk mencegah hang
      await Promise.race([
        new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = srcToLoad;
          s.onload = () => {
            if (srcToLoad.startsWith('blob:')) URL.revokeObjectURL(srcToLoad);
            if (window.Human) { _humanLoaded = true; resolve(); }
            else reject(new Error('Namespace Human tidak ditemukan di script.'));
          };
          s.onerror = () => {
            if (srcToLoad.startsWith('blob:')) URL.revokeObjectURL(srcToLoad);
            reject(new Error('Gagal memuat Human.js dari ' + (srcToLoad.startsWith('blob:') ? 'Cache Lokal' : 'CDN')));
          };
          document.head.appendChild(s);
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Script load timeout (20s)')), 20000))
      ]);
    }


    // ── Muat Model Human.js (satu-satunya engine) ──
    /**
     * Memuat dan menginisialisasi Human.js secara on-demand.
     * Menampilkan progress bar di UI selama proses loading.
     * @returns {Promise<boolean>} true jika model berhasil dimuat
     */
    async function loadAIModels() {
      if (_modelsReady) return true;
      if (_modelLoading) {
        // Tunggu hingga loading selesai (jika background pre-warm sedang berjalan)
        return new Promise(resolve => {
          const check = setInterval(() => {
            if (!_modelLoading) { clearInterval(check); resolve(_modelsReady); }
          }, 200);
          setTimeout(() => { clearInterval(check); resolve(_modelsReady); }, 30000);
        });
      }
      _modelLoading = true;

      try {
        console.log('[AI] Memuat Human.js Engine...');

        // Langkah 1: Muat Script
        await _loadHumanScript();
        _updateModelProgress(0, 15);

        // Langkah 2: Deteksi backend terbaik secara otomatis
        const bestBackend = await _detectBestBackend();
        const isMobile = _isMobileDevice();
        const inputSize = isMobile ? 224 : 320; // Lebih kecil = lebih cepat di HP
        console.log(`[AI] Device: ${isMobile ? 'Mobile' : 'Desktop'} | Backend: ${bestBackend} | InputSize: ${inputSize}`);

        const config = {
          backend: bestBackend,
          modelBasePath: HUMAN_MODELS,
          filter: { enabled: false },
          cacheModels: true,
          warmup: 'none', // Kita handle warmup sendiri
          face: {
            enabled: true,
            detector: {
              enabled: true,
              rotation: true,
              modelPath: 'blazeface.json',
              maxDetected: 1,
              minConfidence: 0.2,
              inputSize
            },
            mesh: { enabled: false },
            iris: { enabled: false },
            description: { enabled: true, modelPath: 'faceres.json' },
            emotion: { enabled: false },
            liveness: { enabled: true }
          },
          body: { enabled: false },
          hand: { enabled: false },
          object: { enabled: false },
          gesture: { enabled: false },
          segmentation: { enabled: false }
        };

        // Langkah 3: Inisialisasi Instance
        let HumanConstructor = window.Human;
        if (window.Human && typeof window.Human.Human === 'function') HumanConstructor = window.Human.Human;
        else if (window.Human && typeof window.Human.default === 'function') HumanConstructor = window.Human.default;

        if (typeof HumanConstructor !== 'function') {
          throw new Error('Gagal menemukan Class Human (window.Human bukan constructor).');
        }

        HumanInstance = new HumanConstructor(config);
        _updateModelProgress(0, 30);

        // Langkah 4: Set Backend TFJS
        if (HumanInstance.tf) {
          try {
            await HumanInstance.tf.setBackend(bestBackend);
            await HumanInstance.tf.ready();
            console.log(`[AI] TFJS backend aktif: ${await HumanInstance.tf.getBackend()}`);
          } catch (e) {
            console.warn('[AI] Backend manual gagal, biarkan Human memilih otomatis:', e.message);
          }
        }

        // Langkah 5: Load Model Weights (timeout 20 detik)
        _updateModelProgress(0, 50);
        await Promise.race([
          HumanInstance.load(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Model load timeout (20s)')), 20000))
        ]);
        _updateModelProgress(1, 70);

        // Langkah 6: Warmup dengan canvas dummy kecil (compile shader sekali)
        console.log('[AI] Warming up TFJS shaders...');
        try {
          const dummy = document.createElement('canvas');
          dummy.width = inputSize; dummy.height = inputSize;
          await HumanInstance.warmup({ warmup: 'face', canvas: dummy });
        } catch (e) {
          console.warn('[AI] Warmup error (non-fatal):', e.message);
        }

        _updateModelProgress(2, 90);
        _modelsReady = true;
        _modelLoading = false;
        _refreshAiBadge();
        console.log('[AI] Human.js siap digunakan.');
        return true;

      } catch (e) {
        console.error('[AI] Gagal memuat Human.js:', e);
        _modelsReady = false;
        _modelLoading = false;
        return false;
      }
    }

    /**
     * Pre-warm Human.js di background tanpa memblokir UI.
     * Dipanggil 3 detik setelah app siap agar kamera terasa instan.
     */
    async function _prewarmHumanInBackground() {
      if (_modelsReady || _modelLoading) return;
      console.log('[AI] Background pre-warm dimulai...');
      _refreshAiBadge();
      try {
        await loadAIModels();
        console.log('[AI] Background pre-warm selesai — kamera siap instan.');
      } catch (e) {
        console.warn('[AI] Background pre-warm gagal (non-fatal):', e.message);
      }
    }

    // Alias untuk kompatibilitas mundur
    async function loadFaceApiModels() { return loadAIModels(); }

    /* ── Buka overlay kamera ── */
    async function openCamOverlay(onDone) {
      const isMeja = onDone === 'meja';
      _forceResetAiState(); // Reset total sebelum mulai

      // Optimasi: Reset UI Meja secara eksplisit & Tambah Stability Delay
      const mejaResult = $('mejaOverlayResult');
      if (mejaResult) mejaResult.style.display = 'none';
      _isStreamStable = false;
      _mejaStartTime = 0; // Reset waktu mulai, akan di-set saat video benar-benar play

      _absenCallbackAfterCam = onDone;
      window._isMejaMode = isMeja;

      const overlay = $('camOverlay');
      if (overlay) {
        overlay.classList.remove('hidden');
        overlay.style.pointerEvents = 'auto';
      }
      $('modelLoading').style.display = 'block';
      if ($('mlTitle')) $('mlTitle').textContent = _modelsReady ? '📷 Membuka Kamera...' : 'Memuat Model AI Deteksi Wajah'; // Dynamic title
      if ($('mlHint')) $('mlHint').textContent = _modelsReady ? 'Mengaktifkan sensor perangkat, harap tunggu...' : 'Harap tunggu sebentar...';
      $('camVideoWrap').style.display = 'none';
      $('camStatus').style.display = 'none';
      $('faceRegCard').style.display = 'none';
      $('camPreview').classList.remove('show');

      // Tampilkan/sembunyikan tombol capture
      const btnCap = $('btnCapture');
      if (btnCap) {
        btnCap.style.display = isMeja ? 'none' : 'flex';
        btnCap.disabled = true;
        btnCap.innerHTML = '📸 Ambil Foto & Lanjutkan';
      }

      const livenessUI = $('livenessMini');
      if (livenessUI) livenessUI.style.display = isMeja ? 'block' : 'none';

      // Panduan oval wajah selalu tampil untuk mode verifikasi
      const faceGuideEl = $('faceGuideWrap');
      if (faceGuideEl) faceGuideEl.style.display = 'flex';

      // Ubah judul kamera sesuai mode
      // Catatan: untuk isRegister, judul sudah di-set oleh caller (misal adminCaptureFaceFor)
      const titleEl = $('camHeaderTitle');
      if (titleEl) {
        if (!onDone?.isRegister && !isMeja) titleEl.textContent = '📷 Verifikasi Wajah';
        // isRegister & isMeja: biarkan judul yang sudah diset caller
      }

      // Reset UI progress
      _updateModelProgress(0, 0);

      // --- MULAI INISIALISASI KAMERA DENGAN TIERED FALLBACK ---
      let stream = null;
      const isPortrait = window.innerHeight > window.innerWidth;
      
      // Tier 1: Optimized Wide View (Native Sensor Ratio)
      try {
        console.log('[AI] Camera Tier 1: Optimized Wide View');
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: isPortrait ? 768 : 1024 },
            height: { ideal: isPortrait ? 1024 : 768 },
            aspectRatio: { ideal: isPortrait ? 0.75 : 1.3333333333 }
          }
        });
      } catch (e1) {
        console.warn('[AI] Tier 1 Failed:', e1.name);
        // Tier 2: Standard Mobile HD (More compatible across devices)
        try {
          console.log('[AI] Camera Tier 2: Standard Mobile HD');
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: isPortrait ? 720 : 1280 },
              height: { ideal: isPortrait ? 1280 : 720 }
            }
          });
        } catch (e2) {
          console.warn('[AI] Tier 2 Failed:', e2.name);
          // Tier 3: Absolute Fallback (Most compatible)
          try {
            console.log('[AI] Camera Tier 3: Absolute Fallback');
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch (e3) {
            console.error('[AI] All camera tiers failed:', e3);
            $('modelLoading').style.display = 'block';
            if ($('mlTitle')) $('mlTitle').textContent = 'Kamera Gagal';
            if ($('mlHint')) $('mlHint').innerHTML = `<span style="color:var(--danger)">Gagal mengakses kamera: ${e3.name || 'Unknown Error'}.<br>Pastikan izin kamera sudah diberikan.</span>`;
            return;
          }
        }
      }

      // Jika berhasil mendapatkan stream
      if (stream) {
        _camStream = stream;
        const vid = $('camVideo');
        vid.srcObject = _camStream;
        await new Promise(r => { vid.onloadedmetadata = r; });
        await vid.play();
        
        // STABILITY FIX: Baru set _mejaStartTime & _isStreamStable SETELAH video play
        _mejaStartTime = Date.now();
        setTimeout(() => { 
          _isStreamStable = true; 
          console.log('[AI] Stream marked as STABLE');
        }, 2500); // Bertambah menjadi 2.5 detik agar sensor benar-benar stabil

        // Ambil track untuk kontrol zoom/flash
        window._camVideoTrack = _camStream.getVideoTracks()[0];
        
        // Inisialisasi Slider Zoom berdasarkan kapabilitas hardware
        const zoomSlider = $('camZoomSlider');
        if (zoomSlider && window._camVideoTrack) {
          try {
            const caps = window._camVideoTrack.getCapabilities();
            if (caps && caps.zoom) {
              zoomSlider.min = caps.zoom.min;
              zoomSlider.max = caps.zoom.max;
              zoomSlider.step = caps.zoom.step || 0.1;
            } else {
              zoomSlider.min = 1; zoomSlider.max = 3; zoomSlider.step = 0.1;
            }
          } catch (_) { 
            zoomSlider.min = 1; zoomSlider.max = 3; zoomSlider.step = 0.1;
          }
        }
      }

      // ── MODE VERIFIKASI WAJAH — Muat AI atau langsung mulai jika sudah pre-warmed ──
      if (_modelsReady) {
        // AI sudah siap dari background pre-warm — langsung buka kamera!
        console.log('[AI] Pre-warm sudah selesai, kamera langsung aktif.');
        $('modelLoading').style.display = 'none';
        $('camVideoWrap').style.display = 'block';
        $('camStatus').style.display = 'flex';
      } else {
        const ready = await loadAIModels();
        if (!ready) {
          setCamStatus('warn', '⚠️', 'AI Gagal Dimuat', 'Gunakan tombol manual untuk ambil foto');
          if (btnCap) btnCap.disabled = false;
        }
        $('modelLoading').style.display = 'none';
        $('camVideoWrap').style.display = 'block';
        $('camStatus').style.display = 'flex';
      }

      if (MY_ID && !onDone?.isRegister && !window._isMejaMode) {
        updateFaceRegUI();
        $('faceRegCard').style.display = 'block';
      }

      startDetectLoop();
    }

    // Fitur Toggle Flash (Torch)
    let _isFlashOn = false;
    async function toggleFlash() {
      if (!window._camVideoTrack) return;
      try {
        _isFlashOn = !_isFlashOn;
        await window._camVideoTrack.applyConstraints({
          advanced: [{ torch: _isFlashOn }]
        });
        const btn = $('camFlashBtn');
        if (_isFlashOn) {
          btn.style.background = 'rgba(255,193,7,.8)';
          btn.style.borderColor = '#ffc107';
          btn.style.color = '#fff';
        } else {
          btn.style.background = 'rgba(255,255,255,.15)';
          btn.style.borderColor = 'rgba(255,255,255,.3)';
          btn.style.color = '#fff';
        }
      } catch (e) {
        console.warn('Flash tidak didukung atau terhalang:', e);
      }
    }

    function closeCamOverlay(triggeredByUser) {
      if (window._isMejaMode) {
        stopMejaAbsen();
        return;
      }

      _isFlashOn = false;
      stopDetectLoop();
      stopCamStream();

      // Tutup Modal
      const overlay = $('camOverlay');
      if (overlay) {
          overlay.classList.add('hidden');
          overlay.style.pointerEvents = 'none';
      }
      setBtnL('btnAbsen', false, 'Kirim Lokasi & Absen');

      // Kembalikan UI ke kondisi awal
      $('camVideoWrap').style.display = 'block';
      $('camPreview').classList.remove('show');
      $('camPreviewImg').src = '';

      // Kembalikan judul & panduan wajah untuk sesi berikutnya
      const titleEl = $('camHeaderTitle');
      if (titleEl) titleEl.textContent = '📷 Verifikasi Wajah';
      const faceGuideEl = $('faceGuideWrap');
      if (faceGuideEl) faceGuideEl.style.display = 'flex';

      const cb = _absenCallbackAfterCam;
      _absenCallbackAfterCam = null;
      _captureData = null;
      
      // Final global safety check
      _forceResetAiState(true);

      // Panggil onCancel HANYA jika ditutup manual oleh pengguna (bukan setelah onDone selesai)
      if (triggeredByUser && cb && typeof cb === 'object' && typeof cb.onCancel === 'function') {
        cb.onCancel();
      }
    }

    function stopCamStream() {
      if (_camStream) { _camStream.getTracks().forEach(t => t.stop()); _camStream = null; }
    }

    /* ── BUKTI OVERLAY (Untuk Keterangan) ── */
    async function openBuktiOverlay(onDone) {
      _absenCallbackAfterCam = onDone;
      _captureData = null;

      $('buktiOverlay').classList.remove('hidden');
      $('buktiPreviewCam').classList.remove('show');

      const btnCap = $('btnBuktiCapture');
      if (btnCap) {
        btnCap.disabled = true;
        btnCap.innerHTML = '📸 Ambil Foto Bukti';
      }

      try {
        _camStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } }
        });
        const vid = $('buktiVideo');
        vid.srcObject = _camStream;
        await new Promise(r => { vid.onloadedmetadata = r; });
        await vid.play();
        if (btnCap) btnCap.disabled = false;
      } catch (e) {
        // Fallback non-constraint
        try {
          _camStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const vid = $('buktiVideo');
          vid.srcObject = _camStream;
          await new Promise(r => { vid.onloadedmetadata = r; });
          await vid.play();
          if (btnCap) btnCap.disabled = false;
        } catch (e2) {
          alert('Gagal mengakses kamera: Pastikan izin kamera aktif.');
        }
      }
    }

    function closeBuktiOverlay() {
      stopCamStream();
      $('buktiOverlay').classList.add('hidden');
      $('buktiPreviewCam').classList.remove('show');
      $('buktiPreviewCamImg').src = '';
      _absenCallbackAfterCam = null;
      _captureData = null;
    }

    async function doBuktiCapture() {
      if (_captureData) return;
      _captureData = true;

      const btnCap = $('btnBuktiCapture');
      if (btnCap) {
        btnCap.disabled = true;
        btnCap.innerHTML = '<span class="spinner"></span> Memproses...';
      }

      const vid = $('buktiVideo');
      const cnv = document.createElement('canvas');
      cnv.width = vid.videoWidth;
      cnv.height = vid.videoHeight;
      const ctx = cnv.getContext('2d');
      ctx.drawImage(vid, 0, 0);
      const dataUrl = cnv.toDataURL('image/jpeg', 0.85);

      stopCamStream();

      // Tampilkan Preview Singkat
      $('buktiPreviewCamImg').src = dataUrl;
      $('buktiPreviewCam').classList.add('show');

      const cb = _absenCallbackAfterCam;
      _absenCallbackAfterCam = null;

      setTimeout(async () => {
        try {
          if (typeof cb === 'function') {
            await cb({ dataUrl });
          } else if (cb?.onDone) {
            await cb.onDone({ dataUrl });
          }
        } catch (err) {
          console.error('[doBuktiCapture] callback error:', err);
        } finally {
          closeBuktiOverlay();
        }
      }, 800);
    }

    function stopDetectLoop() {
      _isLoopEnabled = false; // Matikan loop secara absolut
      _forceResetAiState(false); // Reset deteksi tapi JANGAN reset _aiProcessing agar lock tidak lepas
      if (_detectLoop) { cancelAnimationFrame(_detectLoop); _detectLoop = null; }
      if (_liveMatchTimer) { clearInterval(_liveMatchTimer); _liveMatchTimer = null; }

      // Bersihkan Canvas
      const cnv = $('camCanvas');
      if (cnv) {
        const ctx = cnv.getContext('2d');
        ctx.clearRect(0, 0, cnv.width, cnv.height);
      }
    }

    /* ── Loop deteksi wajah (rAF) ── */
    function startDetectLoop() {
      const vid = $('camVideo');
      const cnv = $('camCanvas');
      const ctx = cnv.getContext('2d');
      const wrap = $('camVideoWrap');

      _blinkDetected = false;
      _livenessScore = 0;
      _livenessHistory = [];
      _lastLandmarks = null;
      _isLive = false;

      // Munculkan tombol capture manual lebih cepat (3 detik) untuk mode Daftar Wajah/Absen biasa
      setTimeout(() => {
        if ($('btnCapture') && !window._isMejaMode) $('btnCapture').disabled = false;
      }, 3000);

      _isLoopEnabled = true;
      const loop = async () => {
        if (!_isLoopEnabled || !_modelsReady || !$('camOverlay') || $('camOverlay').classList.contains('hidden')) return;
        
        // STABILITY FIX: Jika stream belum stabil, jangan deteksi apa-apa
        if (!_isStreamStable) {
           _detectLoop = requestAnimationFrame(loop);
           return;
        }

        // Optimasi: Pastikan video sudah benar-benar memutar frame baru (Fresh Frame Check)
        // readyState 4 = HAVE_ENOUGH_DATA, currentTime > 0.5 = sudah lewat frame awal/hitam
        if (vid.readyState < 4 || vid.currentTime < 0.5 || vid.paused) {
           _detectLoop = requestAnimationFrame(loop);
           return;
        }

        if (_isDetecting) {
          _detectLoop = requestAnimationFrame(loop);
          return;
        }

        // Pastikan dimensi video valid (Mencegah deteksi pada frame kosong/hitam di awal loading)
        if (vid.videoWidth === 0 || vid.videoHeight === 0) {
          _detectLoop = requestAnimationFrame(loop);
          return;
        }

        _isDetecting = true;

        try {
          let detection = null;
          if (window._aiEngine === 'human' && HumanInstance) {
            const res = await _detectWithTimeout(vid, 5000);
            if (res && res.face && res.face.length > 0) {
              const f = res.face[0];
              const liveScore = f.live || 0;
              const realScore = f.real || 0;
              const genericScore = f.liveness || 0;
              _lastHumanScore = Math.max(liveScore, realScore, genericScore).toFixed(2);
              const isLive = (liveScore > 0.4 || realScore > 0.4 || genericScore > 0.4);
              detection = {
                landmarks: { positions: f.landmarks || [] },
                descriptor: f.embedding || null,
                _isHumanLive: isLive
              };
            }
          } else {
            // Human belum siap, tunggu frame berikutnya
            _detectLoop = requestAnimationFrame(loop);
            _isDetecting = false;
            return;
          }

          if (!detection) {
            wrap.className = 'cam-video-wrap face-bad';
            setCamStatus('bad', '😶', 'Wajah Belum Terlihat', 'Hadapkan wajah ke kamera');
            _livenessState.faceOk = false;
            if (window._isMejaMode) {
              $('lsIcon').textContent = '😐';
              $('lsText').textContent = 'Menunggu Wajah...';
              $('lsText').style.color = 'var(--muted)';
              _matchSessionToken++; // Batalkan semua match result yang sedang berjalan
              _lastMatchedId = null;
              _matchStabilityCount = 0;
            }
          } else {
            _livenessState.faceOk = true;
            wrap.className = 'cam-video-wrap face-ok';

            // Selalu gunakan Human liveness score
            _isLive = detection._isHumanLive;

            if (_isLive) {
              setCamStatus('ok', '🛡️', 'Liveness Approved', window._isMejaMode ? 'Mencocokkan Identitas...' : 'Posisikan wajah & Tekan tombol');
              if (window._isMejaMode) {
                $('lsIcon').textContent = '🛡️';
                $('lsText').textContent = 'Wajah Terverifikasi Asli';
                $('lsText').style.color = 'var(--success)';
              }
            } else {
              setCamStatus('ok', '⏳', 'Verifikasi Keaslian...', 'Mohon tetap diam sejenak');
              if (window._isMejaMode) {
                $('lsIcon').textContent = '🔍';
                $('lsText').textContent = `Mengecek Keaslian Wajah... (Score: ${window._lastHumanScore || '0.00'})`;
                $('lsText').style.color = 'var(--gold)';
              }
            }

            if (window._isMejaMode) {
              // --- LIVE MATCHING ON VIDEO STREAM ---
              if (!_autoCaptured && _modelsReady && detection.descriptor) {
                // STARTUP DELAY: Jangan identifikasi jika baru saja kamera terbuka (menunggu sensor stabil)
                if (Date.now() - _mejaStartTime < 1500) return;

                const currentToken = _matchSessionToken;
                // Perform matching asynchronously to not lag the preview
                matchMejaCandidate(detection.descriptor).then(match => {
                  // VALIDASI: Hanya proses jika sesi masih sama (wajah tidak hilang/berubah)
                  if (currentToken !== _matchSessionToken) return;

                  if (match && match.id !== 'unknown') {
                    // STABILITY CHECK: ID harus sama selama 5 frame berturut-turut
                    if (match.id === _lastMatchedId) {
                      _matchStabilityCount++;
                    } else {
                      _lastMatchedId = match.id;
                      _matchStabilityCount = 1;
                      return; // Baru satu frame, jangan tampilkan dulu
                    }

                    if (_matchStabilityCount < 4) return; // Belum cukup stabil

                    const profile = window._mejaUserMap ? window._mejaUserMap[match.id] : null;
                    const nama = profile ? profile.nama : match.id;
                    const score = Math.round(match.score * 100);

                    // Update UI with identified person
                    if ($('lsText')) {
                      $('lsIcon').textContent = '✅';
                      $('lsText').textContent = `ID Found: ${nama} (${score}%)`;
                      $('lsText').style.color = '#4ade80';
                    }

                    // If liveness is also approved, trigger final capture
                    if (_isLive && !_autoCaptured && _livenessState.faceOk) {
                      _autoCaptured = true;
                      console.log(`[AI] Continuous Match OK: ${nama} (Stable: ${_matchStabilityCount}). Finalizing...`);
                      setTimeout(() => {
                        // Cek sekali lagi sebelum benar-benar doCapture
                        if (currentToken === _matchSessionToken && _livenessState.faceOk && match.id === _lastMatchedId) {
                          doCapture(match.id, detection.descriptor, match.score);
                        } else {
                          _autoCaptured = false;
                        }
                      }, 400); // 400ms delay for confirmation
                    }
                  } else {
                    _lastMatchedId = null;
                    _matchStabilityCount = 0;
                    // Reset UI jika tidak ada match dalam frame ini
                    if (_isLive) {
                      $('lsIcon').textContent = '🔍';
                      $('lsText').textContent = 'Mencari Identitas di Database...';
                      $('lsText').style.color = 'var(--gold)';
                    }
                  }
                });
              }
            } else {
              if (!_autoCaptured && _modelsReady && _isLive) {
                _autoCaptured = true;
                setTimeout(() => {
                  if (_livenessState.faceOk && !$('camOverlay').classList.contains('hidden')) {
                    doCapture();
                  } else {
                    _autoCaptured = false;
                  }
                }, 800);
              }
            }
          }
        } catch (e) {
          console.error('[AI] Loop Error:', e);
        } finally {
          _isDetecting = false;
          if (_isLoopEnabled && $('camOverlay') && !$('camOverlay').classList.contains('hidden')) {
            _detectLoop = requestAnimationFrame(loop);
          }
        }
      };
      loop();
    }

    let _isSubmitting = false; // ANTI-SPAM LOCK

    /* ── Helper: Resize Image ── */
    async function _resizeImage(dataUrl, maxW = 640) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          if (img.width <= maxW) return resolve(dataUrl);
          const ratio = maxW / img.width;
          const cnv = document.createElement('canvas');
          cnv.width = maxW; cnv.height = img.height * ratio;
          cnv.getContext('2d').drawImage(img, 0, 0, cnv.width, cnv.height);
          resolve(cnv.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      });
    }

    /* ── Ambil foto (capture) ── */
    /**
     * Tangkap frame dari kamera, ekstrak descriptor wajah, dan cocokkan.
     * Dipanggil otomatis oleh startDetectLoop() saat wajah terdeteksi.
     * @param {string|null} matchId - ID user yang sudah diidentifikasi sebelumnya
     * @param {Float32Array|null} preDescriptor - Pre-computed descriptor
     * @param {number} preScore - Pre-computed similarity score (0-1)
     */
        async function doCapture(matchId = null, preDescriptor = null, preScore = 0) {
      if (_aiProcessing || _isSubmitting) {
        console.warn('[AI] Capture ignored: Already processing or submitting.');
        return;
      }
      _aiProcessing = true;
      console.log('[AI] --- Starting Capture & Finalization ---');

      // Update UI Segera
      setCamStatus('ok', '📸', 'Memproses Foto...', 'Harap tunggu');
      const btnCap = $('btnCapture');
      if (btnCap) {
        btnCap.disabled = true;
        btnCap.innerHTML = '<span class="spinner"></span> Memproses...';
      }

      stopDetectLoop();
      // stopDetectLoop() resets flags via _forceResetAiState(false), 
      // so we MUST re-lock _aiProcessing immediately.
      _aiProcessing = true;

      try {
        const vid = $('camVideo');
        const cnv = $('camCanvas');
        if (!vid) throw new Error('VIDEO_MISSING');

        console.log('[AI] Phase 1: Drawing Frame...');
        const ctx = cnv.getContext('2d');
        cnv.width = vid.videoWidth;
        cnv.height = vid.videoHeight;

        // Mirroring agar hasil searah dengan preview (untuk personal)
        ctx.translate(cnv.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(vid, 0, 0);

        // Optimasi: Resize image agar payload tidak terlalu besar (sering gagal di Cloudflare/n8n jika > 1MB)
        const fullDataUrl = cnv.toDataURL('image/jpeg', 0.85);
        const dataUrl = await _resizeImage(fullDataUrl, 640);
        
        _captureData = { dataUrl };

        if (!window._isMejaMode) stopCamStream();

        let descriptor = preDescriptor;
        if (!descriptor) {
          console.log('[AI] Phase 2: Extracting Face Features (AI)...');
          // Optimasi: Gunakan cnv (frame yang sama) bukan vid agar konsisten
          descriptor = await getFaceDescriptor(cnv);
        } else {
          console.log('[AI] Phase 2: Using Pre-Identified Descriptor.');
        }

        if (!descriptor) {
          console.warn('[AI] End Phase: No face descriptor extracted.');
          _forceResetAiState(true);
          setCamStatus('bad', '⚠️', 'Gagal Ekstraksi', 'Posisikan wajah kembali');
          if (!window._isMejaMode) startDetectLoop();
          return;
        }

        console.log('[AI] Phase 3: Features extracted. Length:', descriptor?.length);

        if (window._isMejaMode) {
          let bestMatch = { id: matchId, score: preScore };
          
          if (!bestMatch.id || bestMatch.id === 'unknown') {
            console.log('[AI] Phase 4: Matching against Employee Database...');
            bestMatch = await matchMejaCandidate(descriptor);
          } else {
            console.log('[AI] Phase 4: Using Pre-Identified ID:', bestMatch.id);
          }
          
          console.log(`[AI] Match Result: ${bestMatch.id} (score: ${bestMatch.score.toFixed(4)})`);
          _onMejaAbsenMatchFound(bestMatch.id, descriptor, dataUrl, bestMatch.score);
        } else {
          console.log('[AI] Phase 4: Manual Capture / Personal Mode.');
          if (_absenCallbackAfterCam) {
            const result = { dataUrl, descriptor };
            if (typeof _absenCallbackAfterCam === 'function') {
              await _absenCallbackAfterCam(result);
            } else if (_absenCallbackAfterCam.onDone) {
              await _absenCallbackAfterCam.onDone(result);
            }
          }
          _forceResetAiState(true); // Lepas kunci setelah callback personal selesai
        }
      } catch (e) {
        console.error('[AI] Fatal Capture Error:', e);
        _forceResetAiState(true);
        setCamStatus('bad', '❌', 'Gagal Memproses', e.message || 'Silakan coba lagi');
        // Aktifkan kembali tombol agar user bisa coba lagi
        const btn = $('btnCapture');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '📸 Coba Lagi';
        }
      }
    }


    async function skipVerifikasi() {
      // Ambil foto lewati liveness check
      _livenessState = { faceOk: true, ch1: true, ch2: true };
      await doCapture();
    }

    /* ── Tutup overlay manual oleh pengguna (tombol ✕) ── */
    function closeCamByUser() {
      closeCamOverlay(true); // true = user yang menutup → panggil onCancel
    }

    function startSimpleCapture(isSimpleMode) {
      // Fallback jika model gagal muat atau isSimple mode
      $('btnCapture').disabled = false;
      if (isSimpleMode) {
        setCamStatus('ok', '📷', 'Kamera Siap', 'Posisikan dokumen/bukti secara jelas lalu tekan Ambil Foto');
      } else {
        setCamStatus('warn', '📷', 'Kamera Siap', 'Model AI tidak tersedia — foto manual');
      }
    }

    /* ── Helper UI ── */
    function setCamStatus(type, icon, title, sub) {
      const el = $('camStatus'); if (!el) return;
      el.className = `cam-status ${type}`;
      $('camStatusIcon').textContent = icon;
      $('camStatusTitle').textContent = title;
      $('camStatusSub').textContent = sub;
    }
    function setLivenessStep(idx, state) {
      // dihapus mengikuti liveness logic
    }

