const jwt = require('jsonwebtoken');
const fs = require('fs');
const KEY_ID = 'MLH9LUFU55';
const ISSUER_ID = '73703d1f-3734-4650-aef2-9e7b77169939';
const BASE = 'https://api.appstoreconnect.apple.com';
const P8 = process.env.ASC_P8;
const LOC_ID = 'a253a4b0-12de-47b7-bb23-2cafb4db08ea';
const KO = JSON.parse(fs.readFileSync('C:\\ctrwork\\vlan-planner\\store\\listing.ko.json', 'utf8'));

function token() {
  return jwt.sign({}, P8, {
    algorithm: 'ES256', expiresIn: '15m', audience: 'appstoreconnect-v1',
    issuer: ISSUER_ID, header: { kid: KEY_ID, typ: 'JWT' },
  });
}
async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

(async () => {
  const cur = await api('GET', `/v1/appStoreVersionLocalizations/${LOC_ID}`);
  console.log('before: locale', cur.data.attributes.locale,
    '| desc len:', (cur.data.attributes.description || '').length,
    '| keywords:', JSON.stringify(cur.data.attributes.keywords));
  await api('PATCH', `/v1/appStoreVersionLocalizations/${LOC_ID}`, {
    data: { type: 'appStoreVersionLocalizations', id: LOC_ID, attributes: {
      description: KO.description,
      keywords: 'ip,넷마스크,ipv4,ccna,네트워크,라우팅,서브네팅,와일드카드,계산기,게이트웨이,브로드캐스트,경로요약,오프라인,noc,supernet',
      promotionalText: KO.promotionalText,
      supportUrl: 'https://github.com/topcrema/vlan-planner',
    } },
  });
  const after = await api('GET', `/v1/appStoreVersionLocalizations/${LOC_ID}`);
  console.log('after: desc len:', after.data.attributes.description.length,
    '| keywords len:', after.data.attributes.keywords.length);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
