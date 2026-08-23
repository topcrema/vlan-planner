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
async function api(path) {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${token()}` } });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  return json;
}

(async () => {
  const testers = await api(`/v1/betaTesters?filter[email]=parkdi1@naver.com&filter[apps]=${APP_ID}`);
  for (const t of testers.data) {
    console.log('tester:', t.attributes.email, '| inviteType:', t.attributes.inviteType, '| state:', t.attributes.state ?? '(none)');
    const groups = await api(`/v1/betaTesters/${t.id}/betaGroups`);
    console.log('  groups:', groups.data.map((g) => g.id).join(', ') || '(none)');
  }
  const groups = await api(`/v1/betaGroups?filter[app]=${APP_ID}`);
  for (const g of groups.data) {
    console.log('group:', g.attributes.name, '| internal:', g.attributes.isInternalGroup, '| allBuilds:', g.attributes.hasAccessToAllBuilds);
  }
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
