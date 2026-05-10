    /* ════ ADMIN LIBUR ════ */
    /* ════ HARI LIBUR & JAM PEGAWAI ════ */

    // Fetch libur dari n8n untuk dipakai rekap

    async function fetchInstansiList() {
      try {
        console.log('[Instansi] Fetching list...');
        const res = await apiGet(P.instansiList);
        if (!res.ok) {
          console.error('[Instansi] API Error:', res.status);
          const el = $('regInstansi');
          if (el) el.innerHTML = '<option value="">— Gagal memuat instansi —</option>';
          return;
        }
        const json = res?.data ?? {};
        console.log('[Instansi] Raw JSON:', json);
        
        // Robust parsing: extract array regardless of wrapping
        let data = parseApiResponse(json);
        
        console.log('[Instansi] Parsed Data:', data);
        
        const el = $('regInstansi');
        if (!el) return;
        
        if (!data || data.length === 0) {
          console.warn('[Instansi] No data found in response');
          el.innerHTML = '<option value="">— Tidak ada data instansi —</option>';
          return;
        }
        
        el.innerHTML = '<option value="">— Pilih Instansi —</option>' + 
          data.map(i => {
              const id = i.id || i.ID || i.instansi_id || '';
              const name = i.nama_instansi || i.nama || i.Nama_Instansi || id || 'Instansi';
              return `<option value="${id}">${name}</option>`;
          }).join('');
        console.log('[Instansi] Populated', data.length, 'items');

        // Jika hanya ada 1 instansi selain BAPPERIDA (atau jika bapperida dipilih), auto-load bidang
        const selected = el.value || (data.length === 1 ? data[0].id : '');
        if (selected) fetchBidangList(selected);

      } catch (e) {
        console.error('[Instansi] Error:', e);
        const el = $('regInstansi');
        if (el) el.innerHTML = `<option value="">— Error: ${e.message || 'Koneksi Terputus'} —</option>`;
      }
    }

    async function fetchBidangList(instansiId) {
      const el = $('regBidang');
      if (!el) return;
      if (!instansiId) {
        el.innerHTML = '<option value="">— Pilih Bidang —</option>';
        return;
      }
      try {
        el.innerHTML = '<option value="">— Memuat Bidang... —</option>';
        console.log('[Bidang] Fetching for:', instansiId);
        const res = await apiGet(`${P.bidangList}?instansi_id=${instansiId}`);
        if (!res.ok) throw new Error(res.status);
        const json = res.rows.length ? res.rows : parseApiResponse(res.data);
        
        let data = [];
        if (Array.isArray(json)) data = json;
        else if (json && Array.isArray(json.data)) data = json.data;
        
        if (!data || data.length === 0) {
          el.innerHTML = '<option value="">— Tidak ada data bidang —</option>';
          return;
        }
        
        el.innerHTML = '<option value="">— Pilih Bidang —</option>' + 
          data.map(b => `<option value="${b.nama_bidang || b.nama || b.id}">${b.nama_bidang || b.nama || b.id}</option>`).join('');
        console.log('[Bidang] Populated', data.length, 'items');
      } catch (e) {
        console.error('[Bidang] Error:', e);
        el.innerHTML = '<option value="">— Error memuat bidang —</option>';
      }
    }

    /**
     * Fetch daftar hari libur untuk keperluan rekap (bukan admin panel).
     * Hasilnya disimpan ke hariLiburSet & hariLiburMap.
     * @returns {Promise<void>}
     */
        async function fetchLiburForRekap() {
      try {
        const res = await apiGet(P.liburList);
        if (!res.ok) return;
        const d = res.rows.length ? res.rows : parseApiResponse(res.data);
        const rows = d.data || d.rows || [];
        hariLiburMap = {};
        rows.forEach(r => {
          const tgl = String(r.tanggal || r.Tanggal || '').trim();
          if (tgl) hariLiburMap[tgl] = r.nama || r.Nama || r.keterangan || r.Keterangan || 'Hari Libur';
        });
        hariLiburSet = new Set(Object.keys(hariLiburMap));
        liburLoaded = true;
      } catch (_) { }
    }

    // Fetch jam per pegawai dari user_list (kolom jam_masuk, jam_pulang)
    async function fetchJamPegawai() {
      try {
        const res = await apiGet(`${P.userList}`);
        if (!res.ok) return;
        const d = res.rows.length ? res.rows : parseApiResponse(res.data);
        const rows = Array.isArray(d) ? d : (d.data || d.rows || []);
        jamPegawaiMap = {};
        rows.forEach(r => {
          const id = String(r.id || r.ID || '').trim();
          const jm = (r.jam_masuk || r['Jam Masuk'] || '').trim();
          const jp = (r.jam_pulang || r['Jam Pulang'] || '').trim();
          if (id && (jm || jp)) {
            const toM = s => { const [h, m] = (s || '').split(':').map(Number); return (isNaN(h) || isNaN(m)) ? null : h * 60 + m; };
            jamPegawaiMap[id] = {
              masuk: jm || null, pulang: jp || null,
              masukMenit: toM(jm), pulangMenit: toM(jp)
            };
          }
        });
      } catch (_) { }
    }

    // Durasi preview saat range berubah
    function updateLiburDurasi() {
      const mulai = $('inputTglLiburMulai').value, selesai = $('inputTglLiburSelesai').value;
      const info = $('liburDurasiInfo'), teks = $('liburDurasiTeks');
      if (!mulai) { if (info) info.style.display = 'none'; return; }
      if (!selesai || selesai < mulai) {
        if ($('inputTglLiburSelesai')) $('inputTglLiburSelesai').value = mulai;
        if (info) info.style.display = 'none'; return;
      }
      const d1 = new Date(mulai), d2 = new Date(selesai);
      const days = Math.round((d2 - d1) / (864e5)) + 1;
      if (info) { info.style.display = 'block'; }
      if (teks) { teks.textContent = days === 1 ? `1 hari (${mulai})` : `${days} hari (${mulai} s.d. ${selesai})`; }
    }
    document.addEventListener('DOMContentLoaded', () => {
      const m = $('inputTglLiburMulai'), s = $('inputTglLiburSelesai');
      if (m) m.addEventListener('change', updateLiburDurasi);
      if (s) s.addEventListener('change', updateLiburDurasi);
    });

    // Admin: tambah hari libur (support range multi-hari)
    /**
     * Tambah atau update hari libur nasional/khusus.
     * @returns {Promise<void>}
     */
        async function handleTambahLibur() {
      const mulai = $('inputTglLiburMulai').value;
      let selesai = $('inputTglLiburSelesai').value || mulai;
      const nama = $('inputNamaLibur').value.trim();
      if (!mulai) { showResult('liburResult', 'liburRIcon', 'liburRTitle', 'liburRMsg', 'warning', '⚠️', 'Pilih Tanggal', 'Tanggal mulai libur wajib dipilih.'); dom.show('liburResult', 'flex'); return; }
      if (selesai < mulai) selesai = mulai;
      // Hitung semua tanggal dalam range
      const dates = [];
      const cur = new Date(mulai);
      const end = new Date(selesai);
      while (cur <= end) {
        dates.push(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
      }
      setBtnL('btnTambahLibur', true, `Menyimpan ${dates.length} hari...`);
      dom.hide('liburResult');
      let ok = 0, fail = 0;
      for (const tgl of dates) {
        try {
          const res = await apiPost(P.liburAdd, { 
            tanggal: tgl, 
            nama: nama || 'Hari Libur', 
            ditambahkan_oleh: MY_ID, 
            nip: localStorage.getItem('MY_NIP') || '',
            admin_nips: ADMIN_NIPS, 
            timestamp: Math.floor(Date.now() / 1000) 
          });
          const d = res?.data ?? {};
          if (d.ok !== false) { ok++; hariLiburSet.add(tgl); } else fail++;
        } catch { fail++; }
      }
      if (ok > 0) {
        const msg = dates.length > 1 ? `${ok} tanggal berhasil ditambahkan${fail ? `, ${fail} gagal` : ''}.` : `${mulai} — ${nama || 'Hari Libur'} ditambahkan.`;
        showResult('liburResult', 'liburRIcon', 'liburRTitle', 'liburRMsg', 'success', '✅', 'Berhasil', msg);
        $('inputTglLiburMulai').value = ''; $('inputTglLiburSelesai').value = ''; $('inputNamaLibur').value = '';
        if ($('liburDurasiInfo')) dom.hide('liburDurasiInfo');
        liburLoaded = true; loadLiburAdmin();
      } else {
        showResult('liburResult', 'liburRIcon', 'liburRTitle', 'liburRMsg', 'fail', '❌', 'Gagal', 'Semua tanggal gagal disimpan. Coba lagi.');
      }
      dom.show('liburResult', 'flex');
      setBtnL('btnTambahLibur', false, '➕ Tambah Hari Libur');
    }

    // Admin: load daftar libur — tampilan lebih baik
    /**
     * Muat daftar hari libur dari server dan render ke tabel admin.
     * @returns {Promise<void>}
     */
        async function loadLiburAdmin() {
      const el = $('liburAdminList');
      if (!el) return;
      dom.shimmer(el.id, 2);
      try {
        const res = await apiGet(P.liburList);
        if (!res.ok) throw 0;
        const d = res.rows.length ? res.rows : parseApiResponse(res.data);
        const rows = (d.data || d.rows || [])
          .filter(r => String(r.tanggal || r.Tanggal || '').trim())
          .sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || ''));
        hariLiburMap = {};
        rows.forEach(r => { const t = String(r.tanggal || r.Tanggal || '').trim(); if (t) hariLiburMap[t] = r.nama || r.Nama || r.keterangan || r.Keterangan || 'Hari Libur'; });
        hariLiburSet = new Set(Object.keys(hariLiburMap));
        liburLoaded = true;
        const badge = $('liburTotalBadge');
        if (badge) { badge.textContent = rows.length; badge.style.display = rows.length ? 'inline-block' : 'none'; }
        if (!rows.length) {
          el.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:11px;padding:16px">Belum ada hari libur tersimpan.</div>';
          return;
        }
        const BULAN = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const byMonth = {};
        rows.forEach(r => {
          const tgl = r.tanggal || r.Tanggal || '';
          const ym = tgl.slice(0, 7);
          if (!byMonth[ym]) byMonth[ym] = [];
          byMonth[ym].push(r);
        });
        el.innerHTML = Object.entries(byMonth).map(([ym, items]) => {
          const [y, m] = ym.split('-');
          const label = `${BULAN[parseInt(m)]} ${y}`;
          const itemsHtml = items.map(r => {
            const tgl = r.tanggal || r.Tanggal || '';
            const nm = r.nama || r.Nama || '—';
            const rn = r.row_number || r.rowNumber || '';
            const dt = new Date(tgl + 'T00:00:00');
            const hari = HARI[dt.getDay()];
            const tgl_fmt = tgl.split('-').reverse().join('/');
            const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
            return `<div class="libur-item">
          <div class="libur-item-left">
            <span class="libur-item-tgl">${tgl_fmt}</span>
            <span class="libur-item-day" style="color:${isWeekend ? 'var(--danger)' : 'var(--muted)'}">${hari}</span>
            <span class="libur-item-nama">${nm}</span>
          </div>
          <button class="libur-del-btn" onclick="hapusLibur('${tgl}',${rn})" title="Hapus">🗑️</button>
        </div>`;
          }).join('');
          return `<div style="margin-bottom:12px">
        <div class="libur-month-header"><span>📅 ${label}</span><span class="libur-badge">${items.length} hari</span></div>
        <div style="display:flex;flex-direction:column;gap:5px">${itemsHtml}</div>
      </div>`;
        }).join('');
      } catch {
        el.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:11px;padding:12px">Gagal memuat. Tekan 🔄 untuk coba lagi.</div>';
      }
    }

    // Admin: hapus hari libur
    async function hapusLibur(tgl, rowNum) {
      if (!confirm(`Hapus hari libur ${tgl}?`)) return;
      try {
        const res = await apiPost(P.liburDel, { 
          tanggal: tgl, 
          row_number: rowNum, 
          dihapus_oleh: MY_ID,
          nip: localStorage.getItem('MY_NIP') || '',
          timestamp: Math.floor(Date.now() / 1000) 
        });
        hariLiburSet.delete(tgl);
        loadLiburAdmin();
      } catch { alert('Gagal menghapus. Coba lagi.'); }
    }

