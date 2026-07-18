import sharp from 'sharp';
import fs from 'fs';

// Arka plan: koyu radyal gradyan + soluk "bakış konisi" taraması.
const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="82%">
      <stop offset="0%" stop-color="#1d2331"/><stop offset="55%" stop-color="#12141d"/><stop offset="100%" stop-color="#0a0b10"/>
    </radialGradient>
    <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#5dcaa5" stop-opacity="0"/><stop offset="100%" stop-color="#5dcaa5" stop-opacity="0.16"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <g transform="translate(512,512) rotate(-18)"><path d="M0 0 L560 -250 A612 612 0 0 1 560 250 Z" fill="url(#sweep)"/></g>
</svg>`;

// Ön plan: göz (beyaz almond + teal iris + altın halka + koyu bebek + parıltı). Şeffaf zemin, güvenli alanda.
const eye = (scale = 1) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="iris" cx="50%" cy="42%" r="62%">
      <stop offset="0%" stop-color="#95ecd0"/><stop offset="55%" stop-color="#45ba90"/><stop offset="100%" stop-color="#1f6d53"/>
    </radialGradient>
  </defs>
  <g transform="translate(512,512) scale(${scale})">
    <path d="M-262 0 Q0 -186 262 0 Q0 186 -262 0 Z" fill="#f4f4ee"/>
    <circle r="134" fill="url(#iris)"/>
    <circle r="134" fill="none" stroke="#efc05a" stroke-width="10" opacity="0.9"/>
    <circle r="58" fill="#0b0c11"/>
    <circle cx="-44" cy="-48" r="23" fill="#ffffff" opacity="0.92"/>
    <path d="M-262 0 Q0 -186 262 0" fill="none" stroke="#0b0c11" stroke-width="10" opacity="0.28"/>
  </g>
</svg>`;

// Tam ikon = arka plan + göz (önizleme + eski cihaz ikonu için).
const full = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="82%"><stop offset="0%" stop-color="#1d2331"/><stop offset="55%" stop-color="#12141d"/><stop offset="100%" stop-color="#0a0b10"/></radialGradient>
    <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#5dcaa5" stop-opacity="0"/><stop offset="100%" stop-color="#5dcaa5" stop-opacity="0.16"/></linearGradient>
    <radialGradient id="iris" cx="50%" cy="42%" r="62%"><stop offset="0%" stop-color="#95ecd0"/><stop offset="55%" stop-color="#45ba90"/><stop offset="100%" stop-color="#1f6d53"/></radialGradient>
  </defs>
  <rect width="1024" height="1024" rx="220" fill="url(#bg)"/>
  <g transform="translate(512,512) rotate(-18)"><path d="M0 0 L520 -235 A570 570 0 0 1 520 235 Z" fill="url(#sweep)"/></g>
  <g transform="translate(512,512)">
    <path d="M-262 0 Q0 -186 262 0 Q0 186 -262 0 Z" fill="#f4f4ee"/>
    <circle r="134" fill="url(#iris)"/><circle r="134" fill="none" stroke="#efc05a" stroke-width="10" opacity="0.9"/>
    <circle r="58" fill="#0b0c11"/><circle cx="-44" cy="-48" r="23" fill="#ffffff" opacity="0.92"/>
  </g>
</svg>`;

fs.mkdirSync('assets', { recursive: true });
await sharp(Buffer.from(bg)).png().toFile('assets/icon-background.png');
await sharp(Buffer.from(eye(0.82))).png().toFile('assets/icon-foreground.png'); // güvenli alan için biraz küçük
await sharp(Buffer.from(full)).png().toFile('assets/icon-only.png');
await sharp(Buffer.from(full)).resize(512, 512).png().toFile('logo-preview.png');
console.log('render tamam: assets/icon-*.png + logo-preview.png');
