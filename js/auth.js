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
          const nip = $('loginNip').value.trim().replace(/\s/g, '');
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
          const hasFace = !!(user.face_histogram && user.face_histogram !== '[]' && user.face_histogram !== '[]' && user.face_histogram !== '')
            || !!(user.face_photo && user.face_photo !== '' && user.face_photo !== 'null')
            || !!(user.foto_base64 && user.foto_base64 !== '')
            || !!(user.descriptor && user.descriptor !== '[]');
          const userNip = String(user.nip || '').trim();
          const targetId = String(user.telegram_id || user.id);
          
          const finalizeLogin = async () => {
            try {
              const sessionBody = { nip: userNip, user_id: targetId, role: user.role || 'USER', instansi_id: user.instansi_id || user.Instansi_Id || '' };
               const { ok, data: sData } = await apiPost(P.sessionLogin, sessionBody);
               console.log('[Login] Session response:', { ok, data: sData });
               if (ok && sData?.session_token) {
                setSession(sData.session_token, { nip: userNip, role: user.role || 'USER', instansi_id: user.instansi_id || '' });
              } else {
                // Fallback: generate client-side token if n8n doesn't provide one
                const fallbackToken = 'cs_' + Date.now() + '_' + Math.random().toString(36).slice(2);
                console.log('[Login] Using fallback token');
                setSession(fallbackToken, { nip: userNip, role: user.role || 'USER', instansi_id: user.instansi_id || '' });
              }
            } catch (_) {}
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
                    onDone: async (camResult) => {
                       if (!camResult || !camResult.dataUrl) {
                          alert('Gagal mengambil data wajah.');
                          if (overlayEl) overlayEl.style.display = 'flex';
                          btn.disabled = false;
                          btn.innerHTML = originalText;
                          return;
                       }
                       
                       try {
                          const faceOk = await syncFaceToServer(targetId, camResult.dataUrl, camResult.descriptor, user.nama, new Date().toISOString());
                          if (!faceOk) throw new Error('Gagal menyimpan data wajah ke server. Hubungi Admin.');
                          alert('Wajah berhasil didaftarkan! Selamat datang.');
                          finalizeLogin();
                       } catch (err) {
                          alert('⚠️ ' + err.message);
                          if (overlayEl) overlayEl.style.display = 'flex';
                          btn.disabled = false;
                          btn.innerHTML = originalText;
                       }
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
                openCamOverlay(async (camResult) => {
                    let similarity = 0;
                    let failReason = "Wajah tidak cocok. Silakan coba lagi.";

                    if (camResult && camResult.descriptor) {
                       let refDescRaw = user.face_histogram || user.face_descriptor || user.descriptor || user.histogram || null;

                       // AUTO-GENERATE: Jika database tidak mengirim descriptor tapi ada foto base64
                       if (!refDescRaw && (user.foto_base64 || user.face_photo) && typeof getDescriptorFromDataUrl === 'function') {
                           try {
                               console.log('[Login] Descriptor kosong dari server. Generate ulang dari foto_base64 secara live...');
                               refDescRaw = await getDescriptorFromDataUrl(user.foto_base64 || user.face_photo);
                               if (refDescRaw) {
                                   console.log('[Login] Berhasil generate ulang descriptor wajah dari foto.');
                               }
                           } catch(e) {
                               console.warn('[Login] Gagal mengekstrak descriptor dari foto:', e);
                           }
                       }

                       if (!refDescRaw) {
                           failReason = "Data biometrik wajah (descriptor) tidak ditemukan di server. Hubungi Admin untuk mendaftar ulang wajah.";
                       } else {
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

                              if (refDim === 0) {
                                  failReason = "Data biometrik wajah Anda di database rusak (dimensi 0). Hubungi Admin.";
                              } else if (refDim > 0 && capDim > 0) {
                                  const AI = typeof HumanInstance !== 'undefined' ? HumanInstance : window.HumanInstance;
                                  if (capDim >= 512 && refDim >= 512 && AI) {
                                      similarity = AI.match.similarity(refDesc, capDesc);
                                      failReason = `Wajah tidak cocok (Akurasi: ${(similarity*100).toFixed(0)}%). Posisikan wajah dengan lurus.`;
                                  } else if (capDim >= 512 && refDim >= 512) {
                                      // Fallback manual Cosine Similarity
                                      let dot = 0, normA = 0, normB = 0;
                                      for(let i=0; i<refDim; i++) {
                                         dot += refDesc[i] * capDesc[i];
                                         normA += refDesc[i] * refDesc[i];
                                         normB += capDesc[i] * capDesc[i];
                                      }
                                      similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
                                      failReason = `Wajah tidak cocok (Akurasi: ${(similarity*100).toFixed(0)}%).`;
                                  } else if (capDim === 128 && refDim === 128) {
                                      let sum = 0;
                                      for(let i=0; i<refDim; i++) {
                                         sum += (refDesc[i] - capDesc[i]) ** 2;
                                      }
                                      const dist = Math.sqrt(sum);
                                      similarity = Math.max(0, 1 - (dist / 1.5));
                                      failReason = `Wajah tidak cocok (Akurasi: ${(similarity*100).toFixed(0)}%).`;
                                  } else {
                                       failReason = `Data wajah format lama (${refDim}-dim). Silakan daftar ulang wajah di menu Profil → Face AI.`;
                                  }
                              }
                           } catch(e){
                              console.error('[Login] Error parsing face reference:', e);
                              failReason = "Terjadi kesalahan saat memproses data wajah dari server.";
                           }
                       }
                    } else {
                       failReason = "Kamera gagal memindai wajah Anda dengan benar.";
                    }

                    // Threshold 0.50 untuk kemiripan wajah
                    if (similarity >= 0.50) {
                       await finalizeLogin();
                    } else {
                       alert(`Verifikasi Gagal!\n${failReason}`);
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
              await finalizeLogin();
              return;
           }
        } else {
          const payload = {
            id: $('regTelegram')?.value.trim() || window.MY_ID || String(Math.floor(Math.random() * 1000000)),
            nama: $('regNama').value.trim(),
            nip: $('regNip').value.trim().replace(/\s/g, ''),
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

          // Cek apakah NIP sudah terdaftar
          const cek = await apiGet(`${P.userList}?nip=${payload.nip}`);
          if (cek.ok) {
            const ada = cek.rows.find(u => String(u.nip || '').trim() === payload.nip);
            if (ada) throw new Error('NIP ' + payload.nip + ' sudah terdaftar. Silakan login.');
          }

          // Sembunyikan form pendaftaran sementara untuk scan wajah
          const overlayEl = document.getElementById('authOverlay');
          if (overlayEl) overlayEl.style.display = 'none';

          alert('Untuk menyelesaikan pendaftaran, silakan scan wajah Anda.');

          // Buka kamera untuk mendaftarkan wajah
          openCamOverlay({
            isRegister: true,
            onDone: async (camResult) => {
              if (!camResult || !camResult.dataUrl) {
                alert('Pendaftaran dibatalkan: Gagal memindai wajah.');
                if (overlayEl) overlayEl.style.display = 'flex';
                btn.disabled = false;
                btn.innerHTML = originalText;
                return;
              }

              btn.disabled = true;
              btn.innerHTML = '<span class="spin-sm"></span> Menyimpan Akun...';

              try {
                // 1. Simpan user ke database
                const { ok: regOk, data: d } = await apiPost(P.userAdd || P.faceRegister, payload);
                if (!regOk || d?.ok === false) throw new Error(d?.message || 'Pendaftaran user gagal');

                // 2. Simpan wajah ke server
                window.MY_ID = payload.id;
                window.tgUser = { first_name: payload.nama, username: payload.nip };
                
                const faceOk = await syncFaceToServer(payload.id, camResult.dataUrl, camResult.descriptor, payload.nama, new Date().toISOString());
                if (!faceOk) throw new Error('Gagal menyimpan data wajah ke server. Hubungi Admin.');

                // 3. Buat session + finalisasi login
                try {
                  const sBody = { nip: payload.nip, user_id: payload.id, role: 'USER', instansi_id: payload.instansi_id || '' };
                  const { ok, data: sData } = await apiPost(P.sessionLogin, sBody);
                  console.log('[Register] Session response:', { ok, data: sData });
                  if (ok && sData?.session_token) {
                    setSession(sData.session_token, { nip: payload.nip, role: 'USER', instansi_id: payload.instansi_id || '' });
                  } else {
                    const fallbackToken = 'cs_' + Date.now() + '_' + Math.random().toString(36).slice(2);
                    console.log('[Register] Using fallback token');
                    setSession(fallbackToken, { nip: payload.nip, role: 'USER', instansi_id: payload.instansi_id || '' });
                  }
                } catch (_) {}
                localStorage.setItem(STORAGE_KEYS.USER_ID, String(window.MY_ID));
                localStorage.setItem('MY_NIP', String(payload.nip));
                localStorage.setItem('MY_ROLE', 'USER');
                localStorage.setItem('MY_NAME', String(payload.nama));
                localStorage.setItem(STORAGE_KEYS.USER_OBJ, JSON.stringify(payload));
                if (payload.instansi_id) localStorage.setItem('MY_INSTANSI', payload.instansi_id);

                alert('Pendaftaran berhasil! Wajah Anda telah terdaftar.');
                location.reload();
              } catch (err) {
                alert('⚠️ ' + err.message);
                window.MY_ID = null;
                window.tgUser = {};
                if (overlayEl) overlayEl.style.display = 'flex';
                btn.disabled = false;
                btn.innerHTML = originalText;
              }
            },
            onCancel: () => {
              if (overlayEl) overlayEl.style.display = 'flex';
              btn.disabled = false;
              btn.innerHTML = originalText;
            }
          });
          return;
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
      if (window._session?.token) {
        try {
          await apiPost(P.sessionLogin, { action: 'logout', session_token: window._session.token });
        } catch (_) {}
      }
      clearSession();
      // Hapus auth-related keys saja, simpan face data + preferences
      localStorage.removeItem(STORAGE_KEYS.USER_ID);
      localStorage.removeItem(STORAGE_KEYS.USER_OBJ);
      localStorage.removeItem('MY_NIP');
      localStorage.removeItem('MY_ROLE');
      localStorage.removeItem('MY_INSTANSI');
      
      // Force return to login screen
      location.href = location.pathname; 
    }

    async function _checkIdentityOnLoad() {
      if (!window.MY_ID) {
        $('authOverlay').style.display = 'flex';
        const splash = $('appSplash');
        if (splash) splash.remove();
        return false;
      }
      // MY_ID ada tapi token tidak ada → auto-login dari Telegram ID
      if (!window._session.token) {
        const isTg = !!(window.Telegram?.WebApp?.initData || new URLSearchParams(window.location.search).has('id'));
        if (isTg) {
          console.log('[Auth] Telegram user without session → auto-login from Telegram ID');
          let nip = '', role = 'USER', instansi = '', targetId = window.MY_ID;

          // Coba fetch user data dari server (best-effort)
          try {
            const { ok, data: users } = await apiGet(P.userList + '?user_id=' + window.MY_ID);
            console.log('[Auth] user-list response:', { ok, users });
            if (ok && users) {
              const user = Array.isArray(users) ? users[0] : users;
              if (user && user.id) {
                nip = String(user.nip || '').trim();
                targetId = String(user.telegram_id || user.id || window.MY_ID);
                role = user.role || 'USER';
                instansi = user.instansi_id || user.Instansi_Id || '';
                localStorage.setItem(STORAGE_KEYS.USER_OBJ, JSON.stringify(user));
              }
            }
          } catch (e) {
            console.warn('[Auth] user-list fetch failed, using Telegram ID only:', e);
          }

          // Selalu buat session — Telegram ID valid sebagai identitas
          if (!nip) nip = 'TG_' + window.MY_ID; // fallback NIP from Telegram ID
          try {
            const { ok: sOk, data: sData } = await apiPost(P.sessionLogin, { nip, user_id: targetId, role, instansi_id: instansi });
            console.log('[Auth] session-login response:', { ok: sOk, data: sData });
            if (sOk && sData?.session_token) {
              setSession(sData.session_token, { nip, role, instansi_id: instansi });
            } else {
              const fallbackToken = 'cs_' + Date.now() + '_' + Math.random().toString(36).slice(2);
              console.log('[Auth] Using fallback token');
              setSession(fallbackToken, { nip, role, instansi_id: instansi });
            }
          } catch (_) {
            const fallbackToken = 'cs_' + Date.now() + '_' + Math.random().toString(36).slice(2);
            console.log('[Auth] session-login failed, using fallback token');
            setSession(fallbackToken, { nip, role, instansi_id: instansi });
          }

          // Simpan user data
          window.MY_ID = targetId;
          localStorage.setItem(STORAGE_KEYS.USER_ID, targetId);
          localStorage.setItem('MY_NIP', nip);
          localStorage.setItem('MY_ROLE', String(role).toUpperCase());
          if (instansi) localStorage.setItem('MY_INSTANSI', instansi);
          console.log('[Auth] Auto-login success:', { targetId, nip, role, hasToken: !!window._session.token });
          return true;
        }
        // Non-Telegram: force re-login
        console.warn('[Auth] No session token → forcing re-login');
        localStorage.removeItem(STORAGE_KEYS.USER_ID);
        localStorage.removeItem(STORAGE_KEYS.USER_OBJ);
        localStorage.removeItem('MY_NIP');
        localStorage.removeItem('MY_ROLE');
        window.MY_ID = null;
        window.tgUser = {};
        window.userProfile = null;
        $('authOverlay').style.display = 'flex';
        const splash = $('appSplash');
        if (splash) splash.remove();
        return false;
      }
      return true;
    }

