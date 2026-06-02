const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:MindCloud123!@mindcloud.my.id:5432/absensidb'
});

async function run() {
  await client.connect();
  try {
    const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'lokasiabsen';");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
run();
