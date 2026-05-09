/* ════ STATE GLOBAL (MUTABLE) ════ */
    /* ════ MODEL LOADING STATE ════ */
    let _modelsReady = false, _modelLoadPct = 0, _modelLoadStep = -1;
    let _isStreamStable = false; // Flag untuk mencegah deteksi instan saat kamera baru terbuka
    function _updateModelProgress(idx, pctPerStep) {
      _modelLoadStep = idx;
      const base = idx * 33.3;
      _modelLoadPct = Math.min(100, Math.round(base + (pctPerStep || 0)));
      const bar = $('mlProgressBar'), per = $('mlPercent'), st = $(`mlStep${idx}`), ic = $(`mlStep${idx}Icon`);
      if (bar) bar.style.width = _modelLoadPct + '%';
      if (per) per.textContent = _modelLoadPct + '%';
      if (st) { st.style.color = 'var(--white)'; st.style.fontWeight = '700'; }
      if (ic) ic.textContent = '⏳';
      // Mark previous as done
      for (let i = 0; i < idx; i++) {
        const sic = $(`mlStep${i}Icon`), sst = $(`mlStep${i}`);
        if (sic) sic.textContent = '✅';
        if (sst) { sst.style.color = 'var(--success)'; sst.style.opacity = '1'; }
      }
      if (_modelLoadPct >= 100) {
        if (ic) ic.textContent = '✅';
        if (st) st.style.color = 'var(--success)';
        if ($('mlTitle')) $('mlTitle').textContent = 'Sistem AI Siap';
        if ($('mlHint')) $('mlHint').textContent = 'Semua model berhasil dimuat.';
      }
    }

    /* ════ DETEKSI DESKTOP ════ */
    function isDesktop() {
      const ua = navigator.userAgent;
      if (/Android|iPhone|iPad|iPod|Mobile|BlackBerry|Opera Mini|Windows Phone/i.test(ua)) return false;
      return !(navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
    }

    /* ════ TELEGRAM ════ */
    const tg = window.Telegram?.WebApp;
    let tgUser = {};
    let MY_ID = null;

    // 1. Prioritas Utama: Ambil dari Cache Logal (Instant pada Refresh)
    try {
      const cachedId = localStorage.getItem(STORAGE_KEYS.USER_ID);
      const cachedUser = localStorage.getItem(STORAGE_KEYS.USER_OBJ);
      if (cachedId) {
        MY_ID = Number(cachedId);
        if (cachedUser) tgUser = JSON.parse(cachedUser);
      }
    } catch (e) { }

    // 2. Sinkronkan dengan data asli Telegram
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#0a1628');
      tg.setBackgroundColor('#0a1628');
      const cur = tg.initDataUnsafe?.user;
      if (cur?.id) {
        MY_ID = Number(cur.id);
        tgUser = cur;
        try {
          localStorage.setItem(STORAGE_KEYS.USER_ID, String(MY_ID));
          localStorage.setItem(STORAGE_KEYS.USER_OBJ, JSON.stringify(tgUser));
        } catch (e) { }
      }
    }

    let IS_ADMIN = false;
    let adminLoaded = false;

    // Helper: Tunggu Telegram ID siap (tapi sekarang instan jika ada cache)
    async function waitForMyId() {
      if (MY_ID) return Number(MY_ID);
      for (let i = 0; i < 15; i++) {
        const cur = window.Telegram?.WebApp?.initDataUnsafe?.user;
        if (cur?.id) {
          MY_ID = Number(cur.id);
          tgUser = cur;
          try {
            localStorage.setItem(STORAGE_KEYS.USER_ID, String(MY_ID));
            localStorage.setItem(STORAGE_KEYS.USER_OBJ, JSON.stringify(tgUser));
          } catch (e) { }
          return MY_ID;
        }
        await new Promise(r => setTimeout(r, 200));
      }
      return null;
    }


    /* ════ STATE OBJECT TERPUSAT ════
       Menggabungkan semua variabel state yang tersebar ke satu namespace.
       Variabel original (MY_ID, IS_ADMIN, dll) TETAP DIPERTAHANKAN untuk
       backward compatibility — State hanyalah pembungkus yang lebih terstruktur
       untuk keperluan baca/debug dan akses lintas modul.

       Penggunaan baru:
         State.user.id     → sama dengan MY_ID
         State.ai.engine   → sama dengan window._aiEngine
         State.rekap.data  → sama dengan lastRekapPegawai

       Catatan: update State tidak otomatis update variabel asli.
       Selalu update variabel asli (MY_ID = x) dan State akan sinkron via getter.
    */
    const State = {

      /* ─── User ─── */
      get user() {
        return {
          id:          MY_ID,
          profile:     tgUser,
          isAdmin:     IS_ADMIN,
          isSuperAdmin: typeof _isSuperAdmin === 'function' ? _isSuperAdmin() : false,
          adminIds:    typeof ADMIN_IDS !== 'undefined' ? ADMIN_IDS : [],
          rekapChatId: typeof REKAP_CHAT_ID !== 'undefined' ? REKAP_CHAT_ID : null,
        };
      },

      /* ─── AI / Face ─── */
      get ai() {
        return {
          engine:        window._aiEngine || 'human',
          modelsReady:   typeof _modelsReady !== 'undefined' ? _modelsReady : false,
          modelLoading:  typeof _modelLoadPct !== 'undefined' ? _modelLoadPct < 100 : false,
          loadPercent:   typeof _modelLoadPct !== 'undefined' ? _modelLoadPct : 0,
        };
      },

      /* ─── Camera ─── */
      get camera() {
        return {
          stream:        typeof _camStream !== 'undefined' ? _camStream : null,
          isLoopEnabled: typeof _detectLoopEnabled !== 'undefined' ? _detectLoopEnabled : false,
          isDetecting:   typeof _isDetecting !== 'undefined' ? _isDetecting : false,
          isSubmitting:  typeof _isSubmitting !== 'undefined' ? _isSubmitting : false,
          zoomLevel:     typeof _camZoomLevel !== 'undefined' ? _camZoomLevel : 1.0,
          streamStable:  typeof _isStreamStable !== 'undefined' ? _isStreamStable : false,
        };
      },

      /* ─── Rekap ─── */
      get rekap() {
        return {
          lastPegawai:   typeof lastRekapPegawai !== 'undefined' ? lastRekapPegawai : [],
          loaded:        typeof rekapLoaded !== 'undefined' ? rekapLoaded : false,
          hariLiburSet:  typeof hariLiburSet !== 'undefined' ? hariLiburSet : new Set(),
        };
      },

      /* ─── UI ─── */
      get ui() {
        return {
          currentTab:        typeof currentTab !== 'undefined' ? currentTab : 'absen',
          desktopMode:       localStorage.getItem(STORAGE_KEYS.DESKTOP_MODE) === '1',
          faceRecognition:   localStorage.getItem(STORAGE_KEYS.FACE_RECOGNITION) !== '0',
        };
      },

      /* ─── Meja Absen ─── */
      get meja() {
        return {
          isActive:      window._isMejaMode || false,
          isProcessing:  window._mejaProcessing || false,
          gpsLocation:   typeof _mejaGpsLocation !== 'undefined' ? _mejaGpsLocation : null,
          lastMatchedId: typeof _lastMejaId !== 'undefined' ? _lastMejaId : null,
          cnt:           typeof _mejaCnt !== 'undefined' ? _mejaCnt : { masuk: 0, pulang: 0, gagal: 0 },
        };
      },

      /* ─── Debug: dump semua state ke console ─── */
      dump() {
        console.group('[State.dump]');
        console.log('user',   this.user);
        console.log('ai',     this.ai);
        console.log('camera', this.camera);
        console.log('rekap',  this.rekap);
        console.log('ui',     this.ui);
        console.log('meja',   this.meja);
        console.groupEnd();
      }
    };

    // Expose State ke window untuk debugging di DevTools
    window.State = State;
