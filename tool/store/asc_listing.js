// Push listing copy + 6.9" screenshots to App Store Connect.
const jwt = require('jsonwebtoken');
const fs = require('fs');
const crypto = require('crypto');

const KEY_ID = 'MLH9LUFU55';
const ISSUER_ID = '73703d1f-3734-4650-aef2-9e7b77169939';
const APP_ID = '6804422979';
const BASE = 'https://api.appstoreconnect.apple.com';
const P8 = process.env.ASC_P8;
const L = JSON.parse(fs.readFileSync('C:\\dev\\tmp\\shotjob\\listing.json', 'utf8'));
const SHOTS_DIR = 'C:\\dev\\tmp\\store\\final\\';
const SHOTS = ['01_subnet.png', '02_vlsm.png', '03_plan.png', '04_plan_errors.png', '05_summarize.png'];

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
  // ---- App info: subtitle, privacy URL, categories
  const infos = await api('GET', `/v1/apps/${APP_ID}/appInfos`);
  const info = infos.data.find((i) => (i.attributes.appStoreState || i.attributes.state) === 'PREPARE_FOR_SUBMISSION') || infos.data[0];
  const iLocs = await api('GET', `/v1/appInfos/${info.id}/appInfoLocalizations`);
  const iEn = iLocs.data.find((l) => l.attributes.locale === 'en-US');
  if (!iEn) throw new Error('no en-US appInfoLocalization');
  await api('PATCH', `/v1/appInfoLocalizations/${iEn.id}`, {
    data: { type: 'appInfoLocalizations', id: iEn.id,
      attributes: { subtitle: L.subtitle, privacyPolicyUrl: L.privacyPolicyUrl } },
  });
  console.log('appInfo localization: subtitle + privacy URL set');
  await api('PATCH', `/v1/appInfos/${info.id}`, {
    data: { type: 'appInfos', id: info.id, relationships: {
      primaryCategory: { data: { type: 'appCategories', id: 'UTILITIES' } },
      secondaryCategory: { data: { type: 'appCategories', id: 'DEVELOPER_TOOLS' } },
    } },
  });
  console.log('categories: Utilities / Developer Tools');

  // ---- Version localization: description, keywords, promo, support URL
  const vers = await api('GET', `/v1/apps/${APP_ID}/appStoreVersions?limit=5`);
  const ver = vers.data.find((v) => v.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION') || vers.data[0];
  console.log('version:', ver.attributes.versionString, ver.attributes.appStoreState);
  const vLocs = await api('GET', `/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`);
  const vEn = vLocs.data.find((l) => l.attributes.locale === 'en-US');
  await api('PATCH', `/v1/appStoreVersionLocalizations/${vEn.id}`, {
    data: { type: 'appStoreVersionLocalizations', id: vEn.id, attributes: {
      description: L.description, keywords: L.keywords,
      promotionalText: L.promotionalText, supportUrl: L.supportUrl,
    } },
  });
  console.log('version localization: description/keywords/promo/support set');

  // ---- Screenshots: 6.9" set
  const sets = await api('GET', `/v1/appStoreVersionLocalizations/${vEn.id}/appScreenshotSets`);
  let set = sets.data.find((s) => s.attributes.screenshotDisplayType === 'APP_IPHONE_67');
  if (!set) {
    const created = await api('POST', '/v1/appScreenshotSets', {
      data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: 'APP_IPHONE_67' },
        relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: vEn.id } } } },
    });
    set = created.data;
    console.log('screenshot set created (APP_IPHONE_67)');
  } else {
    console.log('screenshot set exists; adding to it');
  }

  for (const name of SHOTS) {
    const buf = fs.readFileSync(SHOTS_DIR + name);
    const shot = await api('POST', '/v1/appScreenshots', {
      data: { type: 'appScreenshots', attributes: { fileName: name, fileSize: buf.length },
        relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } },
    });
    for (const op of shot.data.attributes.uploadOperations) {
      const headers = {};
      for (const h of op.requestHeaders || []) headers[h.name] = h.value;
      const part = buf.subarray(op.offset, op.offset + op.length);
      const up = await fetch(op.url, { method: op.method, headers, body: part });
      if (!up.ok) throw new Error(`upload chunk failed ${up.status} for ${name}`);
    }
    const md5 = crypto.createHash('md5').update(buf).digest('hex');
    await api('PATCH', `/v1/appScreenshots/${shot.data.id}`, {
      data: { type: 'appScreenshots', id: shot.data.id,
        attributes: { uploaded: true, sourceFileChecksum: md5 } },
    });
    console.log('uploaded:', name, `(${Math.round(buf.length / 1024)} KB)`);
  }

  // ---- Poll asset processing
  await new Promise((r) => setTimeout(r, 8000));
  const check = await api('GET', `/v1/appScreenshotSets/${set.id}/appScreenshots`);
  for (const s of check.data) {
    console.log('state:', s.attributes.fileName, s.attributes.assetDeliveryState?.state);
  }
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
