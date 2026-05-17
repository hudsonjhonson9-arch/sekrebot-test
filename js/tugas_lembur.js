/* ════ PENUGASAN & LEMBUR ════ */
(function () {
  let _allPegawaiTugas = [];
  let _allPegawaiLembur = [];
  let _selectedLemburPegawai = []; 
  let _selectedTugasPegawai = []; 
  let _tugasMap = null;
  let _tugasMarker = null;
  let _activeTugasData = null; // Store data of the task being worked on


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
  /**
   * Check Role Access and Initialize UI
   */
  function checkTugasLemburAccess() {
    const p = userProfile || {};
    const role = String(p.role || localStorage.getItem('MY_ROLE') || 'USER').toLowerCase().trim();
    const isManager = ['kepala', 'sekretaris', 'kabid', 'irban', 'admin', 'superadmin'].includes(role) || !!window.IS_ADMIN;
    
    // 1. Sidebar/Bottom Nav & Admin Visibility
    if (typeof applyAdminVisibility === 'function') applyAdminVisibility();
    
    const navTugasDesk = $('nav-tugas-desk');
    const navLemburDesk = $('nav-lembur-desk');
    const moreTugas = $('more-tugas');
    const moreLembur = $('more-lembur');

    if (navTugasDesk) navTugasDesk.style.display = 'flex';
    if (moreTugas) moreTugas.style.display = 'flex';
    
    if (navLemburDesk) navLemburDesk.style.display = isManager ? 'flex' : 'none';
    if (moreLembur) moreLembur.style.display = isManager ? 'flex' : 'none';

    // 2. Form vs List visibility
    const creationForm = $('tugasCreationForm');
    const actingAsGroup = $('actingAsGroup');
    if (creationForm) {
      creationForm.style.display = isManager ? 'block' : 'none';
    }
    if (actingAsGroup) {
      const isAdmin = ['admin', 'superadmin'].includes(role) || !!window.IS_ADMIN;
      actingAsGroup.style.display = isAdmin ? 'block' : 'none';
    }

    // 3. Load personal assignments
    loadMyAssignments();
    // 4. Load monitoring if manager
    if (isManager) loadMonitoringTasks();
    // 5. Initialize Superadmin scoping dropdown
    initSuperadminTugasScoping();
  }
  window.checkTugasLemburAccess = checkTugasLemburAccess;

  /**
   * Load Assignments for the current user (NIP based)
   */
  async function loadMyAssignments() {
    const listEl = $('tugasListSection');
    if (!listEl) return;
    
    const p = typeof userProfile !== 'undefined' && userProfile ? userProfile : {};
    let nip = p.nip || localStorage.getItem('MY_NIP');
    
    if (!nip) {
      try {
        const u = JSON.parse(localStorage.getItem('tg_user_obj_v5') || '{}');
        nip = u.nip || u.NIP;
      } catch(e) {}
    }

    if (!nip) {
      listEl.innerHTML = '<div class="empty-state">Data profil belum tersedia</div>';
      return;
    }

    listEl.innerHTML = `
      <div class="shimmer-wrapper">
        <div class="shimmer sh-line" style="width:100%; height:80px; border-radius:15px; margin-bottom:10px"></div>
        <div class="shimmer sh-line" style="width:100%; height:80px; border-radius:15px"></div>
      </div>
    `;

    try {
      // Endpoint: fetching from dedicated penugasan table
      // apiGet already returns {ok, rows, data, status}
      const res = await apiGet(`${P.penugasanList}?nip=${nip}&limit=20`);
      console.log('[TugasLembur] API Response:', res);
      
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      
      // Handle n8n wrap { data: [...] } or direct array via apiGet's logic
      const data = res.rows || parseApiResponse(res.data) || [];
      console.log('[TugasLembur] Parsed Data:', data);

      if (data.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state" style="padding:40px 20px">
            <div style="font-size:40px; margin-bottom:15px">📋</div>
            <div style="font-weight:800; color:var(--white); font-size:14px">Belum Ada Perjalanan Dinas</div>
            <div style="color:var(--muted); font-size:11px; margin-top:5px">Perjalanan dinas yang diberikan atasan akan muncul di sini</div>
          </div>
        `;
        return;
      }

      listEl.innerHTML = `
        <div style="font-size:12px; font-weight:800; color:var(--gold); margin-bottom:15px; text-transform:uppercase; letter-spacing:1px">
          <i class="fas fa-list-ul" style="margin-right:8px"></i> Daftar Perjalanan Dinas Saya
        </div>
        ${data.map(r => renderTugasCard(r)).join('')}
      `;
    } catch (e) {
      console.error('[TugasLembur] Load Error:', e);
      listEl.innerHTML = `
        <div class="empty-state">
          <div style="font-size:30px; margin-bottom:10px">⚠️</div>
          <div style="font-weight:700">Gagal memuat tugas</div>
          <div style="font-size:10px; color:var(--muted); margin:5px 0 10px">${e.message}</div>
          <button onclick="loadMyAssignments()" class="btn-sm" style="background:rgba(255,255,255,0.1); border-radius:10px; padding:8px 15px; border:1px solid rgba(255,255,255,0.2); color:var(--white); cursor:pointer">🔄 Coba Lagi</button>
        </div>
      `;
    }

    // 2. LOAD MONITORING & FORM VISIBILITY (If Manager)
    const profileData = userProfile || {};
    const userRole = String(profileData.role || localStorage.getItem('MY_ROLE') || 'USER').toLowerCase().trim();
    const isManagerRole = ['kepala', 'sekretaris', 'kabid', 'irban', 'admin', 'superadmin'].includes(userRole) || !!window.IS_ADMIN;
    
    // Form Visibility
    const formEl = $('tugasCreationForm');
    if (formEl) {
      formEl.style.display = isManagerRole ? 'block' : 'none';
      if (isManagerRole) {
        loadTugasPegawai();
        loadMonitoringTasks();
      }
    }

    // Monitoring Section
    if (isManager) {
      loadMonitoringTasks();
    } else {
      const monEl = $('tugasMonitoringSection');
      if (monEl) monEl.style.display = 'none';
    }
  }
  function renderTugasCard(r) {
    const rawTgl = r.tanggal || '—';
    let tglDisplay = rawTgl;
    try {
      if (rawTgl.includes('T') || rawTgl.includes('-')) {
        const d = new Date(rawTgl);
        if (!isNaN(d.getTime())) {
          tglDisplay = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }
      }
    } catch(e) {}

    const ket = r.keterangan || '—';
    const lat = r.lat;
    const lon = r.lon;
    const rad = r.radius || 100;
    const status = (r.status || 'AKTIF').toUpperCase();
    const bukti = r.bukti || '';
    const tglSelesai = r.updated_at || r.pengerjaan_timestamp ? new Date(r.updated_at || r.pengerjaan_timestamp).toLocaleString('id-ID', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'}) : '';
    
    let mapBtn = '';
    if (lat && lon) {
      mapBtn = `
        <a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" class="btn-sm" style="background:rgba(96,165,250,0.1); color:#60a5fa; border:1px solid rgba(96,165,250,0.2); padding:6px 12px; border-radius:10px; text-decoration:none; font-size:10px; font-weight:700; display:inline-flex; align-items:center; gap:6px; transition:all 0.3s ease">
          <i class="fas fa-map-marked-alt"></i> Lokasi
        </a>
      `;
    }

    let actionBtn = '';
    if (status === 'AKTIF') {
      actionBtn = `
        <button onclick='handleKerjakanTugas(${JSON.stringify(r)})' class="btn-sm" style="background:linear-gradient(135deg, var(--gold) 0%, #d4af37 100%); color:#000; border:none; padding:8px 16px; border-radius:10px; font-size:11px; font-weight:800; cursor:pointer; box-shadow: 0 4px 15px rgba(212,175,55,0.3); transition:all 0.3s ease">
          🚀 Kerjakan Tugas
        </button>
      `;
    } else {
      actionBtn = `
        <div style="text-align:right">
          <div class="status-badge s-success" style="font-size:9px; background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.3)">SELESAI</div>
          <div style="font-size:8px; color:var(--muted); margin-top:4px; font-weight:600">${tglSelesai}</div>
        </div>
      `;
    }

    let buktiTag = '';
    if (bukti) {
      buktiTag = `
        <div style="margin-top:15px; border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,0.08); position:relative">
          <img src="${bukti}" style="width:100%; height:140px; object-fit:cover; display:block" alt="Bukti Tugas">
          <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(transparent, rgba(0,0,0,0.8)); padding:10px; font-size:9px; color:#fff; font-weight:600">
             <i class="fas fa-check-circle" style="color:#10b981; margin-right:5px"></i> Bukti Terlampir
          </div>
        </div>
      `;
    }

    return `
      <div class="card glass-card" style="margin-bottom:15px; padding:18px; border-left:4px solid ${status === 'AKTIF' ? 'var(--gold)' : '#10b981'}; transition:transform 0.3s ease">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px">
          <div style="flex:1; padding-right:10px">
            <div style="font-size:10px; font-weight:800; color:var(--gold); text-transform:uppercase; letter-spacing:0.5px; opacity:0.8">${tglDisplay}</div>
            ${r.nomor_surat ? `<div style="font-size:11px; color:#fff; font-weight:700; margin-top:4px; background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:6px; display:inline-block"><i class="fas fa-file-invoice" style="margin-right:6px; color:var(--gold)"></i> ${r.nomor_surat}</div>` : ''}
            <div style="font-size:15px; font-weight:800; color:var(--white); margin-top:6px; line-height:1.4">${ket}</div>
          </div>
          ${status === 'AKTIF' ? '<div class="status-badge s-warning" style="font-size:9px; letter-spacing:1px; font-weight:900">AKTIF</div>' : ''}
        </div>
        
        <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:10px; margin-top:10px">
          <div style="display:flex; justify-content:space-between; align-items:center">
             <div style="font-size:11px; color:var(--muted); display:flex; align-items:center; gap:8px">
                <i class="fas fa-bullseye" style="color:var(--danger)"></i>
                Radius: ${rad}m
             </div>
             <div style="display:flex; gap:8px">
                ${mapBtn}
                ${actionBtn}
             </div>
          </div>
          ${buktiTag}
        </div>
      </div>
    `;
  }

  /**
   * Distance Helper (Haversine)
   */
  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
  }

  /**
   * Action: Kerjakan Tugas
   */
  window.handleKerjakanTugas = function(r) {
    if ((r.status || '').toUpperCase() === 'SELESAI') {
      Swal.fire('Info', 'Perjalanan dinas ini sudah diselesaikan.', 'info');
      return;
    }
    _activeTugasData = r;
    
    // Check if target coordinates are defined
    const hasTargetCoords = (r.lat && String(r.lat).trim() !== '' && r.lon && String(r.lon).trim() !== '');

    Swal.fire({
      title: 'Kerjakan Perjalanan Dinas',
      html: `
        <div style="margin-bottom:10px">
          <i class="fas fa-map-marker-alt" style="color:#ef4444; margin-right:8px"></i> 
          ${hasTargetCoords ? 'Pastikan Anda berada di lokasi perjalanan dinas.' : 'Sistem akan mencatat lokasi koordinat penyelesaian perjalanan dinas Anda.'}
        </div>
        <div style="font-size:12px; opacity:0.7">${hasTargetCoords ? 'Sistem akan mengecek jarak koordinat dan meminta bukti foto.' : 'Sistem akan mengambil koordinat lokasi Anda saat ini dan meminta bukti foto.'}</div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: '📍 Cek Lokasi & Foto',
      cancelButtonText: 'Batal'
    }).then((res) => {
      if (res.isConfirmed) {
        // 1. Get Geolocation
        if (!navigator.geolocation) {
          alert('Geolocation tidak didukung di browser ini.');
          return;
        }

        Swal.fire({ title: 'Mengecek Lokasi...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        navigator.geolocation.getCurrentPosition(async (pos) => {
          const myLat = pos.coords.latitude;
          const myLon = pos.coords.longitude;
          
          let insideRadius = true;
          let dist = 0;
          
          if (hasTargetCoords) {
            dist = getDistance(myLat, myLon, parseFloat(r.lat), parseFloat(r.lon));
            if (dist > (r.radius || 100)) {
              insideRadius = false;
            }
          }

          if (!insideRadius) {
            Swal.fire('❌ Gagal', `Anda berada ${Math.round(dist)}m dari titik perjalanan dinas. Jarak maksimal adalah ${r.radius}m.`, 'error');
          } else {
            // 2. Trigger File Input
            Swal.close();
            _activeTugasData.actual_lat = myLat;
            _activeTugasData.actual_lon = myLon;
            $('tugasBuktiInput').click();
          }
        }, (err) => {
          Swal.fire('❌ Gagal', 'Gagal mendapatkan lokasi: ' + err.message, 'error');
        }, { enableHighAccuracy: true });
      }
    });
  };

  /**
   * Process Proof Upload
   */
  window.processTugasBukti = async function(input) {
    if (!input.files || !input.files[0] || !_activeTugasData) return;

    const file = input.files[0];

    // Check if offline
    if (!navigator.onLine) {
      Swal.fire({ title: 'Menyimpan Secara Offline...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target.result;
          
          const offlineData = {
            endpoint: P.penugasanSave,
            method: 'POST',
            payload: {
              id: _activeTugasData.id,
              status: 'SELESAI',
              bukti_base64: base64,
              bukti_mime: file.type,
              bukti_nama: file.name,
              actual_lat: _activeTugasData.actual_lat,
              actual_lon: _activeTugasData.actual_lon,
              pengerjaan_timestamp: Date.now()
            },
            timestamp: Date.now(),
            type: 'tugas',
            nip: _activeTugasData.nip
          };
          
          await idb.set('offline_queue', offlineData);
          
          Swal.fire({
            title: '📴 Disimpan Offline',
            text: 'Penyelesaian Perjalanan Dinas disimpan sementara di perangkat Anda karena tidak ada koneksi internet. Data akan disinkronisasikan otomatis saat terhubung internet.',
            icon: 'warning',
            confirmButtonText: 'OK'
          });
          loadMyAssignments();
        };
        reader.readAsDataURL(file);
      } catch (err) {
        Swal.fire('❌ Gagal', 'Gagal menyimpan data offline: ' + err.message, 'error');
      } finally {
        input.value = '';
      }
      return;
    }

    Swal.fire({ title: 'Mengunggah Bukti...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
      // 1. Upload Photo
      const formData = new FormData();
      formData.append('file', file);
      formData.append('nip', _activeTugasData.nip);
      formData.append('id', _activeTugasData.id);
      
      const uploadRes = await apiUpload(P.upload, formData);
      if (!uploadRes.ok) throw new Error('Gagal mengunggah foto');

      const imageUrl = uploadRes.data?.url || uploadRes.data?.link;
      
      // 2. Update Task Status
      const updateRes = await apiPost(P.penugasanSave, {
        id: _activeTugasData.id,
        status: 'SELESAI',
        bukti: imageUrl,
        actual_lat: _activeTugasData.actual_lat,
        actual_lon: _activeTugasData.actual_lon,
        pengerjaan_timestamp: Date.now()
      });

      if (updateRes.ok) {
        Swal.fire('✅ Berhasil', 'Tugas telah diselesaikan!', 'success');
        loadMyAssignments();
      } else {
        throw new Error('Gagal memperbarui status tugas');
      }

    } catch (e) {
      Swal.fire('❌ Gagal', e.message, 'error');
    } finally {
      input.value = '';
    }
  };

  /* ════════════════════════════════════════════════════
     ADMIN/MANAGER LOGIC
     ════════════════════════════════════════════════════ */

  /**
   * Load Pegawai for Tugas Dropdown
   */
  async function loadTugasPegawai() {
    const el = $('tugasOptionsList');
    const pemberiEl = $('tugasPemberi');
    if (!el) return;
    el.innerHTML = '<div style="padding:10px; text-align:center; font-size:11px; color:var(--muted)">⏳ Memuat...</div>';
    
    try {
      // Use format=full to get ALL employees (including Kabid/Manager)
      const res = await apiGet(P.userList, { format: 'full' });
      const rows = res.rows || parseApiResponse(res.data) || [];
      
      _allPegawaiTugas = rows.map(u => {
        const j = String(u.jabatan || u.Jabatan || '').toLowerCase();
        let r = String(u.role || u.Role || 'USER').toLowerCase().trim();
        
        // Auto-detect role from jabatan if current role is 'user'
        if (r === 'user') {
          // STRICT matches to avoid flooding the list
          if (j === 'kepala badan' || j === 'kepala dinas') r = 'kepala';
          else if (j === 'sekretaris badan' || j === 'sekretaris') r = 'sekretaris';
          else if (j.startsWith('kepala bidang') || j === 'kabid') r = 'kabid';
          else if (j === 'irban') r = 'irban';
        }

        return {
          id: u.id || u.ID || u.telegram_id || '',
          nama: u.nama || u.Nama || u.username || '',
          nip: u.nip || u.NIP || '',
          jabatan: u.jabatan || u.Jabatan || '',
          role: r
        };
      }).sort((a, b) => a.nama.localeCompare(b.nama));

      renderTugasPegawaiList(_allPegawaiTugas);

      // Populate Pemberi Tugas dropdown if it exists (for Admins)
      if (pemberiEl) {
        const managers = _allPegawaiTugas.filter(u => 
          ['kepala', 'sekretaris', 'kabid', 'irban', 'admin', 'superadmin'].includes(u.role)
        );
        pemberiEl.innerHTML = '<option value="">-- Gunakan Profil Saya --</option>' + 
          managers.map(m => `<option value="${m.nip}|${m.nama}">${m.nama} (${m.role.toUpperCase()})</option>`).join('');
      }
    } catch (e) {
      el.innerHTML = '<div style="padding:10px; text-align:center; color:var(--danger)">❌ Gagal memuat pegawai</div>';
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
    
    L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      attribution: '&copy; Google Maps'
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

    if (_selectedTugasPegawai.length === 0 || !tgl) {
      alert('⚠️ Harap pilih minimal satu pegawai dan tanggal tugas.');
      return;
    }

    // Save for each selected employee
    setBtnL('btnSaveTugas', true, '⏳ Memproses...');
    try {
      const pemberiVal = $('tugasPemberi')?.value || '';
      let creatorNama = userProfile?.nama || 'Admin';
      let creatorNip = userProfile?.nip || localStorage.getItem('MY_NIP');

      if (pemberiVal) {
        const [pNip, pNama] = pemberiVal.split('|');
        creatorNip = pNip;
        creatorNama = pNama;
      }

      const results = await Promise.all(_selectedTugasPegawai.map(async (u) => {
        const payload = {
          user_id: u.id,
          nama: u.nama,
          nip: u.nip,
          lat, lon,
          keterangan: ket,
          nomor_surat: $('tugasNomorSurat')?.value?.trim() || '',
          tanggal: tgl,
          radius: parseInt($('tugasRadius').value) || 100,
          created_by: creatorNama,
          created_by_nip: creatorNip,
          timestamp: Date.now()
        };
        return await apiPost(P.penugasanSave, payload);
      }));

      const allOk = results.every(r => r.ok && r.data?.ok !== false);
      if (allOk) {
        showResult('tugasResult', 'tugasRIcon', 'tugasRTitle', 'tugasRMsg', 'success', '✅', 'Penugasan Berhasil', 
          `${_selectedTugasPegawai.length} Pegawai telah ditugaskan pada ${tgl}.`);
        dom.show('tugasResult', 'flex');
        
        // Reset
        $('tugasKet').value = '';
        if ($('tugasNomorSurat')) $('tugasNomorSurat').value = '';
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

    // Find Kepala dynamically (e.g. Kepala Dinas, Kepala Badan, Inspektur)
    const kb = _allPegawaiLembur.find(u => {
      const j = (u.jabatan || '').toUpperCase();
      return j.includes('KEPALA BADAN') || j.includes('KEPALA DINAS') || j.startsWith('KEPALA ') || j === 'KEPALA' || j.includes('INSPEKTUR');
    }) || {
      nama: 'TITUS JURI, S.T., M.Si',
      pangkat: 'Pembina Utama Muda (IV/c)',
      nip: '19740523 200212 1 004',
      jabatan: 'Kepala Badan'
    };
    const kepTitle = kb.jabatan ? kb.jabatan : 'Kepala';

    const instId = getScopedInstansiId();
    const instName = getInstansiName(instId);
    const instNameUpper = instName ? instName.toUpperCase() : 'BADAN PERENCANAAN PEMBANGUNAN<br>RISET DAN INOVASI DAERAH';

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
          <h2>${instNameUpper}</h2>
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
          ${kepTitle},<br><br><br><br><br>
          <b>${kb.nama}</b><br>
          ${kb.pangkat || '—'}<br>
          NIP. ${kb.nip || '—'}
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

  /**
   * Load Monitoring Tasks (Tasks created by this manager)
   */
  async function loadMonitoringTasks() {
    const el = $('tugasMonitoringSection');
    if (!el) return;
    
    const p = userProfile || {};
    const role = String(p.role || localStorage.getItem('MY_ROLE') || 'USER').toLowerCase().trim();
    const isManager = ['kepala', 'sekretaris', 'kabid', 'irban', 'admin', 'superadmin'].includes(role) || !!window.IS_ADMIN;
    if (!isManager) {
      el.innerHTML = '';
      return;
    }

    el.innerHTML = `
      <div class="shimmer-wrapper">
        <div class="shimmer sh-line" style="width:100%; height:80px; border-radius:15px; margin-bottom:10px"></div>
      </div>
    `;

    try {
      const myNip = userProfile?.nip || localStorage.getItem('MY_NIP');
      const isAdmin = ['admin', 'superadmin'].includes(role) || !!window.IS_ADMIN;
      
      // Fetch tasks: Admins see everything, Managers see what they created
      let url = `${P.penugasanList}?limit=100`;
      if (!isAdmin) {
        url += `&created_by_nip=${myNip}`;
      }
      
      const res = await apiGet(url);
      
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      
      const data = res.rows || parseApiResponse(res.data) || [];
      renderMonitoringTasks(data);
    } catch (e) {
      console.error('[TugasLembur] Monitoring Load Error:', e);
      el.innerHTML = `<div class="empty-state" style="padding:20px; font-size:11px">⚠️ Gagal memuat monitoring: ${e.message}</div>`;
    }
  }

  function renderMonitoringTasks(data) {
    const el = $('tugasMonitoringSection');
    if (!el) return;

    if (data.length === 0) {
      el.innerHTML = `
        <div class="card glass-card" style="padding:20px; text-align:center; opacity:0.7">
          <div style="font-size:24px; margin-bottom:8px">📡</div>
          <div style="font-size:11px; font-weight:700">Belum ada perjalanan dinas yang Anda instruksikan</div>
          <div style="font-size:9px; color:var(--muted)">Progres perjalanan dinas yang Anda berikan ke staf akan muncul di sini.</div>
        </div>
      `;
      return;
    }

    const header = `
      <div style="font-size:12px; font-weight:800; color:var(--gold); margin-bottom:15px; margin-top:25px; text-transform:uppercase; letter-spacing:1px">
        <i class="fas fa-satellite-dish" style="margin-right:8px"></i> Monitoring Progres Perjalanan Dinas
      </div>
    `;

    const cards = data.map(t => {
      const isSelesai = String(t.status).toUpperCase() === 'SELESAI';
      const color = isSelesai ? 'var(--success)' : 'var(--warning)';
      const icon = isSelesai ? 'check-circle' : 'clock';
      
      let tglDisplay = t.tanggal || '—';
      try {
        if (tglDisplay.includes('T') || tglDisplay.includes('-')) {
          const d = new Date(tglDisplay);
          if (!isNaN(d.getTime())) {
            tglDisplay = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          }
        }
      } catch (err) {}

      return `
        <div class="card glass-card" style="margin-bottom:12px; border-left: 4px solid ${color}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start">
            <div style="flex:1">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px">
                <div style="font-size:13px; font-weight:800; color:var(--white)">${t.nama || '—'}</div>
                <span class="status-badge" style="background:${isSelesai ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)'}; color:${color}; font-size:9px; border:1px solid ${color}44">
                  <i class="fas fa-${icon}" style="margin-right:4px"></i> ${t.status || 'PENDING'}
                </span>
              </div>
              <div style="font-size:10px; color:var(--muted)">NIP: ${t.nip || '—'}</div>
              <div style="font-size:9px; color:var(--gold); margin-top:2px; font-weight:700">
                <i class="fas fa-user-tie"></i> Pemberi: ${t.created_by || 'Admin'}
              </div>
              <div style="font-size:11px; color:var(--text); margin-top:8px; line-height:1.4">
                <strong>Ket:</strong> ${t.keterangan || '—'}
              </div>
              <div style="font-size:9px; color:var(--muted); margin-top:8px; display:flex; align-items:center; gap:10px">
                 <span>📅 ${tglDisplay}</span>
                 <span>📍 Radius ${t.radius || 100}m</span>
              </div>
            </div>
            
            ${t.bukti ? `
              <button onclick="viewTugasBukti('${t.bukti}')" style="background:rgba(255,255,255,0.05); border:1px solid var(--border); color:var(--white); padding:6px 12px; border-radius:10px; font-size:10px; font-weight:700; cursor:pointer">
                📷 BUKTI
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    el.innerHTML = header + cards;
  }

  window.viewTugasBukti = function(url) {
    if (!url) return;
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'Bukti Pengerjaan',
        imageUrl: url,
        imageAlt: 'Foto Bukti',
        confirmButtonText: 'Tutup',
        background: '#0a192f',
        color: '#fff',
        confirmButtonColor: '#3b82f6'
      });
    } else {
      window.open(url, '_blank');
    }
  };

  function initSuperadminTugasScoping() {
    const isSA = typeof _isSuperAdmin === 'function' && _isSuperAdmin();
    const sec = $('tugasInstansiSection');
    if (!sec) return;

    if (isSA) {
      sec.style.display = 'block';
      const el = $('tugasInstansiSelect');
      if (el && el.options.length <= 1) { // Not populated yet
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

            // Pre-select current instansi
            const scoped = getScopedInstansiId();
            if (scoped) {
              el.value = scoped;
            }
          }
        } catch (e) {
          console.error('[Tugas Superadmin] populate error:', e);
        }
      }
    } else {
      sec.style.display = 'none';
    }
  }

  function onTugasInstansiChange() {
    const el = $('tugasInstansiSelect');
    if (!el) return;
    let val = el.value;
    if (!val) {
      try {
        const u = JSON.parse(localStorage.getItem('tg_user_obj_v5') || '{}');
        val = u.instansi_id || u.Instansi_Id || 'bapperida';
      } catch (e) {
        val = 'bapperida';
      }
    }
    localStorage.setItem('MY_INSTANSI', val);
    document.documentElement.style.setProperty('--agency-name', `'${val.toUpperCase()}'`);
    if (window.userProfile) {
      window.userProfile.instansi_id = val;
    }
    
    // Reload dynamic employee list for tugas
    loadTugasPegawai();
    
    // Reload tugas list / monitoring for this instansi
    loadMyAssignments();
    loadMonitoringTasks();
  }

  window.initSuperadminTugasScoping = initSuperadminTugasScoping;
  window.onTugasInstansiChange = onTugasInstansiChange;
  window.checkTugasLemburAccess = checkTugasLemburAccess;
  window.loadMonitoringTasks = loadMonitoringTasks;
})();
