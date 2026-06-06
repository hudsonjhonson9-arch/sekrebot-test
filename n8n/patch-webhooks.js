const fs = require('fs');
const path = require('path');

const N8N_DIR = __dirname;
const SUBDIRS = ['.', 'simapo']; // Direktori utama dan simapo

// Kredensial dari user
const HEADER_AUTH_CRED = {
  id: "r01tQvSvzADocRWE",
  name: "Header Auth account"
};

let modifiedCount = 0;
let fileCount = 0;

for (const sub of SUBDIRS) {
  const dirPath = path.join(N8N_DIR, sub);
  if (!fs.existsSync(dirPath)) continue;

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json') && f !== 'package.json' && f !== 'package-lock.json');
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      
      let modified = false;

      // Periksa apakah ini file workflow (memiliki properti nodes)
      if (data.nodes && Array.isArray(data.nodes)) {
        for (const node of data.nodes) {
          if (node.type === 'n8n-nodes-base.webhook') {
            
            // Inisialisasi object jika belum ada
            if (!node.parameters) node.parameters = {};
            if (!node.credentials) node.credentials = {};

            // Hanya tambahkan jika belum diatur ke headerAuth
            if (node.parameters.authentication !== 'headerAuth') {
              node.parameters.authentication = 'headerAuth';
              
              node.credentials.httpHeaderAuth = HEADER_AUTH_CRED;
              
              modified = true;
              modifiedCount++;
            }
          }
        }
      }

      if (modified) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[V] Berhasil mengamankan webhook di: ${sub}/${file}`);
        fileCount++;
      }
    } catch (e) {
      console.error(`[X] Gagal membaca ${file}: ${e.message}`);
    }
  }
}

console.log(`\nSelesai! Berhasil mengamankan ${modifiedCount} webhook di ${fileCount} file workflow.`);
