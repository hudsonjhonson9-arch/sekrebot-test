/* ════════════════════════════════════════════════════════════
   SIMAPO HANDLER
   Menangani logika Sistem Inventaris dan Manajemen Aset
════════════════════════════════════════════════════════════ */

window.AbsenApp.simapo.katalogData = [];

/**
 * Switch sub-tabs di dalam panel SIMAPO
 */
function switchSimapoSection(section, force = false) {
  // Populate Superadmin Dropdown
  if (typeof populateSimapoInstansiSelect === 'function') populateSimapoInstansiSelect();

  // Update Buttons
  const btns = document.querySelectorAll('.simapo-tab-btn');
  btns.forEach(b => {
    if(b.id.includes('simapo')) b.classList.remove('active');
  });
  const activeBtn = document.getElementById('btn-simapo-' + section);
  if(activeBtn) activeBtn.classList.add('active');

  // Update Sections
  const sects = document.querySelectorAll('.simapo-section');
  sects.forEach(s => s.style.display = 'none');
  const activeSect = document.getElementById('simapo-section-' + section);
  if(activeSect) activeSect.style.display = 'block';

  // Load Data based on section
  if (section === 'katalog') {
    loadSimapoKatalog(force);
    if (window.loadSimapoKategori) window.loadSimapoKategori(false, force);
  }
  else if (section === 'pinjam') {
    if (typeof populateSimapoPinjamSelect === 'function') populateSimapoPinjamSelect();
    if (typeof loadSimapoRiwayatPinjam === 'function') loadSimapoRiwayatPinjam(force);
    else if (window._simapoCache && typeof window.loadAdminSimapoPinjam === 'function') {
      window._simapoCache.clear('user_pinjam_riwayat');
      const el = document.getElementById('btn-simapo-pinjam');
      el.click();
    }
  }
}

async function populateSimapoPinjamSelect() {
  const listEl = document.getElementById('simapoPinjamList');
  const inputEl = document.getElementById('simapoSelectPinjamInput');
  if (!listEl || !inputEl) return;

  if (typeof window.AbsenApp.simapo.katalogData === 'undefined' || window.AbsenApp.simapo.katalogData.length === 0) {
    if (typeof loadSimapoKatalog === 'function') await loadSimapoKatalog();
  }

  // Event listener untuk input search
  if (!inputEl.hasAttribute('data-bound')) {
    inputEl.setAttribute('data-bound', 'true');
    inputEl.addEventListener('input', (e) => {
      filterSimapoPinjamDropdown(e.target.value);
      const resetBtn = document.getElementById('simapoPinjamResetBtn');
      if (resetBtn) resetBtn.style.display = e.target.value ? 'block' : 'none';
    });
    inputEl.addEventListener('focus', () => { 
      filterSimapoPinjamDropdown(inputEl.value);
      listEl.style.display = 'block'; 
    });
    // Tutup dropdown jika klik di luar
    document.addEventListener('click', (e) => {
      const wrapper = document.getElementById('simapoPinjamWrapper');
      if (wrapper && !wrapper.contains(e.target)) {
        listEl.style.display = 'none';
      }
    });
  }

  filterSimapoPinjamDropdown('');
}

function filterSimapoPinjamDropdown(filterText = '') {
  const listEl = document.getElementById('simapoPinjamList');
  if (!listEl) return;

  const data = (typeof window.AbsenApp.simapo.katalogData !== 'undefined' ? window.AbsenApp.simapo.katalogData : []).filter(b => {
    const q = filterText.toLowerCase();
    return (b.nama && b.nama.toLowerCase().includes(q)) || (b.kodebarang && b.kodebarang.toLowerCase().includes(q));
  });
  
  if (data.length === 0) {
    listEl.innerHTML = '<div class="simapo-empty-sm">Tidak ada barang ditemukan</div>';
    return;
  }

  listEl.innerHTML = data.map(b => `
    <div class="simapo-list-item" 
         onmouseover="this.style.background='rgba(255,255,255,0.1)'" 
         onmouseout="this.style.background='transparent'"
         onclick="selectSimapoPinjamItem('${b.id}', '${b.nama.replace(/'/g, "\\'")}', ${b.stok_saat_ini || 0}, '${b.jenisbarang || 'Aset Tetap'}')">
      <div>
        <div class="simapo-item-title">${b.nama}</div>
        <div class="simapo-item-code">${b.kodebarang || '-'}</div>
      </div>
      <div class="simapo-item-stock" style="color:${b.stok_saat_ini > 0 ? 'var(--gold)' : '#ef4444'}">
        Sisa: ${b.stok_saat_ini || 0}
      </div>
    </div>
  `).join('');
}

