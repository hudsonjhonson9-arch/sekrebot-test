const fs = require('fs');
const path = require('path');

const filesToProcess = [
  path.join('d:\\Code\\absensi_refactored_v6', 'js', 'simapo.js'),
  path.join('d:\\Code\\absensi_refactored_v6', 'js', 'simapo-ext.js')
];

const replacements = [
  {
    target: `style="padding:12px; font-size:12px; color:var(--muted); text-align:center;"`,
    replacement: `class="simapo-empty-sm"`
  },
  {
    target: `style="padding:10px 15px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer; font-size:13px; color:var(--white); display:flex; justify-content:space-between; align-items:center;"`,
    replacement: `class="simapo-list-item"`
  },
  {
    target: `style="font-weight:600; margin-bottom:2px;"`,
    replacement: `class="simapo-item-title"`
  },
  {
    target: `style="font-size:10px; color:var(--muted);"`,
    replacement: `class="simapo-item-code"`
  },
  {
    target: `style="font-size:11px; font-weight:700; color:\${b.stok_saat_ini > 0 ? 'var(--gold)' : '#ef4444'};"`,
    replacement: `class="simapo-item-stock" style="color:\${b.stok_saat_ini > 0 ? 'var(--gold)' : '#ef4444'}"`
  },
  {
    target: `style="width:100%; grid-column: 1 / -1;"`,
    replacement: `class="simapo-shimmer-wrap"`
  },
  {
    target: `style="height:120px; border-radius:12px"`,
    replacement: `class="simapo-shimmer-box"`
  },
  {
    target: `style="grid-column: 1/-1; text-align:center; padding:40px; opacity:0.6; font-size:13px; color:var(--danger)"`,
    replacement: `class="simapo-empty-danger"`
  },
  {
    target: `style="grid-column: 1/-1; text-align:center; padding:40px; opacity:0.6; font-size:13px;"`,
    replacement: `class="simapo-empty-std"`
  },
  {
    target: `style="padding:10px; cursor:pointer; position:relative; overflow:hidden; border: 1px solid rgba(255,255,255,0.08); transition: transform 0.2s;"`,
    replacement: `class="card glass-card simapo-card"`
  }
];

filesToProcess.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  let replacedCount = 0;
  for (const r of replacements) {
    const orig = content;
    content = content.split(r.target).join(r.replacement);
    if (orig !== content) replacedCount++;
  }
  fs.writeFileSync(file, content);
  console.log(`Replaced ${replacedCount} unique inline styles in ${path.basename(file)}`);
});
