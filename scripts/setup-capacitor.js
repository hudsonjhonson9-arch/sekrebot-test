const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Starting Capacitor Android Setup...');

// 1. Write capacitor.config.json
const config = {
  appId: 'com.bapperida.absensi',
  appName: 'Absensi Digital',
  webDir: 'www',
  bundledWebRuntime: false
};
fs.writeFileSync('capacitor.config.json', JSON.stringify(config, null, 2));
console.log('✅ capacitor.config.json written with webDir: "www"!');

// Copy files and folders recursively to 'www'
console.log('📂 Copying web assets to "www" directory...');
if (!fs.existsSync('www')) {
  fs.mkdirSync('www', { recursive: true });
}

const filesToCopy = ['index.html', 'manifest.json', 'service-worker.js', 'version.json'];
filesToCopy.forEach(file => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join('www', file));
  }
});

const foldersToCopy = ['css', 'js'];
foldersToCopy.forEach(folder => {
  if (fs.existsSync(folder)) {
    const dest = path.join('www', folder);
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const copyDir = (src, dst) => {
      fs.readdirSync(src).forEach(item => {
        const sPath = path.join(src, item);
        const dPath = path.join(dst, item);
        if (fs.lstatSync(sPath).isDirectory()) {
          if (!fs.existsSync(dPath)) fs.mkdirSync(dPath, { recursive: true });
          copyDir(sPath, dPath);
        } else {
          fs.copyFileSync(sPath, dPath);
        }
      });
    };
    copyDir(folder, dest);
  }
});
console.log('✅ Web assets copied recursively to "www"!');

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

// 3.5. Configure gradle.properties to ignore Bouncy Castle in Jetifier
const gradlePropsPath = path.join('android', 'gradle.properties');
if (fs.existsSync(gradlePropsPath)) {
  let content = fs.readFileSync(gradlePropsPath, 'utf8');
  if (!content.includes('android.jetifier.ignorelist')) {
    content += '\n# Ignore Bouncy Castle signed jars in Jetifier to prevent configuration failure\nandroid.jetifier.ignorelist=bcprov-jdk15on,bcprov-jdk18on,bcprov-jdk15to18\n';
    fs.writeFileSync(gradlePropsPath, content);
    console.log('✅ Added Bouncy Castle to android.jetifier.ignorelist in gradle.properties!');
  }
}

// 3.6. Upgrade Gradle Wrapper to 8.7 to support modern multi-release signed Jar files (Bouncy Castle)
const wrapperPropsPath = path.join('android', 'gradle', 'wrapper', 'gradle-wrapper.properties');
if (fs.existsSync(wrapperPropsPath)) {
  let content = fs.readFileSync(wrapperPropsPath, 'utf8');
  content = content.replace(/gradle-[\d\.]+-all\.zip/, 'gradle-8.7-all.zip');
  fs.writeFileSync(wrapperPropsPath, content);
  console.log('✅ Upgraded Gradle Wrapper to 8.7 in gradle-wrapper.properties!');
}

// 3.7. Upgrade Android SDK compile and target version to 35 (Android 15) in variables.gradle
const variablesGradlePath = path.join('android', 'variables.gradle');
if (fs.existsSync(variablesGradlePath)) {
  let content = fs.readFileSync(variablesGradlePath, 'utf8');
  content = content.replace(/compileSdkVersion\s*=\s*\d+/, 'compileSdkVersion = 35');
  content = content.replace(/targetSdkVersion\s*=\s*\d+/, 'targetSdkVersion = 35');
  fs.writeFileSync(variablesGradlePath, content);
  console.log('✅ Upgraded compileSdkVersion & targetSdkVersion to 35 in variables.gradle!');
}

// 3.8. Inject Kotlin Dependency Constraints in app/build.gradle to prevent duplicate class errors
const appBuildGradlePath = path.join('android', 'app', 'build.gradle');
if (fs.existsSync(appBuildGradlePath)) {
  let content = fs.readFileSync(appBuildGradlePath, 'utf8');
  const constraintsBlock = `
    constraints {
        implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.8.22") {
            because("kotlin-stdlib-jdk7 is now part of kotlin-stdlib")
        }
        implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.8.22") {
            because("kotlin-stdlib-jdk8 is now part of kotlin-stdlib")
        }
    }
`;
  content = content.replace('dependencies {', `dependencies {${constraintsBlock}`);
  fs.writeFileSync(appBuildGradlePath, content);
  console.log('✅ Injected Kotlin stdlib constraints in app/build.gradle!');
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
        int devOptions = Settings.Global.getInt(getContentResolver(), Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0);
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
