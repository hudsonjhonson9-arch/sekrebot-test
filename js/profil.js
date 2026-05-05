/* ════ PROFIL & DOKUMEN ════ */
    /* ════ USER PROFILE ════ */
    let userProfile = null;
    let _profileLoading = false;

    async function loadUserProfile(isManual = false) {
      if (_profileLoading) return;
      _profileLoading = true;
      const uid = await waitForMyId();
      if (!uid) { _profileLoading = false; setUserFallback(); return; }

      // Tampilkan loading jika manual refresh
      if (isManual) {
        setT('userJabatan', 'Memuat...');
        setT('ketJabatan', 'Memuat...');
      }

      let attempt = 0;
      const maxAttempts = 3;

      while (attempt < maxAttempts) {
        attempt++;
        try {
          const res = await apiGet(P.userList, { user_id: uid });
          if (!res.ok) throw new Error('Network Error');
          // apiGet returns rows (array) + data (raw json)
          // Coba ambil dari rows dulu, lalu fallback ke data
          const d = res.rows.length
            ? res.rows.find(r => String(r.id || r.ID || r.telegram_id) === String(uid)) || res.rows[0]
            : (Array.isArray(res.data) ? (res.data[0] || {}) : (res.data?.data?.[0] || res.data || {}));

          if (d && (d.nama || d.Nama)) {
            userProfile = {
              nama: d.nama || d.Nama || '',
              jabatan: d.jabatan || d.Jabatan || '',
              nip: d.nip || d.NIP || '',
              username: d.username || d.Username || tgUser.username || '',
              status: d.status || d.Status || 'AKTIF',
              role: (d.role || d.Role || 'user').toLowerCase().replace(/\s/g, ''),
              tgl_pangkat: d.tgl_pangkat || d.tgl_kenaikan_pangkat || null,
              tgl_berkala: d.tgl_berkala || d.tgl_kenaikan_berkala || null
            };
            applyProfile();
            _profileLoading = false;
            return; // Berhasil
          } else {
            // Data kosong atau { ok: false }
            if (attempt === maxAttempts) throw new Error('User not found');
            await new Promise(r => setTimeout(r, 600)); // Tunggu sebentar sebelum coba lagi
          }
        } catch (err) {
          console.warn(`[Profile] Gagal memuat (Attempt ${attempt}/${maxAttempts}):`, err.message);
          if (attempt === maxAttempts) break;
          await new Promise(r => setTimeout(r, 600));
        }
      }

      _profileLoading = false;
      // Hanya panggil fallback jika data benar-benar kosong (misal: pertama kali buka)
      // Jika sebelumnya sudah berhasil load, pertahankan data lama agar tidak "hilang" (UX stabil)
      if (!userProfile) {
        setUserFallback();
      } else if (isManual) {
        // Jika manual refresh gagal, beri tahu user tapi jangan hapus data yang ada
        applyProfile();
        console.warn('[Profile] Manual refresh failed, preserving existing data.');
      }
    }
    function fullName() { return tgUser.first_name ? `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}` : 'Pengguna'; }
    function applyProfile() {
      const p = userProfile, n = p.nama || fullName(), i = (n[0] || '?').toUpperCase();
      ['userAvatar', 'ketAvatar'].forEach(id => { const e = $(id); if (e) e.textContent = i; });
      setT('userName', n); setT('ketNama', n);
      setT('userJabatan', p.jabatan || '—'); setT('ketJabatan', p.jabatan || '—');
      setT('userMeta', `NIP: ${p.nip || '—'}`); setT('ketMeta', `NIP: ${p.nip || '—'}`);
      // ── Badge status (baca dari data, bukan hardcode) ──
      const st = (p.status || 'AKTIF').toUpperCase();
      const stEmoji = st === 'AKTIF' ? '✅' : st === 'SAKIT' ? '🤒' : st === 'IZIN' ? '🙏' : st === 'TUGAS' ? '💼' : st === 'NONAKTIF' ? '🚫' : '⚙️';
      const stCls = st === 'AKTIF' ? 's-aktif' : st === 'NONAKTIF' ? 's-nonaktif' : 's-ket';
      const b = $('userBadge'); if (b) { b.textContent = `${stEmoji} ${st}`; b.className = `sbadge ${stCls}`; }
      // ── Isi kartu profil besar ──
      const al = $('profilAvatarLg'); if (al) al.textContent = i;
      setT('profilNama', n);
      setT('profilJabatan', p.jabatan || '—');
      setT('profilNip', `NIP: ${p.nip || '—'}`);
      const tb = $('profilTgBadge');
      if (tb) tb.textContent = `🔗 @${tgUser.username || 'Telegram'}`;
      // ── Badge profil besar (dinamis) ──
      const pb = $('profilStatusBadge');
      if (pb) { pb.textContent = `${stEmoji} ${st}`; pb.className = `profil-badge ${stCls === 's-aktif' ? 'aktif-badge' : stCls === 's-nonaktif' ? 'nonaktif-badge' : 'ket-status-badge'}`; }

      // Update global role map for current user
      if (MY_ID && p.role) {
        window._adminRoleMap[MY_ID] = p.role;
        // Jika status admin berubah, re-apply UI
        if (typeof _applyAdminUIExtended === 'function') _applyAdminUIExtended();
      }

      renderReminders(p);
      updateProfilFaceUI();
    }
    function setUserFallback() {
      const n = fullName(), i = (n[0] || '?').toUpperCase();
      ['userAvatar', 'ketAvatar'].forEach(id => { const e = $(id); if (e) e.textContent = i; });
      setT('userName', n); setT('ketNama', n);
      setT('userJabatan', '—'); setT('ketJabatan', '—');
      setT('userMeta', `@${tgUser.username || '—'} · ID: ${MY_ID || '—'}`);
      setT('ketMeta', `@${tgUser.username || '—'} · ID: ${MY_ID || '—'}`);
      const b = $('userBadge'); if (b) { b.textContent = '⚙️ —'; b.className = 'sbadge'; }
      const al = $('profilAvatarLg'); if (al) al.textContent = i;
      setT('profilNama', n);
      setT('profilJabatan', '—');
      setT('profilNip', 'NIP —');
      const tb = $('profilTgBadge'); if (tb) tb.textContent = `🔗 @${tgUser.username || '—'}`;
    }

    /* ════ PENGINGAT KENAIKAN PANGKAT & BERKALA ════ */
    function renderReminders(p) {
      const sec = $('profilReminderSection');
      if (!sec) return;
      const reminders = [];

      // Baca tgl_pangkat & tgl_berkala dari userProfile (jika ada di Google Sheets)
      const tglPangkat = p.tgl_pangkat || p.TglPangkat || p.tgl_kenaikan_pangkat || null;
      const tglBerkala = p.tgl_berkala || p.TglBerkala || p.tgl_kenaikan_berkala || null;
      const now = nowWITA();

      function selisihBulan(tglStr) {
        if (!tglStr) return null;
        const t = new Date(tglStr);
        if (isNaN(t)) return null;
        return Math.round((t - now) / (1000 * 60 * 60 * 24 * 30));
      }

      const bPangkat = selisihBulan(tglPangkat);
      const bBerkala = selisihBulan(tglBerkala);

      if (bPangkat !== null) {
        if (bPangkat <= 0)
          reminders.push({ cls: 'reminder-warn', icon: '🎖️', title: 'Kenaikan Pangkat Sudah Jatuh Tempo!', sub: `Segera ajukan kenaikan pangkat. Tanggal: ${tglPangkat}` });
        else if (bPangkat <= 3)
          reminders.push({ cls: 'reminder-warn', icon: '⚠️', title: `Kenaikan Pangkat ${bPangkat} bulan lagi`, sub: `Segera siapkan berkas. Tanggal: ${tglPangkat}` });
        else if (bPangkat <= 6)
          reminders.push({ cls: 'reminder-info', icon: '📋', title: `Kenaikan Pangkat ${bPangkat} bulan lagi`, sub: `Tanggal kenaikan: ${tglPangkat}` });
        else
          reminders.push({ cls: 'reminder-ok', icon: '✅', title: `Pangkat aman — ${bPangkat} bulan lagi`, sub: `Tanggal kenaikan: ${tglPangkat}` });
      }

      if (bBerkala !== null) {
        if (bBerkala <= 0)
          reminders.push({ cls: 'reminder-warn', icon: '💰', title: 'Kenaikan Berkala Sudah Jatuh Tempo!', sub: `Segera ajukan kenaikan berkala. Tanggal: ${tglBerkala}` });
        else if (bBerkala <= 3)
          reminders.push({ cls: 'reminder-warn', icon: '⚠️', title: `Kenaikan Berkala ${bBerkala} bulan lagi`, sub: `Segera siapkan berkas. Tanggal: ${tglBerkala}` });
        else if (bBerkala <= 6)
          reminders.push({ cls: 'reminder-info', icon: '📋', title: `Kenaikan Berkala ${bBerkala} bulan lagi`, sub: `Tanggal kenaikan: ${tglBerkala}` });
        else
          reminders.push({ cls: 'reminder-ok', icon: '✅', title: `Berkala aman — ${bBerkala} bulan lagi`, sub: `Tanggal kenaikan: ${tglBerkala}` });
      }

      if (!reminders.length) {
        sec.innerHTML = '';
        return;
      }
      sec.innerHTML = `
    <div class="profil-section-title">🔔 Pengingat Kepegawaian</div>
    ${reminders.map(r => `
      <div class="reminder-card ${r.cls}">
        <div class="reminder-icon">${r.icon}</div>
        <div class="reminder-body">
          <div class="reminder-title">${r.title}</div>
          <div class="reminder-sub">${r.sub}</div>
        </div>
      </div>`).join('')}`;
    }

    /* ════ DOKUMEN KEPEGAWAIAN (Google Drive) ════ */
    let dokumenLoaded = false;
    async function loadDokumen() {
      const el = $('dokumenList');
      if (!el) return;
      el.innerHTML = `<div class="shimmer" style="height:44px;border-radius:10px"></div><div class="shimmer" style="height:44px;border-radius:10px;margin-top:6px"></div>`;
      try {
        const res = await apiGet(P.dokumenList, { user_id: MY_ID || '' });
        if (!res.ok) throw 0;
        const docs = res.rows.length ? res.rows : parseApiResponse(res.data);
        dokumenLoaded = true;
        if (!docs.length) {
          el.innerHTML = `<div class="dokumen-empty">📭 Belum ada dokumen tersimpan.<br><span style="font-size:9px;color:var(--muted)">Hubungi admin untuk menambahkan dokumen.</span></div>`;
          return;
        }
        const JENIS_ICON = {
          'SK': '📜', 'SKEP': '📜', 'IJAZAH': '🎓', 'SERTIFIKAT': '🏅',
          'SKP': '📊', 'FOTO': '🖼️', 'KTP': '🪪', 'DEFAULT': '📄'
        };
        el.innerHTML = docs.map(d => {
          const nama = d.nama_dokumen || d.nama || d.name || 'Dokumen';
          const link = d.link || d.webViewLink || d.url || '#';
          const jenis = (d.jenis || d.kategori || 'DEFAULT').toUpperCase();
          const icon = JENIS_ICON[jenis] || JENIS_ICON['DEFAULT'];
          const tanggal = d.tanggal || d.uploadedAt || '';
          const id = d.id || '';
          const namaEsc = nama.replace(/'/g, "\'");
          return `<div class="dokumen-item" style="cursor:default">
        <a href="${link}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;flex:1;text-decoration:none;min-width:0">
          <div class="dokumen-icon">${icon}</div>
          <div class="dokumen-info">
            <div class="dokumen-nama">${nama}</div>
            <div class="dokumen-meta">${jenis}${tanggal ? ' · ' + tanggal : ''}</div>
          </div>
          <div class="dokumen-arrow">↗</div>
        </a>
        <button class="dokumen-del" onclick="hapusDokumen('${id}','${namaEsc}')" title="Hapus">🗑️</button>
      </div>`;
        }).join('');
      } catch {
        el.innerHTML = `<div class="dokumen-empty">🔌 Gagal memuat dokumen.<br><span style="font-size:9px">Pastikan webhook dokumen aktif di n8n.</span></div>`;
      }
    }
    /* ════ DOKUMEN — TAMBAH & HAPUS ════ */
    let _dokTab = 'upload', _dokFile = null;

    function openDokumenModal() {
      dom.show('dokModalBackdrop', 'flex');
      dom.hide('dokModalMsg');
      $('dokNama').value = ''; $('dokNama2').value = ''; $('dokLink').value = '';
      dom.hide('dokFileName'); _dokFile = null;
      switchDokTab('upload');
    }
    function closeDokumenModal() { dom.hide('dokModalBackdrop'); }
    function switchDokTab(t) {
      _dokTab = t;
      $('dokTabUpload').className = 'dok-tab' + (t === 'upload' ? ' active' : '');
      $('dokTabLink').className = 'dok-tab' + (t === 'link' ? ' active' : '');
      $('dokPanelUpload').style.display = t === 'upload' ? '' : 'none';
      $('dokPanelLink').style.display = t === 'link' ? '' : 'none';
    }
    function onDokFileChange(e) {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 5 * 1024 * 1024) { alert('File terlalu besar (maks 5MB)'); e.target.value = ''; return; }
      _dokFile = f;
      $('dokFileName').textContent = '📎 ' + f.name;
      dom.show('dokFileName', 'block');
      if (!$('dokNama').value) $('dokNama').value = f.name.replace(/\.[^.]+$/, '');
    }
    async function submitDokumen() {
      const btn = $('btnSimpanDok');
      const msg = $('dokModalMsg');
      const showMsg = (t, c) => { msg.style.display = 'block'; msg.style.color = c || 'var(--muted)'; msg.textContent = t; };
      btn.disabled = true; btn.textContent = '⏳ Menyimpan...';
      try {
        let payload;
        if (_dokTab === 'upload') {
          const nama = $('dokNama').value.trim();
          if (!nama) { showMsg('⚠️ Nama dokumen wajib diisi', '#f59e0b'); btn.disabled = false; btn.textContent = '💾 Simpan Dokumen'; return; }
          if (!_dokFile) { showMsg('⚠️ Pilih file terlebih dahulu', '#f59e0b'); btn.disabled = false; btn.textContent = '💾 Simpan Dokumen'; return; }
          // Show progress bar
          const prog = $('dokProgress'); prog.style.display = 'block';
          $('dokProgressFill').style.width = '30%';
          const b64 = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result.split(',')[1]);
            r.onerror = () => rej();
            r.readAsDataURL(_dokFile);
          });
          $('dokProgressFill').style.width = '60%';
          payload = {
            user_id: MY_ID, nama_dokumen: nama,
            jenis: $('dokJenis').value,
            file_base64: b64, file_name: _dokFile.name,
            mime_type: _dokFile.type,
            mode: 'upload'
          };
          $('dokProgressFill').style.width = '80%';
        } else {
          const nama = $('dokNama2').value.trim();
          const link = $('dokLink').value.trim();
          if (!nama || !link) { showMsg('⚠️ Nama & link wajib diisi', '#f59e0b'); btn.disabled = false; btn.textContent = '💾 Simpan Dokumen'; return; }
          payload = { user_id: MY_ID, nama_dokumen: nama, jenis: $('dokJenis2').value, link, mode: 'link' };
        }
        const { ok: docOk, data: d } = await apiPost(P.dokumenAdd, payload);
        if (d.ok) {
          $('dokProgressFill').style.width = '100%';
          showMsg('✅ Dokumen berhasil disimpan!', '#4ade80');
          dokumenLoaded = false;
          setTimeout(() => { closeDokumenModal(); loadDokumen(); }, 1200);
        } else {
          showMsg('❌ ' + (d.message || 'Gagal menyimpan'), '#ef4444');
        }
      } catch (e) {
        showMsg('❌ Koneksi gagal. Coba lagi.', '#ef4444');
      }
      btn.disabled = false; btn.textContent = '💾 Simpan Dokumen';
    }
    async function hapusDokumen(id, nama) {
      if (!confirm(`Hapus dokumen "${nama}"?
File di Google Drive juga akan dihapus.`)) return;
      try {
        const res = await apiPost(P.dokumenDel, { user_id: MY_ID, id });
        const d = res?.data ?? {};
        if (d.ok) { dokumenLoaded = false; loadDokumen(); }
        else alert('❌ ' + (d.message || 'Gagal menghapus'));
      } catch { alert('❌ Koneksi gagal'); }
    }

    function setT(id, v) { const e = $(id); if (e) e.textContent = v; }

