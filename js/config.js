/* ════ SUPABASE CONFIGURATION (MIGRASI DARI N8N) ════ */
// TODO: Ganti placeholder ini dengan kredensial Supabase dari dashboard
const SUPABASE_URL = 'https://[PROJECT_ID].supabase.co';
const SUPABASE_KEY = 'ey-ANON-KEY';

const S_HDR = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Prefer': 'return=representation'
};

/* ════ N8N WEBHOOK AUTHENTICATION ════ */
const SIMAPO_TOKEN = "SIMAPO_SECURE_TOKEN_2026";

/* ════ OFFLINE STORAGE (INDEXEDDB) ════ */
const DB_NAME = 'AbsensiOfflineDB';
const DB_VERSION = 1;

const idb = {
  db: null,
  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('offline_queue')) {
          db.createObjectStore('offline_queue', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('master_data')) {
          db.createObjectStore('master_data', { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      req.onerror = reject;
    });
  },
  async set(storeName, val) {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(val);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  },
  async get(storeName, key) {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  },
  async getAll(storeName) {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      try {
        const req = this.db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve([]);
      } catch (e) { resolve([]); }
    });
  },
  async delete(storeName, key) {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      try {
        const req = this.db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  }
};
idb.init();

/* ════ KONFIGURASI N8N ════ */
// Akan dihapus secara bertahap saat migrasi ke Supabase selesai
const SERVER_1 = 'https://mindcloud.my.id';           // server utama (permanen)
const SERVER_2 = 'https://n8n-sp8dtwslkxal.jkt3.sumopod.my.id'; // fallback/dev
const isTest = false;
// ADMIN_NIPS dimuat dinamis dari database via n8n
// Tidak perlu edit manual — kelola di tab Admin > Manajemen Admin
let ADMIN_NIPS = [];         // diisi oleh loadAdminMgmt()
let MANDATORY_FACE_NIPS = []; // Daftar NIP yang WAJIB face recognition
window._adminRoleMap = {};   // Mapping NIP -> role (superadmin/admin/kepala/dkk)
let REKAP_CHAT_ID = null;    // peninggalan bot lama, bisa diabaikan

/* ════ KONFIGURASI JARINGAN WIFI KANTOR ════
   WAJIB DIISI: Daftar IP publik jaringan WiFi kantor.
   Cara cek IP publik kantor: buka https://api.ipify.org dari jaringan WiFi kantor.
   Bisa isi lebih dari satu IP jika ada beberapa koneksi internet kantor.
   Jika WIFI_CHECK_ENABLED = false, cek jaringan dinonaktifkan (semua jaringan boleh).
*/
const WIFI_CHECK_ENABLED = true;
// IP dicek server-side via ip_range di sheet lokasiabsen (support CIDR, e.g. 36.84.0.0/16)
// Frontend hanya fetch IP publik untuk dikirim ke n8n — validasi dilakukan di n8n
const WIFI_MODE = 'block';

