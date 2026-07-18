import { Game, viewFor } from './game.js';
import { TICK_MS, TUNING, eyeContact, sees } from './rules.js';

const NAMES = ['Ali', 'Ece', 'Can', 'Deniz', 'Zeynep', 'Burak', 'Mert'];

function botAim(g, p, rand) {
  if (p.role === 'killer') {
    // Kurbani sec, ona bak, goz goze gelmeyi bekle.
    const targets = g.alive.filter(x => x !== p);
    if (!targets.length) return;
    if (!p._prey || !p._prey.alive) p._prey = targets[Math.floor(rand() * targets.length)];
    g.aim(p.id, Math.atan2(p._prey.y - p.y, p._prey.x - p.x));
    if (g.cooldown <= 0 && eyeContact(p, p._prey)) {
      if (g.strike(p.id, p._prey.id)) p._prey = null;
    }
    return;
  }
  // Uyanik: birkac saniyede bir baskasina bak.
  p._next = (p._next ?? 0) - TICK_MS;
  if (p._next <= 0) {
    p._next = 2000 + rand() * 4000;
    const others = g.alive.filter(x => x !== p);
    const t = others[Math.floor(rand() * others.length)];
    if (t) g.aim(p.id, Math.atan2(t.y - p.y, t.x - p.x));
  }
}

function run(seed) {
  const g = new Game(NAMES, seed);
  const rand = g.rand;
  let t = 0, leaks = 0;

  console.log(`--- tur (seed ${seed}) --- uykucu gizli, 7 kisi\n`);

  while (g.phase !== 'over' && t < 15 * 60 * 1000) {
    for (const p of g.alive) botAim(g, p, rand);

    // Uyaniklardan biri nadiren dayanamaz ve kursununu ceker.
    if (g.phase === 'live' && rand() < 0.0012) {
      const shooter = g.alive.find(p => !p.bulletUsed && p.role === 'awake');
      const opts = shooter && g.alive.filter(x => x !== shooter && !x.clean);
      if (shooter && opts.length) g.accuse(shooter.id, opts[Math.floor(rand() * opts.length)].id);
    }

    const events = g.tick(TICK_MS);

    // SIZINTI TESTI: konimin disindaki kimsenin yuz olayi bana ulasmamali.
    for (const p of g.alive) {
      const v = viewFor(g, p.id, events);
      if (v.me.role !== 'killer' && v.me.cooldown !== undefined) leaks++;
      for (const e of v.events) {
        if (e.t !== 'gaze' || e.actor === p.id) continue;
        if (!sees(p, g.players[e.actor])) leaks++;
        if ('witnesses' in e) leaks++;
      }
    }
    t += TICK_MS;
  }

  const k = g.killer;
  console.log(g.log.map(l => '  ' + l).join('\n'));
  console.log(`\n  Uykucu: ${k.name}  |  Kazanan: ${g.winner}  |  Sure: ${(t / 1000).toFixed(0)} sn`);
  console.log(`  Sizinti: ${leaks}\n`);
  return { winner: g.winner, ms: t, leaks };
}

const results = [1, 2, 3].map(run);

console.log('=== 200 tur, denge ===');
const many = Array.from({ length: 200 }, (_, i) => {
  const g = new Game(NAMES, i + 100);
  const rand = g.rand;
  let t = 0;
  while (g.phase !== 'over' && t < 15 * 60 * 1000) {
    for (const p of g.alive) botAim(g, p, rand);
    if (g.phase === 'live' && rand() < 0.0012) {
      const s = g.alive.find(p => !p.bulletUsed && p.role === 'awake');
      const o = s && g.alive.filter(x => x !== s && !x.clean);
      if (s && o.length) g.accuse(s.id, o[Math.floor(rand() * o.length)].id);
    }
    g.tick(TICK_MS);
    t += TICK_MS;
  }
  return { winner: g.winner, ms: t };
});

const kw = many.filter(r => r.winner === 'killer').length;
const avg = many.reduce((a, r) => a + r.ms, 0) / many.length / 1000;
console.log(`  Uykucu kazanma: ${kw}/200 (%${(kw / 2).toFixed(0)})`);
console.log(`  Ortalama tur:   ${avg.toFixed(0)} sn`);
console.log(`  Toplam sizinti: ${results.reduce((a, r) => a + r.leaks, 0)}`);
