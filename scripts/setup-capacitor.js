const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Starting Capacitor Android Setup...');

// 1. Write capacitor.config.json
const config = {
  appId: 'com.bapperida.absensi',
  appName: 'Absensi Digital',
  webDir: '.',
  bundledWebRuntime: false
};
fs.writeFileSync('capacitor.config.json', JSON.stringify(config, null, 2));
console.log('✅ capacitor.config.json written!');

// 2. Install Capacitor packages
console.log('📦 Installing Capacitor NPM packages...');
execSync('npm install @capacitor/core @capacitor/cli @capacitor/android --save-dev', { stdio: 'inherit' });

// 3. Initialize Android platform
console.log('🤖 Adding Android Platform...');
try {
  execSync('npx cap add android', { stdio: 'inherit' });
} catch (e) {
  console.log('ℹ️ Android platform already added or skipped.');
}

// 4. Update MainActivity.java with Developer Mode Block
const mainActivityPath = path.join(
  'android', 'app', 'src', 'main', 'java', 'com', 'bapperida', 'absensi', 'MainActivity.java'
);

const secureJavaCode = `package com.bapperida.absensi;

import android.os.Bundle;
import android.provider.Settings;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Pengecekan Opsi Pengembang (Developer Options) & USB Debugging (ADB)
        int devOptions = Settings.Global.getInt(getContentResolver(), Settings.Global.DEVELOPER_SETTINGS_ENABLED, 0);
        int adbEnabled = Settings.Global.getInt(getContentResolver(), Settings.Global.ADB_ENABLED, 0);
        
        if (devOptions == 1 || adbEnabled == 1) {
            Toast.makeText(this, "⚠️ Opsi Pengembang (Developer Options) Aktif! Mohon matikan Opsi Pengembang di Pengaturan HP untuk menggunakan aplikasi ini.", Toast.LENGTH_LONG).show();
            finishAffinity(); // Tutup aplikasi sepenuhnya
            System.exit(0);
        }
    }
}
`;

// Buat direktori tujuan secara manual jika belum ada (untuk simulasi penambahan)
const targetDir = path.dirname(mainActivityPath);
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

fs.writeFileSync(mainActivityPath, secureJavaCode);
console.log('🛡️ MainActivity.java has been secured against Developer Options & USB Debugging!');

console.log('🎉 Setup complete! You can now compile the project or run inside GitHub Actions.');
