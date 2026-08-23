const jwt = require('jsonwebtoken');
const KEY_ID = 'MLH9LUFU55';
const ISSUER_ID = '73703d1f-3734-4650-aef2-9e7b77169939';
const APP_ID = '6804422979';
const BASE = 'https://api.appstoreconnect.apple.com';
const P8 = process.env.ASC_P8;

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
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 700)}`);
  return text ? JSON.parse(text) : null;
}

(async () => {
  // 1. Copyright on version 1.0
  const vers = await api('GET', `/v1/apps/${APP_ID}/appStoreVersions?limit=5`);
  const ver = vers.data.find((v) => v.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION') || vers.data[0];
  await api('PATCH', `/v1/appStoreVersions/${ver.id}`, {
    data: { type: 'appStoreVersions', id: ver.id,
      attributes: { copyright: '© 2026 Dongil Park' } },
  });
  console.log('copyright set');

  // 2. Content rights: no third-party content
  await api('PATCH', `/v1/apps/${APP_ID}`, {
    data: { type: 'apps', id: APP_ID,
      attributes: { contentRightsDeclaration: 'DOES_NOT_USE_THIRD_PARTY_CONTENT' } },
  });
  console.log('content rights: does not use third-party content');

  // 3. Dump age rating declaration to see unanswered (new social media) fields
  const infos = await api('GET', `/v1/apps/${APP_ID}/appInfos`);
  const info = infos.data.find((i) => (i.attributes.appStoreState || i.attributes.state) === 'PREPARE_FOR_SUBMISSION') || infos.data[0];
  const decl = await api('GET', `/v1/appInfos/${info.id}/ageRatingDeclaration`);
  console.log('ageRatingDeclaration attributes:');
  for (const [k, v] of Object.entries(decl.data.attributes)) {
    console.log(`  ${k}: ${JSON.stringify(v)}`);
  }
  console.log('declId:', decl.data.id);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
