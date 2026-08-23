// Render 4 app-icon candidates (1024x1024 PNG, no alpha) from inline SVG.
const sharp = require('sharp');

const S = 1024;

// A. Switch + three subnet nodes (hub/spoke)
const svgA = `
<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1D4ED8"/>
      <stop offset="1" stop-color="#0B1E4B"/>
    </linearGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="url(#bg)"/>
  <rect x="252" y="240" width="520" height="150" rx="40" fill="#FFFFFF"/>
  <circle cx="332" cy="315" r="26" fill="#1D4ED8"/>
  <circle cx="422" cy="315" r="26" fill="#1D4ED8"/>
  <circle cx="512" cy="315" r="26" fill="#1D4ED8"/>
  <path d="M512 390 L512 520 M512 470 L292 470 L292 600 M512 470 L732 470 L732 600 M512 520 L512 600"
        stroke="#7EA4FF" stroke-width="34" fill="none" stroke-linecap="round"/>
  <circle cx="292" cy="680" r="86" fill="#34D399"/>
  <circle cx="512" cy="680" r="86" fill="#FBBF24"/>
  <circle cx="732" cy="680" r="86" fill="#F472B6"/>
</svg>`;

// B. Slash motif (CIDR) — rotated bar + address dots, no text
const svgB = `
<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0F172A"/>
      <stop offset="1" stop-color="#1E3A8A"/>
    </linearGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="url(#bg)"/>
  <g transform="rotate(24 512 512)">
    <rect x="452" y="192" width="120" height="640" rx="60" fill="#FFFFFF"/>
  </g>
  <circle cx="284" cy="768" r="44" fill="#60A5FA"/>
  <circle cx="404" cy="768" r="44" fill="#60A5FA"/>
  <circle cx="620" cy="256" r="44" fill="#34D399"/>
  <circle cx="740" cy="256" r="44" fill="#34D399"/>
</svg>`;

// C. VLAN plan grid — colored blocks, one highlighted
const svgC = `
<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#111827"/>
      <stop offset="1" stop-color="#1F2937"/>
    </linearGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="url(#bg)"/>
  <rect x="160" y="160" width="336" height="336" rx="56" fill="#2563EB"/>
  <rect x="528" y="160" width="336" height="160" rx="56" fill="#34D399"/>
  <rect x="528" y="352" width="336" height="144" rx="56" fill="#FBBF24"/>
  <rect x="160" y="528" width="160" height="336" rx="56" fill="#F472B6"/>
  <rect x="352" y="528" width="512" height="336" rx="56" fill="#334155" stroke="#60A5FA" stroke-width="14" stroke-dasharray="42 30"/>
</svg>`;

// D. 802.1Q tag layers — three offset tags
const svgD = `
<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#312E81"/>
      <stop offset="1" stop-color="#0F172A"/>
    </linearGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="url(#bg)"/>
  <g transform="rotate(-8 512 512)">
    <rect x="212" y="252" width="600" height="150" rx="75" fill="#34D399" opacity="0.95"/>
    <rect x="212" y="437" width="600" height="150" rx="75" fill="#FBBF24" opacity="0.95"/>
    <rect x="212" y="622" width="600" height="150" rx="75" fill="#60A5FA" opacity="0.95"/>
    <circle cx="292" cy="327" r="40" fill="#0F172A"/>
    <circle cx="292" cy="512" r="40" fill="#0F172A"/>
    <circle cx="292" cy="697" r="40" fill="#0F172A"/>
  </g>
</svg>`;

(async () => {
  const out = 'C:\\dev\\tmp\\shots\\';
  const jobs = { icon_a_nodes: svgA, icon_b_slash: svgB, icon_c_grid: svgC, icon_d_tags: svgD };
  for (const [name, svg] of Object.entries(jobs)) {
    await sharp(Buffer.from(svg)).flatten({ background: '#0F172A' }).png().toFile(`${out}${name}.png`);
    console.log(name, 'done');
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
