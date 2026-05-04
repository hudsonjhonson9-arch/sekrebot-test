/* ════ HELPERS — DOM, DATA, RESULT UI ════ */
    /* ════ RIWAYAT HARI INI ════ */
    /**
     * Parse berbagai format response array dari n8n menjadi array flat.
     * @deprecated Gunakan parseApiResponse() dari config.js untuk kode baru.
     * @param {any} json - Response JSON dari API
     * @returns {any[]}
     */
        function parseRows(json) {
      if (!json) return [];
      // Jika format nya [ { data: [...], total: 10 } ] (N8N standard wrapper)
      if (Array.isArray(json) && json.length === 1 && Array.isArray(json[0]?.data)) return json[0].data;
      // Jika format nya langsung array [ {...}, {...} ]
      if (Array.isArray(json)) return json;
      // Jika format nya object { data: [...] }
      if (Array.isArray(json?.data)) return json.data;
      // Jika format nya [ [...] ] (array di dalam array)
      if (Array.isArray(json?.[0])) return json[0];
      return [];
    }
    /**
     * Ambil nilai field dari row data dengan fallback multi-key.
     * Menangani perbedaan kapitalisasi key antara format lama dan baru.
     * @param {Object} r - Baris data
     * @param {...string} keys - Key yang dicoba berurutan
     * @returns {any} Nilai pertama yang ditemukan, atau undefined
     */
        function getField(r, ...keys) {
      for (const k of keys) {
        if (r[k] !== undefined && r[k] !== null && r[k] !== '') return r[k];
      }
      return '';
    }

    let _todayLoading = false;
    async function loadTodayHistory() {
      const uid = await waitForMyId();
      if (_todayLoading) return;
      _todayLoading = true;
      const el = $('todayList');
      if (!el) return;
      el.innerHTML = `<div class="shimmer" style="height:32px;border-radius:8px;margin-bottom:5px"></div>
                  <div class="shimmer" style="height:32px;border-radius:8px"></div>`;
      try {
        const todayStr = fmtD(nowWITA());
        const { ok: logOk, rows } = await apiGet(P.log, { user_id: uid || '', tanggal: todayStr });
        if (!logOk) throw 0;
        let rowsMut = rows;
        rowsMut = rowsMut.filter(r => {
          const rowUid = Number(getField(r, 'ID', 'id'));
          const tgl = getField(r, 'Tanggal', 'tanggal');
          const byMe = uid ? (rowUid === uid) : true;
          return byMe && tgl === todayStr;
        });
        rowsMut.sort((a, b) => {
          const ja = getField(a, 'Jam', 'jam'), jb = getField(b, 'Jam', 'jam');
          return ja.localeCompare(jb);
        });
        renderTodayHistory(rowsMut);
      } catch (e) {
        el.innerHTML = `<div class="today-empty">🔌 Gagal memuat. Pastikan n8n aktif.</div>`;
      } finally {
        _todayLoading = false;
      }
    }
    function getTodayBadge(jenis) {
      const j = (jenis || '').toUpperCase().trim();
      if (j === 'MASUK') return { cls: 'tb-masuk', icon: '🟢', lbl: 'MASUK' };
      if (j === 'PULANG') return { cls: 'tb-pulang', icon: '🔵', lbl: 'PULANG' };
      if (j === 'PULANG LUAR') return { cls: 'tb-pulang-luar', icon: '🏃', lbl: 'PULANG LAPANGAN' };
      if (j.includes('LUAR') && j.includes('MASUK')) return { cls: 'tb-luar', icon: '⚠️', lbl: 'LUAR JAM MASUK' };
      if (j.includes('LUAR') && j.includes('PULANG')) return { cls: 'tb-luar', icon: '🏃', lbl: 'PULANG CEPAT' };
      if (j.includes('LUAR')) return { cls: 'tb-luar', icon: '⚠️', lbl: 'DI LUAR JAM' };
      if (j === 'IZIN') return { cls: 'tb-izin', icon: '🙏', lbl: 'IZIN' };
      if (j === 'SAKIT') return { cls: 'tb-sakit', icon: '🤒', lbl: 'SAKIT' };
      if (j === 'TUGAS') return { cls: 'tb-tugas', icon: '💼', lbl: 'TUGAS' };
      return { cls: 'tb-luar', icon: '📋', lbl: jenis || '—' };
    }
    function renderTodayHistory(rows) {
      const el = $('todayList');
      // Simpan ke global untuk dipakai cek masuk di pulang luar
      window._todayRows = rows;
      if (!rows.length) {
        el.innerHTML = `<div class="today-empty">📭 Belum ada absen hari ini</div>`;
        // Pastikan tombol aktif jika belum absen sama sekali
        const btn = $('btnAbsen');
        if (btn && !btn.dataset.manualDisabled) {
          btn.disabled = false;
          setBtnL('btnAbsen', false, 'Kirim Lokasi & Absen');
        }
        return;
      }

      el.innerHTML = rows.map(r => {
        const jenis = getField(r, 'Jenis Absen', 'jenis', 'Jenis') || '';
        const jam = getField(r, 'Jam', 'jam') || '—';
        const lokasi = getField(r, 'Lokasi', 'lokasi') || '—';
        const { cls, icon, lbl } = getTodayBadge(jenis);
        return `<div class="today-row">
      <span class="today-badge ${cls}">${icon} ${lbl}</span>
      <span class="today-jam">${jam}</span>
      <span class="today-lokasi">📍 ${lokasi}</span>
    </div>`;
      }).join('');

      // ── Cek apakah jenis absen saat ini sudah tercatat ──
      const n = nowWITA();
      const tot = n.getHours() * 60 + n.getMinutes();
      const _tglHari2 = n.toLocaleDateString('sv-SE', { timeZone: TZ });
      const _jH2 = getJamForTanggal(_tglHari2);
      const _jmH2 = toMenitStr(_jH2.masuk) ?? JAM_MASUK_MENIT;
      const _jpH2 = toMenitStr(_jH2.pulang) ?? JAM_PULANG_MENIT;
      let jenisSkrg;
      if (tot <= _jmH2) jenisSkrg = 'MASUK';
      else if (tot < 720) jenisSkrg = 'DI LUAR JAM MASUK';
      else if (tot < _jpH2) jenisSkrg = 'DI LUAR JAM PULANG';
      else jenisSkrg = 'PULANG';

      const GRP_MASUK = ['MASUK', 'DI LUAR JAM MASUK'];
      const GRP_PULANG = ['PULANG', 'DI LUAR JAM PULANG', 'PULANG LUAR'];

      const sudahMasuk = rows.some(r => GRP_MASUK.includes((getField(r, 'Jenis Absen', 'jenis', 'Jenis') || '').toUpperCase().trim()));
      const sudahPulang = rows.some(r => GRP_PULANG.includes((getField(r, 'Jenis Absen', 'jenis', 'Jenis') || '').toUpperCase().trim()));

      const isSkrgMasuk = GRP_MASUK.includes(jenisSkrg);
      const isSkrgPulang = GRP_PULANG.includes(jenisSkrg);

      const sudahAbsen = (isSkrgMasuk && sudahMasuk) || (isSkrgPulang && sudahPulang);
      const pesanTolak = sudahMasuk && isSkrgMasuk
        ? 'Absen masuk hari ini sudah tercatat.'
        : 'Absen pulang hari ini sudah tercatat.';

      const btn = $('btnAbsen');
      if (!btn) return;
      if (sudahAbsen) {
        btn.disabled = true;
        btn.dataset.manualDisabled = '1';
        setBtnL('btnAbsen', false, '✅ Sudah Absen');
        // Tampilkan info tanpa error
        const rc = $('resultCard');
        if (rc && !rc.classList.contains('show')) {
          showResult('resultCard', 'rIcon', 'rTitle', 'rMsg', 'warning', 'ℹ️', 'Sudah Absen',
            pesanTolak);
        }
      } else {
        // Belum absen di periode ini — aktifkan tombol
        btn.disabled = false;
        delete btn.dataset.manualDisabled;
        setBtnL('btnAbsen', false, 'Kirim Lokasi & Absen');
      }
    }

    /* ════ AUTO UPDATE STATUS AKTIF SAAT ABSEN ════ */
    async function autoUpdateStatusAktif() {
      // Hanya update jika status pegawai bukan AKTIF
      const statusSaatIni = (userProfile?.status || 'AKTIF').toUpperCase();
      if (statusSaatIni === 'AKTIF') return;

      const todayStr = fmtD(nowWITA());

      // Gunakan ketStatusCache jika sudah terisi — hindari request tambahan ke server
      const _checkKetRows = (rows) => rows.some(r => {
        const st = (r.status || r.Status || '').toUpperCase();
        const tgl = r.tanggal || r.Tanggal || r.tgl_mulai || '';
        const tglS = r.tgl_selesai || r.tanggal || '';
        return (st === 'DISETUJUI' || st === 'APPROVED') && tgl <= todayStr && todayStr <= tglS;
      });

      if (ketStatusCache.length > 0) {
        if (_checkKetRows(ketStatusCache)) {
          console.log('autoUpdateStatusAktif: ada keterangan aktif (cache), skip update status');
          return;
        }
      } else {
        // Cache kosong — fetch sekali, tidak simpan ke ketStatusCache agar tidak mempengaruhi UI ket
        try {
          const { ok: ckOk, data: dKet } = await apiGet(P.ketList, { user_id: MY_ID });
          if (ckOk) {
            const ketRows = dKet?.data || dKet?.rows || parseApiResponse(dKet);
            if (_checkKetRows(ketRows)) {
              console.log('autoUpdateStatusAktif: ada keterangan aktif hari ini, skip update status');
              return;
            }
          }
        } catch (_) { }
      }

      // Update status ke AKTIF
      try {
        await apiPost(P.updateStatus, { user_id: MY_ID, status, tanggal: todayStr });
        if (userProfile) { userProfile.status = 'AKTIF'; applyProfile(); }
      } catch (_) { }
    }
    function setBtnL(id, loading, txt) {
      const b = $(id); b.disabled = loading;
      const map = { btnAbsen: 'btnText', btnKet: 'btnKetText', btnTambahLokasi: 'btnAdminText' };
      const el = $(map[id]); if (el) el.innerHTML = loading ? `<span class="spinner"></span> ${txt}` : txt;
    }
    /**
     * Tampilkan result card di UI dengan icon, judul, dan pesan.
     * @param {string} cid - ID container card
     * @param {string} iid - ID elemen icon
     * @param {string} tid - ID elemen title
     * @param {string} mid - ID elemen message
     * @param {'ok'|'fail'|'warning'|'info'} type - Jenis result (warna)
     * @param {string} icon - Emoji/icon
     * @param {string} title - Judul result
     * @param {string} msg - Pesan detail
     */
        function showResult(cid, iid, tid, mid, type, icon, title, msg) {
      const el = $(cid);
      if (!el) {
        console.warn(`[showResult] Element not found: ${cid}. Title: ${title}, Msg: ${msg}`);
        return;
      }
      el.className = `result-card r-${type} show`;
      const iEl = $(iid), tEl = $(tid), mEl = $(mid);
      if (iEl) iEl.textContent = icon;
      if (tEl) tEl.textContent = title;
      if (mEl) mEl.textContent = msg;
    }
    function showGPS(lat, lon, acc, lokasi) {
      const n = nowWITA();
      $('gpsLat').textContent = lat.toFixed(6); $('gpsLon').textContent = lon.toFixed(6);
      $('gpsAcc').textContent = `${Math.round(acc)} meter`;
      $('gpsLokasi').textContent = lokasi || 'Mendeteksi...';
      const clb = $('clockLocBadge');
      if (clb) {
        if (lokasi) {
          clb.textContent = '📍 ' + lokasi;
          clb.className = 'clock-loc-badge';
        } else {
          clb.textContent = '📍 Mendeteksi lokasi...';
          clb.className = 'clock-loc-badge unknown';
        }
      }
      $('gpsTanggal').textContent = n.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      $('gpsJam').textContent = `${p2(n.getHours())}:${p2(n.getMinutes())}:${p2(n.getSeconds())} WITA`;
      const pct = Math.max(5, Math.min(100, 100 - (acc / 5)));
      const col = acc <= 20 ? '#22c55e' : acc <= 100 ? '#f59e0b' : '#ef4444';
      $('accFill').style.width = pct + '%'; $('accFill').style.background = col;
      $('gpsCard').classList.add('show');
    }

