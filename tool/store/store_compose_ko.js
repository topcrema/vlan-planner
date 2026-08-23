// Korean-headline App Store screenshots from the existing raw captures.
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const RAW = 'C:/dev/tmp/store/raw/';
const OUT = 'C:\\dev\\tmp\\store\\final_ko\\';
const FRAME = 'file:///C:/dev/tmp/shotjob/frame.html';

const SHOTS = [
  { raw: 'raw_subnet', out: 'ko_01_subnet', title: '모든 서브넷 계산,\\n즉시', sub: 'CIDR와 마스크, 완전 오프라인' },
  { raw: 'raw_vlsm', out: 'ko_02_vlsm', title: '딱 맞게 쪼개는\\nVLSM 설계', sub: '사용률까지 한눈에' },
  { raw: 'raw_plan', out: 'ko_03_plan', title: '사이트 VLAN 표,\\n실시간 검증', sub: 'ID, 서브넷, 게이트웨이를 한곳에' },
  { raw: 'raw_plan_errors', out: 'ko_04_plan_errors', title: '대역 겹침, 배포 전에\\n잡아냅니다', sub: '중복 ID, 충돌, 잘못된 게이트웨이' },
  { raw: 'raw_summarize', out: 'ko_05_summarize', title: '경로를 최소 집합으로\\n요약', sub: '정확한 슈퍼넷 병합' },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1320, height: 2868, deviceScaleFactor: 1 });
  for (const s of SHOTS) {
    const params = new URLSearchParams({ title: s.title, sub: s.sub, img: `file:///${RAW}${s.raw}.png` });
    await page.goto(`${FRAME}?${params}`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: `${OUT}${s.out}.png` });
    console.log(s.out, 'done');
  }
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
