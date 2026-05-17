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

          // Check for application auto-updates from GitHub
          checkAppUpdate();
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
        }, 300);
      }
    }

    // ═══ AUTOMATIC UPDATE SYSTEM FOR MOBILE ═══
    async function checkAppUpdate() {
      try {
        console.log('[Update] Checking for updates...');
        
        // Fetch local version bundled in the APK
        const localRes = await fetch('version.json');
        if (!localRes.ok) return;
        const localData = await localRes.json();
        
        // Fetch live remote version from GitHub Pages (cache-busted)
        const remoteRes = await fetch('https://hudsonjhonson9-arch.github.io/sekrebot-test/version.json?t=' + Date.now());
        if (!remoteRes.ok) return;
        const remoteData = await remoteRes.json();
        
        console.log(`[Update] Local build: ${localData.build}, Remote build: ${remoteData.build}`);
        
        if (remoteData.build > localData.build) {
          console.log('[Update] Update found! Showing gorgeous overlay...');
          showUpdateModal(remoteData.version, remoteData.releaseNotes, remoteData.apkUrl);
        }
      } catch (err) {
        console.warn('[Update] Update check skipped or failed:', err);
      }
    }

    function showUpdateModal(version, notes, apkUrl) {
      if (document.getElementById('updateOverlay')) return;

      const overlay = document.createElement('div');
      overlay.id = 'updateOverlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(13, 27, 42, 0.85);
        backdrop-filter: blur(15px);
        -webkit-backdrop-filter: blur(15px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        opacity: 0;
        transition: opacity 0.4s ease;
      `;

      const card = document.createElement('div');
      card.style.cssText = `
        background: linear-gradient(135deg, rgba(25, 42, 86, 0.95), rgba(15, 28, 63, 0.95));
        border: 1px solid rgba(255, 255, 255, 0.15);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 168, 204, 0.2);
        border-radius: 24px;
        width: 100%;
        max-width: 400px;
        padding: 30px;
        text-align: center;
        color: #fff;
        transform: scale(0.9);
        transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        font-family: system-ui, -apple-system, sans-serif;
      `;

      card.innerHTML = `
        <div style="font-size: 64px; margin-bottom: 20px; filter: drop-shadow(0 0 10px rgba(0, 168, 204, 0.5));">💡</div>
        <h3 style="font-size: 22px; font-weight: 700; margin: 0 0 10px 0; background: linear-gradient(90deg, #00d2ff, #0066ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Pembaluan Tersedia!</h3>
        <p style="font-size: 14px; color: rgba(255, 255, 255, 0.7); margin: 0 0 20px 0;">Versi terbaru <b>v${version}</b> telah rilis di GitHub.</p>
        
        <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 15px; text-align: left; font-size: 13px; max-height: 120px; overflow-y: auto; margin-bottom: 25px; line-height: 1.5; color: rgba(255, 255, 255, 0.8);">
          <div style="font-weight: 600; margin-bottom: 6px; color: #00d2ff;">Catatan Rilis:</div>
          ${notes || 'Perbaikan performa dan stabilitas aplikasi.'}
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="btnLaterUpdate" style="flex: 1; padding: 12px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.15); background: transparent; color: rgba(255, 255, 255, 0.8); font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;">Nanti Saja</button>
          <button id="btnConfirmUpdate" style="flex: 1; padding: 12px; border-radius: 12px; border: none; background: linear-gradient(135deg, #00d2ff 0%, #0066ff 100%); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 8px 20px rgba(0, 102, 255, 0.3); transition: all 0.2s;">Unduh</button>
        </div>
      `;

      overlay.appendChild(card);
      document.body.appendChild(overlay);

      // Animate in
      setTimeout(() => {
        overlay.style.opacity = '1';
        card.style.transform = 'scale(1)';
      }, 50);

      // Close handlers
      const closeModal = () => {
        overlay.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        setTimeout(() => overlay.remove(), 400);
      };

      document.getElementById('btnLaterUpdate').addEventListener('click', closeModal);

      document.getElementById('btnConfirmUpdate').addEventListener('click', () => {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
          window.Capacitor.Plugins.Browser.open({ url: apkUrl });
        } else {
          window.open(apkUrl, '_blank');
        }
        closeModal();
      });
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