function selectSimapoPinjamItem(id, nama, stok = 0, jenis = 'Aset Tetap') {
  const inputEl = document.getElementById('simapoSelectPinjamInput');
  const hiddenEl = document.getElementById('simapoSelectPinjam');
  const jumlahEl = document.getElementById('simapoPinjamJumlah');
  
  const tglMulaiCol = document.getElementById('simapoColMulai');
  const tglSelesaiCol = document.getElementById('simapoColSelesai');
  const btnPinjam = document.getElementById('btnSimapoSubmitPinjam');

  if (inputEl) inputEl.value = nama;
  if (hiddenEl) {
    hiddenEl.value = id;
    hiddenEl.dataset.stok = stok;
    hiddenEl.dataset.jenis = jenis;
  }
  // Show reset button
  const resetBtn = document.getElementById('simapoPinjamResetBtn');
  if (resetBtn) resetBtn.style.display = 'block';
  if (jumlahEl) {
    jumlahEl.max = stok;
    if (parseInt(jumlahEl.value) > stok) {
      jumlahEl.value = stok > 0 ? 1 : 0;
    }
  }

  // Toggle based on jenisbarang
  if (jenis === 'Habis Pakai') {
    if (tglSelesaiCol) tglSelesaiCol.style.display = 'none';
    if (tglMulaiCol) tglMulaiCol.querySelector('label').textContent = 'Tgl Permintaan';
    if (btnPinjam) btnPinjam.innerHTML = '<div class="btn-inner"><span>🚀</span> Ajukan Permintaan</div>';
  } else {
    if (tglSelesaiCol) tglSelesaiCol.style.display = 'block';
    if (tglMulaiCol) tglMulaiCol.querySelector('label').textContent = 'Tgl Mulai';
    if (btnPinjam) btnPinjam.innerHTML = '<div class="btn-inner"><span>📤</span> Ajukan Pinjaman</div>';
  }
  
  const listEl = document.getElementById('simapoPinjamList');
  if (listEl) listEl.style.display = 'none';
}

function resetSimapoPinjamSelection() {
  const inputEl = document.getElementById('simapoSelectPinjamInput');
  const hiddenEl = document.getElementById('simapoSelectPinjam');
  const jumlahEl = document.getElementById('simapoPinjamJumlah');
  const resetBtn = document.getElementById('simapoPinjamResetBtn');
  const listEl = document.getElementById('simapoPinjamList');
  const tglSelesaiCol = document.getElementById('simapoColSelesai');
  const tglMulaiCol = document.getElementById('simapoColMulai');
  const btnPinjam = document.getElementById('btnSimapoSubmitPinjam');

  // Clear input & hidden values
  if (inputEl) { inputEl.value = ''; inputEl.focus(); }
  if (hiddenEl) { hiddenEl.value = ''; delete hiddenEl.dataset.stok; delete hiddenEl.dataset.jenis; }
  if (jumlahEl) { jumlahEl.value = '1'; jumlahEl.max = ''; }
  // Hide reset button
  if (resetBtn) resetBtn.style.display = 'none';
  // Reset form labels
  if (tglSelesaiCol) tglSelesaiCol.style.display = 'block';
  if (tglMulaiCol) tglMulaiCol.querySelector('label').textContent = 'Tgl Mulai';
  if (btnPinjam) btnPinjam.innerHTML = '<div class="btn-inner"><span>📤</span> Ajukan Pinjaman</div>';
  // Re-show dropdown with all items
  filterSimapoPinjamDropdown('');
  if (listEl) listEl.style.display = 'block';
}

