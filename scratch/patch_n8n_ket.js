const fs = require('fs');
const file = 'd:/Code/absensi_refactored_v6/n8n/Ket absensi wf.json';
let content = fs.readFileSync(file, 'utf8');

const regex1 = /INSERT INTO \\\"ket_temp\\\" \(\\\"ID_Ket\\\", \\\"ID_Pegawai\\\", \\\"Nama\\\", \\\"NIP\\\", \\\"Tanggal\\\", \\\"tgl_mulai\\\", \\\"tgl_selesai\\\", \\\"Jam\\\", \\\"Jenis Absen\\\", \\\"Ket\\\", \\\"Status\\\", \\\"request_id\\\"\)/g;
const repl1 = 'INSERT INTO \\\"ket_temp\\\" (\\\"ID_Ket\\\", \\\"ID_Pegawai\\\", \\\"Nama\\\", \\\"NIP\\\", \\\"Tanggal\\\", \\\"tgl_mulai\\\", \\\"tgl_selesai\\\", \\\"Jam\\\", \\\"Jenis Absen\\\", \\\"Ket\\\", \\\"Status\\\", \\\"request_id\\\", \\\"instansi_id\\\")';
content = content.replace(regex1, repl1);

const regex2 = /INSERT INTO \\\"ket_temp\\\" \(\\\"ID_Ket\\\", \\\"ID_Pegawai\\\", \\\"Nama\\\", \\\"NIP\\\", \\\"Tanggal\\\", \\\"tgl_mulai\\\", \\\"tgl_selesai\\\", \\\"Jam\\\", \\\"Jenis Absen\\\", \\\"Ket\\\", \\\"Status\\\", \\\"drive_link\\\", \\\"request_id\\\"\)/g;
const repl2 = 'INSERT INTO \\\"ket_temp\\\" (\\\"ID_Ket\\\", \\\"ID_Pegawai\\\", \\\"Nama\\\", \\\"NIP\\\", \\\"Tanggal\\\", \\\"tgl_mulai\\\", \\\"tgl_selesai\\\", \\\"Jam\\\", \\\"Jenis Absen\\\", \\\"Ket\\\", \\\"Status\\\", \\\"drive_link\\\", \\\"request_id\\\", \\\"instansi_id\\\")';
content = content.replace(regex2, repl2);

const coalesceInstansi = `COALESCE(NULLIF('{{ ($(\\'Keterangan\\').first().json.body.user.instansi_id || \\'\\').toString().replace(/\\'/g, \\"\\'\\'\\") }}', ''), (SELECT instansi_id FROM user_list WHERE \\"NIP\\" = '{{ ($json.nip || \\'\\').toString().replace(/\\'/g, \\"\\'\\'\\") }}' LIMIT 1), (SELECT instansi_id FROM user_list WHERE id::text = '{{ ($json.user_id || $(\\'Validasi & Cek Bukti\\').first().json.user_id || \\'\\').toString().replace(/\\'/g, \\"\\'\\'\\") }}' LIMIT 1), 'bapperida')`;

// Replace VALUES ends for 1468 & 1944 (which end with request_id)
const regexValues1 = /'\{\{ \(\$\('Keterangan'\)\.first\(\)\.json\.body\.request_id\)\.toString\(\)\.replace\(\/'\/g, \\"''\\"\) \}\}'\) RETURNING \*/g;
const replValues1 = `'{{ ($(\\'Keterangan\\').first().json.body.request_id || \\'\\').toString().replace(/\\'/g, \\"\\'\\'\\") }}', ${coalesceInstansi}) RETURNING *`;
content = content.replace(regexValues1, replValues1);

fs.writeFileSync(file, content);
console.log('Patched Ket absensi wf.json successfully.');
