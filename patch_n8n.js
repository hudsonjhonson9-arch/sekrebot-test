const fs = require('fs');
const file = 'n8n/AbsensiBot V.5.1.json';
let data = fs.readFileSync(file, 'utf8');
let obj = JSON.parse(data);

// Find the node
const formatNode = obj.nodes.find(n => n.name === 'Format Lokasi-List');
if (formatNode) {
    let jsCode = formatNode.parameters.jsCode;
    console.log("Original jsCode:\\n", jsCode);
    
    // Check if it already has instansi_id
    if (!jsCode.includes('instansi_id:')) {
        // Insert instansi_id mapping right after id mapping
        jsCode = jsCode.replace("id:          r.json.id          || r.json.ID          || '',", 
                                "id:          r.json.id          || r.json.ID          || '',\\n  instansi_id: r.json.instansi_id || r.json.Instansi_Id || 'all',");
        
        formatNode.parameters.jsCode = jsCode;
        fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
        console.log("Patched n8n JSON with instansi_id!");
    } else {
        console.log("Already has instansi_id");
    }
} else {
    console.log("Node not found!");
}
