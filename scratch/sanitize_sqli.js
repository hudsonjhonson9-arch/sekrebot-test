const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const n8nDir = 'd:/Code/absensi_refactored_v6/n8n';

walkDir(n8nDir, (filePath) => {
  if (!filePath.endsWith('.json')) return;
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let data = JSON.parse(content);
    let modified = false;

    const nodes = data.nodes || [];
    nodes.forEach(node => {
      if (node.type === 'n8n-nodes-base.postgres' && node.parameters && node.parameters.query) {
        let query = node.parameters.query;
        // Find expressions like {{ $json.nama }}
        // and replace them with {{ ($json.nama || '').toString().replace(/'/g, "''") }}
        // We'll use a regex to find all {{ ... }} inside the query
        const regex = /\{\{\s*(.*?)\s*\}\}/g;
        let newQuery = query.replace(regex, (match, expression) => {
          // If it already contains a replace for single quotes, skip it
          if (expression.includes("replace(/'/g")) {
            return match;
          }
          // If the expression is just a variable or fallback, wrap it
          return `{{ (${expression}).toString().replace(/'/g, '' '') }}`;
        });

        if (newQuery !== query) {
          node.parameters.query = newQuery;
          modified = true;
        }
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log('Patched SQL injection in:', path.relative(n8nDir, filePath));
    }
  } catch (e) {
    console.error('Error parsing', filePath, e.message);
  }
});
