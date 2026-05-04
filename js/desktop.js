/* ════ DESKTOP MODE & ADMIN FACE REGISTRATION ════ */
    /* ════════════════════════════════════════════════════
       ADMIN: DAFTARKAN WAJAH PEGAWAI
    ════════════════════════════════════════════════════════ */
    let _adminFaceTargetId = null;
    let _adminFaceTargetNama = null;

    async function loadAdminFaceReg() {
      const listEl = $('adminFaceRegList');
      const selectEl = $('selectPegawaiFaceReg');
      if (!listEl) return;

      listEl.innerHTML = `<div class="shimmer" style="height:44px;border-radius:10px"></div>`;

      try {
        // Muat daftar pegawai
        const ur = await apiFetch(P.userList + '?format=full', { method: 'GET' });
        const ud = ur.ok ? await ur.json() : [];
        let users = Array.isArray(ud) ? ud : (ud.data || []);

        // Urutkan berdasarkan ID (numerik)
        users.sort((a, b) => {
          const valA = Number(a.id || a.ID || 999999);
          const valB = Number(b.id || b.ID || 999999);
          return valA - valB;
        });

        // Populate select
        if (selectEl) {
          selectEl.innerHTML = `<option value="">— Pilih Pegawai —</option>` +
            users.map(u => {
              const uid = u.ID || u.id || u.telegram_id || '';
              const nama = u.Nama || u.nama || u.username || String(uid);
              return `<option value="${uid}" data-nama="${nama}">${nama}</option>`;
            }).join('');
        }

        const listEl2 = $('adminFaceRegList');
        if (!listEl2) return;

        if (!users.length) {
          listEl.innerHTML = `<div class="empty-state" style="padding:16px"><div class="empty-icon">👥</div><div class="empty-text">Tidak ada pegawai</div></div>`;
          return;
        }

        listEl.innerHTML = users.map(u => {
          const uid = String(u.ID || u.id || u.telegram_id || '');
          const nama = u.Nama || u.nama || u.username || uid;
          // Gunakan metadata has_face & has_signature dari view_user_mgmt
          const hasFace = !!(u.has_face);
          const hasSig = !!(u.has_signature);
          const facePhoto = u.face_photo || null;

          let engineBadge = '';
          if (hasFace) {
            const faceModel = u.face_model || null;
            if (faceModel === 'human') {
              engineBadge = '<span style="font-size:8px;padding:1px 4px;background:rgba(201,168,76,0.2);color:var(--gold);border-radius:4px;margin-left:4px;border:1px solid rgba(201,168,76,0.3);display:inline-block">🛡️ Human</span>';
            } else if (faceModel === 'faceapi') {
              engineBadge = '<span style="font-size:8px;padding:1px 4px;background:rgba(96,165,250,0.2);color:#60a5fa;border-radius:4px;margin-left:4px;border:1px solid rgba(96,165,250,0.3);display:inline-block">🤖 API</span>';
            } else {
              // Fallback to check length if face_histogram is available in 'u'
              const histD = u.face_histogram || u.descriptor;
              if (histD && histD !== '' && histD !== '[]') {
                try {
                  const arr = typeof histD === 'string' ? JSON.parse(histD) : histD;
                  const dLen = Array.isArray(arr) ? arr.length : 0;
                  if (dLen >= 512) engineBadge = '<span style="font-size:8px;padding:1px 4px;background:rgba(201,168,76,0.2);color:var(--gold);border-radius:4px;margin-left:4px;border:1px solid rgba(201,168,76,0.3);display:inline-block">🛡️ Human</span>';
                  else if (dLen === 128) engineBadge = '<span style="font-size:8px;padding:1px 4px;background:rgba(96,165,250,0.2);color:#60a5fa;border-radius:4px;margin-left:4px;border:1px solid rgba(96,165,250,0.3);display:inline-block">🤖 API</span>';
                } catch (e) { }
              }
            }
          }

          const faceS = hasFace ? '<span style="color:#22c55e">OK</span>' : '<span style="color:#ef4444">Belum</span>';
          const sigS = hasSig ? '<span style="color:#22c55e">OK</span>' : '<span style="color:#ef4444">Belum</span>';

          return `
            <div class="face-adm-item" style="padding:15px; border-radius:20px; display:flex; align-items:center; background:rgba(255,255,255,0.03); border:1px solid var(--border); margin-bottom:10px">
              <div class="face-adm-thumb" id="thumb-${uid}" style="width:64px; height:64px; border-radius:18px; flex-shrink:0; overflow:hidden; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.05); cursor:pointer" onclick="adminLoadSinglePhoto('${uid}')">
                ${facePhoto ? `<img src="${facePhoto}" style="width:100%;height:100%;object-fit:cover">` : 
                (hasFace ? '<span style="font-size:10px;color:var(--gold);font-weight:700">LIHAT</span>' : '<span style="opacity:0.3;font-size:32px">👤</span>')}
              </div>
              <div class="face-adm-info" style="flex:1; margin-left:14px; min-width:0">
                <div class="face-adm-name" style="font-size:14px; font-weight:800; color:#fff; word-break:break-word; line-height:1.3; margin-bottom:4px">${nama}</div>
                <div class="face-adm-status" style="font-size:10px; color:rgba(255,255,255,0.5)">
                  <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px">📷 Wajah: ${faceS}${engineBadge} <span style="margin:0 4px">·</span> ✍️ TTD: ${sigS}</div>
                  <div style="opacity:0.6; font-size:9px; margin-top:4px">ID: ${uid} &nbsp;·&nbsp; ${u.nip || u.NIP || '—'} &nbsp;·&nbsp; ${u.jabatan || u.Jabatan || '—'}</div>
                </div>
              </div>
              <div class="face-adm-btns" style="display:flex; flex-direction:column; gap:6px; margin-left:12px">
                <button class="face-adm-btn" onclick="adminCaptureFaceFor('${uid}','${nama.replace(/'/g, "&#39;")}')" style="min-width:75px">📷 Wajah</button>
                <button class="face-adm-btn" onclick="adminCaptureSignatureFor('${uid}','${nama.replace(/'/g, "&#39;")}')" style="min-width:75px">✍️ TTD</button>
              </div>
            </div>`;
        }).join('');

        if (listEl) listEl.style.display = 'block';
        const galleryEl = $('adminFaceGallery');
        if (galleryEl) galleryEl.style.display = 'none';
      } catch (e) {
        const errMsg = e?.message || 'Koneksi gagal';
        const galleryEl = $('adminFaceGallery');
        if (galleryEl) {
          galleryEl.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;padding:16px">
              <div class="empty-icon">🔌</div>
              <div class="empty-text">Gagal memuat galeri wajah</div>
              <div class="empty-sub" style="margin-bottom:12px">${errMsg}</div>
              <button onclick="loadAdminFaceReg()"
                style="padding:8px 18px;border-radius:10px;background:var(--gold-dim);border:1px solid rgba(201,168,76,.4);color:var(--gold);font-size:11px;font-weight:700;cursor:pointer">
                🔄 Coba Lagi
              </button>
            </div>`;
        }
        // Also reset the select dropdown
        const selectEl = $('selectPegawaiFaceReg');
        if (selectEl) selectEl.innerHTML = '<option value="">— Pilih Pegawai —</option>';
      }
    }

    // Fungsi On-Demand untuk memuat foto profil tunggal agar hemat egress
    async function adminLoadSinglePhoto(uid) {
      const container = $(`thumb-${uid}`);
      if (!container) return;
      
      const original = container.innerHTML;
      container.innerHTML = '<span class="spin-sm"></span>';
      
      try {
        const res = await apiFetch(`${P.userList}?user_id=${uid}`, { method: 'GET' });
        if (!res.ok) throw 0;
        const json = await res.json();
        const d = Array.isArray(json) ? (json[0] || {}) : (json.data || json);
        
        if (d && d.face_photo) {
          container.innerHTML = `<img src="${d.face_photo}" style="width:100%;height:100%;object-fit:cover;animation:fadeIn .3s">`;
          container.onclick = null; // Sudah dimuat
        } else {
           container.innerHTML = '<span style="opacity:0.3;font-size:32px">👤</span>';
        }
      } catch (e) {
        container.innerHTML = original;
        toast('Gagal memuat foto', 'error');
      }
    }

    function adminCaptureFaceFor(uid, nama) {
      _adminFaceTargetId = uid;
      _adminFaceTargetNama = nama;

      // Ubah judul kamera
      const title = $('camHeaderTitle');
      if (title) title.textContent = `📷 Daftar Wajah: ${nama}`;

      openCamOverlay({
        isRegister: true,
        onDone: async (cap) => {
          if (!cap?.dataUrl) return;
          const ok = await saveFaceRefFor(uid, cap.dataUrl, cap.descriptor, nama);
          if (ok) {
            loadAdminFaceReg();
            // Juga update status wajah admin card yang lama
            if (typeof loadFaceStatusAdmin === 'function') loadFaceStatusAdmin();
          }
        },
        onCancel: () => {
          const title = $('camTitle');
          if (title) title.textContent = '📸 Verifikasi Wajah';
        }
      });
    }

    function adminCaptureFace() {
      const selectEl = $('selectPegawaiFaceReg');
      if (!selectEl || !selectEl.value) {
        showResult('adminFaceRegResult', 'adminFaceRegRIcon', 'adminFaceRegRTitle', 'adminFaceRegRMsg',
          'warning', '⚠️', 'Pilih Pegawai', 'Pilih nama pegawai terlebih dahulu sebelum membuka kamera.');
        dom.show('adminFaceRegResult', 'flex');
        return;
      }
      const uid = selectEl.value;
      const opt = selectEl.options[selectEl.selectedIndex];
      const nama = opt ? (opt.dataset.nama || opt.text) : uid;
      adminCaptureFaceFor(uid, nama);
    }

    async function saveFaceRefFor(uid, dataUrl, descriptor, nama) {
      try {
        const savedAt = new Date().toISOString();

        // Safety check: Face MUST be detected
        if (!descriptor) {
          alert("⚠️ Wajah tidak terdeteksi dengan jelas. Harap posisikan wajah lurus ke kamera dan ambil foto lagi.");
          return false;
        }
        const descriptorArray = Array.from(descriptor);

        const ok = await syncFaceToServer(uid, dataUrl, descriptorArray, nama, savedAt);

        showResult('adminFaceRegResult', 'adminFaceRegRIcon', 'adminFaceRegRTitle', 'adminFaceRegRMsg',
          ok ? 'success' : 'warning',
          ok ? '✅' : '⚠️',
          ok ? 'Wajah Tersimpan!' : 'Gagal Simpan',
          ok ? `Wajah ${nama} berhasil didaftarkan.` : 'Terjadi kesalahan saat menyimpan di server.');
        dom.show('adminFaceRegResult', 'flex');

        return ok;
      } catch (e) {
        console.error('Registration error:', e);
        showResult('adminFaceRegResult', 'adminFaceRegRIcon', 'adminFaceRegRTitle', 'adminFaceRegRMsg',
          'warning', '🔌', 'Koneksi Gagal', 'Gagal menghubungi server pendaftaran wajah.');
        dom.show('adminFaceRegResult', 'flex');
        return false;
      }
    }

