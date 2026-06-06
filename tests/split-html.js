const fs = require('fs');
const path = require('path');

const indexPath = path.join('d:\\Code\\absensi_refactored_v6', 'index.html');
const templatesDir = path.join('d:\\Code\\absensi_refactored_v6', 'templates');

if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir);

let html = fs.readFileSync(indexPath, 'utf8');

const panels = [
  'panel-absen', 'panel-ket', 'panel-profil', 'panel-rekap', 
  'panel-tugas', 'panel-lembur', 'panel-simapo', 'panel-admin'
];

panels.forEach(panelId => {
  // Regex to match <div class="panel..." id="panelId">...</div>
  // We need to account for nested divs, so regex is tricky.
  // We will do a manual character-by-character bracket matching.
  
  const searchStr = `id="${panelId}"`;
  const idx = html.indexOf(searchStr);
  if (idx === -1) return;
  
  // Find the `<div` that comes right before `id="panelId"`
  const divStart = html.lastIndexOf('<div', idx);
  
  // Now count nested divs
  let openDivs = 0;
  let i = divStart;
  let foundEnd = false;
  
  while (i < html.length) {
    if (html.startsWith('<div', i)) {
      openDivs++;
      i += 4;
    } else if (html.startsWith('</div', i)) {
      openDivs--;
      i += 5;
      if (openDivs === 0) {
        // We found the end!
        const divEnd = html.indexOf('>', i) + 1;
        const panelContent = html.substring(divStart, divEnd);
        
        // Extract innerHTML (we keep the outer div in index.html, empty it, and save innerHTML to template)
        // Wait, the prompt says "lazy load fragment". If we replace innerHTML, we should just save the inner content.
        const firstCloseBracket = panelContent.indexOf('>') + 1;
        const innerContent = panelContent.substring(firstCloseBracket, panelContent.length - 6).trim();
        
        const templatePath = path.join(templatesDir, `${panelId.replace('panel-', 'tab-')}.html`);
        fs.writeFileSync(templatePath, innerContent);
        
        // Replace in index.html
        const outerDiv = panelContent.substring(0, firstCloseBracket);
        const replacement = `${outerDiv}\n      <!-- Content will be loaded dynamically from templates/${panelId.replace('panel-', 'tab-')}.html -->\n    </div>`;
        html = html.substring(0, divStart) + replacement + html.substring(divEnd);
        
        console.log(`Extracted ${panelId}`);
        break;
      }
    } else {
      i++;
    }
  }
});

fs.writeFileSync(indexPath, html);
console.log('index.html updated successfully.');
