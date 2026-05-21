const fs = require('fs');
const path = require('path');

const src = "C:\\Users\\Agil\\.gemini\\antigravity\\brain\\363d3750-4763-42e9-bc56-b4c24af1c8dc\\media__1779025599660.png";
const destDir = "D:\\Code\\absensi_refactored_v6\\assets";

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

fs.copyFileSync(src, path.join(destDir, "icon.png"));
fs.copyFileSync(src, path.join(destDir, "splash.png"));
console.log("✅ Logo successfully copied to icon.png and splash.png!");
