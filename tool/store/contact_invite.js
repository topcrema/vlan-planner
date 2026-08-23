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
async function api(method, path, body, allow404) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    if (allow404 && res.status === 404) return null;
    throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 700)}`);
  }
  return text ? JSON.parse(text) : null;
}

(async () => {
  // 1. App Review contact info
  const vers = await api('GET', `/v1/apps/${APP_ID}/appStoreVersions?limit=5`);
  const ver = vers.data.find((v) => v.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION') || vers.data[0];
  const attrs = {
    contactFirstName: 'Dongil',
    contactLastName: 'Park',
    contactPhone: '+821093429105',
    contactEmail: 'parkdi1@naver.com',
    demoAccountRequired: false,
    notes: 'Fully offline utility for network engineers. No account or sign-in required; all features are available immediately on launch.',
  };
  const existing = await api('GET', `/v1/appStoreVersions/${ver.id}/appStoreReviewDetail`, null, true);
  if (existing && existing.data) {
    await api('PATCH', `/v1/appStoreReviewDetails/${existing.data.id}`, {
      data: { type: 'appStoreReviewDetails', id: existing.data.id, attributes: attrs },
    });
    console.log('review contact: updated');
  } else {
    await api('POST', '/v1/appStoreReviewDetails', {
      data: { type: 'appStoreReviewDetails', attributes: attrs,
        relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } },
    });
    console.log('review contact: created');
  }

  // 2. Resend TestFlight invite
  const testers = await api('GET', `/v1/betaTesters?filter[email]=parkdi1@naver.com&filter[apps]=${APP_ID}`);
  const tester = testers.data[0];
  if (!tester) throw new Error('tester not found');
  await api('POST', '/v1/betaTesterInvitations', {
    data: { type: 'betaTesterInvitations', relationships: {
      betaTester: { data: { type: 'betaTesters', id: tester.id } },
      app: { data: { type: 'apps', id: APP_ID } },
    } },
  });
  console.log('TestFlight invite resent to parkdi1@naver.com');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
