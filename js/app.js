/* ════ APP INIT ════ */
    async function initApp() {
      try {
        fetchInstansiList(); // Pre-load instansi for registration
        console.log('[Init] Checking identity...');
        if (!_checkIdentityOnLoad()) return; // Stop if not logged in

        console.log('[Init] Starting application...');
        await idb.init();

        // Critical: Load role & face settings first
        await Promise.allSettled([
          loadFaceToggle(),
          loadJamAbsen()
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

    // PWA Auto Update Check
    async function checkForUpdate() {
      try {
        const res = await fetch('./version.json?t=' + Date.now());
        if (res.ok) {
          const remote = await res.json();
          const local = localStorage.getItem('app_version');
          if (local && local !== remote.version) {
            if (typeof Swal !== 'undefined') {
              Swal.fire({
                title: '🔄 Pembaruan Tersedia!',
                text: 'Versi baru dari aplikasi absensi tersedia. Muat ulang sekarang untuk menikmati fitur terbaru?',
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: 'Ya, Muat Ulang',
                cancelButtonText: 'Nanti',
              }).then((result) => {
                if (result.isConfirmed) {
                  localStorage.setItem('app_version', remote.version);
                  window.location.reload(true);
                }
              });
            } else {
              if (confirm('🔄 Versi baru tersedia! Muat ulang aplikasi sekarang?')) {
                localStorage.setItem('app_version', remote.version);
                window.location.reload(true);
              }
            }
          } else if (!local) {
            localStorage.setItem('app_version', remote.version);
          }
        }
      } catch (e) {
        console.warn('[PWA] Gagal mengecek pembaruan:', e);
      }
    }
    
    // Cek update setiap 5 menit
    setInterval(checkForUpdate, 5 * 60 * 1000);
    // Cek sesaat setelah init
    setTimeout(checkForUpdate, 5000);

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