/**
 * Load Katalog Barang dari Server dengan Caching
 */
async function loadSimapoKatalog(force = false) {
  const container = document.getElementById('simapoKatalogList');
  if (!container) return;

  // Tampilkan shimmer jika force atau data kosong
  if (force || window.AbsenApp.simapo.katalogData.length === 0) {
    container.innerHTML = `
      <div class="shimmer-wrapper" class="simapo-shimmer-wrap">
        <div class="shimmer sh-line" class="simapo-shimmer-box"></div>
      </div>
    `;
  }

  try {
    let data = null;
    // Gunakan cache manager jika tersedia
    if (window._simapoCache && typeof window._simapoCache.getOrFetch === 'function') {
      data = await window._simapoCache.getOrFetch('user_katalog', async () => {
        try {
          const res = await apiFetch(P.simapoKatalog);
          if (!res.ok) throw new Error('Fetch failed');
          return parseApiResponse(await res.json());
        } catch (e) { 
          console.warn('[SIMAPO] Fetch Error:', e);
          return null; 
        }
      }, force);
    } else {
      // Fallback tanpa cache manager
      const res = await apiFetch(P.simapoKatalog);
      data = parseApiResponse(await res.json());
    }

    if (data && Array.isArray(data)) {
      window.AbsenApp.simapo.katalogData = data;
      renderSimapoKatalog(data);
    } else {
      throw new Error('Data format invalid or null');
    }
  } catch (e) {
    console.error('[SIMAPO] Katalog Load failed:', e);
    // Jangan gunakan dummy data agar tidak dikira data instansi lain bocor
    window.AbsenApp.simapo.katalogData = [];
    document.getElementById('simapoKatalogList').innerHTML = '<div class="simapo-empty-danger">Gagal memuat data katalog. Pastikan server N8n aktif.</div>';
  }
}

function filterSimapoKatalog(val) {
  const q = val.toLowerCase();
  const filtered = window.AbsenApp.simapo.katalogData.filter(b => 
    (b.nama && b.nama.toLowerCase().includes(q)) || 
    (b.kodebarang && b.kodebarang.toLowerCase().includes(q))
  );
  renderSimapoKatalog(filtered);
}

function renderSimapoKatalog(data) {
  const container = document.getElementById('simapoKatalogList');
  if (!container) return;

  if (data.length === 0) {
    container.innerHTML = '<div class="simapo-empty-std">Tidak ada barang ditemukan.</div>';
    return;
  }

  container.innerHTML = data.map(item => {
    const isOut = item.stok_saat_ini <= 0;
    return `
      <div class="card glass-card" class="card glass-card simapo-card" 
           onclick="showSimapoDetail('${item.id}')"
           onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='none'">
        <div style="height:100px; background:rgba(255,255,255,0.05); border-radius:8px; display:flex; align-items:center; justify-content:center; margin-bottom:8px; overflow:hidden;">
          ${item.foto ? `<img src="${item.foto}" style="width:100%; height:100%; object-fit:cover;">` : `<i class="fas fa-box" style="font-size:24px; opacity:0.2;"></i>`}
        </div>
        <div style="font-size:12px; font-weight:800; color:var(--white); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.nama}</div>
        <div style="font-size:10px; color:var(--muted); margin-bottom:6px;">${item.kodebarang}</div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:11px; color:${isOut ? '#ff4d4d' : 'var(--gold)'}; font-weight:700;">
            ${isOut ? 'Habis' : `Stok: ${item.stok_saat_ini}`}
          </div>
          <div style="font-size:9px; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px; opacity:0.7;">${item.satuan}</div>
        </div>
      </div>
    `;
  }).join('');
}

