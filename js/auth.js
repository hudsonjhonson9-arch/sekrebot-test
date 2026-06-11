/* ════ AUTH — LOGIN, REGISTER, LOGOUT ════ */

    // ── AUTH LOGIC (LOGIN & REGISTRATION) ──
    function switchAuthTab(mode) {
      if (mode === 'login') {
        $('tabLogin').classList.add('active');
        $('tabRegister').classList.remove('active');
        $('formLogin').style.display = 'block';
        $('formRegister').style.display = 'none';
      } else {
        $('tabLogin').classList.remove('active');
        $('tabRegister').classList.add('active');
        $('formLogin').style.display = 'none';
        $('formRegister').style.display = 'block';
        // Populate & Toggle Telegram ID visibility
        const regTg = $('regTelegram');
        const regTgWrapper = $('regTelegramWrapper');
        if (regTg) {
          regTg.value = window.MY_ID || '';
          if (window.MY_ID) {
            if (regTgWrapper) regTgWrapper.style.display = 'block';
            regTg.style.border = '1px solid rgba(100, 255, 100, 0.2)';
            regTg.style.color = '#4ade80'; 
          } else {
            if (regTgWrapper) regTgWrapper.style.display = 'none';
          }
        }
        // Pre-fill Instansi from URL if present
        const urlParams = new URLSearchParams(window.location.search);
        const instParam = urlParams.get('instansi') || urlParams.get('instansi_id');
        if (instParam && $('regInstansi')) {
          $('regInstansi').value = instParam;
        }
      }
    }

    async function handleAuthAction(mode) {
      const btn = mode === 'login' ? $('btnLogin') : $('btnRegister');
      const originalText = btn.innerHTML;

      btn.disabled = true;
      btn.innerHTML = '<span class="spin-sm"></span> Memproses...';

      try {
        if (mode === 'login') {
          const nip = $('loginNip').value.trim();
          if (!nip) throw new Error('Silakan masukkan NIP');
          if (nip.length < 3) throw new Error('ID / NIP minimal terdiri dari 3 karakter');

          const res = await apiGet(`${P.userList}?nip=${nip}`);
          if (!res.ok) throw new Error('Server tidak merespons. Coba lagi.');

          // Tangani berbagai format response n8n:
          // - Array of objects: res.rows = [{id, nip, ...}]
          // - Single object: res.data = {single: true, id, nip, ...}
          const rawData = res.data;
          let user = null;
          if (res.rows && res.rows.length) {
            user = res.rows.find(u => String(u.nip || '').trim() === nip)
                || res.rows[0];
          } else if (rawData && !Array.isArray(rawData)) {
            // Single-object response (n8n versi lama)
            if (rawData.single || rawData.id || rawData.nip) user = rawData;
          }

          if (!user || user.error || !user.id) throw new Error('NIP tidak terdaftar. Silakan daftar baru.');

          // Verifikasi akhir untuk memastikan NIP benar
          if (String(user.nip || '').trim() !== nip) {
            throw new Error('Hasil pencarian NIP tidak cocok. Hubungi admin.');
          }

          // ── FACE VERIFICATION LOGIN (PASSWORDLESS) ──
          const isFaceEnabled = typeof FACE_RECOGNITION_ENABLED !== 'undefined' ? FACE_RECOGNITION_ENABLED : true;
          const hasFace = !!(user.face_histogram || user.face_photo || user.face_model || user.foto_base64 || user.descriptor);
          const userNip = String(user.nip || '').trim();
          const targetId = String(user.telegram_id || user.id);
          
          const finalizeLogin = () => {
             window.MY_ID = targetId;
             localStorage.setItem(STORAGE_KEYS.USER_ID, window.MY_ID);
             localStorage.setItem('MY_NIP', userNip);
             localStorage.setItem('MY_ROLE', String(user.role || 'USER').toUpperCase());
             localStorage.setItem('MY_NAME', String(user.nama || 'User'));
             localStorage.setItem(STORAGE_KEYS.USER_OBJ, JSON.stringify(user));
             const finalInst = (user.instansi_id || user.Instansi_Id || '').trim();
             if (finalInst) localStorage.setItem('MY_INSTANSI', finalInst);
             else localStorage.removeItem('MY_INSTANSI');
             location.reload();
          };

          if (isFaceEnabled && typeof openCamOverlay === 'function') {
             // Sembunyikan form login
             const overlayEl = document.getElementById('authOverlay');
             if (overlayEl) overlayEl.style.display = 'none';

             // Inject variabel sementara untuk face.js
             window.MY_ID = targetId;
             window.tgUser = { first_name: user.nama || 'User', username: userNip };
             
             if (!hasFace) {
                // REGISTRASI WAJAH PERTAMA KALI
                alert('Wajah Anda belum terdaftar.\nSilakan daftarkan wajah Anda ke sistem sekarang untuk mengamankan akun (Passwordless).');
                openCamOverlay({
                   isRegister: true,
                   onDone: () => {
                      alert('Wajah berhasil didaftarkan! Selamat datang.');
                      finalizeLogin();
                   },
                   onCancel: () => {
                      window.MY_ID = null; // revert
                      window.tgUser = {};
                      if (overlayEl) overlayEl.style.display = 'flex';
                      btn.disabled = false;
                      btn.innerHTML = originalText;
                   }
                });
             } else {
                // VERIFIKASI WAJAH
                openCamOverlay(async (camResult) => {
                   let similarity = 0;
                   if (camResult && camResult.descriptor) {
                      const refDescRaw = user.face_histogram || user.face_descriptor || user.descriptor || user.histogram || null;
                      if (refDescRaw) {
                          try {
                             let refDesc = typeof refDescRaw === 'string' ? JSON.parse(refDescRaw) : refDescRaw;
                             if (typeof refDesc === 'string') {
                                try { refDesc = JSON.parse(refDesc); } catch(e){}
                             }
                             if (refDesc && !Array.isArray(refDesc) && typeof refDesc === 'object') {
                                refDesc = Object.values(refDesc);
                             } else if (refDesc) {
                                refDesc = Array.from(refDesc);
                             }

                             const capDesc = Array.from(camResult.descriptor);
                             const refDim = refDesc ? refDesc.length : 0;
                             const capDim = capDesc.length;

                             if (refDim > 0 && capDim > 0) {
                                 if (capDim >= 512 && refDim >= 512 && window.HumanInstance) {
                                     similarity = window.HumanInstance.match.similarity(refDesc, capDesc);
                                 } else if (capDim === 128 && refDim === 128) {
                                     let sum = 0;
                                     for(let i=0; i<refDim; i++) {
                                        sum += (refDesc[i] - capDesc[i]) ** 2;
                                     }
                                     const dist = Math.sqrt(sum);
                                     similarity = Math.max(0, 1 - (dist / 1.5));
                                 }
                             }
                          } catch(e){
                             console.error('[Login] Error parsing face reference:', e);
                          }
                      }
                   }

                   // Threshold 0.50 untuk kemiripan wajah
                   if (similarity >= 0.50) {
                      finalizeLogin();
                   } else {
                      alert(`Verifikasi Gagal!\nWajah tidak cocok (Akurasi: ${(similarity*100).toFixed(0)}%). Silakan coba lagi atau posisikan wajah lurus ke kamera.`);
                      window.MY_ID = null; // Revert
                      window.tgUser = {};
                      if (overlayEl) overlayEl.style.display = 'flex';
                      btn.disabled = false;
                      btn.innerHTML = originalText;
                   }
                });
             }
             // Biarkan tombol disable selagi kamera aktif
             return; 
          } else {
             // Jika Face Recognition didisable dari admin, login normal
             finalizeLogin();
             return;
          }
        } else {
          const payload = {
            id: $('regTelegram')?.value.trim() || window.MY_ID || Math.floor(Math.random() * 1000000),
            nama: $('regNama').value.trim(),
            nip: $('regNip').value.trim(),
            jabatan: $('regJabatan').value.trim(),
            no_hp: $('regNomor')?.value.trim() || '',
            bidang: $('regBidang').value || '',
            pangkat: $('regPangkat').value || '',
            status: 'AKTIF',
            role: 'USER',
            instansi_id: ($('regInstansi')?.value || '').trim() || getScopedInstansiId() || ''
          };

          if (!payload.nama || !payload.nip) throw new Error('Nama dan NIP wajib diisi');
          if (payload.nip.length < 3) throw new Error('ID / NIP minimal terdiri dari 3 karakter');
          if (payload.no_hp && payload.no_hp.length < 10) throw new Error('Nomor WhatsApp minimal 10 digit');

          const { ok: regOk, data: d } = await apiPost(P.userAdd || P.faceRegister, payload);
          if (!regOk || d?.ok === false) throw new Error(d?.message || 'Pendaftaran gagal');

          window.MY_ID = payload.id;
          localStorage.setItem(STORAGE_KEYS.USER_ID, String(window.MY_ID));
          localStorage.setItem('MY_NIP', String(payload.nip));
          location.reload();
        }
      } catch (err) {
        alert('⚠️ ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }


    // Global Logout Handler
    async function handleLogout() {
      if (!confirm('Apakah Anda yakin ingin keluar dari akun ini?')) return;
      console.log('[Auth] Logging out user...');
      localStorage.clear();
      
      // Force return to login screen
      location.href = location.pathname; 
    }

    function _checkIdentityOnLoad() {
      if (!window.MY_ID) {
        $('authOverlay').style.display = 'flex';
        const splash = $('appSplash');
        if (splash) splash.remove(); // No need splash if no auth
        return false;
      }
      return true;
    }

