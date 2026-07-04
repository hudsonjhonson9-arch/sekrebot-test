# Session Gate Setup — n8n Workflows

## Sudah Saya Update di File

Semua file workflow JSON berikut sudah saya perbarui — tinggal import ke n8n:

### ✅ `session_login_wf.json` (baru)
- **Cara kerja**: Menerima POST ke `/webhook/session-login`
  - `{ nip, user_id, role, instansi_id }` → create session, balikin `session_token`
  - `{ action: "logout", session_token }` → deactivate session
- **Yang perlu kamu lakukan**:
  1. Ganti credential Postgres (`"id": "CHANGE_ME"` → pilih credential Postgres kamu)
  2. Import & aktifkan webhook

### ✅ `header_instansi_wf.json`
- CORS headers: `Authorization` sudah ditambahkan ke `Access-Control-Allow-Headers`

### ✅ `AbsensiBot V.5.1.json`
- **4 Security Gate nodes** (Absen, User-List, User-Edit, Rekap):
  Sekarang nerima **Authorization: Bearer \<session\>** (new) **DAN** X-App-Token (old) — backward compatible.
- **Meja Absen token**: ganti dari hardcoded `BAPPERIDA_MEJA_SECURE_2026` → session token.
- **CORS**: `Authorization` sudah ditambahkan.

### ✅ `Ket absensi wf.json`
- **Security Gate Ket**: update sama — bearer + legacy token fallback.

### ✅ `kirimrekapabsen.json`
- **Security Gate**: update sama — bearer + legacy token fallback.

### ✅ `simapo/*.json` (6 files)
- Tidak perlu diubah — mereka tidak punya auth gate sendiri.

---

## Yang Masih Perlu Kamu Lakukan Manual di n8n UI

### 1. Hapus httpHeaderAuth Credential dari Webhook Nodes
Buka tiap workflow yang pakai webhook → klik webhook node → **Authentication** ganti jadi `None`.

Workflow yang perlu diubah:
| Workflow | Webhook Node |
|----------|-------------|
| AbsensiBot V.5.1 | Semua webhook (Absen, User List, User Edit, Rekap) |
| Ket absensi wf | Webhook Ket |
| kirimrekapabsen | Webhook Kirim Rekap |
| header_instansi_wf | Webhook GET & POST |

### 2. Update Credential Postgres
Di `session_login_wf.json` → **Run SQL** node → ganti credential Postgres.

### 3. Validasi
- Kirim request dengan `Authorization: Bearer <session_token>` — harus 200
- Kirim request dengan `X-App-Token: BAPPERIDA_SECURE_TOKEN_2025` — harus 200 (backward compat)

### 4. (Nanti) Hapus Legacy Token
Setelah semua client pake session token:
- Hapus `legacy` fallback dari code nodes
- Hapus `BAPPERIDA_SECURE_TOKEN_2025` dari env
