// Compose final App Store screenshots (1320x2868) from raw captures + frame.html.
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const RAW = 'C:/dev/tmp/store/raw/';
const OUT = 'C:\\dev\\tmp\\store\\final\\';
const FRAME = 'file:///C:/dev/tmp/shotjob/frame.html';

const SHOTS = [
  { raw: 'raw_subnet', out: '01_subnet', title: 'Every subnet answer,\\ninstantly', sub: 'CIDR and mask math, fully offline' },
  { raw: 'raw_vlsm', out: '02_vlsm', title: 'Carve networks\\nthat fit exactly', sub: 'VLSM allocation with utilization' },
  { raw: 'raw_plan', out: '03_plan', title: "Your site's VLAN table,\\nvalidated live", sub: 'IDs, subnets, gateways in one place' },
  { raw: 'raw_plan_errors', out: '04_plan_errors', title: 'Overlaps caught before\\nthey reach production', sub: 'Duplicate IDs, collisions, bad gateways' },
  { raw: 'raw_summarize', out: '05_summarize', title: 'Collapse routes to\\nthe minimum set', sub: 'Exact supernet aggregation' },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1320, height: 2868, deviceScaleFactor: 1 });
  for (const s of SHOTS) {
    const params = new URLSearchParams({
      title: s.title, sub: s.sub, img: `file:///${RAW}${s.raw}.png`,
    });
    await page.goto(`${FRAME}?${params}`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: `${OUT}${s.out}.png` });
    console.log(s.out, 'done');
  }
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
