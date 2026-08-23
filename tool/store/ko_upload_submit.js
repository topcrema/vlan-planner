// Upload ko screenshots (iPhone 6.9 + iPad 13) and resubmit for review.
const jwt = require('jsonwebtoken');
const fs = require('fs');
const crypto = require('crypto');

const KEY_ID = 'MLH9LUFU55';
const ISSUER_ID = '73703d1f-3734-4650-aef2-9e7b77169939';
const APP_ID = '6804422979';
const KO_LOC = 'a253a4b0-12de-47b7-bb23-2cafb4db08ea';
const BASE = 'https://api.appstoreconnect.apple.com';
const P8 = process.env.ASC_P8;

const GROUPS = [
  { type: 'APP_IPHONE_67', dir: 'C:\\dev\\tmp\\store\\final_ko\\', files: ['ko_01_subnet.png', 'ko_02_vlsm.png', 'ko_03_plan.png', 'ko_04_plan_errors.png', 'ko_05_summarize.png'] },
  { type: 'APP_IPAD_PRO_3GEN_129', dir: 'C:\\dev\\tmp\\store\\ipad\\', files: ['ipad_01_subnet.png', 'ipad_02_vlsm.png', 'ipad_03_plan.png', 'ipad_04_plan_errors.png', 'ipad_05_summarize.png'] },
];

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
  // 1. Screenshots into ko localization
  const sets = await api('GET', `/v1/appStoreVersionLocalizations/${KO_LOC}/appScreenshotSets`);
  for (const g of GROUPS) {
    let set = sets.data.find((s) => s.attributes.screenshotDisplayType === g.type);
    if (!set) {
      const created = await api('POST', '/v1/appScreenshotSets', {
        data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: g.type },
          relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: KO_LOC } } } },
      });
      set = created.data;
    }
    const existing = await api('GET', `/v1/appScreenshotSets/${set.id}/appScreenshots`);
    const have = new Set(existing.data.map((s) => s.attributes.fileName));
    for (const name of g.files) {
      if (have.has(name)) { console.log('skip (exists):', name); continue; }
      const buf = fs.readFileSync(g.dir + name);
      const rec = await api('POST', '/v1/appScreenshots', {
        data: { type: 'appScreenshots', attributes: { fileName: name, fileSize: buf.length },
          relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } },
      });
      for (const op of rec.data.attributes.uploadOperations) {
        const headers = {};
        for (const h of op.requestHeaders || []) headers[h.name] = h.value;
        const up = await fetch(op.url, { method: op.method, headers, body: buf.subarray(op.offset, op.offset + op.length) });
        if (!up.ok) throw new Error(`chunk failed ${up.status} for ${name}`);
      }
      await api('PATCH', `/v1/appScreenshots/${rec.data.id}`, {
        data: { type: 'appScreenshots', id: rec.data.id,
          attributes: { uploaded: true, sourceFileChecksum: crypto.createHash('md5').update(buf).digest('hex') } },
      });
      console.log('uploaded:', g.type, name);
    }
  }

  // 2. Resubmit
  const vers = await api('GET', `/v1/apps/${APP_ID}/appStoreVersions?limit=5`);
  const ver = vers.data.find((v) => ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED'].includes(v.attributes.appStoreState)) || vers.data[0];
  console.log('version state:', ver.attributes.appStoreState);
  const created = await api('POST', '/v1/reviewSubmissions', {
    data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' },
      relationships: { app: { data: { type: 'apps', id: APP_ID } } } },
  });
  const sub = created.data;
  await api('POST', '/v1/reviewSubmissionItems', {
    data: { type: 'reviewSubmissionItems', relationships: {
      reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.id } },
      appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } },
    } },
  });
  const done = await api('PATCH', `/v1/reviewSubmissions/${sub.id}`, {
    data: { type: 'reviewSubmissions', id: sub.id, attributes: { submitted: true } },
  });
  console.log('RESUBMITTED:', done.data.attributes.state);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
