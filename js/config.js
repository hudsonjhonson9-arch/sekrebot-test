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

/* ════ OFFLINE STORAGE (INDEXEDDB) ════ */
const DB_NAME = 'BapperidaOfflineDB';
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
// ADMIN_IDS dimuat dinamis dari sheet admin_list via n8n
// Tidak perlu edit manual — kelola di tab Admin > Manajemen Admin
let ADMIN_IDS = [];          // diisi oleh loadJamAbsen()
window._adminRoleMap = {};   // Mapping telegram_id -> role (superadmin/admin)
let REKAP_CHAT_ID = null;    // diisi setelah ADMIN_IDS loaded

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
  seragamGet: isTest ? '/webhook-test/seragam-get' : '/webhook/seragam-get',
  seragamSave: isTest ? '/webhook-test/seragam-save' : '/webhook/seragam-save',
  seragamTypeList: isTest ? '/webhook-test/seragam-type-list' : '/webhook/seragam-type-list',
  seragamTypeAdd: isTest ? '/webhook-test/seragam-type-add' : '/webhook/seragam-type-add',
  seragamTypeDel: isTest ? '/webhook-test/seragam-type-delete' : '/webhook/seragam-type-delete',
  jamPeriodeList: isTest ? '/webhook-test/jam-periode-list' : '/webhook/jam-periode-list',
  jamPeriodeAdd: isTest ? '/webhook-test/jam-periode-add' : '/webhook/jam-periode-add',
  jamPeriodeDel: isTest ? '/webhook-test/jam-periode-delete' : '/webhook/jam-periode-delete',
  adminList: isTest ? '/webhook-test/admin-list' : '/webhook/admin-list',
  adminAdd: isTest ? '/webhook-test/admin-add' : '/webhook/admin-add',
  adminDel: isTest ? '/webhook-test/admin-delete' : '/webhook/admin-delete',
  userAdd: isTest ? '/webhook-test/user-add' : '/webhook/user-add',
  userEdit: isTest ? '/webhook-test/user-edit' : '/webhook/user-edit',
  userDel: isTest ? '/webhook-test/user-delete' : '/webhook/user-delete',
  logAdd: isTest ? '/webhook-test/log-add' : '/webhook/log-add',
  logEdit: isTest ? '/webhook-test/log-edit' : '/webhook/log-edit',
  signatureSave: isTest ? '/webhook-test/signature-save' : '/webhook/signature-save',
  signatureGet: isTest ? '/webhook-test/signature-get' : '/webhook/signature-get',
  signatureList: isTest ? '/webhook-test/signature-list' : '/webhook/signature-list',
};

function getScopedInstansiId() {
  // Priority 1: From URL parameters (Registration context / Override)
  const urlParams = new URLSearchParams(window.location.search);
  let inst = urlParams.get('instansi') || urlParams.get('instansi_id');
  if (inst) return inst;

  // Priority 2: From logged in user data (User List cache)
  try {
    const u = JSON.parse(localStorage.getItem('tg_user_obj_v5') || '{}');
    if (u.instansi_id) return u.instansi_id;
  } catch (e) { }

  // Priority 3: Global fallback
  return 'bapperida';
}

/**
 * Fetch ke n8n API dengan fallback ke server cadangan.
 * Auto-append instansi_id ke semua request.
 * @param {string} path - Path endpoint (e.g. P.absen)
 * @param {RequestInit} [opts={}] - fetch options (method, body, headers)
 * @returns {Promise<Response>} Response object
 * @throws {Error} Jika semua server gagal
 */
const HDR = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true', 'Accept': 'application/json' };
async function apiFetch(path, opts = {}) {
  // Auto-append instansi_id & nip scoping
  const inst = getScopedInstansiId();
  if (inst && !path.includes('instansi_id=')) {
    path += (path.includes('?') ? '&' : '?') + 'instansi_id=' + inst;
  }

  let myNip = localStorage.getItem('MY_NIP');
  if (!myNip) {
    try {
      const u = JSON.parse(localStorage.getItem('tg_user_obj_v5') || '{}');
      myNip = u.nip || u.NIP || '';
      if (myNip) localStorage.setItem('MY_NIP', myNip); // Auto-migrate
    } catch (e) { }
  }

  if (myNip && !path.includes('nip=')) {
    path += (path.includes('?') ? '&' : '?') + 'nip=' + encodeURIComponent(myNip);
  }

  for (const base of [SERVER_1, SERVER_2]) {
    try {
      console.log(`[Fetch] Attempting: ${base}${path}`);
      const fetchOpts = { ...opts };
      fetchOpts.headers = { ...HDR, ...(opts.headers || {}) };
      if (opts.method === 'GET' || !opts.body) {
        delete fetchOpts.headers['Content-Type'];
      }
      const r = await fetch(base + path, fetchOpts);
      if (r.ok || (r.status >= 400 && r.status < 500)) {
        console.log(`[Fetch] Success: ${base}${path}`);
        return r;
      }
      throw new Error(`HTTP ${r.status}`);
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
  // [ { data: [...] } ] — format paling umum dari n8n
  if (Array.isArray(json) && json.length === 1 && Array.isArray(json[0]?.data)) return json[0].data;
  // { data: [...] }
  if (!Array.isArray(json) && Array.isArray(json?.data)) return json.data;
  // [ [...] ] — nested array
  if (Array.isArray(json) && json.length === 1 && Array.isArray(json[0])) return json[0];
  // [ {...}, {...} ] — array of objects langsung
  if (Array.isArray(json)) return json;
  return [];
}
