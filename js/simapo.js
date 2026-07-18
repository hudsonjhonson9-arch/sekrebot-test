/* ════════════════════════════════════════════════════════════
   SIMAPO HANDLER
   Menangani logika Sistem Inventaris dan Manajemen Aset
════════════════════════════════════════════════════════════ */

let simapoKatalogData = [];

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

  if (typeof simapoKatalogData === 'undefined' || simapoKatalogData.length === 0) {
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

  const data = (typeof simapoKatalogData !== 'undefined' ? simapoKatalogData : []).filter(b => {
    const q = filterText.toLowerCase();
    return (b.nama && b.nama.toLowerCase().includes(q)) || (b.kodebarang && b.kodebarang.toLowerCase().includes(q));
  });
  
  if (data.length === 0) {
    listEl.innerHTML = '<div style="padding:12px; font-size:12px; color:var(--muted); text-align:center;">Tidak ada barang ditemukan</div>';
    return;
  }

  listEl.innerHTML = data.map(b => `
    <div style="padding:10px 15px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer; font-size:13px; color:var(--white); display:flex; justify-content:space-between; align-items:center;" 
         onmouseover="this.style.background='rgba(255,255,255,0.1)'" 
         onmouseout="this.style.background='transparent'"
         onclick="selectSimapoPinjamItem('${b.id}', '${b.nama.replace(/'/g, "\\'")}', ${b.stok_saat_ini || 0}, '${b.jenisbarang || 'Aset Tetap'}')">
      <div>
        <div style="font-weight:600; margin-bottom:2px;">${b.nama}</div>
        <div style="font-size:10px; color:var(--muted);">${b.kodebarang || '-'}</div>
      </div>
      <div style="font-size:11px; font-weight:700; color:${b.stok_saat_ini > 0 ? 'var(--gold)' : '#ef4444'};">
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
  if (force || simapoKatalogData.length === 0) {
    container.innerHTML = `
      <div class="shimmer-wrapper" style="width:100%; grid-column: 1 / -1;">
        <div class="shimmer sh-line" style="height:120px; border-radius:12px"></div>
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
      simapoKatalogData = data;
      renderSimapoKatalog(data);
    } else {
      throw new Error('Data format invalid or null');
    }
  } catch (e) {
    console.error('[SIMAPO] Katalog Load failed:', e);
    // Jangan gunakan dummy data agar tidak dikira data instansi lain bocor
    simapoKatalogData = [];
    document.getElementById('simapoKatalogList').innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px; opacity:0.6; font-size:13px; color:var(--danger)">Gagal memuat data katalog. Pastikan server N8n aktif.</div>';
  }
}

function filterSimapoKatalog(val) {
  const q = val.toLowerCase();
  const filtered = simapoKatalogData.filter(b => 
    (b.nama && b.nama.toLowerCase().includes(q)) || 
    (b.kodebarang && b.kodebarang.toLowerCase().includes(q))
  );
  renderSimapoKatalog(filtered);
}

