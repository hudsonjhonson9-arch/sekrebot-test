    /* ════ STARTUP DIAGNOSTICS ════
       Deteksi masalah inisialisasi di browser console.
       Aktif di development/staging — NONAKTIFKAN di produksi akhir.
    */
    (function() {
      const LOG = (msg) => console.log('[DIAG]', msg);
      const ERR = (msg) => console.error('[DIAG ❌]', msg);
      const OK  = (msg) => console.log('[DIAG ✅]', msg);

      // 1. Check critical globals
      const globals = {
        '$':                   typeof $ !== 'undefined',
        'P':                   typeof P !== 'undefined',
        'apiGet':              typeof apiGet !== 'undefined',
        'apiPost':             typeof apiPost !== 'undefined',
        'apiFetch':            typeof apiFetch !== 'undefined',
        'switchTab':           typeof switchTab !== 'undefined',
        'handleAbsen':         typeof handleAbsen !== 'undefined',
        'loadUserProfile':     typeof loadUserProfile !== 'undefined',
        'loadTodayHistory':    typeof loadTodayHistory !== 'undefined',
        'loadJamAbsen':        typeof loadJamAbsen !== 'undefined',
        'loadFaceToggle':      typeof loadFaceToggle !== 'undefined',
        'initApp':             typeof initApp !== 'undefined',
        '_checkIdentityOnLoad':typeof _checkIdentityOnLoad !== 'undefined',
        'parseApiResponse':    typeof parseApiResponse !== 'undefined',
        'dom':                 typeof dom !== 'undefined',
        'handleAbsenError':    typeof handleAbsenError !== 'undefined',
        'waitForMyId':         typeof waitForMyId !== 'undefined',
        'showResult':          typeof showResult !== 'undefined',
        'setBtnL':             typeof setBtnL !== 'undefined',
        'updateClock':         typeof updateClock !== 'undefined',
        'MY_ID':               typeof MY_ID !== 'undefined',
        'IS_ADMIN':            typeof IS_ADMIN !== 'undefined',
        'STORAGE_KEYS':        typeof STORAGE_KEYS !== 'undefined',
        'ERROR_CODES':         typeof ERROR_CODES !== 'undefined',
        'FACE_THRESHOLD':      typeof FACE_THRESHOLD !== 'undefined',
        '_confirmAbsenLanjut': typeof _confirmAbsenLanjut !== 'undefined',
        '_confirmAbsenBatal':  typeof _confirmAbsenBatal !== 'undefined',
      };

      let allOk = true;
      for (const [name, defined] of Object.entries(globals)) {
        if (!defined) { ERR(`${name} is UNDEFINED`); allOk = false; }
      }

      if (allOk) OK('All critical globals defined');

      // 2. Check MY_ID
      const storedId = localStorage.getItem('tg_user_id_v5');
      LOG(`localStorage MY_ID: ${storedId} | runtime MY_ID: ${typeof MY_ID !== 'undefined' ? MY_ID : 'UNDEFINED'}`);

      // 3. Check P endpoints
      if (typeof P !== 'undefined') {
        OK(`P has ${Object.keys(P).length} endpoints. jamAbsen: ${P.jamAbsen}`);
      }

      // 4. Tab buttons
      const tabs = document.querySelectorAll('.tab');
      LOG(`Tab buttons found: ${tabs.length}`);
      tabs.forEach(t => {
        const onclick = t.getAttribute('onclick');
        LOG(`  Tab "${t.textContent.trim()}": onclick="${onclick}"`);
      });

      // 5. Panel divs
      ['absen','ket','rekap','profil','admin'].forEach(tab => {
        const panel = document.getElementById('panel-' + tab);
        LOG(`  panel-${tab}: ${panel ? 'EXISTS' : '❌ MISSING'}`);
      });

    })();
