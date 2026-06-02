const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:MindCloud123!@mindcloud.my.id:5432/absensidb'
});

async function run() {
  await client.connect();
  try {
    const res = await client.query("SELECT nama, role FROM pegawai LIMIT 20;");
    console.log("Pegawai Roles:");
    console.table(res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
run();
