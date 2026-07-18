/* ─── GLOBAL STATE ── */
window._simapoMasterEditId = null;
window._allPinjamData = [];
window._allTiketData = [];
window._allMasterData = [];

/* ─── CACHE MANAGER ────────────────────────────────────────── */
window._simapoCache = {
  data: {},
  expiry: 2 * 60 * 1000,
  async getOrFetch(key, fetchFn, force = false) {
    if (!force && this.data[key] && (Date.now() - this.data[key].time < this.expiry)) {
      return this.data[key].value;
    }
    try {
      const val = await fetchFn();
      if (val !== null) this.set(key, val);
      return val;
    } catch (e) {
      console.error(`[Cache] Fetch Error for ${key}:`, e);
      return null;
    }
  },
  set(key, value) { this.data[key] = { value, time: Date.now() }; },
  clear(key) { if(key) delete this.data[key]; else this.data = {}; }
};

/* ─── SUB-TAB SWITCHER ──────────────────────────────────────── */
window.switchSATab = function(name, force = false) {
  console.log('[SIMAPO] Switching sub-tab to:', name);
  document.querySelectorAll('.sa-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.sa-sect').forEach(s => {
      s.style.display = 'none';
      s.style.opacity = '0';
  });
  
  const btn = document.getElementById('sa-tab-' + name);
  const sect = document.getElementById('sa-sect-' + name);
  if (btn) btn.classList.add('active');
  if (sect) {
      sect.style.display = 'block';
      setTimeout(() => { sect.style.opacity = '1'; sect.style.transition = 'opacity 0.3s'; }, 10);
  }
  
  if (name === 'pinjam') window.loadAdminSimapoPinjam(force);
  else if (name === 'tiket') window.loadAdminSimapoTiket(force);
  else if (name === 'master') window.loadAdminSimapoMaster(force);
  else if (name === 'mutasi') { window.loadMutasiRiwayat(force); window.populateMutasiBarangSelect(); }
  else if (name === 'opname') window.loadOpnameForm(force);
  else if (name === 'kat') window.loadSimapoKategori(true, force);
};

/* ─── HELPER: SHOW SHIMMER ── */
window.showAdminSimapoShimmer = function(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = `
    <div class="shimmer-wrapper" style="width:100%;">
      <div class="shimmer sh-line" style="height:80px; border-radius:12px; margin-bottom:10px;"></div>
      <div class="shimmer sh-line" style="height:80px; border-radius:12px; margin-bottom:10px;"></div>
    </div>
  `;
};

/* ─── ADMIN: PEMINJAMAN ── */
window.loadAdminSimapoPinjam = async function(force = false) {
  console.log('[SIMAPO] Loading Admin Pinjaman...');
  const el = document.getElementById('adminSimapoPinjamList');
  if (!el) return;
  
  if (force || !window._allPinjamData || window._allPinjamData.length === 0) {
    window.showAdminSimapoShimmer('adminSimapoPinjamList');
  }

  try {
    const data = await window._simapoCache.getOrFetch('admin_pinjam', async () => {
      try {
        const res = await apiFetch(P.simapoAdminPinjamList);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return parseApiResponse(json);
      } catch (e) { 
        console.warn('[SIMAPO] Pinjam Fetch Fail:', e); 
        return null; 
      }
    }, force);

    if (data && Array.isArray(data)) {
      window._allPinjamData = data;
    } else {
      console.log('[SIMAPO] No data from server, using demo fallback');
      window._allPinjamData = [
        { id:'P001', userid:'1234567', nama_peminjam:'Demo User 1', nama_barang:'Proyektor Epson', tujuanpeminjaman:'Presentasi', tanggalmulai:'2026-05-15', tanggalselesai:'2026-05-15', status:'MENUNGGU' },
        { id:'P002', userid:'7654321', nama_peminjam:'Demo User 2', nama_barang:'Kamera DSLR', tujuanpeminjaman:'Dokumentasi', tanggalmulai:'2026-05-18', tanggalselesai:'2026-05-20', status:'MENUNGGU' },
      ];
    }
  } catch (e) {
    console.error('[SIMAPO] Critical Load Error:', e);
  }

  // Auto-filter based on active button or default to MENUNGGU
  const activeFilterBtn = document.querySelector('.sa-filter-btn.active');
  const activeFilter = activeFilterBtn ? (activeFilterBtn.dataset.filter || 'MENUNGGU') : 'MENUNGGU';
  window.filterSAPinjam(activeFilter, activeFilterBtn);
};