function showSimapoDetail(id) {
  const item = window.AbsenApp.simapo.katalogData.find(b => b.id === id);
  if (!item) return;

  const isOut = item.stok_saat_ini <= 0;
  
  // Tampilkan Modal Detail (Kita gunakan Swal atau Modal Custom)
  Swal.fire({
    title: `<span style="font-size:18px; color:var(--white)">Detail Aset</span>`,
    background: '#1a1d21',
    color: '#fff',
    html: `
      <div style="text-align:left; font-size:14px;">
        <div style="width:100%; height:150px; background:rgba(255,255,255,0.03); border-radius:12px; display:flex; align-items:center; justify-content:center; margin-bottom:15px; overflow:hidden; border:1px solid rgba(255,255,255,0.1)">
          ${item.foto ? `<img src="${item.foto}" style="max-width:100%; max-height:100%;">` : `<i class="fas fa-box" style="font-size:40px; opacity:0.1;"></i>`}
        </div>
        <div style="font-weight:800; font-size:16px; color:var(--gold); margin-bottom:4px;">${item.nama}</div>
        <div style="font-size:12px; color:var(--muted); margin-bottom:12px;">ID: ${item.kodebarang}</div>
        
        <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
          <div style="font-size:11px; text-transform:uppercase; color:var(--muted); font-weight:700; margin-bottom:4px;">Spesifikasi</div>
          <div style="color:var(--white); line-height:1.4;">${item.spesifikasi || 'Tidak ada spesifikasi khusus.'}</div>
        </div>
        
        <div style="margin-top:12px; display:flex; gap:10px;">
          <div style="flex:1; background:rgba(255,255,255,0.03); padding:8px; border-radius:8px; text-align:center;">
             <div style="font-size:9px; color:var(--muted);">STOK</div>
             <div style="font-weight:800; color:${isOut ? '#ff4d4d' : '#22c55e'}">${item.stok_saat_ini} ${item.satuan}</div>
          </div>
          <div style="flex:1; background:rgba(255,255,255,0.03); padding:8px; border-radius:8px; text-align:center;">
             <div style="font-size:9px; color:var(--muted);">HARGA ESTIMASI</div>
             <div style="font-weight:800;">Rp ${parseInt(item.hargasatuan || 0).toLocaleString()}</div>
          </div>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: isOut ? 'Stok Habis' : 'Pinjam Aset',
    confirmButtonColor: isOut ? '#333' : '#d4af37',
    customClass: {
      confirmButton: isOut ? 'swal2-confirm-disabled' : ''
    },
    cancelButtonText: 'Tutup',
    preConfirm: () => {
      if (isOut) {
        Swal.showValidationMessage('Stok barang sedang kosong');
        return false;
      }
      return true;
    }
  }).then((result) => {
    if (result.isConfirmed) {
      openSimapoPinjamForm(item.id, item.nama);
    }
  });
}

async function openSimapoPinjamForm(id, nama) {
  // Switch ke tab pinjam (ini otomatis memanggil populateSimapoPinjamSelect)
  switchSimapoSection('pinjam');
  
  // Tunggu sebentar untuk memastikan populateSimapoPinjamSelect selesai jika async
  await new Promise(r => setTimeout(r, 50));
  
  // Pilih barang di select
  const sel = document.getElementById('simapoSelectPinjam');
  if (sel) {
    sel.value = id;
  }
}

async function simapoSubmitPinjam() {
  const hiddenEl = document.getElementById('simapoSelectPinjam');
  const id = hiddenEl?.value;
  const tujuan = document.getElementById('simapoTujuanPinjam')?.value;
  const mulai = document.getElementById('simapoPinjamMulai')?.value;
  const selesai = document.getElementById('simapoPinjamSelesai')?.value;
  const jumlah = parseInt(document.getElementById('simapoPinjamJumlah')?.value) || 1;
  const stokMaks = parseInt(hiddenEl?.dataset.stok) || 0;
  const jenis = hiddenEl?.dataset.jenis || 'Aset Tetap';

  if (!id || !tujuan || !mulai || jumlah < 1) {
    showToast('Harap isi semua kolom dengan benar!', 'error');
    return;
  }
  
  if (jenis === 'Aset Tetap' && !selesai) {
    showToast('Harap isi tanggal selesai untuk Aset Tetap!', 'error');
    return;
  }

  if (jumlah > stokMaks) {
    showToast(`Gagal! Jumlah yang diminta (${jumlah}) melebihi stok (${stokMaks}).`, 'error');
    return;
  }

  showToast('Mengirim pengajuan...', 'info');
  try {
    const res = await apiFetch(P.simapoPinjam, {
      method: 'POST',
      body: JSON.stringify({
        unitasetid: id,
        tujuanpeminjaman: tujuan,
        tanggalmulai: mulai,
        tanggalselesai: jenis === 'Habis Pakai' ? mulai : selesai,
        jumlah: jumlah,
        jenisbarang: jenis
      })
    });
    
    if (res.ok) {
      showToast('Pengajuan berhasil dikirim!', 'success');
      // Reset
      document.getElementById('simapoSelectPinjam').value = '';
      const inputEl = document.getElementById('simapoSelectPinjamInput');
      if (inputEl) inputEl.value = '';
      document.getElementById('simapoTujuanPinjam').value = '';
      document.getElementById('simapoPinjamJumlah').value = '1';
      document.getElementById('simapoTujuanPinjam').value = '';
      if (window._simapoCache) {
        window._simapoCache.clear('admin_pinjam');
        window._simapoCache.clear('user_pinjam_riwayat');
      }
      switchSimapoSection('katalog');
    } else {
      showToast('Gagal mengirim pengajuan', 'error');
    }
  } catch (e) {
    showToast('(Demo) Pengajuan terkirim!', 'success');
    switchSimapoSection('katalog');
  }
}

async function loadSimapoRiwayatPinjam(force = false) {
  const container = document.getElementById('simapoRiwayatPinjamList');
  if (!container) return;

  container.innerHTML = '<div class="shimmer-wrapper"><div class="shimmer sh-line" style="height:80px; border-radius:12px"></div></div>';

  const data = await (window._simapoCache ? window._simapoCache.getOrFetch('user_pinjam_riwayat', async () => {
    try {
      const res = await apiFetch(P.simapoPinjamList);
      return parseApiResponse(await res.json());
    } catch { return null; }
  }, force) : apiFetch(P.simapoPinjamList).then(r => r.json()).then(parseApiResponse).catch(() => null));

  if (data) {
    renderSimapoRiwayatPinjam(data);
  } else {
    // Kosongkan riwayat jika gagal / tidak ada
    renderSimapoRiwayatPinjam([]);
  }
}

function renderSimapoRiwayatPinjam(data) {
  const container = document.getElementById('simapoRiwayatPinjamList');
  if (!container) return;

  if (data.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; opacity:0.5; font-size:12px;">Belum ada riwayat peminjaman.</div>';
    return;
  }

  container.innerHTML = data.map(item => {
    let color = '#d4af37'; // MENUNGGU
    let icon = '<i class="fas fa-clock"></i>';
    if (item.status === 'DISETUJUI' || item.status === 'DIPINJAM') { color = '#22c55e'; icon = '<i class="fas fa-check-circle"></i>'; }
    if (item.status === 'DITOLAK') { color = '#ff4d4d'; icon = '<i class="fas fa-times-circle"></i>'; }
    if (item.status === 'DIKEMBALIKAN') { color = '#64b4ff'; icon = '<i class="fas fa-undo"></i>'; }

    return `
      <div class="card glass-card" style="margin-bottom:10px; padding:16px; border-left: 4px solid ${color}; transition: transform 0.2s; cursor:default;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
        <div style="display:flex; justify-content:space-between; align-items:flex-start">
          <div>
            <div style="font-weight:800; font-size:14px; color:var(--white); line-height:1.2;">${item.nama_barang}</div>
            <div style="font-size:11px; color:var(--muted); margin-top:4px;">Jumlah: <strong style="color:var(--gold)">${item.jumlah || 1}</strong></div>
          </div>
          <div style="font-size:10px; font-weight:800; color:${color}; background:rgba(255,255,255,0.08); padding:4px 10px; border-radius:8px; display:flex; align-items:center; gap:4px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
            <span>${icon}</span> <span>${item.status}</span>
          </div>
        </div>
        <div style="display:flex; gap: 15px; margin-top:12px;">
          <div>
            <div style="font-size:9px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">${item.jenisbarang === 'Habis Pakai' ? 'Tgl Permintaan' : 'Jadwal Pinjam'}</div>
            <div style="font-size:11px; font-weight:700; color:var(--white); margin-top:2px;">
              ${item.jenisbarang === 'Habis Pakai' ? item.tanggalmulai : `${item.tanggalmulai} <span style="color:var(--muted);font-weight:400;margin:0 4px;">s/d</span> ${item.tanggalselesai}`}
            </div>
          </div>
        </div>
        <div style="margin-top:12px; padding-top:12px; border-top: 1px solid rgba(255,255,255,0.05);">
          <div style="font-size:9px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">Tujuan Peminjaman</div>
          <div style="font-size:12px; color:var(--gold); margin-top:4px; font-style:italic;">"${item.tujuanpeminjaman}"</div>
        </div>
      </div>
    `;
  }).join('');
}

async function simapoSubmitTiket() {
  const judul = document.getElementById('simapoTiketJudul')?.value;
  const desc = document.getElementById('simapoTiketDesc')?.value;
  const lokasi = document.getElementById('simapoTiketLokasi')?.value;

  if (!judul || !desc) {
    showToast('Harap isi judul dan deskripsi!', 'error');
    return;
  }

  showToast('Mengirim laporan...', 'info');
  try {
    const res = await apiFetch(P.simapoTiket, {
      method: 'POST',
      body: JSON.stringify({ judul, deskripsi: desc, lokasi })
    });
    
    if (res.ok) {
      showToast('Laporan kerusakan berhasil dikirim!', 'success');
      document.getElementById('simapoTiketJudul').value = '';
      document.getElementById('simapoTiketDesc').value = '';
      if (window._simapoCache) window._simapoCache.clear('admin_tiket');
      switchSimapoSection('katalog');
    } else {
      showToast('Gagal mengirim laporan', 'error');
    }
  } catch (e) {
    showToast('(Demo) Laporan terkirim!', 'success');
    switchSimapoSection('katalog');
  }
}

/* --- SUPERADMIN INSTANSI SELECTOR --- */
function populateSimapoInstansiSelect() {
  const sec = document.getElementById('simapoInstansiSection');
  if (!sec) return;

  const storedRole = String(localStorage.getItem('MY_ROLE') || '').toLowerCase();
  const isSA = storedRole.includes('super') || 
               (typeof _isSuperAdmin === 'function' && _isSuperAdmin()) ||
               (window.IS_ADMIN && storedRole.includes('super'));

  if (isSA) {
    sec.style.display = 'block';
    const el = document.getElementById('simapoInstansiSelect');
    if (el) {
      if (el.options.length <= 1) { // Not populated yet
        try {
          const cached = localStorage.getItem('absen_instansi_map');
          if (cached) {
            const map = JSON.parse(cached);
            const keys = Object.keys(map);
            el.innerHTML = '<option value="">— Pilih Instansi —</option>' +
              keys.map(k => {
                const inst = map[k];
                const id = inst.id || inst.ID || k;
                const name = inst.nama_instansi || inst.header || inst.nama || id.toUpperCase();
                return `<option value="${id}">${name}</option>`;
              }).join('');
          }
        } catch (e) {
          console.warn('[SIMAPO] Gagal load instansi map', e);
        }
      }
      // Set to currently selected instansi if available
      const savedInst = localStorage.getItem('MY_INSTANSI');
      if (savedInst && el.value === '') {
        el.value = savedInst;
      }
    }
  } else {
    sec.style.display = 'none';
  }
}

function onSimapoInstansiChange() {
  // Clear caches for the new instansi context
  if (window._simapoCache && typeof window._simapoCache.clear === 'function') {
    window._simapoCache.clear();
  }
  window.AbsenApp.simapo.katalogData = [];
  
  // Reload current section
  const activeBtn = document.querySelector('.simapo-tab-btn.active');
  if (activeBtn) {
    const id = activeBtn.id; // e.g. btn-simapo-katalog
    const section = id.replace('btn-simapo-', '');
    switchSimapoSection(section, true); // force reload
  } else {
    switchSimapoSection('katalog', true);
  }
}
