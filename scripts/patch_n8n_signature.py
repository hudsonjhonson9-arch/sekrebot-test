import json
import os

input_file = r"D:\Code\absensi_refactored_v6\n8n\AbsensiBot V.5.1 (Patched).json"
output_file = r"D:\Code\absensi_refactored_v6\n8n\AbsensiBot V.5.1 (Patched).json"

print(f"Reading {input_file}...")
with open(input_file, 'r', encoding='utf-8') as f:
    workflow = json.load(f)

nodes = workflow.get('nodes', [])

new_code = """const headers = $input.first().json.headers || {};
const body = $input.first().json.body || {};
const method = $input.first().json.method || '';
if (method === 'OPTIONS') return $input.all();

const token = headers['x-app-token'] || headers['X-App-Token'];
if (token !== 'BAPPERIDA_SECURE_TOKEN_2025') {
  $execution.respond({ statusCode: 401, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: false, message: 'Unauthorized' }) });
  return [];
}

// HMAC Signature Anti-Spoofing (Only for POST requests to Absen)
if (method === 'POST' && body.latitude && body.longitude) {
  const clientSig = body._signature;
  const clientTs = body.timestamp;
  
  if (!clientSig || !clientTs) {
    $execution.respond({ statusCode: 401, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: false, message: 'Missing Signature/Timestamp' }) });
    return [];
  }
  
  // Replay Attack Check (24 hours tolerance for Offline Sync)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - clientTs) > 86400) {
    $execution.respond({ statusCode: 401, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: false, message: 'Request Expired (Offline Sync max 24h)' }) });
    return [];
  }

  // Pure JS SHA-256 Implementation
  const sha256 = function(ascii) {
      function rightRotate(value, amount) { return (value>>>amount) | (value<<(32 - amount)); };
      var mathPow = Math.pow; var maxWord = mathPow(2, 32); var lengthProperty = 'length'
      var i, j; var result = ''
      var words = []; var asciiBitLength = ascii[lengthProperty]*8;
      var hash = sha256.h = sha256.h || [];
      var k = sha256.k = sha256.k || [];
      var primeCounter = k[lengthProperty];
      var isComposite = {};
      for (var candidate = 2; primeCounter < 64; candidate++) {
          if (!isComposite[candidate]) {
              for (i = 0; i < 313; i += candidate) { isComposite[i] = candidate; }
              hash[primeCounter] = (mathPow(candidate, .5)*maxWord)|0;
              k[primeCounter++] = (mathPow(candidate, 1/3)*maxWord)|0;
          }
      }
      ascii += '\\x80'
      while (ascii[lengthProperty]%64 - 56) ascii += '\\x00'
      for (i = 0; i < ascii[lengthProperty]; i++) {
          j = ascii.charCodeAt(i);
          if (j>>8) return; 
          words[i>>2] |= j << ((3 - i)%4)*8;
      }
      words[words[lengthProperty]] = ((asciiBitLength/maxWord)|0);
      words[words[lengthProperty]] = (asciiBitLength)
      for (j = 0; j < words[lengthProperty];) {
          var w = words.slice(j, j += 16); var oldHash = hash;
          hash = hash.slice(0, 8);
          for (i = 0; i < 64; i++) {
              var w15 = w[i - 15], w2 = w[i - 2];
              var a = hash[0], e = hash[4];
              var temp1 = hash[7]
                  + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
                  + ((e&hash[5])^((~e)&hash[6]))
                  + k[i]
                  + (w[i] = (i < 16) ? w[i] : (
                          w[i - 16]
                          + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15>>>3))
                          + w[i - 7]
                          + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2>>>10))
                      )|0
                  );
              var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
                  + ((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));
              hash = [(temp1 + temp2)|0].concat(hash);
              hash[4] = (hash[4] + temp1)|0;
          }
          for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i])|0;
      }
      for (i = 0; i < 8; i++) {
          for (j = 3; j + 1; j--) {
              var b = (hash[i]>>(j*8))&255;
              result += ((b < 16) ? 0 : '') + b.toString(16);
          }
      }
      return result;
  };

  const reqIdVal = String(body.request_id || '');
  const nipVal = String(body.nip || (body.user && body.user.nip) || '');
  const latVal = String(body.latitude || '');
  const lngVal = String(body.longitude || '');
  const tsVal = String(clientTs || '');
  
  const expectedBase = `${reqIdVal}${nipVal}${latVal}${lngVal}${tsVal}${token}`;
  const expectedSig = sha256(expectedBase);
  
  if (clientSig !== expectedSig) {
     $execution.respond({ statusCode: 401, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: false, message: 'Invalid Signature - Anti Spoofing Triggered' }) });
     return [];
  }
}

return $input.all();"""

for node in nodes:
    if node.get('name') == 'Security Gate Absen':
        node['parameters']['jsCode'] = new_code
        print("Patched 'Security Gate Absen' node for HMAC signature.")

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(workflow, f, indent=2, ensure_ascii=False)

print(f"Successfully saved patched workflow to: {output_file}")