const P = {
  instansiList: isTest ? '/webhook-test/instansi-list' : '/webhook/instansi-list',
  instansiUpdate: isTest ? '/webhook-test/instansi-update' : '/webhook/instansi-update',
  bidangList: isTest ? '/webhook-test/bidang-list' : '/webhook/bidang-list',
  absen: isTest ? '/webhook-test/absen' : '/webhook/absen',
  ket: isTest ? '/webhook-test/keterangan' : '/webhook/keterangan',
  log: isTest ? '/webhook-test/log-absen' : '/webhook/log-absen',
  rekap: isTest ? '/webhook-test/rekap-absen' : '/webhook/rekap-absen',
  userList: isTest ? '/webhook-test/user-list' : '/webhook/user-list',
  updateStatus: isTest ? '/webhook-test/update-status' : '/webhook/update-status',
  lokasiList: isTest ? '/webhook-test/lokasi-list' : '/webhook/lokasi-list',
  lokasiAdd: isTest ? '/webhook-test/lokasi-add' : '/webhook/lokasi-add',
  lokasiDel: isTest ? '/webhook-test/lokasi-delete' : '/webhook/lokasi-delete',
  lokasiUpdate: isTest ? '/webhook-test/lokasi-update' : '/webhook/lokasi-update',
  dokumenList: isTest ? '/webhook-test/dokumen-list' : '/webhook/dokumen-list',
  jamAbsen: isTest ? '/webhook-test/jam-absen' : '/webhook/jam-absen',
  kirimRekap: isTest ? '/webhook-test/kirim-rekap' : '/webhook/kirim-rekap',
  ketList: isTest ? '/webhook-test/ket-list' : '/webhook/ket-list',
  ketEdit: isTest ? '/webhook-test/ket-edit' : '/webhook/ket-edit',
  ketDelete: isTest ? '/webhook-test/ket-delete' : '/webhook/ket-delete',
  ketApprove: isTest ? '/webhook-test/ket-approve' : '/webhook/ket-approve',
  liburList: isTest ? '/webhook-test/libur-list' : '/webhook/libur-list',
  liburAdd: isTest ? '/webhook-test/libur-add' : '/webhook/libur-add',
  liburDel: isTest ? '/webhook-test/libur-delete' : '/webhook/libur-delete',
  dokumenAdd: isTest ? '/webhook-test/dokumen-add' : '/webhook/dokumen-add',
  dokumenDel: isTest ? '/webhook-test/dokumen-delete' : '/webhook/dokumen-delete',
  dokumenGet: isTest ? '/webhook-test/dokumen-get' : '/webhook/dokumen-get',
  faceRegister: isTest ? '/webhook-test/face-register' : '/webhook/face-register',
  faceGet: isTest ? '/webhook-test/face-get' : '/webhook/face-get',
  faceToggle: isTest ? '/webhook-test/face-toggle' : '/webhook/face-toggle',
  faceGetAll: isTest ? '/webhook-test/face-get-all' : '/webhook/face-get-all',
  mejaAbsen: isTest ? '/webhook-test/meja-absen' : '/webhook/meja-absen',
  jamPeriodeList: isTest ? '/webhook-test/jam-periode-list' : '/webhook/jam-periode-list',
  jamPeriodeAdd: isTest ? '/webhook-test/jam-periode-add' : '/webhook/jam-periode-add',
  jamPeriodeDel: isTest ? '/webhook-test/jam-periode-delete' : '/webhook/jam-periode-delete',
  adminList: isTest ? '/webhook-test/admin-list' : '/webhook/admin-list',
  adminAdd: isTest ? '/webhook-test/admin-add' : '/webhook/admin-add',
  adminDel: isTest ? '/webhook-test/admin-delete' : '/webhook/admin-delete',
  userAdd: isTest ? '/webhook-test/user-add' : '/webhook/user-add',
  userEdit: isTest ? '/webhook-test/user-edit' : '/webhook/user-edit',
  penugasanList: isTest ? '/webhook-test/penugasan-list' : '/webhook/penugasan-list',
  penugasanSave: isTest ? '/webhook-test/penugasan-save' : '/webhook/penugasan-save',
  userDel: isTest ? '/webhook-test/user-delete' : '/webhook/user-delete',
  logAdd: isTest ? '/webhook-test/log-add' : '/webhook/log-add',
  logEdit: isTest ? '/webhook-test/log-edit' : '/webhook/log-edit',
  signatureSave: isTest ? '/webhook-test/signature-save' : '/webhook/signature-save',
  signatureGet: isTest ? '/webhook-test/signature-get' : '/webhook/signature-get',
  signatureList: isTest ? '/webhook-test/signature-list' : '/webhook/signature-list',
  keteranganAdd: isTest ? '/webhook-test/keterangan' : '/webhook/keterangan',
  tugasAdd: isTest ? '/webhook-test/tugas-add' : '/webhook/tugas-add',
  tugasList: isTest ? '/webhook-test/tugas-list' : '/webhook/tugas-list',
  lemburGet: isTest ? '/webhook-test/lembur-get' : '/webhook/lembur-get',
  simapoKatalog: isTest ? '/webhook-test/simapo-katalog' : '/webhook/simapo-katalog',
  simapoPinjam: isTest ? '/webhook-test/simapo-pinjam' : '/webhook/simapo-pinjam',
  simapoPinjamList: isTest ? '/webhook-test/simapo-pinjam-list' : '/webhook/simapo-pinjam-list',
  simapoTiket: isTest ? '/webhook-test/simapo-tiket' : '/webhook/simapo-tiket',
  simapoAdminPinjamList: isTest ? '/webhook-test/simapo-admin-pinjam-list' : '/webhook/simapo-admin-pinjam-list',
  simapoAdminPinjamAction: isTest ? '/webhook-test/simapo-admin-pinjam-action' : '/webhook/simapo-admin-pinjam-action',
  simapoAdminTiketList: isTest ? '/webhook-test/simapo-admin-tiket-list' : '/webhook/simapo-admin-tiket-list',
  simapoAdminTiketAction: isTest ? '/webhook-test/simapo-admin-tiket-action' : '/webhook/simapo-admin-tiket-action',
  simapoAdminMasterList: isTest ? '/webhook-test/simapo-admin-master-list' : '/webhook/simapo-admin-master-list',
  simapoAdminMasterSave: isTest ? '/webhook-test/simapo-admin-master-save' : '/webhook/simapo-admin-master-save',
  simapoAdminMasterDel: isTest ? '/webhook-test/simapo-admin-master-delete' : '/webhook/simapo-admin-master-delete',
  // Mutasi Stok
  simapoMutasiSave: isTest ? '/webhook-test/simapo-mutasi-save' : '/webhook/simapo-mutasi-save',
  simapoMutasiList: isTest ? '/webhook-test/simapo-mutasi-list' : '/webhook/simapo-mutasi-list',
  // Stok Opname
  simapoOpnameSave: isTest ? '/webhook-test/simapo-opname-save' : '/webhook/simapo-opname-save',
  // Kategori
  simapoKategoriList: isTest ? '/webhook-test/simapo-kategori-list' : '/webhook/simapo-kategori-list',
  simapoKategoriSave: isTest ? '/webhook-test/simapo-kategori-save' : '/webhook/simapo-kategori-save',
  simapoKategoriDel: isTest ? '/webhook-test/simapo-kategori-delete' : '/webhook/simapo-kategori-delete',
  lemburSave: isTest ? '/webhook-test/lembur-save' : '/webhook/lembur-save',
  lemburArchiveList: isTest ? '/webhook-test/lembur-archive-list' : '/webhook/lembur-archive-list',
  lemburArchiveDelete: isTest ? '/webhook-test/lembur-archive-delete' : '/webhook/lembur-archive-delete',
};

