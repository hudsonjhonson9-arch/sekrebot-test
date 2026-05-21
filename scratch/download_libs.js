const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_DIR = path.resolve(__dirname, '..');

const LIBS = [
  { url: 'https://telegram.org/js/telegram-web-app.js', dest: 'js/lib/telegram-web-app.js' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', dest: 'js/lib/xlsx.full.min.js' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', dest: 'js/lib/jspdf.umd.min.js' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js', dest: 'js/lib/jspdf.plugin.autotable.min.js' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js', dest: 'js/lib/leaflet.min.js' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css', dest: 'css/lib/leaflet.min.css' },
  
  // Leaflet images
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png', dest: 'css/lib/images/marker-icon.png' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png', dest: 'css/lib/images/marker-icon-2x.png' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png', dest: 'css/lib/images/marker-shadow.png' },

  // SweetAlert2
  { url: 'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js', dest: 'js/lib/sweetalert2.all.min.js' },

  // Flatpickr
  { url: 'https://cdn.jsdelivr.net/npm/flatpickr', dest: 'js/lib/flatpickr.min.js' },
  { url: 'https://cdn.jsdelivr.net/npm/flatpickr/dist/themes/dark.css', dest: 'css/lib/flatpickr-dark.css' },

  // FontAwesome
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css', dest: 'css/lib/font-awesome.min.css' },
  
  // FontAwesome Webfonts
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-solid-900.woff2', dest: 'css/webfonts/fa-solid-900.woff2' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-solid-900.woff', dest: 'css/webfonts/fa-solid-900.woff' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-solid-900.ttf', dest: 'css/webfonts/fa-solid-900.ttf' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-regular-400.woff2', dest: 'css/webfonts/fa-regular-400.woff2' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-regular-400.woff', dest: 'css/webfonts/fa-regular-400.woff' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-regular-400.ttf', dest: 'css/webfonts/fa-regular-400.ttf' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-brands-400.woff2', dest: 'css/webfonts/fa-brands-400.woff2' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-brands-400.woff', dest: 'css/webfonts/fa-brands-400.woff' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-brands-400.ttf', dest: 'css/webfonts/fa-brands-400.ttf' }
];

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const fullDest = path.join(BASE_DIR, destPath);
    const dir = path.dirname(fullDest);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const file = fs.createWriteStream(fullDest);
    
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Handle redirect
        download(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: status code ${res.statusCode}`));
        return;
      }
      
      res.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded: ${url} -> ${destPath}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(fullDest, () => {});
      reject(err);
    });
  });
}

async function run() {
  console.log('Starting downloading external dependencies...');
  for (const item of LIBS) {
    try {
      await download(item.url, item.dest);
    } catch (err) {
      console.error(`Error downloading ${item.url}:`, err.message);
    }
  }
  console.log('All downloads completed!');
}

run();
