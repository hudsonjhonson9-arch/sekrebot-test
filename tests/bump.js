const fs = require('fs');
let html = fs.readFileSync('../index.html', 'utf8');
html = html.replace(/\.js(\?v=[0-9a-zA-Z]+)?\"/g, '.js?v=' + Date.now() + '"');
fs.writeFileSync('../index.html', html);
