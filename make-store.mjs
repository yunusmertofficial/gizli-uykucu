import sharp from 'sharp';
import fs from 'fs';

fs.mkdirSync('store', { recursive: true });

// Ortak göz + arka plan parçaları (make-icon.mjs ile aynı dil).
const defs = `
  <radialGradient id="bg" cx="50%" cy="42%" r="82%">
    <stop offset="0%" stop-color="#1d2331"/><stop offset="55%" stop-color="#12141d"/><stop offset="100%" stop-color="#0a0b10"/>
  </radialGradient>
  <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#5dcaa5" stop-opacity="0"/><stop offset="100%" stop-color="#5dcaa5" stop-opacity="0.16"/>
  </linearGradient>
  <radialGradient id="iris" cx="50%" cy="42%" r="62%">
    <stop offset="0%" stop-color="#95ecd0"/><stop offset="55%" stop-color="#45ba90"/><stop offset="100%" stop-color="#1f6d53"/>
  </radialGradient>`;

const eyeGroup = (x, y, s) => `
  <g transform="translate(${x},${y}) scale(${s})">
    <path d="M-262 0 Q0 -186 262 0 Q0 186 -262 0 Z" fill="#f4f4ee"/>
    <circle r="134" fill="url(#iris)"/>
    <circle r="134" fill="none" stroke="#efc05a" stroke-width="10" opacity="0.9"/>
    <circle r="58" fill="#0b0c11"/>
    <circle cx="-44" cy="-48" r="23" fill="#ffffff" opacity="0.92"/>
    <path d="M-262 0 Q0 -186 262 0" fill="none" stroke="#0b0c11" stroke-width="10" opacity="0.28"/>
  </g>`;

// 1) Mağaza ikonu 512×512 — tam kare (Play kendi maskesini uygular; şeffaflık/yuvarlak köşe yok).
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 1024 1024">
  <defs>${defs}</defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <g transform="translate(512,512) rotate(-18)"><path d="M0 0 L520 -235 A570 570 0 0 1 520 235 Z" fill="url(#sweep)"/></g>
  ${eyeGroup(512, 512, 1)}
</svg>`;

// 2) Özellik grafiği 1024×500 — sol büyük göz + sağ başlık/slogan.
const feature = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>${defs}
    <radialGradient id="bgW" cx="30%" cy="45%" r="95%">
      <stop offset="0%" stop-color="#1d2331"/><stop offset="60%" stop-color="#12141d"/><stop offset="100%" stop-color="#08090e"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#bgW)"/>
  <g transform="translate(250,250) rotate(-16)"><path d="M0 0 L760 -320 A820 820 0 0 1 760 320 Z" fill="url(#sweep)"/></g>
  ${eyeGroup(250, 250, 0.62)}
  <text x="470" y="212" font-family="Segoe UI, Roboto, sans-serif" font-size="82" font-weight="800" fill="#f2f2f6" letter-spacing="1">Gizli Uykucu</text>
  <text x="472" y="272" font-family="Segoe UI, Roboto, sans-serif" font-size="33" font-weight="600" fill="#5dcaa5">Bakışları izle. Uykucuyu bul.</text>
  <text x="472" y="330" font-family="Segoe UI, Roboto, sans-serif" font-size="24" font-weight="400" fill="#9aa0ad">7 kişilik sosyal çıkarım oyunu</text>
</svg>`;

await sharp(Buffer.from(icon)).png().toFile('store/icon-512.png');
await sharp(Buffer.from(feature)).png().toFile('store/feature-1024x500.png');
console.log('render tamam: store/icon-512.png + store/feature-1024x500.png');
