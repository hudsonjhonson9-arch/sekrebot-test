const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres.vyoiyrtftltddzzd:SupabaseBapperida123!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=disable'
});

async function run() {
  await client.connect();
  try {
    await client.query(`
      CREATE OR REPLACE VIEW view_user_mgmt AS
      SELECT id,
             username,
             "NIP",
             "Jabatan",
             "Status",
             tgl_pangkat,
             tgl_berkala,
             face_histogram,
             face_saved_at,
             no,
             face_photo,
             face_model,
             bidang,
             instansi_id,
             pangkat,
             nomorhp,
             role,
             is_admin,
             (face_histogram IS NOT NULL AND face_histogram <> '[]'::text AND face_histogram <> ''::text) AS has_face,
             (EXISTS ( SELECT 1
                    FROM tanda_tangan
                   WHERE tanda_tangan.telegram_id = user_list.id)) AS has_signature
      FROM user_list;
    `);
    console.log('View successfully updated to include role and is_admin');
  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    await client.end();
  }
}

run();
