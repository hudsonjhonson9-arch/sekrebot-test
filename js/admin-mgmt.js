    /* ════ ADMIN MGMT ════ */
    /**
     * Muat daftar admin aktif dari server dan render ke tabel.
     * @returns {Promise<void>}
     */
        async function loadAdminMgmt() {
      const el = $('adminMgmtList');
      if (!el) return;
      dom.shimmer(el.id, 1);
      try {
        // Gunakan cache dari loadJamAbsen() — tidak perlu fetch ulang ke server
        const jam = _jamAbsenCache || await _getJamAbsen();
        const ids = (jam || {}).admin_ids || [];

        // Update global ADMIN_IDS jika perlu
        if (ids.length) {
          ADMIN_IDS.length = 0;
          ids.forEach(id => ADMIN_IDS.push(id));
          IS_ADMIN = ADMIN_IDS.includes(MY_ID);
          REKAP_CHAT_ID = ADMIN_IDS[0] || MY_ID;
        }

        if (!ids.length) {
          el.innerHTML = `<div class="empty-state" style="padding:12px"><div class="empty-icon">👥</div><div class="empty-text">Belum ada admin terdaftar</div></div>`;
          return;
        }

        // Untuk tampilkan nama, fetch dari user-list
        let namaMap = {};
        try {
          const ur = await apiGet(P.userList + '?format=full');
          if (ur.ok) {
            const users = ur.rows || [];
            window._adminNipMap = {}; // Cache NIP for deletion
            users.forEach(u => {
              if (!u) return;
              const uid = parseInt(u.ID || u.id || u.telegram_id || 0);
              if (uid) {
                namaMap[uid] = u.Nama || u.nama || u.username || String(uid);
                window._adminNipMap[uid] = u.NIP || u.nip || '';
              }
            });
          }
        } catch (_) { }

        el.innerHTML = ids.map(id => {
          const nama = namaMap[id] || `ID: ${id}`;
          const isMe = id === MY_ID;
          // Role diambil dari window._adminRoleMap yang diisi oleh _getJamAbsen()
          const rawRole = window._adminRoleMap[id] || (isMe ? userProfile?.role : null) || 'admin';
          const rText = String(rawRole).toLowerCase().trim();
          // PENTING: ID pertama di ADMIN_IDS selalu Super Admin (Fallback)
          const isSAId = (Array.isArray(ADMIN_IDS) && ADMIN_IDS.length > 0 && String(id) === String(ADMIN_IDS[0]));
          const isSuperAdmin = rText.includes('super') || isSAId;
          
          console.log(`[AdminMgmt] ID: ${id}, RawRole: "${rawRole}", IsSuper: ${isSuperAdmin} (isSAId: ${isSAId})`);

          return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;margin-bottom:6px">
        <div style="font-size:18px">${isSuperAdmin ? '👑' : '🛡️'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:700;color:var(--text)">${nama}${isMe ? ' <span style="color:var(--gold);font-size:9px">(Anda)</span>' : ''}</div>
          <div style="font-size:9px;color:var(--muted);font-family:'JetBrains Mono',monospace">${id} · ${isSuperAdmin ? 'superadmin' : 'admin'}</div>
        </div>
        ${!isMe && ids.length > 1 ? `<button onclick="hapusAdmin(${id},'${nama.replace(/'/g, "&#39;")}')" style="padding:3px 10px;border-radius:7px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.08);color:#ef4444;font-size:10px;font-weight:700;cursor:pointer">🗑 Hapus</button>` : ''}
      </div>`;
        }).join('');
      } catch (e) {
        el.innerHTML = `<div class="empty-state" style="padding:12px"><div class="empty-icon">🔌</div><div class="empty-text">Gagal memuat daftar admin</div></div>`;
      }
    }

    /**
     * Tambah admin baru berdasarkan Telegram ID dan role.
     * @returns {Promise<void>}
     */
        async function tambahAdmin() {
      const idInput = $('inputAdminTgId');
      const nipInput = $('inputAdminNip');
      const namaInput = $('inputAdminNama');
      const roleInput = $('inputAdminRole');
      const tgId = parseInt(idInput?.value || 0);
      const nip = (nipInput?.value || '').trim();
      const nama = (namaInput?.value || '').trim();
      const role = roleInput?.value || 'admin';

      if (!tgId || tgId < 1) {
        _showAdminMgmtResult('warning', '⚠️', 'ID Tidak Valid', 'Masukkan Telegram ID yang benar.');
        return;
      }
      if (ADMIN_IDS.includes(tgId)) {
        _showAdminMgmtResult('warning', '⚠️', 'Sudah Ada', `ID ${tgId} sudah terdaftar sebagai admin.`);
        return;
      }
      try {
        const { ok: addOk, data: d } = await apiPost(P.adminAdd, {
            telegram_id: tgId, nip, nama, role,
            ditambahkan_oleh: MY_ID,
            timestamp: Math.floor(Date.now() / 1000)
          });
        if (!addOk || (d && d.ok === false)) {
          _showAdminMgmtResult('warning', '⚠️', 'Ditolak', (d && d.message) || 'Gagal menambahkan admin.');
          return;
        }
        ADMIN_IDS.push(tgId);
        REKAP_CHAT_ID = ADMIN_IDS[0] || MY_ID;
        if (idInput) idInput.value = '';
        if (nipInput) nipInput.value = '';
        if (namaInput) namaInput.value = '';
        _showAdminMgmtResult('success', '✅', 'Admin Ditambahkan', `${nama || tgId} berhasil ditambahkan sebagai ${role}.`);
        loadAdminMgmt();
      } catch (e) {
        _showAdminMgmtResult('fail', '🔌', 'Gagal', 'Server tidak merespons. Coba lagi.');
      }
    }

    async function hapusAdmin(tgId, nama) {
      if (tgId === MY_ID) {
        _showAdminMgmtResult('warning', '⚠️', 'Tidak Bisa', 'Anda tidak bisa menghapus akun Anda sendiri.');
        return;
      }
      if (ADMIN_IDS.length <= 1) {
        _showAdminMgmtResult('warning', '⚠️', 'Minimal 1 Admin', 'Harus ada minimal 1 admin yang terdaftar.');
        return;
      }
      if (!confirm(`Hapus ${nama} (${tgId}) dari daftar admin?`)) return;
      try {
        const targetNip = window._adminNipMap ? window._adminNipMap[tgId] : '';
        const { ok, data } = await apiPost(P.adminDel, { 
          telegram_id: tgId, 
          nip: targetNip,
          ditambahkan_oleh: MY_ID 
        });
        if (!ok || data?.ok === false) {
          _showAdminMgmtResult('warning', '⚠️', 'Ditolak', data.message || 'Gagal menghapus admin.');
          return;
        }
        const idx = ADMIN_IDS.indexOf(tgId);
        if (idx > -1) ADMIN_IDS.splice(idx, 1);
        REKAP_CHAT_ID = ADMIN_IDS[0] || MY_ID;
        _showAdminMgmtResult('success', '✅', 'Dihapus', `${nama} dihapus dari daftar admin.`);
        loadAdminMgmt();
      } catch (e) {
        _showAdminMgmtResult('fail', '🔌', 'Gagal', 'Server tidak merespons.');
      }
    }

    function _showAdminMgmtResult(type, icon, title, msg) {
      const el = $('adminMgmtResult');
      if (!el) return;
      el.style.display = 'block';
      showResult('adminMgmtResult', 'adminMgmtRIcon', 'adminMgmtRTitle', 'adminMgmtRMsg', type, icon, title, msg);
    }

    /* ── Cache bersama endpoint jamAbsen — P.jamAbsen hanya dipanggil 1× ──
       Baik loadJamAbsen() maupun loadAdminMgmt() memakai _getJamAbsen()
       sehingga tidak ada double-request ke server Google Sheets.           */
    let _jamAbsenCache = null;   // objek hasil JSON
    let _jamAbsenPromise = null;   // Promise aktif yang sedang berjalan

    async function _getJamAbsen() {
      if (_jamAbsenCache) return _jamAbsenCache;
      if (_jamAbsenPromise) return _jamAbsenPromise;
      _jamAbsenPromise = apiGet(P.jamAbsen)
        .then(res => {
          if (!res.ok) return Promise.reject(new Error('HTTP error'));
          const raw = res.data;
          _jamAbsenCache = (Array.isArray(raw) ? raw[0] : raw?.data || raw) || {};
          // Sinkronisasi role ke map global dari admin_list (bukan user_list)
          if (_jamAbsenCache.admin_roles) {
            Object.entries(_jamAbsenCache.admin_roles).forEach(([uid, role]) => {
              window._adminRoleMap[uid] = role;
            });
            // Re-apply admin UI jika role saya berubah (misal baru login)
            if (typeof _applyAdminUIExtended === 'function') _applyAdminUIExtended();
          }
          return _jamAbsenCache;
        })
        .catch(e => { _jamAbsenPromise = null; return Promise.reject(e); });
      return _jamAbsenPromise;
    }
    function _resetJamAbsenCache() {
      _jamAbsenCache = null;
      _jamAbsenPromise = null;
    }

    async function loadJamAbsen() {
      const uid = await waitForMyId();
      try {
        const jam = await _getJamAbsen();
        if (jam.masuk) { const m = toMenitStr(jam.masuk); if (m !== null) JAM_MASUK_MENIT = m; }
        if (jam.pulang) { const m = toMenitStr(jam.pulang); if (m !== null) JAM_PULANG_MENIT = m; }

        // ── Muat daftar admin dari server (dinamis, tanpa hardcode) ──
        if (Array.isArray(jam.admin_ids) && jam.admin_ids.length) {
          ADMIN_IDS.length = 0;
          jam.admin_ids.forEach(id => ADMIN_IDS.push(id));
        }
        IS_ADMIN = ADMIN_IDS.includes(uid);
        REKAP_CHAT_ID = ADMIN_IDS[0] || uid || null;
        _applyAdminUI();
        if (typeof _applyAdminUIExtended === 'function') _applyAdminUIExtended();

        try { localStorage.setItem('jam_absen_bapperida', JSON.stringify({ masuk: menitToStr(JAM_MASUK_MENIT), pulang: menitToStr(JAM_PULANG_MENIT) })); } catch (_) { }
        updateClock();
        initJamAdminUI();

        // FIX: Jika sedang di tab admin saat data jam/admin dimuat, refresh UI admin
        const activeTab = document.querySelector('.tab.active')?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
        if (activeTab === 'admin' && IS_ADMIN) {
          _applyAdminUIExtended();
          // Trigger loading data admin jika baru pertama kali terbuka
          if (typeof loadKonfirmasiAdmin === 'function') loadKonfirmasiAdmin();
        }
      } catch (e) {
        initJamAdminUI();
      }
    }

    function _applyAdminUI() {
      const panelAdmin = $('panel-admin');
      if (!panelAdmin) return;

      // Update visibility of manual log button in Rekap tab
      const btnLog = $('btnTambahLog');
      if (btnLog) btnLog.style.display = IS_ADMIN ? 'inline-block' : 'none';

      if (!IS_ADMIN) {
        panelAdmin.style.display = 'none';
        // Sembunyikan tombol tab admin jika ada
        const btn = document.querySelector('.tab[data-tab="admin"]');
        if (btn) btn.style.display = 'none';
        // Jika sedang di tab admin (yang sekarang terlarang), kembali ke absen
        if (localStorage.getItem('absen_last_tab') === 'admin') switchTab('absen');
      } else {
        panelAdmin.style.display = '';
        // Buat tombol tab admin jika belum ada, lalu tampilkan
        setupAdminTab();
        const btn = document.querySelector('.tab[data-tab="admin"]');
        if (btn) btn.style.display = '';
      }
    }

    /**
     * Simpan konfigurasi jam masuk/pulang global ke server.
     * @returns {Promise<void>}
     */
        async function simpanJamAbsen() {
      const inM = $('inputJamMasuk'), inP = $('inputJamPulang');
      if (!inM || !inP) return;
      const mMasuk = toMenitStr(inM.value);
      const mPulang = toMenitStr(inP.value);
      if (mMasuk === null || mPulang === null) {
        showResult('jamResult', 'jamRIcon', 'jamRTitle', 'jamRMsg', 'warning', '⚠️', 'Input Tidak Valid', 'Pastikan format jam benar (HH:MM).');
        return;
      }
      if (mMasuk >= mPulang) {
        showResult('jamResult', 'jamRIcon', 'jamRTitle', 'jamRMsg', 'warning', '⚠️', 'Jam Tidak Logis', 'Jam masuk harus lebih kecil dari jam pulang.');
        return;
      }
      const btn = $('btnSimpanJam');
      if (btn) { btn.disabled = true; dom.setText('btnJamText', '💾 Menyimpan...'); }
      try {
        await apiPost(P.jamAbsen, { 
          masuk: inM.value, 
          pulang: inP.value, 
          diubah_oleh: MY_ID, 
          nip: localStorage.getItem('MY_NIP') || '',
          timestamp: Math.floor(Date.now() / 1000) 
        });
        // Invalidasi cache agar loadAdminMgmt() membaca data terbaru
        _jamAbsenCache = null; _jamAbsenPromise = null;
        JAM_MASUK_MENIT = mMasuk;
        JAM_PULANG_MENIT = mPulang;
        try { localStorage.setItem('jam_absen_bapperida', JSON.stringify({ masuk: inM.value, pulang: inP.value })); } catch (_) { }
        updateClock();
        updateJamPreview();
        showResult('jamResult', 'jamRIcon', 'jamRTitle', 'jamRMsg', 'success', '✅', 'Jam Tersimpan!',
          `Masuk ≤ ${inM.value} · Pulang ≥ ${inP.value}\nBerlaku langsung untuk semua pengguna.`);
      } catch {
        showResult('jamResult', 'jamRIcon', 'jamRTitle', 'jamRMsg', 'warning', '⚠️', 'Gagal Menyimpan',
          'Simpan lokal berhasil, tapi gagal ke server. Pastikan webhook jam-absen aktif di n8n.');
        JAM_MASUK_MENIT = mMasuk;
        JAM_PULANG_MENIT = mPulang;
        try { localStorage.setItem('jam_absen_bapperida', JSON.stringify({ masuk: inM.value, pulang: inP.value })); } catch (_) { }
        updateClock(); updateJamPreview();
      } finally {
        if (btn) { setTimeout(() => { btn.disabled = false; dom.setText('btnJamText', 'Simpan Pengaturan Jam'); }, 2500); }
      }
    }

    /* ════ ADMIN JAM ════ */
    /* ════ PENGATURAN JAM ABSEN (ADMIN) ════ */
    function updateJamPreview() {
      const jmStr = menitToStr(JAM_MASUK_MENIT);
      const jpStr = menitToStr(JAM_PULANG_MENIT);
      setT('prevMasuk', jmStr);
      setT('prevMasuk1', menitToStr(JAM_MASUK_MENIT + 1));  // Terlambat mulai dari JamMasuk+1
      setT('prevTengah', '11:59');                           // Terlambat s/d sebelum tengah hari
      setT('prevTengah2', '12:00');
      setT('prevPulang1', menitToStr(JAM_PULANG_MENIT - 1)); // Belum waktunya s/d JamPulang-1
      setT('prevPulang', jpStr);
    }

    function initJamAdminUI() {
      const inM = $('inputJamMasuk'), inP = $('inputJamPulang');
      if (!inM || !inP) return;
      inM.value = menitToStr(JAM_MASUK_MENIT);
      inP.value = menitToStr(JAM_PULANG_MENIT);
      updateJamPreview();
      inM.addEventListener('input', () => {
        const m = toMenitStr(inM.value);
        if (m !== null) { JAM_MASUK_MENIT = m; updateJamPreview(); updateClock(); }
      });
      inP.addEventListener('input', () => {
        const m = toMenitStr(inP.value);
        if (m !== null) { JAM_PULANG_MENIT = m; updateJamPreview(); updateClock(); }
      });
    }

