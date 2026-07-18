import sharp from 'sharp';
import fs from 'fs';

const S = 'store/screens';
const OUT = 'store';
// [kaynak, başlık] — üst-orta boş alana başlık; HUD sol/sağ köşede, çakışmaz.
const items = [
  ['lobby.png',  'Oda kur, kodu paylaş — 7 kişi bir masada'],
  ['intro.png',  'Ya gizli uykucu sensin…'],
  ['k_15s.png',  'Kim kime bakıyor? Bakışları izle.'],
  ['a_30s.png',  'Biri uyudu — uykucu aranızda.'],
  ['a_9s.png',   'Sezinle, tartış, tek kurşunu doğru kullan.'],
];

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const overlay = (title) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
  <defs>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="8" flood-color="#000000" flood-opacity="0.85"/>
    </filter>
    <linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0.55"/><stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1920" height="260" fill="url(#top)"/>
  <g filter="url(#sh)" font-family="Segoe UI, Roboto, Arial, sans-serif" text-anchor="middle">
    <text x="960" y="150" font-size="54" font-weight="800" fill="#f4f4f6" letter-spacing="0.5">${esc(title)}</text>
  </g>
  <rect x="880" y="178" width="160" height="5" rx="2.5" fill="#5dcaa5"/>
</svg>`);

fs.mkdirSync(OUT, { recursive: true });
let i = 1;
for (const [src, title] of items) {
  const p = `${S}/${src}`;
  if (!fs.existsSync(p)) { console.log('atlandı (yok):', src); continue; }
  const out = `${OUT}/ss${i}.png`;
  await sharp(p).resize(1920, 1080, { fit: 'cover' })
    .composite([{ input: overlay(title), top: 0, left: 0 }])
    .png().toFile(out);
  console.log('ss', i, '←', src);
  i++;
}
console.log('bitti:', i - 1, 'ekran görüntüsü');