function getScopedInstansiId() {
  // Check if current user is Superadmin
  const p = window.userProfile || {};
  const myNip = p.nip || localStorage.getItem('MY_NIP');
  const storedRole = String(localStorage.getItem('MY_ROLE') || '').toLowerCase();
  const isSA = storedRole.includes('super') ||
               (typeof _isSuperAdmin === 'function' && _isSuperAdmin()) ||
               (myNip && window._adminRoleMap && window._adminRoleMap[myNip] && String(window._adminRoleMap[myNip]).toLowerCase().includes('super')) ||
               (p.role || '').toLowerCase().includes('super') ||
               (window.IS_ADMIN && storedRole.includes('super'));

  // Priority 0: Active tab specific dropdown overrides (explicit user intent)
  const currentTab = localStorage.getItem('absen_last_tab') || 'absen';
  if (isSA) {
    if (currentTab === 'rekap') {
      const rekapSelect = document.getElementById('rekapInstansiSelect');
      if (rekapSelect && rekapSelect.value) {
        return rekapSelect.value;
      }
    } else if (currentTab === 'admin') {
      const activeAdminSect = localStorage.getItem('absen_last_admin_section') || 'ops';
      if (activeAdminSect === 'user') {
        const pegawaiSelect = document.getElementById('pegawaiInstansiSelect');
        if (pegawaiSelect && pegawaiSelect.value) {
          return pegawaiSelect.value;
        }
      } else if (activeAdminSect === 'ops') {
        const adminKetSelect = document.getElementById('adminKetInstansiSelect');
        if (adminKetSelect && adminKetSelect.value) {
          return adminKetSelect.value;
        }
      }
      const adminSelect = document.getElementById('inEditInstansiSelect') || document.getElementById('adminInstansiSelect');
      if (adminSelect && adminSelect.value) {
        return adminSelect.value;
      }
    } else if (currentTab === 'tugas') {
      const tugasSelect = document.getElementById('tugasInstansiSelect');
      if (tugasSelect && tugasSelect.value) {
        return tugasSelect.value;
      }
    } else if (currentTab === 'simapo') {
      const simapoSelect = document.getElementById('simapoInstansiSelect');
      if (simapoSelect && simapoSelect.value) {
        return simapoSelect.value;
      }
    }
  }

  // Priority 1: Persistent storage (selected agency) for Superadmins
  if (isSA) {
    const savedInst = localStorage.getItem('MY_INSTANSI');
    if (savedInst) return savedInst;
  }

  // Priority 2: From URL parameters (Registration context / Override)
  const urlParams = new URLSearchParams(window.location.search);
  let inst = urlParams.get('instansi') || urlParams.get('instansi_id');
  if (inst) return inst;

  // Priority 3: From live state (Most up to date)
  if (window.userProfile?.instansi_id) return window.userProfile.instansi_id;

  // Priority 4: From persistent storage (Safe for refresh)
  const savedInst = localStorage.getItem('MY_INSTANSI');
  if (savedInst) return savedInst;

  // Priority 5: From logged in user data (User List cache)
  try {
    const u = JSON.parse(localStorage.getItem('tg_user_obj_v5') || '{}');
    const uInst = u.instansi_id || u.Instansi_Id;
    if (uInst) return uInst;
  } catch (e) { }

  return '';
}

