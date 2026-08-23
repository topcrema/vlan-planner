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
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 900)}`);
  return text ? JSON.parse(text) : null;
}

(async () => {
  const vers = await api('GET', `/v1/apps/${APP_ID}/appStoreVersions?limit=5`);
  const ver = vers.data.find((v) => v.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION') || vers.data[0];

  // Reuse an existing open submission if one exists
  const subs = await api('GET', `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES`);
  let sub = subs.data && subs.data[0];
  if (!sub) {
    const created = await api('POST', '/v1/reviewSubmissions', {
      data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' },
        relationships: { app: { data: { type: 'apps', id: APP_ID } } } },
    });
    sub = created.data;
    console.log('review submission created:', sub.id, sub.attributes.state);
  } else {
    console.log('existing submission:', sub.id, sub.attributes.state);
  }

  const items = await api('GET', `/v1/reviewSubmissions/${sub.id}/items`);
  if (!items.data.length) {
    await api('POST', '/v1/reviewSubmissionItems', {
      data: { type: 'reviewSubmissionItems', relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.id } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } },
      } },
    });
    console.log('version 1.0 added to submission');
  } else {
    console.log('submission already has', items.data.length, 'item(s)');
  }

  const done = await api('PATCH', `/v1/reviewSubmissions/${sub.id}`, {
    data: { type: 'reviewSubmissions', id: sub.id, attributes: { submitted: true } },
  });
  console.log('SUBMITTED:', done.data.attributes.state);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
