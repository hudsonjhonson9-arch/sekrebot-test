/* ════ APP INIT ════ */
    async function initApp() {
      try {
        fetchInstansiList(); // Pre-load instansi for registration
        // Safety pre-check: restore face toggle from localStorage before identity check
        // (in case admin-face.js didn't load — syntax error, SW cache, etc.)
        try {
          const ft = localStorage.getItem('face_recognition_bapperida');
          if (ft !== null) FACE_RECOGNITION_ENABLED = ft !== '0';
          else FACE_RECOGNITION_ENABLED = false;
        } catch (_) {}
        console.log('[Init] Checking identity...');
        if (!await _checkIdentityOnLoad()) return; // Stop if not logged in

        console.log('[Init] Starting application...');
        await idb.init();

        // Critical: Load role & face settings first
        await Promise.allSettled([
          typeof loadFaceSettingsGlobal === 'function' ? loadFaceSettingsGlobal() : Promise.resolve(),
          typeof loadFaceToggle === 'function' ? loadFaceToggle() : Promise.resolve(),
          typeof loadJamAbsen === 'function' ? loadJamAbsen() : Promise.resolve()
        ]);

        // Secondary: Load Profile and History to show on dashboard
        await Promise.allSettled([
          loadUserProfile(),
          loadTodayHistory(),
          fetchJamPeriode()
        ]);

        updateClock();
        if (typeof applyAdminVisibility === 'function') applyAdminVisibility();

        // Tertiary/Lazy: Background tasks that don't block the main UI
        setTimeout(async () => {
          await loadFaceFromServer();
          loadBidangList();
          // Optimasi Opsi B: Pre-warm Human.js di background setelah 3 detik.
          // Kamera akan terasa instan saat tombol Absen ditekan.
          setTimeout(() => _prewarmHumanInBackground(), 3000);
          
          // Check face registration requirement AFTER loading from server
          _cekWajibFace();
        }, 1500);

        const lastTab = localStorage.getItem('absen_last_tab') || 'absen';
        switchTab(lastTab);
        if (typeof hideResult === 'function') hideResult(); // Ensure result is hidden on startup

        if (IS_ADMIN) {
          const lastSection = localStorage.getItem('absen_last_admin_section') || 'ops';
          switchAdminSection(lastSection);
        }

        // Initialize Tugas & Lembur Module
        if (typeof initTugasLembur === 'function') initTugasLembur();

        // Strip spasi dari input NIP
        document.querySelectorAll('#loginNip, #regNip, #inPegawaiNip, #inputAdminNip').forEach(el => {
          el.addEventListener('input', () => { el.value = el.value.replace(/\s/g, ''); });
        });

        // Manage Logout Button Visibility
        const logoutSec = $('logoutSection');
        if (logoutSec) {
          const isTg = !!(window.Telegram?.WebApp?.initData || new URLSearchParams(window.location.search).has('id'));
          logoutSec.style.display = !isTg ? 'block' : 'none';
        }

      } catch (err) {
        console.error('[Init] Error during startup:', err);
      } finally {
        // Always hide splash screen after 300ms attempt
        setTimeout(() => {
          const splash = document.getElementById('appSplash');
          if (splash) {
            splash.classList.add('hide');
            setTimeout(() => splash.remove(), 500);
          }
          console.log('[Init] Application ready.');

          // Notify Capgo OTA system that the app is successfully loaded and ready
          if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater) {
            window.Capacitor.Plugins.CapacitorUpdater.notifyAppReady()
              .then(() => console.log('[Capgo] App successfully marked as ready for OTA updates.'))
              .catch(err => console.error('[Capgo] Failed to notify app ready:', err));
          }
        }, 300);
      }
    }

    // Jalankan initApp di akhir script atau via DOMContentLoaded
    document.addEventListener('DOMContentLoaded', initApp);

    // Safety fallback: Hide splash anyway after 8s
    setTimeout(() => {
      const splash = document.getElementById('appSplash');
      if (splash) {
        console.warn('[Init] Splash screen safety fallback triggered.');
        splash.classList.add('hide');
        setTimeout(() => splash.remove(), 500);
      }
    }, 8000);