/**
 * Fetch ke n8n API dengan fallback ke server cadangan.
 * Auto-append instansi_id ke semua request.
 * @param {string} path - Path endpoint (e.g. P.absen)
 * @param {Object} opts - Fetch options
 */
const API_TOKEN = 'BAPPERIDA_SECURE_TOKEN_2025';

const HDR = { 
  'Content-Type': 'application/json', 
  'ngrok-skip-browser-warning': 'true', 
  'Accept': 'application/json',
  'X-App-Token': API_TOKEN 
};
async function apiFetch(path, opts = {}) {
  // Auto-append cache buster to avoid stale results
  path += (path.includes('?') ? '&' : '?') + '_t=' + Date.now();

  // Auto-append instansi_id & nip scoping
  const p = window.userProfile || {};
  const myNip = p.nip || localStorage.getItem('MY_NIP');
  const storedRole = String(localStorage.getItem('MY_ROLE') || '').toLowerCase();
  const isSA = storedRole.includes('super') ||
               (typeof _isSuperAdmin === 'function' && _isSuperAdmin()) ||
               (myNip && window._adminRoleMap && window._adminRoleMap[myNip] && String(window._adminRoleMap[myNip]).toLowerCase().includes('super')) ||
               (p.role || '').toLowerCase().includes('super');
  const inst = getScopedInstansiId();
  
  // Scoping Logic:
  // 1. If instansi_id is NOT in path, append it
  // 2. EXCEPT if user is SUPERADMIN (they see everything unless explicitly filtered)
  if (inst && !path.includes('instansi_id=') && !path.includes('log-absen')) {
    path += '&instansi_id=' + inst;
  }
  
  if (myNip && !path.includes('nip=')) {
    // Jangan auto-append NIP untuk superadmin dan admin agar tidak memblokir query monitoring/list
    const isAdminOrSA = isSA || storedRole.includes('admin') || (p.role || '').toLowerCase().includes('admin') || !!window.IS_ADMIN;
    if (!isAdminOrSA) {
      path += (path.includes('?') ? '&' : '?') + 'nip=' + encodeURIComponent(myNip);
    }
  }

  for (const base of [SERVER_1, SERVER_2]) {
    try {
      console.log(`[Fetch] -> ${base}${path}`);
      const fetchOpts = { ...opts };
      
      // Inject Authorization Bearer Token untuk Webhook N8n
      let finalHeaders = { ...HDR };
      if (path.includes('simapo')) {
        // Hapus ngrok header tapi TETAP kirim X-App-Token (dibutuhkan oleh N8n webhook)
        delete finalHeaders['ngrok-skip-browser-warning'];
        finalHeaders['Authorization'] = 'Bearer ' + SIMAPO_TOKEN;
        finalHeaders['X-App-Token'] = API_TOKEN; // N8n SIMAPO butuh ini
      }
      
      fetchOpts.headers = { ...finalHeaders, ...(opts.headers || {}) };
      
      if (opts.method === 'GET' || !opts.body) {
        delete fetchOpts.headers['Content-Type'];
      }

      // Add 15s timeout for each server (increased for large inventory data)
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 15000);
      
      try {
        const r = await fetch(base + path, { ...fetchOpts, signal: ctrl.signal });
        clearTimeout(tid);
        
        if (r.ok || (r.status >= 400 && r.status < 500)) {
          console.log(`[Fetch] Success: ${base}${path}`);
          
          // N8n Webhook kadang mereturn 0 bytes jika execution stop di awal (misal 0 baris PG).
          // Intercept r.json() agar tidak terjadi SyntaxError.
          const originalJson = r.json.bind(r);
          r.json = async () => {
            const text = await r.text();
            if (!text || text.trim() === '') return { data: [], message: 'Empty N8n Response' };
            try { return JSON.parse(text); } catch(e) { return { data: [], message: text }; }
          };
          
          return r;
        }
        throw new Error(`HTTP ${r.status}`);
      } catch (e) {
        clearTimeout(tid);
        throw e;
      }
    } catch (e) {
      console.warn(`[Fetch Fallback] ${base}${path}:`, e.message);
    }
  }
  throw new Error(`Semua server (${[SERVER_1, SERVER_2].join(', ')}) offline/error.`);
}


/* ════ API RESPONSE PARSER ════
   Menangani berbagai format response dari n8n yang tidak konsisten:
   - [ { data: [...] } ]
   - [ {...} ]
   - { data: [...] }
   - [ [...] ]  (nested array)
*/
function parseApiResponse(json) {
  if (!json) return [];
  // 1. [ { data: [...] } ] — format paling umum dari n8n
  if (Array.isArray(json) && json.length === 1 && Array.isArray(json[0]?.data)) return json[0].data;
  // 2. { data: [...] }
  if (!Array.isArray(json) && Array.isArray(json?.data)) return json.data;
  // 3. [ [...] ] — nested array
  if (Array.isArray(json) && json.length === 1 && Array.isArray(json[0])) return json[0];
  // 4. [ {...}, {...} ] — array of objects langsung
  if (Array.isArray(json)) return json;
  // 5. { id: ... } — single object record (NEW)
  if (typeof json === 'object' && (json.id || json.ID || json.telegram_id)) return [json];
  
  return [];
}