window.filterSAPinjam = function(status, btnEl) {
  document.querySelectorAll('.sa-filter-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  
  const filtered = status ? window._allPinjamData.filter(d => (d.status||'').toUpperCase() === status.toUpperCase()) : window._allPinjamData;
  window.renderAdminSimapoPinjam(filtered);
};

window.renderAdminSimapoPinjam = function(data) {
  const el = document.getElementById('adminSimapoPinjamList');
  if (!el) return;
  if (!data || data.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--muted);font-size:12px">📭 Tidak ada data peminjaman.</div>`;
    return;
  }
  el.innerHTML = data.map(item => {
    const st = (item.status || 'MENUNGGU').toUpperCase();
    const isPending = st === 'MENUNGGU';
    let badge = `<span style="background:var(--warning);color:#000;">⏳ ${st}</span>`;
    if (st === 'DISETUJUI' || st === 'DIPINJAM') badge = `<span style="background:var(--success);color:#fff;">✅ ${st}</span>`;
    if (st === 'DITOLAK') badge = `<span style="background:var(--danger);color:#fff;">❌ ${st}</span>`;
    if (st === 'KEMBALI' || st === 'DIKEMBALIKAN') badge = `<span style="background:rgba(100,180,255,0.3);color:#64b4ff;">📦 ${st}</span>`;

    return `
      <div style="padding:14px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <div style="font-weight:800;font-size:14px;color:var(--white)">${item.nama_barang || 'Tanpa Nama'} <span style="font-size:11px; color:var(--gold); font-weight:700;">(x${item.jumlah || 1})</span></div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">👤 ${item.nama_peminjam || 'Pegawai'} &nbsp;·&nbsp; NIP ${item.userid || item.nip_peminjam || '—'}</div>
          </div>
          <div style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:8px;">${badge}</div>
        </div>
        <div style="font-size:12px;color:var(--gold);margin:10px 0 4px;font-style:italic;">"${item.tujuanpeminjaman || item.tujuan || '—'}"</div>
        <div style="font-size:11px;color:var(--muted);">${item.jenisbarang === 'Habis Pakai' ? `📅 Diminta pd ${item.tanggalmulai}` : `📅 ${item.tanggalmulai} s/d ${item.tanggalselesai}`}</div>
        ${isPending ? `
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button onclick="window.adminSimapoPinjamAction('${item.id}','${item.jenisbarang === 'Habis Pakai' ? 'SELESAI' : 'DIPINJAM'}')" style="flex:1;padding:8px;background:var(--success);color:#fff;border:none;border-radius:8px;font-weight:800;font-size:12px;cursor:pointer;">✅ Setujui</button>
          <button onclick="window.adminSimapoPinjamAction('${item.id}','DITOLAK')" style="flex:1;padding:8px;background:var(--danger);color:#fff;border:none;border-radius:8px;font-weight:800;font-size:12px;cursor:pointer;">❌ Tolak</button>
        </div>` : ( (st === 'DISETUJUI' || st === 'DIPINJAM') && item.jenisbarang !== 'Habis Pakai' ? `
        <button onclick="window.adminSimapoPinjamAction('${item.id}','DIKEMBALIKAN')" style="width:100%;padding:8px;background:rgba(100,180,255,0.2);color:#64b4ff;border:1px solid rgba(100,180,255,0.3);border-radius:8px;font-weight:800;font-size:12px;cursor:pointer;margin-top:12px;">📦 Tandai Kembali</button>
        ` : '')}
      </div>`;
  }).join('');
};

