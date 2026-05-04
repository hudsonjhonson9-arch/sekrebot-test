    /* ════ ADMIN PEGAWAI ════ */
    /**
     * Muat daftar pegawai untuk panel manajemen admin.
     * @returns {Promise<void>}
     */
        async function loadPegawaiMgmt() {
      const el = $('pegawaiMgmtList');
      if (!el) return;
      dom.shimmer(el.id, 2);
      try {
        const res = await apiGet(P.userList + '?format=full');
        if (!saveOk) throw new Error('Refresh failed');
        const ud = res;
        const users = (Array.isArray(ud) ? ud : (ud.data || [])).filter(u => (u.id || u.ID));

        if (!users.length) {
          el.innerHTML = `<div class="empty-state" style="padding:15px"><div class="empty-icon">👥</div><div class="empty-text">Belum ada data pegawai</div></div>`;
          return;
        }

        // Urutkan berdasarkan "no" (No Pegawai) secara numerik
        users.sort((a, b) => {
          const valA = parseInt(a.no || a.No || 9999);
          const valB = parseInt(b.no || b.No || 9999);
          return valA - valB;
        });

        el.innerHTML = users.map(u => {
          const uid = String(u.id || u.ID || '');
          const nama = u.nama || u.Nama || u.username || 'Tanpa Nama';
          const nip = u.nip || u.NIP || '—';
          const jab = u.jabatan || u.Jabatan || '—';
          const bid = u.bidang || u.Bidang || '—';
          const status = (u.status || u.Status || 'AKTIF').toUpperCase();
          const isAktif = status === 'AKTIF';

          return `<div class="face-adm-item" style="padding:10px 12px; margin-bottom:8px">
            <div class="face-adm-thumb" style="width:36px; height:36px; border-radius:10px; background:rgba(255,184,0,0.1); display:flex; align-items:center; justify-content:center; font-size:16px">
              ${isAktif ? '👤' : '💤'}
            </div>
            <div style="flex:1; min-width:0; margin-left:2px">
              <div class="face-adm-name" style="font-size:12px; margin-bottom:1px; color:#fff">${nama}</div>
              <div style="font-size:9px; color:rgba(255,255,255,0.4)">ID: ${uid} &nbsp;·&nbsp; ${jab} &nbsp;·&nbsp; ${bid}</div>
            </div>
            <div style="display:flex; gap:6px; margin-left:10px">
              <button onclick="editPegawai('${uid}')" style="background:rgba(96,165,250,0.1); border:1px solid rgba(110,131,236,0.35); color:#60a5fa; width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:12px; cursor:pointer">✍️</button>
              <button onclick="deletePegawai('${uid}', '${nama.replace(/'/g, "\\'")}')" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#f87171; width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:12px; cursor:pointer">🗑</button>
            </div>
          </div>`;
        }).join('');
      } catch (e) {
        console.error('[Fetch Pegawai Error]', e);
        el.innerHTML = `<div class="empty-state" style="padding:15px"><div class="empty-icon">🔌</div><div class="empty-text">Gagal memuat data pegawai</div><div class="empty-sub">${e.message || 'Coba lagi beberapa saat'}</div></div>`;
      }
    }

    function showAddPegawai() {
      const f = $('pegawaiForm');
      if (!f) return;
      dom.setText('pegawaiFormTitle', '➕ TAMBAH PEGAWAI BARU');
      $('editPegawaiId').value = '';
      $('inPegawaiId').value = '';
      dom.setDisabled('inPegawaiId', false);
      $('inPegawaiNama').value = '';
      $('inPegawaiNo').value = '';
      $('inPegawaiNip').value = '';
      $('inPegawaiJabatan').value = '';
      $('inPegawaiRole').value = 'USER';
      $('inPegawaiStatus').value = 'AKTIF';
      dom.hide('pegawaiFormResult');
      f.style.display = 'block';
      f.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function hidePegawaiForm() {
      const f = $('pegawaiForm');
      if (f) f.style.display = 'none';
      dom.hide('pegawaiFormResult');
    }

    async function editPegawai(uid) {
      const f = $('pegawaiForm');
      if (!f) return;
      try {
        // Find existing data in list (to avoid extra fetch)
        // Or fetch single if needed. For now, try logic: fetch all or find in cache
        const ur = await apiGet(P.userList + '?user_id=' + uid);
        if (!ur.ok) return;
        const res = (ur.rows?.length ?? 0) ? ur.rows : parseApiResponse(ur.data);
        const p = res.single ? res : (res.data ? res.data[0] : null);
        if (!p) return;

        dom.setText('pegawaiFormTitle', '✍️ EDIT DATA PEGAWAI');
        $('editPegawaiId').value = uid;
        $('inPegawaiId').value = uid;
        dom.setDisabled('inPegawaiId', true); // Telegram ID cannot be changed in edit
        $('inPegawaiNama').value = p.nama || p.Nama || '';
        $('inPegawaiNo').value = p.no || '';
        $('inPegawaiNip').value = p.nip || p.NIP || '';
        $('inPegawaiJabatan').value = p.jabatan || p.Jabatan || '';
        $('inPegawaiBidang').value = p.bidang || p.Bidang || '';
        $('inPegawaiPangkat').value = p.pangkat || p.Pangkat || '';

        // Auto select Tipe based on string content if not explicit
        const pkt = (p.pangkat || '').toUpperCase();
        if (pkt.includes('GOLONGAN')) $('inPegawaiTipe').value = 'PPPK';
        else if (pkt.includes('/') || pkt.includes('JURU') || pkt.includes('PENGATUR') || pkt.includes('PENATA') || pkt.includes('PEMBINA')) $('inPegawaiTipe').value = 'PNS';
        else $('inPegawaiTipe').value = 'NONASN';
        _updatePangkatDropdown('inPegawaiPangkat', $('inPegawaiTipe').value);
        $('inPegawaiPangkat').value = p.pangkat || '';

        $('inPegawaiRole').value = (p.role || p.Role || 'USER').toUpperCase();
        $('inPegawaiStatus').value = (p.status || p.Status || 'AKTIF').toUpperCase();

        f.style.display = 'block';
        f.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) { console.error('Edit error:', e); }
    }

    /**
     * Simpan data pegawai baru atau update pegawai yang sudah ada.
     * @returns {Promise<void>}
     */
        async function savePegawai() {
      const editId = $('editPegawaiId').value;
      const isEdit = !!editId;
      const id = $('inPegawaiId').value;
      const nama = $('inPegawaiNama').value.trim();
      const no = $('inPegawaiNo').value;
      const nip = $('inPegawaiNip').value.trim();
      const jabatan = $('inPegawaiJabatan').value.trim();
      const pangkat = $('inPegawaiPangkat').value;
      const bidang = $('inPegawaiBidang').value;
      const role = $('inPegawaiRole').value;
      const status = $('inPegawaiStatus').value;

      if (!id || !nama) {
        showResult('pegawaiFormResult', 'pegawaiFormRIcon', 'pegawaiFormRTitle', 'pegawaiFormRMsg', 'warning', '⚠️', 'Data Kurang', 'ID Telegram dan Nama wajib diisi.');
        return;
      }

      dom.setText('btnSavePegawaiTxt', 'Menyimpan...');
      try {
        const path = isEdit ? P.userEdit : P.userAdd;
        const mainPayload = { id, nama, no, nip, jabatan, pangkat, bidang, role, status, instansi_id: 'bapperida' };

        // apiPost handles method+body
        const { ok: saveOk, data: res } = await apiPost(path, payload);
        const d = res.catch(() => ({}));

        if (!saveOk || d?.ok === false) {
          showResult('pegawaiFormResult', 'pegawaiFormRIcon', 'pegawaiFormRTitle', 'pegawaiFormRMsg', 'fail', '❌', 'Gagal', d.message || 'Gagal menyimpan data pegawai.');
        } else {
          // ── SYNC ADMIN LOGIC (Request User) ──
          // Jika role adalah ADMIN atau SUPERADMIN, sync ke webhook admin-add
          const cleanRole = role.toLowerCase().replace(/\s+/g, '');
          if (cleanRole === 'admin' || cleanRole === 'superadmin') {
            try {
              console.log('[Sync] Detecting Admin role, syncing to admin-add...');
              await apiPost(P.adminAdd, {
                  telegram_id: Number(id),
                  nama: nama,
                  role: cleanRole,
                  ditambahkan_oleh: Number(MY_ID)
                });
            } catch (err) {
              console.warn('[Sync] Gagal sync ke admin-list (opsional):', err.message);
            }
          }

          showResult('pegawaiFormResult', 'pegawaiFormRIcon', 'pegawaiFormRTitle', 'pegawaiFormRMsg', 'success', '✅', 'Berhasil', isEdit ? 'Data pegawai diperbarui.' : 'Pegawai baru ditambahkan.');
          setTimeout(hidePegawaiForm, 2500);
          loadPegawaiMgmt();
        }
      } catch (e) {
        console.error('[SavePegawai] Error:', e);
        showResult('pegawaiFormResult', 'pegawaiFormRIcon', 'pegawaiFormRTitle', 'pegawaiFormRMsg', 'fail', '🔌', 'Koneksi Error', `Server tidak merespons: ${e.message}`);
      }
      dom.setText('btnSavePegawaiTxt', 'Simpan Data');
    }

    /**
     * Hapus data pegawai dari sistem.
     * @param {string|number} uid - Telegram ID pegawai
     * @param {string} nama - Nama pegawai (untuk konfirmasi)
     * @returns {Promise<void>}
     */
        async function deletePegawai(uid, nama) {
      if (!confirm(`Hapus pegawai "${nama}" (${uid})?\nData wajah dan ttd mungkin juga tidak akan bisa digunakan lagi.`)) return;
      try {
        const res = await apiPost(P.userDel, { id: uid });
        const d = res?.data ?? {};
        if (d.ok !== false) {
          loadPegawaiMgmt();
        } else {
          alert('Gagal: ' + (d.message || 'Error server'));
        }
      } catch (e) { alert('Server error'); }
    }

