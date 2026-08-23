// 1) Answer new social-media age rating questions.
// 2) Capture 13" iPad screenshots (1032x1376 @2x = 2064x2752) and upload.
const jwt = require('jsonwebtoken');
const fs = require('fs');
const crypto = require('crypto');
const puppeteer = require('puppeteer-core');

const KEY_ID = 'MLH9LUFU55';
const ISSUER_ID = '73703d1f-3734-4650-aef2-9e7b77169939';
const APP_ID = '6804422979';
const DECL_ID = '796eaeff-17b7-42cc-ab60-0c51a3b762e3';
const BASE = 'https://api.appstoreconnect.apple.com';
const P8 = process.env.ASC_P8;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = 'C:\\dev\\tmp\\store\\ipad\\';

const CLEAN_PLAN = JSON.stringify([
  { vlanId: 10, name: 'Servers', purpose: 'Server farm', cidr: '10.10.90.0/23', gateway: '10.10.90.1' },
  { vlanId: 20, name: 'Clients', purpose: 'Office LAN', cidr: '10.10.92.0/22', gateway: '10.10.92.1' },
  { vlanId: 30, name: 'Voice', purpose: 'IP phones', cidr: '10.10.96.0/24', gateway: '10.10.96.1' },
  { vlanId: 40, name: 'IoT', purpose: 'Sensors and meters', cidr: '10.10.97.0/24', gateway: '10.10.97.1' },
  { vlanId: 99, name: 'Mgmt', purpose: 'Switch management', cidr: '10.10.99.0/24', gateway: '10.10.99.1' },
]);
const ERROR_PLAN = JSON.stringify([
  { vlanId: 10, name: 'Servers', purpose: 'Server farm', cidr: '10.10.90.0/23', gateway: '10.10.90.1' },
  { vlanId: 20, name: 'Clients', purpose: 'Office LAN', cidr: '10.10.92.0/22', gateway: '10.10.92.1' },
  { vlanId: 30, name: 'Voice', purpose: 'IP phones', cidr: '10.10.96.0/24', gateway: '10.10.96.1' },
  { vlanId: 50, name: 'Guest Wi-Fi', purpose: 'Visitors', cidr: '10.10.96.128/25', gateway: '10.10.96.129' },
]);
const SHOTS = [
  { name: 'ipad_01_subnet', url: 'http://localhost:5173/?tab=0', plan: null },
  { name: 'ipad_02_vlsm', url: 'http://localhost:5173/?tab=1', plan: null },
  { name: 'ipad_03_plan', url: 'http://localhost:5173/?tab=3', plan: CLEAN_PLAN },
  { name: 'ipad_04_plan_errors', url: 'http://localhost:5173/?tab=3', plan: ERROR_PLAN },
  { name: 'ipad_05_summarize', url: 'http://localhost:5173/?tab=2', plan: null },
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
  // 1. Social media questions
  await api('PATCH', `/v1/ageRatingDeclarations/${DECL_ID}`, {
    data: { type: 'ageRatingDeclarations', id: DECL_ID,
      attributes: { socialMedia: false, socialMediaAgeRestricted: false } },
  });
  console.log('age rating: socialMedia questions answered (no)');

  // 2. Capture iPad shots
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'],
  });
  for (const shot of SHOTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1032, height: 1376, deviceScaleFactor: 2 });
    if (shot.plan) {
      await page.evaluateOnNewDocument((planJson) => {
        localStorage.setItem('flutter.vlan_plan_v1', JSON.stringify(planJson));
      }, shot.plan);
    }
    await page.goto(shot.url, { waitUntil: 'load', timeout: 90000 });
    await page.evaluate(() => new Promise((resolve) => {
      const t = setTimeout(resolve, 15000);
      window.addEventListener('flutter-first-frame', () => { clearTimeout(t); resolve(); }, { once: true });
      if (document.querySelector('flt-glass-pane, flutter-view, canvas')) { clearTimeout(t); resolve(); }
    }));
    await new Promise((r) => setTimeout(r, 3500));
    await page.screenshot({ path: `${OUT}${shot.name}.png` });
    console.log('captured:', shot.name);
    await page.close();
  }
  await browser.close();

  // 3. Upload to APP_IPAD_PRO_3GEN_129 set
  const vers = await api('GET', `/v1/apps/${APP_ID}/appStoreVersions?limit=5`);
  const ver = vers.data.find((v) => v.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION') || vers.data[0];
  const vLocs = await api('GET', `/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`);
  const vEn = vLocs.data.find((l) => l.attributes.locale === 'en-US');
  const sets = await api('GET', `/v1/appStoreVersionLocalizations/${vEn.id}/appScreenshotSets`);
  let set = sets.data.find((s) => s.attributes.screenshotDisplayType === 'APP_IPAD_PRO_3GEN_129');
  if (!set) {
    const created = await api('POST', '/v1/appScreenshotSets', {
      data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: 'APP_IPAD_PRO_3GEN_129' },
        relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: vEn.id } } } },
    });
    set = created.data;
    console.log('iPad screenshot set created');
  }
  for (const shot of SHOTS) {
    const buf = fs.readFileSync(`${OUT}${shot.name}.png`);
    const rec = await api('POST', '/v1/appScreenshots', {
      data: { type: 'appScreenshots', attributes: { fileName: `${shot.name}.png`, fileSize: buf.length },
        relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } },
    });
    for (const op of rec.data.attributes.uploadOperations) {
      const headers = {};
      for (const h of op.requestHeaders || []) headers[h.name] = h.value;
      const up = await fetch(op.url, { method: op.method, headers, body: buf.subarray(op.offset, op.offset + op.length) });
      if (!up.ok) throw new Error(`chunk failed ${up.status}`);
    }
    await api('PATCH', `/v1/appScreenshots/${rec.data.id}`, {
      data: { type: 'appScreenshots', id: rec.data.id,
        attributes: { uploaded: true, sourceFileChecksum: crypto.createHash('md5').update(buf).digest('hex') } },
    });
    console.log('uploaded:', shot.name);
  }
  await new Promise((r) => setTimeout(r, 8000));
  const check = await api('GET', `/v1/appScreenshotSets/${set.id}/appScreenshots`);
  for (const s of check.data) console.log('state:', s.attributes.fileName, s.attributes.assetDeliveryState?.state);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