/* ─── ADMIN: TIKET KERUSAKAN ── */
window.loadAdminSimapoTiket = async function(force = false) {
  const el = document.getElementById('adminSimapoTiketList');
  if (!el) return;
  if (force || window._allTiketData.length === 0) window.showAdminSimapoShimmer('adminSimapoTiketList');

  const data = await window._simapoCache.getOrFetch('admin_tiket', async () => {
    try {
      const res = await apiFetch(P.simapoAdminTiketList);
      return parseApiResponse(await res.json());
    } catch { return null; }
  }, force);

  if (data) window._allTiketData = data;
  else if (!force && window._allTiketData.length) {}
  else {
    window._allTiketData = [{ id: 'T001', judul: 'AC Ruang Rapat Bocor', deskripsi: 'Air menetes.', lokasi: 'Ruang Rapat', nip_pelapor: '12345', nama_pelapor: 'Demo User', status: 'MASUK', createdat: '2026-05-12' }];
  }
  window.renderAdminSimapoTiket(window._allTiketData);
};

window.renderAdminSimapoTiket = function(data) {
  const el = document.getElementById('adminSimapoTiketList');
  if (!el) return;
  if (!data || data.length === 0) { el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--muted);font-size:12px">🚨 Tidak ada tiket kerusakan.</div>`; return; }
  el.innerHTML = data.map(item => {
    const st = (item.status || 'MASUK').toUpperCase();
    const colorMap = { MASUK: 'var(--warning)', DIPROSES: '#64b4ff', SELESAI: 'var(--success)', DITUTUP: 'var(--muted)' };
    const color = colorMap[st] || 'var(--muted)';
    return `
      <div style="padding:14px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);margin-bottom:10px;border-left:4px solid ${color};">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div style="font-weight:800;font-size:14px;color:var(--white)">${item.judul}</div>
          <div style="font-size:10px;font-weight:800;padding:4px 10px;border-radius:8px;background:rgba(255,255,255,0.05);color:${color};">${st}</div>
        </div>
        <div style="font-size:12px;color:var(--muted);margin-top:6px;">📍 ${item.lokasi || '—'} &nbsp;·&nbsp; 👤 ${item.nama_pelapor || '—'}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:8px;font-style:italic;">"${item.deskripsi || ''}"</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px;">📅 ${item.createdat}</div>
        ${(st==='MASUK'||st==='DIPROSES') ? `<div style="display:flex;gap:8px;margin-top:12px;">
          <button onclick="window.adminSimapoTiketAction('${item.id}','DIPROSES')" style="flex:1;padding:8px;background:rgba(100,180,255,0.2);color:#64b4ff;border:1px solid rgba(100,180,255,0.3);border-radius:8px;font-weight:800;font-size:12px;cursor:pointer;">🔧 Proses</button>
          <button onclick="window.adminSimapoTiketAction('${item.id}','SELESAI')" style="flex:1;padding:8px;background:var(--success);color:#fff;border:none;border-radius:8px;font-weight:800;font-size:12px;cursor:pointer;">✅ Selesai</button>
        </div>` : ''}
      </div>`;
  }).join('');
};

/* ─── ADMIN: MASTER ASET ── */
window.loadAdminSimapoMaster = async function(force = false) {
  const el = document.getElementById('adminSimapoMasterList');
  if (!el) return;
  if (force || window._allMasterData.length === 0) window.showAdminSimapoShimmer('adminSimapoMasterList');

  const data = await window._simapoCache.getOrFetch('admin_master', async () => {
    try {
      const res = await apiFetch(P.simapoAdminMasterList);
      return parseApiResponse(await res.json());
    } catch { return null; }
  }, force);

  if (data) window._allMasterData = data;
  else if (!force && window._allMasterData.length) {}
  else {
    window._allMasterData = [{ id:'1',nama:'Demo Laptop',kodebarang:'IT-001',stok_saat_ini:5,satuan:'Unit',hargasatuan:10000000,isactive:true }];
  }
  window.renderAdminSimapoMaster(window._allMasterData);
};

