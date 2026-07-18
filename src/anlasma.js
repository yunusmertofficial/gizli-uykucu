import { Game } from './game.js';
import { TICK_MS, eyeContact } from './rules.js';

// "Kimse kimseye bakmasin" anlasmasi kac kisi gerektiriyor?
// Disiplinli oyuncu: bos bir noktaya bakar, kimseyle goz goze gelmez.
// Uykucu her zaman normal oynar (avlanmak zorunda).

const NAMES = ['Ali', 'Ece', 'Can', 'Deniz', 'Zeynep', 'Burak', 'Mert'];
const CAP = 10 * 60 * 1000;

function play(seed, nDisciplined, panic) {
  const g = new Game(NAMES, seed);
  const rand = g.rand;
  let t = 0, strikes = 0;

  // Uykucu disinda ilk N uyanik disiplinli.
  const disciplined = new Set(
    g.players.filter(p => p.role !== 'killer').slice(0, nDisciplined).map(p => p.id)
  );

  while (g.phase !== 'over' && t < CAP) {
    for (const p of g.alive) {
      if (p.role === 'killer') {
        const o = g.alive.filter(x => x !== p);
        if (!o.length) continue;
        if (!p._prey || !p._prey.alive) p._prey = o[Math.floor(rand() * o.length)];
        g.aim(p.id, Math.atan2(p._prey.y - p.y, p._prey.x - p.x));
        if (g.cooldown <= 0 && eyeContact(p, p._prey) && g.strike(p.id, p._prey.id)) {
          strikes++; p._prey = null;
        }
      } else if (disciplined.has(p.id)) {
        // Halkanin disina, kimsenin olmadigi yone bak. Sabit.
        g.aim(p.id, Math.atan2(p.y, p.x));
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
  return { winner: g.winner, ms: t, stalled: g.phase !== 'over', strikes };
}

for (const [label, panic] of [['KURSUN SIKAN MASA', 0.0012], ['KURSUN SIKMAYAN MASA', 0]]) {
  console.log(`\n${label}\n`);
  console.log('  disiplinli   uykucu     10 dk\'da      ort. hamle    ort. tur');
  console.log('  /6 uyanik    kazanma    bitmeyen      sayisi');
  console.log('  ' + '-'.repeat(58));
  for (let n = 0; n <= 6; n++) {
    const r = Array.from({ length: 250 }, (_, i) => play(i + 1, n, panic));
    const done = r.filter(x => !x.stalled);
    const kw = done.filter(x => x.winner === 'killer').length;
    const st = r.filter(x => x.stalled).length;
    console.log(
      `  ${String(n).padStart(4)}         ` +
      `%${String(Math.round(kw / (done.length || 1) * 100)).padStart(3)}       ` +
      `%${String(Math.round(st / r.length * 100)).padStart(3)}          ` +
      `${(r.reduce((a, x) => a + x.strikes, 0) / r.length).toFixed(2).padStart(5)}         ` +
      `${done.length ? (done.reduce((a, x) => a + x.ms, 0) / done.length / 1000).toFixed(0) + ' sn' : '—'}`
    );
  }
}
console.log('');
