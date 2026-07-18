import { Game } from './game.js';
import { TICK_MS, TUNING, eyeContact, sees } from './rules.js';

// Kazanma orani denge verisi degil (botlar konusmuyor).
// Asil metrik: bir olumden sonra taniklarin supheli listesi kac kisilik?
//   1 kisilikse  -> oyun cozulmus, uykucu ilk hamlede yanar
//   cok buyukse  -> uykucu bulunamaz, tanikligin anlami yok

const NAMES = ['Ali', 'Ece', 'Can', 'Deniz', 'Zeynep', 'Burak', 'Mert'];

function botAim(g, p, rand) {
  if (p.role === 'killer') {
    const o = g.alive.filter(x => x !== p);
    if (!o.length) return;
    if (!p._prey || !p._prey.alive) p._prey = o[Math.floor(rand() * o.length)];
    g.aim(p.id, Math.atan2(p._prey.y - p.y, p._prey.x - p.x));
    if (g.cooldown <= 0 && eyeContact(p, p._prey) && g.strike(p.id, p._prey.id)) p._prey = null;
  } else {
    p._next = (p._next ?? 0) - TICK_MS;
    if (p._next <= 0) {
      p._next = 2000 + rand() * 4000;
      const o = g.alive.filter(x => x !== p);
      const t = o[Math.floor(rand() * o.length)];
      if (t) g.aim(p.id, Math.atan2(t.y - p.y, t.x - p.x));
    }
  }
}

function measure(seed) {
  const g = new Game(NAMES, seed);
  const rand = g.rand;
  let t = 0;
  const seen = NAMES.map(() => []);     // her oyuncunun gordugu bakislar: {actor, t}
  const strikes = [];                   // {t, killer, victim, witnesses}
  const out = [];

  while (g.phase !== 'over' && t < 10 * 60 * 1000) {
    for (const p of g.alive) botAim(g, p, rand);
    const events = g.tick(TICK_MS);
    t += TICK_MS;

    for (const e of events) {
      if (e.t === 'gaze') {
        for (const w of e.witnesses) seen[w].push({ actor: e.actor, t });
        if (g.pending.some(s => s.striker === e.actor && s.ms > 4900))
          strikes.push({ t, killer: e.actor, witnesses: e.witnesses });
      }
      if (e.t === 'sleep' && e.cause === 'strike') {
        const s = strikes[strikes.length - 1];
        if (!s) continue;
        // Hamleyi goren, hala ayakta olan herkes icin:
        for (const w of s.witnesses) {
          if (!g.players[w].alive) continue;
          // 5 sn'lik pencerede bu tanigin gordugu FARKLI bakan sayisi
          const win = seen[w].filter(x => x.t >= s.t - 200 && x.t <= t);
          const suspects = new Set(win.map(x => x.actor));
          out.push({ n: suspects.size, hasKiller: suspects.has(s.killer) });
        }
        out.push({ noWitness: s.witnesses.filter(w => g.players[w].alive).length === 0 });
      }
    }
  }
  return out;
}

function sweep(label, apply) {
  apply();
  const all = [];
  for (let s = 0; s < 400; s++) all.push(...measure(s + 1));
  const wit = all.filter(x => x.n !== undefined);
  const deaths = all.filter(x => x.noWitness !== undefined);
  const blind = deaths.filter(x => x.noWitness).length;
  const avg = wit.reduce((a, x) => a + x.n, 0) / (wit.length || 1);
  const solo = wit.filter(x => x.n === 1).length / (wit.length || 1);
  console.log(
    `  ${label.padEnd(16)} supheli listesi: ${avg.toFixed(2)} kisi` +
    `   |  tek suphelı: %${(solo * 100).toFixed(0)}` +
    `   |  taniksiz olum: %${(blind / (deaths.length || 1) * 100).toFixed(0)}`
  );
}

const base = { ...TUNING };
console.log('\nGURULTU SIKLIGI (hamle gecikmesi sabit 5 sn)\n');
for (const ms of [2000, 4000, 6000, 9000, 15000])
  sweep(`gurultu ${ms / 1000} sn`, () => Object.assign(TUNING, base, { noiseMs: ms }));

console.log('\nKONI GENISLIGI (gurultu 6 sn)\n');
for (const deg of [70, 90, 110, 140, 180])
  sweep(`koni ${deg}\u00b0`, () => Object.assign(TUNING, base, { coneDeg: deg }));
console.log('');