function renderSimapoKatalog(data) {
  const container = document.getElementById('simapoKatalogList');
  if (!container) return;

  if (data.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px; opacity:0.6; font-size:13px;">Tidak ada barang ditemukan.</div>';
    return;
  }

  container.innerHTML = data.map(item => {
    const isOut = item.stok_saat_ini <= 0;
    return `
      <div class="card glass-card" style="padding:10px; cursor:pointer; position:relative; overflow:hidden; border: 1px solid rgba(255,255,255,0.08); transition: transform 0.2s;" 
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
  const item = simapoKatalogData.find(b => b.id === id);
  if (!item) return;

  const isOut = item.stok_saat_ini <= 0;
  const origin = window.location.origin + window.location.pathname;
  const qrPayload = origin + '?qr=SIMAPO-' + item.id;

  let qrImg = '';
  try {
    const QR = window.QRCode || qrcode;
    if (typeof QR === 'function') {
      const qr = QR(0, 'M');
      qr.addData(qrPayload);
      qr.make();
      qrImg = '<img src="' + qr.createDataURL(5, 6) + '" style="width:140px;height:140px;display:block;margin:0 auto;">';
    }
  } catch (_) {
    console.warn('[QR] detail:', _.message);
  }

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

        ${qrImg ? `
        <div style="margin-top:14px; background:rgba(255,255,255,0.03); padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.05); text-align:center;">
          <div style="font-size:11px; text-transform:uppercase; color:var(--muted); font-weight:700; margin-bottom:8px;">QR Code Aset</div>
          <div style="background:#fff; display:inline-block; padding:8px; border-radius:6px;">${qrImg}</div>
          <div style="margin-top:8px;">
            <button onclick="downloadQRFromCatalog('${item.id}','${item.nama}')" style="padding:6px 14px;background:#22c55e;color:#fff;border:none;border-radius:6px;font-weight:700;font-size:11px;cursor:pointer;">📥 Download QR</button>
          </div>
        </div>` : ''}
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

window.downloadQRFromCatalog = function(id, nama) {
  const QR = window.QRCode || qrcode;
  if (typeof QR !== 'function') return showToast('QR library tidak tersedia', 'error');
  const origin = window.location.origin + window.location.pathname;
  const payload = origin + '?qr=SIMAPO-' + id;
  const qr = QR(0, 'M');
  qr.addData(payload);
  qr.make();
  const dataUrl = qr.createDataURL(6, 8);
  const link = document.createElement('a');
  link.download = 'QR-' + (nama || id).replace(/[^a-zA-Z0-9-]/g, '_') + '.png';
  link.href = dataUrl;
  link.click();
};

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
  simapoKatalogData = [];
  
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

/* ─── QR SCAN FLOW ──────────────────────────────────────────── */
window.processQR = async function(payload) {
  if (!payload || !payload.startsWith('SIMAPO-')) {
    showToast('QR tidak valid', 'error');
    return;
  }

  const unitId = payload.replace('SIMAPO-', '');
  console.log('[SIMAPO-QR] Processing QR for unit:', unitId);

  switchTab('simapo');
  setTimeout(() => {
    switchSimapoSection('pinjam');
    setTimeout(() => loadQRForm(unitId), 300);
  }, 400);
};

async function loadQRForm(unitId) {
  showToast('Memuat data aset...', 'info');
  try {
    const res = await apiGet(P.simapoUnitByQR, { q: 'SIMAPO-' + unitId });
    if (!res.ok || !res.rows?.length) {
      showToast('QR tidak dikenal atau aset tidak ditemukan', 'error');
      return;
    }
    const unit = res.rows[0];
    renderQRConfirmPanel(unit);
  } catch (e) {
    showToast('Gagal memuat data aset', 'error');
  }
}

function renderQRConfirmPanel(unit) {
  const panel = document.getElementById('qrConfirmPanel');
  if (!panel) return;

  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const nama = window.userProfile?.nama || localStorage.getItem('MY_NAMA') || 'Pegawai';
  const nip = window._session?.nip || localStorage.getItem('MY_NIP') || '';
  const dipinjam = unit.statuspinjam === true || unit.statuspinjam === 'true';

  // Sembunyikan form manual
  const manualForm = document.getElementById('simapoPinjamForm');
  if (manualForm) manualForm.style.display = 'none';
  const riwayatSection = document.getElementById('simapoRiwayatSection');
  if (riwayatSection) riwayatSection.style.display = 'none';

  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  panel.dataset.unitasetid = unit.id;

  let statusHtml = '';
  if (dipinjam) {
    statusHtml = `<span style="color:#ef4444;font-weight:800;">🔴 Sedang Dipinjam</span>
      <div style="font-size:11px;color:var(--muted);margin-top:4px;">Oleh: ${unit.nama_peminjam_saat_ini || '—'}</div>`;
  } else if (unit.kondisi !== 'BAIK') {
    statusHtml = `<span style="color:#f59e0b;font-weight:800;">⚠️ Kondisi: ${unit.kondisi}</span>
      <div style="font-size:11px;color:var(--muted);margin-top:4px;">Laporkan kerusakan jika ingin meminjam</div>`;
  } else {
    statusHtml = `<span style="color:#22c55e;font-weight:800;">✅ Tersedia</span>`;
  }

  panel.innerHTML = `
    <div class="card glass-card" style="border:2px solid rgba(201,168,76,0.3);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <span style="font-size:24px;">📷</span>
        <div style="font-weight:800;font-size:14px;color:var(--gold);">Hasil Scan QR</div>
      </div>
      <div style="display:flex;gap:14px;background:rgba(255,255,255,0.03);border-radius:12px;padding:14px;border:1px solid rgba(255,255,255,0.07);margin-bottom:14px;">
        <div style="width:60px;height:60px;border-radius:8px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;overflow:hidden;">
          ${unit.foto_barang ? `<img src="${unit.foto_barang}" style="width:100%;height:100%;object-fit:cover;">` : '📦'}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:800;font-size:14px;color:var(--white);">${escapeHtml(unit.nama_barang || 'Aset')}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">${unit.nomorinventaris || '—'}</div>
          <div style="font-size:11px;color:var(--muted);">Kondisi: ${unit.kondisi || 'BAIK'}</div>
          <div style="margin-top:6px;">${statusHtml}</div>
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:10px;margin-bottom:12px;">
        <div style="font-size:11px;color:var(--muted);">👤 Peminjam</div>
        <div style="font-weight:700;font-size:13px;color:var(--white);">${escapeHtml(nama)}</div>
        <div style="font-size:11px;color:var(--muted);">NIP: ${escapeHtml(nip)}</div>
      </div>
      ${dipinjam || unit.kondisi !== 'BAIK' ? `
      <button class="btn-primary" onclick="closeQRPanel()" style="width:100%;background:var(--muted);">
        <div class="btn-inner"><span>✕</span> Tutup</div>
      </button>` : `
      <div class="form-group" style="margin-bottom:10px;">
        <label class="form-label">Tujuan Peminjaman</label>
        <textarea class="form-textarea" id="qrTujuan" placeholder="Untuk kegiatan apa?" style="min-height:50px;">Peminjaman</textarea>
      </div>
      <div style="display:flex;gap:10px;margin-bottom:14px;">
        <div style="flex:1;">
          <label class="form-label">Tgl Mulai</label>
          <input type="date" class="form-input" id="qrMulai" value="${today}">
        </div>
        <div style="flex:1;">
          <label class="form-label">Tgl Selesai</label>
          <input type="date" class="form-input" id="qrSelesai" value="${nextWeek}">
        </div>
      </div>
      <button class="btn-primary" onclick="submitQRPinjam()" style="width:100%;">
        <div class="btn-inner"><span>📤</span> Konfirmasi Pinjam</div>
      </button>
      <button onclick="closeQRPanel()" style="width:100%;margin-top:8px;padding:10px;background:transparent;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:var(--muted);font-size:12px;cursor:pointer;">Batal</button>
      `}
    </div>
  `;
}

window.closeQRPanel = function() {
  const panel = document.getElementById('qrConfirmPanel');
  if (panel) {
    panel.style.display = 'none';
    panel.innerHTML = '';
  }
  const manualForm = document.getElementById('simapoPinjamForm');
  if (manualForm) manualForm.style.display = 'block';
  const riwayatSection = document.getElementById('simapoRiwayatSection');
  if (riwayatSection) riwayatSection.style.display = 'block';
};

window.submitQRPinjam = async function() {
  const panel = document.getElementById('qrConfirmPanel');
  if (!panel) return;
  const unitasetid = panel.dataset.unitasetid;
  const tujuan = document.getElementById('qrTujuan')?.value.trim() || 'Peminjaman';
  const mulai = document.getElementById('qrMulai')?.value;
  const selesai = document.getElementById('qrSelesai')?.value;

  if (!mulai || !selesai) {
    showToast('Harap isi tanggal pinjam', 'error');
    return;
  }

  showToast('Mengirim pengajuan...', 'info');
  try {
    const res = await apiFetch(P.simapoQRPinjam, {
      method: 'POST',
      body: JSON.stringify({
        unitasetid,
        tujuanpeminjaman: tujuan,
        tanggalmulai: mulai,
        tanggalselesai: selesai
      })
    });
    if (res.ok) {
      showToast('Pengajuan berhasil dikirim!', 'success');
      closeQRPanel();
      if (window._simapoCache) {
        window._simapoCache.clear('admin_pinjam');
        window._simapoCache.clear('user_pinjam_riwayat');
      }
      loadSimapoRiwayatPinjam(true);
    } else {
      const err = parseApiResponse(await res.json().catch(() => null));
      showToast(err?.message || 'Gagal mengirim pengajuan', 'error');
    }
  } catch (e) {
    showToast('(Demo) Pengajuan terkirim!', 'success');
    closeQRPanel();
    switchSimapoSection('katalog');
  }
};
