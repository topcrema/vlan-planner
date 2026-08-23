const jwt = require('jsonwebtoken');
const fs = require('fs');

const KEY_ID = 'MLH9LUFU55';
const ISSUER_ID = '73703d1f-3734-4650-aef2-9e7b77169939';
const P8_PATH = 'C:\\Users\\박동일\\Downloads\\AuthKey_MLH9LUFU55.p8';
const BUNDLE_ID = 'com.topcrema.vlanplanner';
const BASE = 'https://api.appstoreconnect.apple.com';

function token() {
  return jwt.sign({}, fs.readFileSync(P8_PATH, 'utf8'), {
    algorithm: 'ES256',
    expiresIn: '15m',
    audience: 'appstoreconnect-v1',
    issuer: ISSUER_ID,
    header: { kid: KEY_ID, typ: 'JWT' },
  });
}

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

(async () => {
  // 1. Bundle ID: find or register.
  const found = await api('GET', `/v1/bundleIds?filter[identifier]=${BUNDLE_ID}`);
  let bundle = (found.data || []).find((b) => b.attributes.identifier === BUNDLE_ID);
  if (!bundle) {
    const created = await api('POST', '/v1/bundleIds', {
      data: {
        type: 'bundleIds',
        attributes: { identifier: BUNDLE_ID, name: 'VLAN Planner', platform: 'IOS' },
      },
    });
    bundle = created.data;
    console.log('bundleId: REGISTERED just now');
  } else {
    console.log('bundleId: already registered');
  }
  console.log('  identifier:', bundle.attributes.identifier);
  console.log('  seedId (Team ID):', bundle.attributes.seedId);

  // 2. App record?
  const apps = await api('GET', `/v1/apps?filter[bundleId]=${BUNDLE_ID}`);
  if ((apps.data || []).length > 0) {
    const a = apps.data[0];
    console.log(`app record: EXISTS — "${a.attributes.name}" (${a.attributes.sku || 'no sku'}, id ${a.id})`);
  } else {
    console.log('app record: NOT FOUND — create it in App Store Connect');
  }
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
