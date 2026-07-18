import { Game } from './game.js';
import { TICK_MS, TUNING, eyeContact, sees } from './rules.js';

const NAMES = ['Ali', 'Ece', 'Can', 'Deniz', 'Zeynep', 'Burak', 'Mert'];

function run(seed) {
  const g = new Game(NAMES, seed);
  const rand = g.rand;
  const k = g.killer;
  const seen = NAMES.map(() => []);
  const beats = [];
  let t = 0, readySince = null;

  while (g.phase !== 'over' && t < 5 * 60 * 1000) {
    // --- UYKUCUNUN KOLTUGU ---
    const prey = (!k._prey || !k._prey.alive)
      ? (k._prey = g.alive.filter(x => x !== k)[Math.floor(rand() * (g.alive.length - 1))])
      : k._prey;
    if (k.alive && prey) {
      g.aim(k.id, Math.atan2(prey.y - k.y, prey.x - k.x));
      if (g.cooldown <= 0 && readySince === null) { readySince = t; beats.push({ k: 'ready', t }); }
      const ec = eyeContact(k, prey);
      const eyes = g.alive.filter(p => p !== k && p !== prey && sees(p, k)).length;
      if (g.cooldown <= 0 && ec && g.strike(k.id, prey.id)) {
        beats.push({ k: 'strike', t, victim: prey.id, eyes, waited: t - readySince,
                     witnesses: g.players.filter(p => p.alive && p !== k && sees(p, k)).map(p => p.id) });
        readySince = null; k._prey = null;
      }
    }
    // --- MASANIN GERI KALANI ---
    for (const p of g.alive) {
      if (p === k) continue;
      p._n = (p._n ?? 0) - TICK_MS;
      if (p._n <= 0) {
        p._n = 2000 + rand() * 4000;
        const o = g.alive.filter(x => x !== p);
        const tt = o[Math.floor(rand() * o.length)];
        if (tt) g.aim(p.id, Math.atan2(tt.y - p.y, tt.x - p.x));
      }
    }

    for (const e of g.tick(TICK_MS)) {
      if (e.t === 'gaze') for (const w of e.witnesses) seen[w].push({ a: e.actor, t });
      if (e.t === 'sleep') beats.push({ k: 'sleep', t, victim: e.victim });
    }
    t += TICK_MS;
  }
  return { g, beats, seen };
}

// Iki hamlesi olan, uykucunun bekledigi bir tur bul
let R = null;
for (let s = 1; s < 300 && !R; s++) {
  const r = run(s);
  const st = r.beats.filter(b => b.k === 'strike');
  if (st.length >= 2 && st.some(b => b.waited > 3000) && st[0].eyes >= 1) R = r;
}
const { g, beats, seen } = R;
const N = i => g.players[i].name;
const K = g.killer;
const ss = ms => (ms / 1000).toFixed(1) + ' sn';

console.log(`\nUYKUCU: ${N(K.id)}\n${'='.repeat(60)}`);
for (const b of beats.filter(b => b.k !== 'ready').slice(0, 6)) {
  if (b.k === 'strike') {
    console.log(`\n${ss(b.t).padStart(8)}  HAMLE -> ${N(b.victim)}`);
    console.log(`          hazir olup goz goze bekledigi sure: ${ss(b.waited)}`);
    console.log(`          hamle aninda uzerindeki goz sayisi: ${b.eyes}`);
    console.log(`          hamleyi gorenler: ${b.witnesses.map(N).join(', ')}`);
  }
  if (b.k === 'sleep') console.log(`${ss(b.t).padStart(8)}  ${N(b.victim)} uyudu.`);
}

// Masum bir tanigin penceresi
const st = beats.filter(b => b.k === 'strike');
const sl = beats.filter(b => b.k === 'sleep');
const wit = st[0].witnesses.find(w => w !== st[0].victim && g.players[w].alive);
console.log(`\n${'='.repeat(60)}\nMASUM: ${N(wit)}\n`);
for (let i = 0; i < Math.min(2, sl.length); i++) {
  const s = st.find(x => x.victim === sl[i].victim);
  if (!s) continue;
  const win = [...new Set(seen[wit].filter(x => x.t >= s.t - 200 && x.t <= sl[i].t).map(x => x.a))];
  console.log(`  ${N(sl[i].victim)} uyudu (${ss(sl[i].t)}). Onceki 5 sn'de gordugu bakislar:`);
  console.log(`    ${win.map(N).join(', ')}   -> ${win.length} supheli` +
              (win.includes(K.id) ? '' : '   (uykucu listede DEGIL)'));
}
console.log(`\n  Toplam: ${N(wit)} tum tur boyunca ${seen[wit].length} uykulu bakis gordu.`);
console.log(`  Bunlardan ${seen[wit].filter(x => x.a === K.id).length} tanesi ${N(K.id)}'in.`);
console.log(`  Kacinin hamle oldugu: ${st.filter(s => s.witnesses.includes(wit)).length}\n`);
