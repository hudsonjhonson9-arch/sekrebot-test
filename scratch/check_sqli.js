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
const results = [];

walkDir(n8nDir, (filePath) => {
  if (!filePath.endsWith('.json')) return;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const nodes = data.nodes || [];
    nodes.forEach(node => {
      if (node.type === 'n8n-nodes-base.postgres' && node.parameters && node.parameters.query) {
        const query = node.parameters.query;
        // Check if query has {{...}} which implies expression interpolation
        if (query.includes('{{')) {
          // Check if it's potentially unsafe (lacking .replace(/'/g, '' '') or similar)
          // Look for '{{ ... }}' inside the query
          const regex = /'\{\{([^}]+)\}\}'/g;
          let match;
          while ((match = regex.exec(query)) !== null) {
            const expression = match[1];
            // If the expression does not contain replace(/'/g, it might be vulnerable
            if (!expression.includes("replace(/'/g")) {
              results.push({
                file: path.relative(n8nDir, filePath),
                nodeName: node.name,
                vulnerableExpression: match[0],
                fullQuery: query.substring(0, 100) + '...'
              });
            }
          }
        }
      }
    });
  } catch (e) {
    console.error('Error parsing', filePath, e.message);
  }
});

console.log(JSON.stringify(results, null, 2));
