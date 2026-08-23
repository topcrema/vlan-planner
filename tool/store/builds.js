const jwt = require('jsonwebtoken');
const KEY_ID = 'MLH9LUFU55';
const ISSUER_ID = '73703d1f-3734-4650-aef2-9e7b77169939';
const APP_ID = '6804422979';
const P8 = process.env.ASC_P8;

function token() {
  return jwt.sign({}, P8, {
    algorithm: 'ES256', expiresIn: '15m', audience: 'appstoreconnect-v1',
    issuer: ISSUER_ID, header: { kid: KEY_ID, typ: 'JWT' },
  });
}

(async () => {
  const res = await fetch(
    `https://api.appstoreconnect.apple.com/v1/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=5`,
    { headers: { Authorization: `Bearer ${token()}` } });
  const json = await res.json();
  if (!res.ok) { console.error(JSON.stringify(json).slice(0, 400)); process.exit(1); }
  if (!json.data.length) { console.log('no builds visible yet (still ingesting)'); return; }
  for (const b of json.data) {
    console.log(`build ${b.attributes.version}: ${b.attributes.processingState} (uploaded ${b.attributes.uploadedDate})`);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