window.renderAdminSimapoMaster = function(data) {
  const el = document.getElementById('adminSimapoMasterList');
  if (!el) return;
  if (!data || data.length === 0) { el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--muted);font-size:12px">📦 Belum ada data aset.</div>`; return; }
  const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

  el.innerHTML = data.map(item => `
    <div data-barang-id="${item.id}" style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);margin-bottom:8px;">
      <div style="width:40px;height:40px;border-radius:8px;background:rgba(201,168,76,0.15);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">📦</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:800;font-size:13px;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.nama}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">${item.kodebarang} &nbsp;·&nbsp; Stok: <span style="color:${item.stok_saat_ini > 0 ? 'var(--success)' : 'var(--danger)'}">${item.stok_saat_ini} ${item.satuan}</span></div>
        <div style="font-size:11px;color:var(--gold);margin-top:2px;">${fmt(item.hargasatuan || 0)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
        <button onclick="window.showSimapoMasterForm('${item.id}')" style="padding:6px 10px;background:rgba(255,255,255,0.08);color:var(--white);border:none;border-radius:6px;font-size:11px;cursor:pointer;font-weight:700;">✏️</button>
        <button onclick="window.deleteSimapoMaster('${item.id}')" style="padding:6px 10px;background:rgba(255,60,60,0.15);color:var(--danger);border:1px solid rgba(255,60,60,0.2);border-radius:6px;font-size:11px;cursor:pointer;font-weight:700;">🗑</button>
        <button onclick="toggleUnitList('${item.id}', this)" style="padding:6px 10px;background:rgba(34,197,94,0.1);color:#22c55e;border:1px solid rgba(34,197,94,0.2);border-radius:6px;font-size:10px;cursor:pointer;font-weight:700;">▶ QR</button>
      </div>
    </div>`).join('');
};

window.filterSAMaster = function(val) {
  const q = val.toLowerCase();
  const filtered = window._allMasterData.filter(b => 
    (b.nama && b.nama.toLowerCase().includes(q)) || 
    (b.kodebarang && b.kodebarang.toLowerCase().includes(q))
  );
  window.renderAdminSimapoMaster(filtered);
};

window.showSimapoMasterForm = async function(id = null) {
  window._simapoMasterEditId = id;
  const modal = document.getElementById('modalSimapoMaster');
  if (!modal) return;

  // Pastikan data kategori dimuat
  const katData = await window._simapoCache.getOrFetch('simapo_kategori', async () => {
    try {
      const res = await apiFetch(P.simapoKategoriList);
      return parseApiResponse(await res.json());
    } catch { return null; }
  }, false);

  const selKat = document.getElementById('smfKategori');
  if (selKat && katData) {
    selKat.innerHTML = '<option value="">-- Pilih Kategori --</option>' + 
      katData.map(k => `<option value="${k.id}">${k.nama}</option>`).join('');
  }

  // Reset Form
  document.getElementById('smfNama').value = '';
  document.getElementById('smfKode').value = '';
  document.getElementById('smfSatuan').value = 'Unit';
  document.getElementById('smfJenis').value = 'Aset Tetap';
  if (selKat) selKat.value = '';
  document.getElementById('smfStok').value = '0';
  document.getElementById('smfHarga').value = '0';
  document.getElementById('smfSpesifikasi').value = '';
  const titleEl = document.getElementById('smfTitle');
  if (titleEl) titleEl.textContent = id ? '✏️ Edit Data Aset' : '➕ Tambah Aset Baru';

  if (id) {
    const item = window._allMasterData.find(b => b.id === id);
    if (item) {
      document.getElementById('smfNama').value = item.nama || '';
      document.getElementById('smfKode').value = item.kodebarang || '';
      document.getElementById('smfSatuan').value = item.satuan || 'Unit';
      document.getElementById('smfJenis').value = item.jenisbarang || 'Aset Tetap';
      if (selKat) selKat.value = item.kategoriid || '';
      document.getElementById('smfStok').value = item.stok_saat_ini || 0;
      document.getElementById('smfHarga').value = item.hargasatuan || 0;
      document.getElementById('smfSpesifikasi').value = item.spesifikasi || '';
    }
  }

  modal.style.display = 'flex';
  modal.style.opacity = '0';
  setTimeout(() => { modal.style.opacity = '1'; modal.style.transition = 'opacity 0.3s'; }, 10);
};

window.closeSimapoMasterForm = function() {
  const modal = document.getElementById('modalSimapoMaster');
  if (modal) modal.style.display = 'none';
};

/* ─── ACTIONS ── */
window.adminSimapoPinjamAction = async function(id, status) {
  if (!confirm(`Konfirmasi perubahan status ke ${status}?`)) return;
  showToast('Memproses...', 'info');
  try {
    const res = await apiFetch(P.simapoAdminPinjamAction, { method:'POST', body: JSON.stringify({ id, status }) });
    if (res.ok) { showToast('Berhasil', 'success'); window._simapoCache.clear('admin_pinjam'); window.loadAdminSimapoPinjam(true); }
    else throw 1;
  } catch { showToast('Status diubah (Demo)', 'success'); window._simapoCache.clear('admin_pinjam'); window.loadAdminSimapoPinjam(true); }
};

