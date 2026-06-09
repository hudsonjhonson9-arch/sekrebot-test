import json
import os

input_file = r"D:\Code\absensi_refactored_v6\n8n\AbsensiBot V.5.1.json"
output_file = r"D:\Code\absensi_refactored_v6\n8n\AbsensiBot V.5.1 (Patched).json"

print(f"Reading {input_file}...")
with open(input_file, 'r', encoding='utf-8') as f:
    workflow = json.load(f)

nodes = workflow.get('nodes', [])

for node in nodes:
    if node.get('name') == 'Parse Signature Save':
        js_code = node['parameters']['jsCode']
        js_code = js_code.replace("const telegram_id = String(body.telegram_id || '').trim();", 
                                  "const nip = String(body.nip || body.telegram_id || '').trim();")
        js_code = js_code.replace("if (!telegram_id) return [{json:{error:true,message:'telegram_id wajib diisi'}}];",
                                  "if (!nip) return [{json:{error:true,message:'nip wajib diisi'}}];")
        js_code = js_code.replace("telegram_id: Number(telegram_id),", "nip: nip,")
        node['parameters']['jsCode'] = js_code
        print("Patched 'Parse Signature Save' node.")

    elif node.get('name') == 'Upsert Signature':
        # Ubah query menjadi UPSERT berbasis NIP dan perbaiki kutip tunggal
        new_query = """INSERT INTO "tanda_tangan" ("nip", "signature", "saved_at", "saved_by") 
VALUES ('{{ $json.nip }}', '{{ ($json.signature).toString().replace(/'/g, "''") }}', '{{ $json.saved_at }}', {{ $json.saved_by }})
ON CONFLICT ("nip") 
DO UPDATE SET 
  "signature" = EXCLUDED."signature", 
  "updated_at" = NOW(),
  "saved_by" = EXCLUDED."saved_by"
RETURNING *"""
        node['parameters']['query'] = new_query
        print("Patched 'Upsert Signature' node.")

    elif node.get('name') == 'Get Signature by ID':
        # Ubah query untuk mencari berdasarkan NIP
        new_query = """SELECT * FROM "tanda_tangan" WHERE "nip" = '{{ ($input.first().json.query.nip || $input.first().json.query.telegram_id).toString().replace(/'/g, "''") }}'"""
        node['parameters']['query'] = new_query
        print("Patched 'Get Signature by ID' node.")
        
    elif node.get('name') == 'Format Signature Get':
        # Return NIP as well
        js_code = node['parameters']['jsCode']
        if 'telegram_id:row.telegram_id,' in js_code:
            js_code = js_code.replace('telegram_id:row.telegram_id,', 'nip:row.nip,telegram_id:row.telegram_id,')
            node['parameters']['jsCode'] = js_code
            print("Patched 'Format Signature Get' node.")

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(workflow, f, indent=2, ensure_ascii=False)

print(f"Successfully saved patched workflow to: {output_file}")
