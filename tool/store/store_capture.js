// Capture raw app frames for App Store screenshots.
// 440x956 logical @3x = 1320x2868 px (iPhone 6.9" portrait spec).
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = 'C:\\dev\\tmp\\store\\raw\\';

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
  { name: 'raw_plan', url: 'http://localhost:5173/?tab=3', plan: CLEAN_PLAN },
  { name: 'raw_plan_errors', url: 'http://localhost:5173/?tab=3', plan: ERROR_PLAN },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'],
  });
  for (const shot of SHOTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: 440, height: 956, deviceScaleFactor: 3 });
    if (shot.plan) {
      // shared_preferences web json-encodes every stored value, so the
      // list-JSON string must be stored double-encoded.
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
    console.log(shot.name, 'done');
    await page.close();
  }
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