window.adminSimapoTiketAction = async function(id, status) {
  showToast('Memproses...', 'info');
  try {
    const res = await apiFetch(P.simapoAdminTiketAction, { method:'POST', body: JSON.stringify({ id, status }) });
    if (res.ok) { showToast('Berhasil', 'success'); window._simapoCache.clear('admin_tiket'); window.loadAdminSimapoTiket(true); }
    else throw 1;
  } catch { showToast('Status diubah (Demo)', 'success'); window._simapoCache.clear('admin_tiket'); window.loadAdminSimapoTiket(true); }
};

window.deleteSimapoMaster = async function(id) {
  if (!confirm('Hapus aset ini?')) return;
  showToast('Menghapus...', 'info');
  try {
    const res = await apiFetch(P.simapoAdminMasterDel, { method:'POST', body: JSON.stringify({ id }) });
    if (res.ok) { showToast('Aset dihapus', 'success'); window._simapoCache.clear('admin_master'); window.loadAdminSimapoMaster(true); }
    else throw 1;
  } catch { showToast('Dihapus (Demo)', 'success'); window._simapoCache.clear('admin_master'); window.loadAdminSimapoMaster(true); }
};

window.saveSimapoMaster = async function() {
  const payload = {
    id: window._simapoMasterEditId,
    nama: document.getElementById('smfNama')?.value.trim(),
    kodebarang: document.getElementById('smfKode')?.value.trim(),
    satuan: document.getElementById('smfSatuan')?.value.trim(),
    jenisbarang: document.getElementById('smfJenis')?.value.trim(),
    kategoriid: document.getElementById('smfKategori')?.value || null,
    stok_saat_ini: parseInt(document.getElementById('smfStok')?.value) || 0,
    hargasatuan: parseFloat(document.getElementById('smfHarga')?.value) || 0,
    spesifikasi: document.getElementById('smfSpesifikasi')?.value.trim(),
  };
  if (!payload.nama || !payload.kodebarang) { showToast('Nama & Kode wajib!', 'error'); return; }
  showToast('Menyimpan...', 'info');
  try {
    const res = await apiFetch(P.simapoAdminMasterSave, { method:'POST', body: JSON.stringify(payload) });
    if (res.ok) { showToast('Berhasil', 'success'); window._simapoCache.clear('admin_master'); window.loadAdminSimapoMaster(true); if(window.closeSimapoMasterForm) window.closeSimapoMasterForm(); }
    else throw 1;
  } catch { showToast('Simpan (Demo)', 'success'); window._simapoCache.clear('admin_master'); window.loadAdminSimapoMaster(true); if(window.closeSimapoMasterForm) window.closeSimapoMasterForm(); }
};

/* ─── OTHERS ── */
window.populateMutasiBarangSelect = async function() {
  const sel = document.getElementById('mutasiBarangId'); if (!sel) return;
  let data = window._allMasterData;
  if (!data.length) try { data = parseApiResponse(await (await apiFetch(P.simapoAdminMasterList)).json()); } catch { data=[]; }
  sel.innerHTML = '<option value="">-- Pilih Barang --</option>' + data.map(b => `<option value="${b.id}">${b.nama} (${b.kodebarang})</option>`).join('');
};

window.loadMutasiRiwayat = async function(force = false) {
  const el = document.getElementById('mutasiRiwayatList'); if (!el) return;
  const data = await window._simapoCache.getOrFetch('mutasi_riwayat', async () => {
    try { const res = await apiFetch(P.simapoMutasiList); return parseApiResponse(await res.json()); } catch { return null; }
  }, force);
  if (!data || !data.length) { el.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--muted)">Belum ada riwayat.</div>'; return; }
  el.innerHTML = data.map(m => `<div style="padding:10px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);margin-bottom:6px;"><div style="font-weight:800;font-size:13px">${m.nama_barang}</div><div style="font-size:11px">${m.jenis} · ${m.jumlah} · ${m.createdat}</div></div>`).join('');
};

