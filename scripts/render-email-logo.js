// scripts/render-email-logo.js
// Rasterizes the Ripple Nexus email logo to PNG (emails cannot render SVG).
// The wordmark is drawn as explicit shapes-free <text> with wide fallbacks so
// the rasterizer produces a clean, bold lockup at 2x for retina clients.
// Usage: node scripts/render-email-logo.js

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'logos', 'rn');

// 600x132 (renders at 300x66 in email) — mark + wordmark on transparent bg
function lockupSvg(textColor) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="132" viewBox="0 0 600 132">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="50%">
      <stop offset="0%"  stop-color="#7C5CFF"/>
      <stop offset="55%" stop-color="#B794FF"/>
      <stop offset="100%" stop-color="#22D3EE"/>
    </linearGradient>
  </defs>
  <g transform="translate(6,2) scale(2)">
    <circle cx="22" cy="32" r="5" fill="url(#g)"/>
    <path d="M 27 23.34 A 10 10 0 0 1 27 40.66"  fill="none" stroke="url(#g)" stroke-width="3" stroke-linecap="round"/>
    <path d="M 34.73 19.27 A 18 18 0 0 1 34.73 44.73" fill="none" stroke="url(#g)" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
    <path d="M 44.52 19 A 26 26 0 0 1 44.52 45" fill="none" stroke="url(#g)" stroke-width="3" stroke-linecap="round" opacity="0.45"/>
  </g>
  <text x="132" y="86" font-family="Arial, Helvetica, sans-serif"
        font-weight="800" font-size="52" letter-spacing="-1.5"
        fill="${textColor}">Ripple Nexus</text>
</svg>`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await sharp(Buffer.from(lockupSvg('#F4F5FA')), { density: 144 })
    .png()
    .toFile(path.join(OUT_DIR, 'email-logo-dark.png'));
  await sharp(Buffer.from(lockupSvg('#0A0B14')), { density: 144 })
    .png()
    .toFile(path.join(OUT_DIR, 'email-logo-light.png'));
  console.log('Rendered email-logo-dark.png and email-logo-light.png');
}

main().catch((e) => { console.error(e); process.exit(1); });
