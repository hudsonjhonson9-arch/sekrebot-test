const fs = require('fs');
const path = require('path');

const fileTugas = path.join('d:\\Code\\absensi_refactored_v6', 'js', 'tugas_lembur.js');
let content = fs.readFileSync(fileTugas, 'utf8');

const replacements = [
  {
    target: `style="width:100%; height:80px; border-radius:15px; margin-bottom:10px"`,
    replacement: `class="sh-box mb-10"`
  },
  {
    target: `style="width:100%; height:80px; border-radius:15px"`,
    replacement: `class="sh-box"`
  },
  {
    target: `class="empty-state" style="padding:40px 20px"`,
    replacement: `class="empty-state empty-state-wrap"`
  },
  {
    target: `style="font-size:40px; margin-bottom:15px"`,
    replacement: `class="empty-icon"`
  },
  {
    target: `style="font-weight:800; color:var(--white); font-size:14px"`,
    replacement: `class="empty-title"`
  },
  {
    target: `style="color:var(--muted); font-size:11px; margin-top:5px"`,
    replacement: `class="empty-subtitle"`
  },
  {
    target: `style="font-size:12px; font-weight:800; color:var(--gold); margin-bottom:15px; text-transform:uppercase; letter-spacing:1px"`,
    replacement: `class="section-title-sm"`
  },
  {
    target: `style="font-size:30px; margin-bottom:10px"`,
    replacement: `class="empty-icon"`
  },
  {
    target: `style="font-weight:700"`,
    replacement: `class="empty-title"`
  },
  {
    target: `style="background:rgba(255,255,255,0.1); border-radius:10px; padding:8px 15px; border:1px solid rgba(255,255,255,0.2); color:var(--white); cursor:pointer"`,
    replacement: `class="btn-retry"`
  },
  {
    target: `style="background:rgba(96,165,250,0.1); color:#60a5fa; border:1px solid rgba(96,165,250,0.2); padding:6px 12px; border-radius:10px; text-decoration:none; font-size:10px; font-weight:700; display:inline-flex; align-items:center; gap:6px; transition:all 0.3s ease"`,
    replacement: `class="btn-map"`
  },
  {
    target: `style="background:linear-gradient(135deg, var(--gold) 0%, #d4af37 100%); color:#000; border:none; padding:8px 16px; border-radius:10px; font-size:11px; font-weight:800; cursor:pointer; box-shadow: 0 4px 15px rgba(212,175,55,0.3); transition:all 0.3s ease"`,
    replacement: `class="btn-action"`
  },
  {
    target: `style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:15px; margin-bottom:15px; display:flex; flex-direction:column; gap:12px; position:relative; overflow:hidden"`,
    replacement: `class="tugas-card"`
  },
  {
    target: `style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px dashed rgba(255,255,255,0.1); padding-bottom:12px"`,
    replacement: `class="tugas-card-header"`
  },
  {
    target: `style="font-size:10px; color:var(--muted); margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px"`,
    replacement: `class="tugas-date-label"`
  },
  {
    target: `style="font-size:14px; font-weight:800; color:var(--white)"`,
    replacement: `class="tugas-date-value"`
  },
  {
    target: `style="display:flex; align-items:flex-start; gap:10px; margin-bottom:8px"`,
    replacement: `class="tugas-loc-row"`
  },
  {
    target: `style="width:30px; height:30px; border-radius:8px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; font-size:12px; color:var(--muted); flex-shrink:0"`,
    replacement: `class="tugas-loc-icon"`
  },
  {
    target: `style="font-size:11px; color:var(--muted); margin-bottom:2px"`,
    replacement: `class="tugas-loc-title"`
  },
  {
    target: `style="font-size:13px; font-weight:700; color:var(--white); line-height:1.4"`,
    replacement: `class="tugas-loc-desc"`
  },
  {
    target: `style="background:rgba(0,0,0,0.2); padding:10px 12px; border-radius:8px; font-size:12px; color:var(--white); line-height:1.5; border-left:3px solid var(--gold)"`,
    replacement: `class="tugas-ket-row"`
  },
  {
    target: `style="display:flex; justify-content:space-between; align-items:center; margin-top:4px"`,
    replacement: `class="tugas-footer"`
  }
];

let replacedCount = 0;
for (const r of replacements) {
  const orig = content;
  content = content.split(r.target).join(r.replacement);
  if (orig !== content) replacedCount++;
}

fs.writeFileSync(fileTugas, content);
console.log(`Replaced ${replacedCount} unique inline styles in tugas_lembur.js`);
