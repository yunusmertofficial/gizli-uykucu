import { Game } from './game.js';
import { TICK_MS, eyeContact, sees } from './rules.js';

// Bekleyen uykucu gercekten kazaniyor mu?
// Acgozlu: goz goze gelir gelmez vur.
// Sabirli: sadece uzerinde en fazla N goz varken vur.

const NAMES = ['Ali', 'Ece', 'Can', 'Deniz', 'Zeynep', 'Burak', 'Mert'];
const CAP = 15 * 60 * 1000;

// Uykucunun uzerindeki goz sayisi (kurban haric — o zaten goz goze).
const eyesOn = (g, k, victim) =>
  g.alive.filter(p => p !== k && p !== victim && sees(p, k)).length;

function play(seed, maxEyes, panic) {
  const g = new Game(NAMES, seed);
  const rand = g.rand;
  let t = 0;

  while (g.phase !== 'over' && t < CAP) {
    for (const p of g.alive) {
      if (p.role === 'killer') {
        const o = g.alive.filter(x => x !== p);
        if (!o.length) continue;
        if (!p._prey || !p._prey.alive) p._prey = o[Math.floor(rand() * o.length)];
        g.aim(p.id, Math.atan2(p._prey.y - p.y, p._prey.x - p.x));
        if (g.cooldown <= 0 && eyeContact(p, p._prey) &&
            eyesOn(g, p, p._prey) <= maxEyes &&
            g.strike(p.id, p._prey.id)) p._prey = null;
      } else {
        p._next = (p._next ?? 0) - TICK_MS;
        if (p._next <= 0) {
          p._next = 2000 + rand() * 4000;
          const o = g.alive.filter(x => x !== p);
          const tt = o[Math.floor(rand() * o.length)];
          if (tt) g.aim(p.id, Math.atan2(tt.y - p.y, tt.x - p.x));
        }
      }
    }
    if (g.phase === 'live' && rand() < panic) {
      const s = g.alive.find(p => !p.bulletUsed && p.role === 'awake');
      const o = s && g.alive.filter(x => x !== s && !x.clean);
      if (s && o.length) g.accuse(s.id, o[Math.floor(rand() * o.length)].id);
    }
    g.tick(TICK_MS);
    t += TICK_MS;
  }
  return { winner: g.winner, ms: t, stalled: g.phase !== 'over' };
}

function run(label, maxEyes, panic) {
  const r = Array.from({ length: 300 }, (_, i) => play(i + 1, maxEyes, panic));
  const done = r.filter(x => !x.stalled);
  const kw = done.filter(x => x.winner === 'killer').length;
  console.log(
    `  ${label.padEnd(22)} uykucu kazanma %${(kw / (done.length || 1) * 100).toFixed(0)}` +
    `  |  ort. tur ${(done.reduce((a, x) => a + x.ms, 0) / (done.length || 1) / 1000).toFixed(0)} sn` +
    `  |  15 dk'da bitmeyen %${(r.filter(x => x.stalled).length / r.length * 100).toFixed(0)}`
  );
}

// panic = uyaniklarin bir tick'te kor kursun sikma olasiligi
for (const [pl, panic] of [['sabirli masa', 0.0004], ['normal masa', 0.0012], ['panik masa', 0.0035]]) {
  console.log(`\n${pl.toUpperCase()}  (kor kursun egilimi ${panic})\n`);
  run('acgozlu uykucu', 99, panic);
  run('sabirli (<=2 goz)', 2, panic);
  run('cok sabirli (<=1 goz)', 1, panic);
  run('hayalet (0 goz)', 0, panic);
}
console.log('');
