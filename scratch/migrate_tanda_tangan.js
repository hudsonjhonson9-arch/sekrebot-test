const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres.vyoiyrtftltddzzd:SupabaseBapperida123!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=disable'
});

async function run() {
  await client.connect();
  try {
    console.log('1. Adding nip column to tanda_tangan...');
    await client.query(`ALTER TABLE tanda_tangan ADD COLUMN IF NOT EXISTS nip text;`);
    
    console.log('2. Migrating nip data from user_list...');
    const result = await client.query(`
      UPDATE tanda_tangan
      SET nip = user_list."NIP"
      FROM user_list
      WHERE tanda_tangan.telegram_id = user_list.id;
    `);
    console.log(`Updated ${result.rowCount} rows.`);

    console.log('3. Updating view_user_mgmt...');
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
                   WHERE tanda_tangan.nip = user_list."NIP")) AS has_signature
      FROM user_list;
    `);

    console.log('4. Adding UNIQUE constraint to nip...');
    // Drop existing constraint if any, to be safe. We ignore error if it doesn't exist.
    try {
      await client.query(`ALTER TABLE tanda_tangan DROP CONSTRAINT IF EXISTS tanda_tangan_nip_key;`);
      // Delete rows where NIP is duplicate to avoid constraint violation (keep the latest)
      await client.query(`
        DELETE FROM tanda_tangan
        WHERE id IN (
          SELECT id FROM (
            SELECT id, row_number() over (partition by nip order by updated_at desc) as rn
            FROM tanda_tangan
          ) t WHERE rn > 1
        );
      `);
      await client.query(`ALTER TABLE tanda_tangan ADD CONSTRAINT tanda_tangan_nip_key UNIQUE (nip);`);
    } catch (e) {
      console.warn('Could not add unique constraint, might already exist or duplicates present:', e.message);
    }
    
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    await client.end();
  }
}

run();