window.loadOpnameForm = async function() {
  const el = document.getElementById('opnameFormList'); if (!el) return;
  let data = window._allMasterData;
  if (!data.length) try { data = parseApiResponse(await (await apiFetch(P.simapoAdminMasterList)).json()); } catch { data=[]; }
  el.innerHTML = data.map(b => `<div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);margin-bottom:6px;"><div style="flex:1;"><div style="font-weight:700;font-size:13px">${b.nama}</div><div style="font-size:11px">${b.kodebarang} · Sistem: ${b.stok_saat_ini}</div></div><input type="number" class="form-input opname-input" data-id="${b.id}" data-sistem="${b.stok_saat_ini}" value="${b.stok_saat_ini}" style="width:70px;padding:6px;"></div>`).join('');
};

window.submitStokOpname = async function() {
  const items = Array.from(document.querySelectorAll('.opname-input')).map(i => ({
    id: i.dataset.id,
    stok_fisik: parseInt(i.value) || 0,
    stok_sistem: parseInt(i.dataset.sistem) || 0
  }));
  if (!confirm('Simpan hasil opname?')) return;
  showToast('Menyimpan...', 'info');
  try {
    const res = await apiFetch(P.simapoOpnameSave, { method:'POST', body: JSON.stringify({ items }) });
    if (res.ok) { showToast('Berhasil', 'success'); window._simapoCache.clear('admin_master'); window.loadAdminSimapoMaster(true); }
    else throw 1;
  } catch { showToast('Opname (Demo)', 'success'); window._simapoCache.clear('admin_master'); window.loadAdminSimapoMaster(true); }
};

/* ─── KATEGORI ── */
window.loadSimapoKategori = async function(isAdmin = true, force = false) {
  const elId = isAdmin ? 'adminSimapoKatList' : 'simapoKatFilterBar';
  const el = document.getElementById(elId);
  if (!el) return;

  if (force) window.showAdminSimapoShimmer(elId);

  const data = await window._simapoCache.getOrFetch('simapo_kategori', async () => {
    try {
      const res = await apiFetch(P.simapoKategoriList);
      return parseApiResponse(await res.json());
    } catch { return null; }
  }, force);

  if (isAdmin) {
    window.renderAdminSimapoKat(data || []);
  } else {
    window.renderUserSimapoKatFilter(data || []);
  }
};

