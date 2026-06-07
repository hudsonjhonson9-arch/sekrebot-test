import json

# Paths
json_file = "d:/Code/absensi_refactored_v6/n8n/AbsensiBot V.5.1.json"
js_file = "C:/Users/Agil/.gemini/antigravity-ide/brain/433bbe89-d542-489d-ba5a-10939e42d0be/scratch/validasi_absen_fixed.js"

with open(js_file, "r", encoding="utf-8") as f:
    js_code = f.read()

with open(json_file, "r", encoding="utf-8") as f:
    data = json.load(f)

# Find the node named 'Validasi Absen'
found = False
for node in data.get("nodes", []):
    if node.get("name") == "Validasi Absen":
        node["parameters"]["jsCode"] = js_code
        found = True
        break

if not found:
    print("Error: Node 'Validasi Absen' not found.")
else:
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("Successfully updated AbsensiBot V.5.1.json")
