/* ════ PENUGASAN & LEMBUR ════ */
(function () {
  let _allPegawaiTugas = [];
  let _allPegawaiLembur = [];
  let _selectedLemburPegawai = []; 
  let _selectedTugasPegawai = []; 
  let _tugasMap = null;
  let _tugasMarker = null;


  /**
   * Inisialisasi Modul
   */
  async function initTugasLembur() {
    console.log('[TugasLembur] Initializing...');
    checkTugasLemburAccess();
    
    // Set default dates
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
    if ($('tugasTanggal')) $('tugasTanggal').value = today; 
    if ($('lemburDari')) $('lemburDari').value = today;
    if ($('lemburSampai')) $('lemburSampai').value = today;
  }
  window.initTugasLembur = initTugasLembur;

  /**
   * Check Role Access
   */
  function checkTugasLemburAccess() {
    const p = userProfile || {};
    const jabatan = (p.jabatan || '').toUpperCase();
    const isKabid = jabatan.includes('KEPALA BIDANG') || jabatan.includes('SEKRETARIS') || jabatan.includes('KEPALA BADAN');
    const isAdmin = !!IS_ADMIN;
    
    console.log('[TugasLemburCheck] User:', p.nama, '| NIP:', p.nip);
    console.log('[TugasLemburCheck] IS_ADMIN:', isAdmin, '| isKabid:', isKabid);

    const navTugas = $('nav-tugas');
    const navLembur = $('nav-lembur');
    
    if (navTugas) {
      navTugas.style.display = (isKabid || isAdmin) ? 'flex' : 'none';
      console.log('[TugasLemburCheck] nav-tugas display set to:', navTugas.style.display);
    }
    if (navLembur) {
      navLembur.style.display = isAdmin ? 'flex' : 'none';
      console.log('[TugasLemburCheck] nav-lembur display set to:', navLembur.style.display);
    }
  }
  window.checkTugasLemburAccess = checkTugasLemburAccess;

  /* ════════════════════════════════════════════════════
     PENUGASAN LOGIC
     ════════════════════════════════════════════════════ */

  /**
   * Load Pegawai for Tugas Dropdown
   */
  async function loadTugasPegawai() {
    const el = $('tugasOptionsList');
    if (!el) return;
    el.innerHTML = '<div style="padding:10px; text-align:center; font-size:11px; color:var(--muted)">⏳ Memuat...</div>';
    
    try {
      const res = await apiGet(P.userList + '?format=full');
      const rows = res.ok ? ((res.rows?.length ?? 0) ? res.rows : parseApiResponse(res.data)) : [];
      
      _allPegawaiTugas = rows.map(u => ({
        id: u.id || u.ID || u.telegram_id || '',
        nama: u.nama || u.Nama || u.username || '',
        nip: u.nip || u.NIP || '',
        jabatan: u.jabatan || u.Jabatan || '',
        pangkat: u.pangkat || u.Pangkat || ''
      })).sort((a, b) => a.nama.localeCompare(b.nama));

      renderTugasPegawaiList(_allPegawaiTugas);
    } catch (e) {
      el.innerHTML = '<div style="padding:10px; text-align:center; color:var(--danger)">❌ Gagal</div>';
    }
  }

  function renderTugasPegawaiList(list) {
    const el = $('tugasOptionsList');
    if (!el) return;
    if (list.length === 0) {
      el.innerHTML = '<div style="padding:10px; text-align:center; color:var(--muted)">🔍 Tidak ditemukan</div>';
      return;
    }
    el.innerHTML = list.map(u => {
      const isSelected = _selectedTugasPegawai.some(s => s.id == u.id);
      return `
        <div class="dropdown-item ${isSelected ? 'selected' : ''}" onclick="selectTugasPegawai('${u.id}', '${u.nama.replace(/'/g, "\\'")}', '${u.nip}')">
          <div style="display:flex; align-items:center; justify-content:space-between; width:100%">
            <div>
              <span class="item-name">${u.nama}</span>
              <span class="item-nip">🪪 ${u.nip || '—'}</span>
            </div>
            ${isSelected ? '<i class="fas fa-check-circle" style="color:var(--success)"></i>' : ''}
          </div>
        </div>
      `;
    }).join('');
  }


  window.toggleTugasDropdown = function(forceClose = false) {
    const container = $('tugasPegawaiContainer');
    if (!container) return;
    if (forceClose) container.classList.remove('open');
    else {
      container.classList.toggle('open');
      if (container.classList.contains('open')) {
        if (!_allPegawaiTugas.length) loadTugasPegawai();
        $('tugasSearchInput').focus();
      }
    }
  };

  window.filterTugasPegawai = function(query) {
    const q = query.toLowerCase().trim();
    const filtered = _allPegawaiTugas.filter(u => u.nama.toLowerCase().includes(q) || u.nip.toLowerCase().includes(q));
    renderTugasPegawaiList(filtered);
    const container = $('tugasPegawaiContainer');
    if (container && !container.classList.contains('open')) container.classList.add('open');
  };

  window.selectTugasPegawai = function(id, nama, nip) {
    const idx = _selectedTugasPegawai.findIndex(p => p.id == id);
    if (idx > -1) {
      _selectedTugasPegawai.splice(idx, 1);
    } else {
      _selectedTugasPegawai.push({ id, nama, nip });
    }
    
    renderTugasPills();
    renderTugasPegawaiList(_allPegawaiTugas);
    
    // Multi-select: keep open and focus search
    $('tugasSearchInput').value = '';
    $('tugasSearchInput').focus();
  };

  function renderTugasPills() {
    const container = $('tugasSelectedPills');
    if (!container) {
      const trigger = document.querySelector('#tugasPegawaiContainer .dropdown-trigger');
      const pillsWrap = document.createElement('div');
      pillsWrap.id = 'tugasSelectedPills';
      pillsWrap.style = 'display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;';
      trigger.parentNode.insertBefore(pillsWrap, trigger.nextSibling);
    }
    
    const el = $('tugasSelectedPills');
    if (_selectedTugasPegawai.length === 0) {
      el.innerHTML = '';
      return;
    }

    el.innerHTML = _selectedTugasPegawai.map(u => `
      <div class="pegawai-pill">
        <span>${u.nama.split(' ')[0]}</span>
        <i class="fas fa-times-circle" onclick="event.stopPropagation(); selectTugasPegawai('${u.id}')"></i>
      </div>
    `).join('');
  }


  /**
   * Map Initialization
   */
  function initTugasMap() {
    if (_tugasMap) return;
    
    // Default center (Sumba Barat / Kantor Bapperida)
    const defCenter = [-9.6548, 119.4122]; 
    _tugasMap = L.map('tugasMap').setView(defCenter, 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(_tugasMap);

    _tugasMap.on('click', function(e) {
      const { lat, lng } = e.latlng;
      setTugasMarker(lat, lng);
    });

    // Try to get current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude, longitude } = pos.coords;
        _tugasMap.setView([latitude, longitude], 16);
      });
    }
  }
  window.initTugasMap = initTugasMap;

  function setTugasMarker(lat, lng) {
    if (_tugasMarker) _tugasMarker.setLatLng([lat, lng]);
    else _tugasMarker = L.marker([lat, lng], { draggable: true }).addTo(_tugasMap);

    $('tugasLat').value = lat.toFixed(6);
    $('tugasLon').value = lng.toFixed(6);
  }

  /**
   * Save Assignment
   */
  window.handleSaveTugas = async function() {
    const pegSel = $('tugasPegawai');
    const lat = $('tugasLat').value;
    const lon = $('tugasLon').value;
    const ket = $('tugasKet').value.trim();
    const tgl = $('tugasTanggal').value;

    if (_selectedTugasPegawai.length === 0 || !lat || !tgl) {
      alert('⚠️ Harap pilih minimal satu pegawai, titik lokasi, dan tanggal tugas.');
      return;
    }

    // Save for each selected employee
    setBtnL('btnSaveTugas', true, '⏳ Memproses...');
    try {
      const results = await Promise.all(_selectedTugasPegawai.map(async (u) => {
        const payload = {
          user_id: u.id,
          nama: u.nama,
          nip: u.nip,
          lat, lon,
          keterangan: ket,
          tanggal: tgl,
          created_by: userProfile?.nama || 'Admin',
          timestamp: Date.now()
        };
        return await apiPost(P.tugasAdd, payload);
      }));

      const allOk = results.every(r => r.ok && r.data?.ok !== false);
      if (allOk) {
        showResult('tugasResult', 'tugasRIcon', 'tugasRTitle', 'tugasRMsg', 'success', '✅', 'Penugasan Berhasil', 
          `${_selectedTugasPegawai.length} Pegawai telah ditugaskan pada ${tgl}.`);
        dom.show('tugasResult', 'flex');
        
        // Reset
        $('tugasKet').value = '';
        if (_tugasMarker) { _tugasMap.removeLayer(_tugasMarker); _tugasMarker = null; }
        $('tugasLat').value = ''; $('tugasLon').value = '';
        _selectedTugasPegawai = [];
        renderTugasPills();
      } else {
        showResult('tugasResult', 'tugasRIcon', 'tugasRTitle', 'tugasRMsg', 'fail', '❌', 'Sebagian Gagal', 'Beberapa penugasan gagal disimpan.');
        dom.show('tugasResult', 'flex');
      }

    } catch (e) {
      alert('❌ Terjadi kesalahan koneksi.');
    } finally {
      setBtnL('btnSaveTugas', false, '💾 Simpan Penugasan');
    }
  };

  /* ════════════════════════════════════════════════════
     LEMBUR LOGIC
     ════════════════════════════════════════════════════ */

  /**
   * Load Pegawai for Lembur Dropdown
   */
  async function loadLemburPegawai() {
    const el = $('lemburOptionsList');
    if (!el) return;
    el.innerHTML = '<div style="padding:10px; text-align:center; font-size:11px; color:var(--muted)">⏳ Memuat...</div>';
    
    try {
      const res = await apiGet(P.userList + '?format=full');
      const rows = res.ok ? ((res.rows?.length ?? 0) ? res.rows : parseApiResponse(res.data)) : [];
      
      _allPegawaiLembur = rows.map(u => ({
        id: u.id || u.ID || u.telegram_id || '',
        nama: u.nama || u.Nama || u.username || '',
        nip: u.nip || u.NIP || '',
        jabatan: u.jabatan || u.Jabatan || '',
        pangkat: u.pangkat || u.Pangkat || ''
      })).sort((a, b) => a.nama.localeCompare(b.nama));

      renderLemburPegawaiList(_allPegawaiLembur);
    } catch (e) {
      el.innerHTML = '<div style="padding:10px; text-align:center; color:var(--danger)">❌ Gagal</div>';
    }
  }

  function renderLemburPegawaiList(list) {
    const el = $('lemburOptionsList');
    if (!el) return;
    if (list.length === 0) {
      el.innerHTML = '<div style="padding:10px; text-align:center; color:var(--muted)">🔍 Tidak ditemukan</div>';
      return;
    }
    el.innerHTML = list.map(u => {
      const isSelected = _selectedLemburPegawai.some(s => s.id == u.id);
      return `
        <div class="dropdown-item ${isSelected ? 'selected' : ''}" onclick="selectLemburPegawai('${u.id}', '${u.nama.replace(/'/g, "\\'")}', '${u.nip}')">
          <div style="display:flex; align-items:center; justify-content:space-between; width:100%">
            <div>
              <span class="item-name">${u.nama}</span>
              <span class="item-nip">🪪 ${u.nip || '—'}</span>
            </div>
            ${isSelected ? '<i class="fas fa-check-circle" style="color:var(--success)"></i>' : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  window.toggleLemburDropdown = function(forceClose = false) {
    const container = $('lemburPegawaiContainer');
    if (!container) return;
    if (forceClose) container.classList.remove('open');
    else {
      container.classList.toggle('open');
      if (container.classList.contains('open')) {
        if (!_allPegawaiLembur.length) loadLemburPegawai();
        $('lemburSearchInput').focus();
      }
    }
  };

  window.filterLemburPegawai = function(query) {
    const q = query.toLowerCase().trim();
    const filtered = _allPegawaiLembur.filter(u => u.nama.toLowerCase().includes(q) || u.nip.toLowerCase().includes(q));
    renderLemburPegawaiList(filtered);
    const container = $('lemburPegawaiContainer');
    if (container && !container.classList.contains('open')) container.classList.add('open');
  };

  window.selectLemburPegawai = function(id, nama, nip) {
    const idx = _selectedLemburPegawai.findIndex(p => p.id == id);
    if (idx > -1) {
      _selectedLemburPegawai.splice(idx, 1);
    } else {
      _selectedLemburPegawai.push({ id, nama, nip });
    }
    
    renderLemburPills();
    renderLemburPegawaiList(_allPegawaiLembur); // Refresh list for checkmarks
    
    // Don't close for multi-select
    $('lemburSearchInput').value = '';
    $('lemburSearchInput').focus();
  };

  function renderLemburPills() {
    const container = $('lemburSelectedPills');
    if (!container) {
      // Create container if not exists
      const trigger = document.querySelector('#lemburPegawaiContainer .dropdown-trigger');
      const pillsWrap = document.createElement('div');
      pillsWrap.id = 'lemburSelectedPills';
      pillsWrap.style = 'display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;';
      trigger.parentNode.insertBefore(pillsWrap, trigger.nextSibling);
    }
    
    const el = $('lemburSelectedPills');
    if (_selectedLemburPegawai.length === 0) {
      el.innerHTML = '';
      return;
    }

    el.innerHTML = _selectedLemburPegawai.map(u => `
      <div class="pegawai-pill">
        <span>${u.nama.split(' ')[0]}</span>
        <i class="fas fa-times-circle" onclick="event.stopPropagation(); selectLemburPegawai('${u.id}')"></i>
      </div>
    `).join('');
  }

  /**
   * Fetch Overtime Data
   */
  window.handleFetchLembur = async function() {
    const dari = $('lemburDari').value;
    const sampai = $('lemburSampai').value;

    if (!dari || !sampai || _selectedLemburPegawai.length === 0) {
      alert('⚠️ Harap isi rentang tanggal dan pilih minimal satu pegawai.');
      return;
    }

    const listEl = $('lemburResultList');
    listEl.innerHTML = '<div class="shimmer" style="height:100px; border-radius:15px"></div>';
    
    const nips = _selectedLemburPegawai.map(p => p.nip).join(',');
    if (!nips) {
      alert('Pilih minimal satu pegawai.');
      return;
    }

    setBtnL('btnFetchLembur', true, '⌛ Menarik Data...');

    try {
      const res = await apiGet(`${P.lemburGet}?dari=${dari}&sampai=${sampai}&nips=${nips}`);
      if (!res.ok) {
        const msg = getApiErrorMsg(res.data, 'Gagal menarik data dari server.');
        listEl.innerHTML = `<div class="empty-state">❌ ${msg}</div>`;
        return;
      }
      
      const data = parseApiResponse(res.data);
      renderLemburResults(data);
      
      // Store data for PDF
      window._currentLemburData = data;
      window._currentLemburRange = { dari, sampai };
      
    } catch (e) {
      listEl.innerHTML = `<div class="empty-state">❌ Terjadi kesalahan jaringan atau server offline.</div>`;
    } finally {
      setBtnL('btnFetchLembur', false, '📊 Tarik Data Lembur');
    }
  };

  /**
   * Calculate Overtime (Standard 14:30)
   */
  function calculateOvertime(jamPulang) {
    if (!jamPulang || jamPulang === '—') return 0;
    const standard = "14:30:00";
    const [h, m] = jamPulang.split(':').map(Number);
    const [sh, sm] = standard.split(':').map(Number);
    
    const pulMin = h * 60 + m;
    const stdMin = sh * 60 + sm;
    
    const diff = pulMin - stdMin;
    return diff > 0 ? diff : 0;
  }

  function formatDuration(minutes) {
    if (minutes <= 0) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h} jam ${m} mnt` : `${m} mnt`;
  }

  /**
   * Handle PDF Export (Matrix Format)
   */
  window.handleExportLemburPDF = function() {
    const data = window._currentLemburData;
    const range = window._currentLemburRange;
    if (!data || data.length === 0) return alert('Tidak ada data untuk dicetak.');

    // 1. Get unique dates in range (sorted)
    const dates = [...new Set(data.map(r => r.tanggal))].sort();
    
    // 2. Group data by employee (NIP)
    const groups = {};
    data.forEach(r => {
      if (!groups[r.nip]) {
        groups[r.nip] = {
          nama: r.nama,
          nip: r.nip,
          dates: {}
        };
      }
      groups[r.nip].dates[r.tanggal] = calculateOvertime(r.jam_pulang);
    });

    let printArea = document.getElementById('printArea');
    if (!printArea) {
      printArea = document.createElement('div');
      printArea.id = 'printArea';
      document.body.appendChild(printArea);
    }


    // Find Kepala Badan dynamically
    const kb = _allPegawaiLembur.find(u => (u.jabatan || '').toUpperCase().includes('KEPALA BADAN')) || {
      nama: 'TITUS JURI, S.T., M.Si',
      pangkat: 'Pembina Utama Muda (IV/c)',
      nip: '19740523 200212 1 004'
    };

    const html = `
      <style>
        @media print {
          body > *:not(#printArea) { display: none !important; }
          body::before, body::after { display: none !important; content: none !important; }
          #printArea { display: block !important; position: absolute; left: 0; top: 0; width: 100%; height: auto; margin: 0; padding: 0; background: #fff !important; color: #000 !important; }
          @page { size: portrait; margin: 1cm; }
        }
        #printArea { font-family: 'Times New Roman', serif; padding: 20px; background: white; color: black; display: none; }
        .print-header { display: flex; align-items: center; border-bottom: 0.8px solid #000; padding-bottom: 2px; margin-bottom: 2px; width: 100%; position: relative; }
        .print-header-line { border-bottom: 2.5px solid #000; margin-bottom: 20px; width: 100%; }
        .print-header-logo { width: 65px; height: auto; position: absolute; left: 10px; top: 0; }
        .print-header-text { flex: 1; text-align: center; width: 100%; padding-left: 50px; }
        .print-header-text h1 { font-size: 15px; margin: 0; font-weight: bold; line-height: 1.2; text-transform: uppercase; }
        .print-header-text h2 { font-size: 18px; margin: 2px 0; font-weight: bold; line-height: 1.1; text-transform: uppercase; }
        .print-header-text p { font-size: 11px; margin: 2px 0 0 0; font-style: normal; }
        
        .print-title { text-align: center; font-size: 14px; font-weight: bold; margin-top: 25px; text-decoration: underline; text-transform: uppercase; }
        .print-subtitle { text-align: center; font-size: 11px; margin-bottom: 25px; font-weight: normal; }

        
        .print-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .print-table th, .print-table td { border: 1px solid #000; padding: 5px 3px; font-size: 10px; text-align: center; vertical-align: middle; }
        .print-table th { background: #e0e0e0 !important; font-weight: bold; -webkit-print-color-adjust: exact; }
        .print-table .pegawai-col { text-align: left; padding-left: 6px; width: 200px; }
        
        .print-footer { display: flex; justify-content: flex-end; margin-top: 40px; }
        .print-sign { text-align: left; width: 250px; font-size: 11px; line-height: 1.4; }
        .print-sign b { text-decoration: underline; font-size: 12px; }
      </style>

      <div class="print-header">
        <img class="print-header-logo" src="https://raw.githubusercontent.com/hudsonjhonson9-arch/sekrebot/main/Lambang_Kabupaten_Sumba_Barat.png">
        <div class="print-header-text">
          <h1>PEMERINTAH KABUPATEN SUMBA BARAT</h1>
          <h2>BADAN PERENCANAAN PEMBANGUNAN<br>RISET DAN INOVASI DAERAH</h2>
          <p>Jl. Weekarou, Waikabubak, Sumba Barat, Nusa Tenggara Timur</p>
        </div>
      </div>
      <div class="print-header-line"></div>



      
      <div class="print-title">REKAPITULASI KERJA LEMBUR PEGAWAI</div>
      <div class="print-subtitle">Periode: ${range.dari} s/d ${range.sampai}</div>

      <table class="print-table">
        <thead>
          <tr>
            <th width="30">NO</th>
            <th class="pegawai-col">NAMA / NIP</th>
            ${dates.map(d => `<th>${d.split('-').slice(1).join('/')}</th>`).join('')}
            <th width="80">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${Object.values(groups).map((g, i) => {
            let rowTotal = 0;
            const cells = dates.map(d => {
              const mins = g.dates[d] || 0;
              rowTotal += mins;
              return `<td>${mins > 0 ? formatDuration(mins) : '—'}</td>`;
            }).join('');
            
            return `
              <tr>
                <td>${i + 1}</td>
                <td class="pegawai-col"><b>${g.nama}</b><br><small>NIP. ${g.nip}</small></td>
                ${cells}
                <td style="font-weight:bold">${formatDuration(rowTotal)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="print-footer">
        <div class="print-sign">
          Waikabubak, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br>
          Mengetahui,<br>
          Kepala Badan,<br><br><br><br><br>
          <b>${kb.nama}</b><br>
          ${kb.pangkat || 'Pembina Utama Muda (IV/c)'}<br>
          NIP. ${kb.nip}
        </div>
      </div>
    `;




    printArea.innerHTML = html;

    // Wait for logo to load before printing
    const img = printArea.querySelector('.print-header-logo');
    if (img && !img.complete) {
      img.onload = () => window.print();
      img.onerror = () => window.print(); // Still print if logo fails
    } else {
      window.print();
    }
  };

  /**
   * Render Results to UI
   */
  function renderLemburResults(data) {
    const listEl = $('lemburResultList');
    if (!listEl) return;

    if (data.length === 0) {
      listEl.innerHTML = '<div class="empty-state">📭 Tidak ada data absen untuk rentang ini.</div>';
      return;
    }

    const header = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:15px; margin-top:20px">
        <div style="font-size:12px; font-weight:800; color:var(--white)">📋 HASIL PENCARIAN (${data.length})</div>
        <button class="btn-sm-admin" onclick="handleExportLemburPDF()" style="background:var(--success); border:none; color:white; padding:6px 12px; border-radius:8px; font-size:10px; font-weight:700">
           📄 Cetak Rekap PDF
        </button>
      </div>
    `;

    const items = data.map(r => {
      const minutes = calculateOvertime(r.jam_pulang);
      const isConflict = r.is_tugas;
      
      return `
        <div class="card glass-card" style="margin-bottom:12px; border-left:4px solid ${isConflict ? 'var(--danger)' : 'var(--success)'}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start">
            <div>
              <div style="font-size:13px; font-weight:800; color:var(--white)">${r.nama}</div>
              <div style="font-size:10px; color:var(--muted); margin-bottom:8px">NIP: ${r.nip} | Tanggal: ${r.tanggal}</div>
              
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
                <div style="background:rgba(255,255,255,0.03); padding:6px; border-radius:8px">
                  <div style="font-size:8px; color:var(--muted)">MASUK</div>
                  <div style="font-size:11px; font-weight:700; color:var(--success)">${r.jam_masuk || '—'}</div>
                </div>
                <div style="background:rgba(255,255,255,0.03); padding:6px; border-radius:8px">
                  <div style="font-size:8px; color:var(--muted)">PULANG</div>
                  <div style="font-size:11px; font-weight:700; color:var(--info)">${r.jam_pulang || '—'}</div>
                </div>
              </div>
            </div>
            
            <div style="text-align:right">
              <div style="font-size:9px; color:var(--muted)">DURASI LEMBUR</div>
              <div style="font-size:14px; font-weight:900; color:var(--gold)">${formatDuration(minutes)}</div>
              ${isConflict ? '<div class="status-badge s-fail" style="font-size:8px; padding:2px 6px; margin-top:5px">⚠️ TUGAS</div>' : ''}
            </div>
          </div>
          
          ${isConflict ? `
            <div style="margin-top:10px; padding:8px; background:rgba(239,68,68,0.1); border-radius:8px; font-size:10px; color:rgba(239,68,68,0.8)">
              <strong>Keterangan Tugas:</strong> ${r.tugas_detail || 'Sedang dalam tugas luar.'}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    listEl.innerHTML = header + items;
  }

  // Close dropdowns on click outside
  document.addEventListener('click', (e) => {
    const tCont = $('tugasPegawaiContainer');
    if (tCont && !tCont.contains(e.target)) window.toggleTugasDropdown(true);
    
    const lCont = $('lemburPegawaiContainer');
    if (lCont && !lCont.contains(e.target)) window.toggleLemburDropdown(true);
  });

})();