window.renderAdminSimapoKat = function(data) {
  const el = document.getElementById('adminSimapoKatList');
  if (!el) return;
  if (!data || data.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--muted)">Belum ada kategori.</div>';
    return;
  }
  el.innerHTML = data.map(k => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);margin-bottom:6px;">
      <div>
        <div style="font-weight:800;font-size:13px;color:var(--white)">${k.nama}</div>
        <div style="font-size:11px;color:var(--muted)">${k.jumlah_aset || 0} Aset</div>
      </div>
      <button onclick="window.deleteSimapoKategori('${k.id}')" style="padding:6px;background:rgba(255,60,60,0.1);color:var(--danger);border:none;border-radius:6px;cursor:pointer;">
        <i class="fas fa-trash-alt"></i>
      </button>
    </div>
  `).join('');
};

window.addSimapoKategori = async function() {
  const input = document.getElementById('katNamaInput');
  const nama = input?.value.trim();
  if (!nama) {
    showToast('Silakan ketik nama kategori terlebih dahulu!', 'error');
    if (input) input.focus();
    return;
  }

  showToast('Menyimpan...', 'info');
  try {
    const res = await apiFetch(P.simapoKategoriSave, { method:'POST', body: JSON.stringify({ nama }) });
    if (res.ok) {
      showToast('Kategori berhasil ditambahkan', 'success');
      input.value = '';
      window._simapoCache.clear('simapo_kategori');
      window.loadSimapoKategori(true, true);
    } else throw 1;
  } catch {
    showToast('Berhasil (Demo)', 'success');
    input.value = '';
    window.loadSimapoKategori(true, true);
  }
};

window.deleteSimapoKategori = async function(id) {
  if (!confirm('Hapus kategori ini?')) return;
  showToast('Menghapus...', 'info');
  try {
    const res = await apiFetch(P.simapoKategoriDel, { method:'POST', body: JSON.stringify({ id }) });
    if (res.ok) {
      showToast('Kategori dihapus', 'success');
      window._simapoCache.clear('simapo_kategori');
      window.loadSimapoKategori(true, true);
    } else throw 1;
  } catch {
    showToast('Dihapus (Demo)', 'success');
    window.loadSimapoKategori(true, true);
  }
};

window.renderUserSimapoKatFilter = function(data) {
  const el = document.getElementById('simapoKatFilterBar');
  if (!el) return;
  el.innerHTML = '<button onclick="filterSimapoKatalog(\'\')" class="simapo-kat-badge active">Semua</button>' + 
    data.map(k => `<button onclick="filterSimapoKatalog('${k.nama}')" class="simapo-kat-badge">${k.nama}</button>`).join('');
};

/* ─── ADMIN: QR GENERATOR ──────────────────────────────────── */
window._unitCache = {};

window.toggleUnitList = async function(barangId, btnEl) {
  const row = document.getElementById('unit-list-' + barangId);
  if (row) {
    row.remove();
    if (btnEl) btnEl.textContent = '▶ Lihat Unit';
    return;
  }

  if (btnEl) btnEl.textContent = '▼ Tutup';

  const masterContainer = document.getElementById('adminSimapoMasterList');
  const targetItem = document.querySelector(`[data-barang-id="${barangId}"]`);
  if (!targetItem) return;

  const wrapper = document.createElement('div');
  wrapper.id = 'unit-list-' + barangId;
  wrapper.innerHTML = '<div style="padding:12px;text-align:center;color:var(--muted);font-size:12px;">Memuat unit...</div>';
  targetItem.after(wrapper);

  try {
    const res = await apiGet(P.simapoUnitList, { barangid: barangId });
    const units = res.ok ? (res.rows || []) : [];
    window._unitCache[barangId] = units;

    if (!units.length) {
      wrapper.innerHTML = '<div style="padding:12px;text-align:center;color:var(--muted);font-size:11px;">Tidak ada unit aset.</div>';
      return;
    }

    wrapper.innerHTML = `
      <div style="margin:0 0 10px 0;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
        ${units.map(u => {
          const hasQR = !!(u.qrcode && u.qrcode.startsWith('http'));
          const isPinjam = u.statuspinjam === true || u.statuspinjam === 'true';
          return `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(255,255,255,0.02);border-bottom:1px solid rgba(255,255,255,0.04);">
            <div style="width:16px;height:16px;border-radius:4px;flex-shrink:0;background:${isPinjam ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'};">
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:12px;color:var(--white);">${u.nomorinventaris || '—'}</div>
              <div style="font-size:10px;color:var(--muted);">Seri: ${u.nomorseri || '—'} · ${isPinjam ? '🔴 Dipinjam' : '✅ Tersedia'}</div>
            </div>
            <div style="flex-shrink:0;display:flex;gap:4px;align-items:center;">
              ${hasQR
                ? `<span style="font-size:10px;color:#22c55e;font-weight:700;">✅ QR</span>
                   <button onclick="viewQRCode('${u.id}')" style="padding:4px 8px;background:rgba(255,255,255,0.06);border:none;border-radius:4px;color:var(--muted);font-size:10px;cursor:pointer;" title="Lihat QR">📱</button>
                   <button onclick="generateQRCode('${u.id}','${u.nomorinventaris || u.id}')" style="padding:4px 8px;background:rgba(255,255,255,0.06);border:none;border-radius:4px;color:var(--muted);font-size:10px;cursor:pointer;" title="Regenerate">🔄</button>`
                : `<span style="font-size:10px;color:var(--muted);">❌</span>
                   <button onclick="generateQRCode('${u.id}','${u.nomorinventaris || u.id}')" style="padding:4px 8px;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.3);border-radius:4px;color:var(--gold);font-size:10px;cursor:pointer;font-weight:700;">Generate QR</button>`
              }
            </div>
          </div>`;
        }).join('')}
        <div style="padding:8px 14px;background:rgba(255,255,255,0.01);text-align:center;border-top:1px solid rgba(255,255,255,0.04);">
          <button onclick="generateAllQR('${barangId}')" style="padding:6px 14px;background:rgba(201,168,76,0.1);border:1px dashed rgba(201,168,76,0.3);border-radius:6px;color:var(--gold);font-size:11px;cursor:pointer;font-weight:700;">⚡ Generate All QR</button>
        </div>
      </div>
    `;
  } catch (e) {
    wrapper.innerHTML = '<div style="padding:12px;text-align:center;color:#ef4444;font-size:11px;">Gagal memuat unit.</div>';
  }
};

window.generateQRCode = async function(unitasetId, label) {
  const origin = window.location.origin;
  const path = window.location.pathname;
  const payload = origin + path + '?qr=SIMAPO-' + unitasetId;

  try {
    const qr = qrcode(0, 'M');
    qr.addData(payload);
    qr.make();
    const canvas = qr.createImgTag(6, 8);

    // Simpan ke API
    await apiFetch(P.simapoQRUpdate, {
      method: 'POST',
      body: JSON.stringify({ unitasetid: unitasetId, qrcode: payload })
    });

    // Tampilkan modal QR
    Swal.fire({
      title: `QR: ${label}`,
      html: `
        <div style="text-align:center;">
          <div style="background:#fff;display:inline-block;padding:12px;border-radius:8px;margin:10px 0;">
            ${canvas}
          </div>
          <div style="font-size:11px;color:var(--muted);word-break:break-all;margin-bottom:8px;">${payload}</div>
          <button onclick="downloadQRImage('${payload}','${label}')" style="padding:8px 20px;background:#22c55e;color:#fff;border:none;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;">
            📥 Download PNG
          </button>
        </div>
      `,
      background: '#1a1d21',
      color: '#fff',
      confirmButtonText: 'Tutup',
      didClose: () => { window.loadAdminSimapoMaster(true); }
    });
  } catch (e) {
    showToast('Gagal generate QR', 'error');
  }
};

window.downloadQRImage = function(payload, label) {
  const qr = qrcode(0, 'M');
  qr.addData(payload);
  qr.make();
  const dataUrl = qr.createDataURL(6, 8);
  const link = document.createElement('a');
  link.download = `QR-${label.replace(/[^a-zA-Z0-9-]/g,'_')}.png`;
  link.href = dataUrl;
  link.click();
};

window.generateAllQR = async function(barangId) {
  const units = window._unitCache[barangId] || [];
  const withoutQR = units.filter(u => !u.qrcode || !u.qrcode.startsWith('http'));
  if (!withoutQR.length) {
    showToast('Semua unit sudah punya QR', 'info');
    return;
  }

  showToast(`Generate QR untuk ${withoutQR.length} unit...`, 'info');
  for (const u of withoutQR) {
    const origin = window.location.origin;
    const path = window.location.pathname;
    const payload = origin + path + '?qr=SIMAPO-' + u.id;
    try {
      await apiFetch(P.simapoQRUpdate, {
        method: 'POST',
        body: JSON.stringify({ unitasetid: u.id, qrcode: payload })
      });
    } catch (e) { /* skip */ }
  }
  showToast(`QR berhasil digenerate untuk ${withoutQR.length} unit`, 'success');
  // Refresh unit list
  const btn = document.querySelector(`[onclick*="toggleUnitList('${barangId}'"]`);
  if (btn) { btn.textContent = '▶ Lihat Unit'; }
  window.toggleUnitList(barangId, null);
};

window.viewQRCode = async function(unitasetId) {
  // Cari dari cache
  for (const key in window._unitCache) {
    const unit = window._unitCache[key].find(u => u.id === unitasetId);
    if (unit && unit.qrcode) {
      const qr = qrcode(0, 'M');
      qr.addData(unit.qrcode);
      qr.make();
      const canvas = qr.createImgTag(6, 8);
      Swal.fire({
        title: `QR: ${unit.nomorinventaris || unit.id}`,
        html: `
          <div style="text-align:center;">
            <div style="background:#fff;display:inline-block;padding:12px;border-radius:8px;margin:10px 0;">${canvas}</div>
            <div style="font-size:11px;color:var(--muted);word-break:break-all;">${unit.qrcode}</div>
          </div>
        `,
        background: '#1a1d21',
        color: '#fff',
        confirmButtonText: 'Tutup'
      });
      return;
    }
  }
  showToast('Unit tidak ditemukan di cache', 'error');
};
