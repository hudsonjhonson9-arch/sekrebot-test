const fs = require('fs');
const path = require('path');

const fileRekap = path.join('d:\\Code\\absensi_refactored_v6', 'js', 'rekap.js');
let content = fs.readFileSync(fileRekap, 'utf8');

const replacements = [
  {
    target: `style="font-size:9px;color:var(--gold);margin-top:1px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"`,
    replacement: `class="rekap-jabatan"`
  },
  {
    target: `style="border-color:\${cardBorderColor};position:relative;overflow:hidden;padding-bottom:10px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); cursor:pointer;"`,
    replacement: `class="rekap-card-wrap" style="border-color:\${cardBorderColor}"`
  },
  {
    target: `style="position:absolute;top:0;left:0;right:0;height:2px;background:\${cardTopColor}"`,
    replacement: `class="rekap-top-bar" style="background:\${cardTopColor}"`
  },
  {
    target: `style="margin-bottom:10px"`,
    replacement: `class="mb-10"`
  },
  {
    target: `style="flex:1;min-width:0"`,
    replacement: `class="flex-1-min0"`
  },
  {
    target: `style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"`,
    replacement: `class="text-truncate"`
  },
  {
    target: `style="margin-top:2px"`,
    replacement: `class="mt-2"`
  },
  {
    target: `style="font-size:8px;font-weight:700;color:#a78bfa;margin-top:2px"`,
    replacement: `class="rekap-periode"`
  },
  {
    target: `style="flex-shrink:0;text-align:right"`,
    replacement: `class="flex-shrink-right"`
  },
  {
    target: `style="font-size:8px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px"`,
    replacement: `class="rekap-label-sm"`
  },
  {
    target: `style="font-size:15px;font-weight:800"`,
    replacement: `class="rekap-time"`
  },
  {
    target: `style="font-size:11px;font-weight:800"`,
    replacement: `class="rekap-time-small"`
  },
  {
    target: `style="font-size:9px;font-weight:600;margin-top:3px;display:flex;align-items:center;gap:4px"`,
    replacement: `class="rekap-loc"`
  },
  {
    target: `style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px"`,
    replacement: `class="rekap-loc-text"`
  },
  {
    target: `style="width:30px;height:30px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);margin-left:auto"`,
    replacement: `class="rekap-img-wrap"`
  }
];

let replacedCount = 0;
for (const r of replacements) {
  const orig = content;
  content = content.split(r.target).join(r.replacement);
  if (orig !== content) replacedCount++;
}

fs.writeFileSync(fileRekap, content);
console.log(`Replaced ${replacedCount} unique inline styles in rekap.js`);
