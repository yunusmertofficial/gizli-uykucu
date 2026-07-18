import { Game } from './game.js';
import { TICK_MS, eyeContact, sees } from './rules.js';

const NAMES = ['Ali', 'Ece', 'Can', 'Deniz', 'Zeynep', 'Burak', 'Mert'];

function bots(g, rand) {
  for (const p of g.alive) {
    if (p.role === 'killer') {
      const o = g.alive.filter(x => x !== p);
      if (!o.length) continue;
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
}

// Bir tur oynat, her oyuncunun NE GORDUGUNU kaydet.
function trace(seed) {
  const g = new Game(NAMES, seed);
  const rand = g.rand;
  const seen = NAMES.map(() => []);      // [{actor, t}]
  const beats = [];
  let t = 0;

  while (g.phase !== 'over' && t < 6 * 60 * 1000) {
    bots(g, rand);
    const events = g.tick(TICK_MS);
    t += TICK_MS;

    for (const e of events) {
      if (e.t === 'gaze') {
        for (const w of e.witnesses) seen[w].push({ actor: e.actor, t });
        const s = g.pending.find(x => x.striker === e.actor && x.ms > 4900);
        if (s) beats.push({ kind: 'strike', t, killer: e.actor, victim: s.victim,
                            witnesses: [...e.witnesses] });
      }
      if (e.t === 'sleep' && e.cause === 'strike') {
        const s = [...beats].reverse().find(b => b.kind === 'strike' && b.victim === e.victim);
        if (!s) continue;
        const lists = {};
        for (const w of s.witnesses) {
          if (!g.players[w].alive) continue;
          lists[w] = [...new Set(seen[w].filter(x => x.t >= s.t - 200 && x.t <= t)
                                        .map(x => x.actor))];
        }
        beats.push({ kind: 'sleep', t, victim: e.victim, strikeT: s.t, lists });
      }
    }
  }
  return { g, beats };
}

// Iki hamleyi birden goren bir tanigi olan tur bul.
let found = null;
for (let s = 1; s < 400 && !found; s++) {
  const { g, beats } = trace(s);
  const sleeps = beats.filter(b => b.kind === 'sleep');
  if (sleeps.length < 2) continue;
  const both = Object.keys(sleeps[0].lists).filter(w => w in sleeps[1].lists);
  for (const w of both) {
    const inter = sleeps[0].lists[w].filter(x => sleeps[1].lists[w].includes(x));
    if (inter.length <= 2 && sleeps[0].lists[w].length >= 3) {
      found = { seed: s, g, beats, w: +w, inter }; break;
    }
  }
}

const { g, beats, w, inter } = found;
const N = i => g.players[i].name;
const ss = ms => (ms / 1000).toFixed(1).padStart(5) + ' sn';

console.log(`\nseed ${found.seed}  —  uykucu: ${N(g.killer.id)}  (kimse bilmiyor)\n`);
console.log(`Takipteki tanik: ${N(w)}\n${'-'.repeat(58)}`);

for (const b of beats.filter(x => x.kind === 'sleep').slice(0, 2)) {
  const s = beats.find(x => x.kind === 'strike' && x.t === b.strikeT);
  console.log(`\n${ss(s.t)}  ${N(s.killer)} -> ${N(s.victim)} goz goze. HAMLE.`);
  console.log(`         gorenler: ${s.witnesses.map(N).join(', ') || '(kimse)'}`);
  console.log(`         gorulen sey: uykulu bir bakis. Gurultuyle ayni.`);
  console.log(`${ss(b.t)}  ${N(b.victim)} uyudu.`);
  if (b.lists[w]) {
    console.log(`\n         ${N(w)}'in 5 sn'lik penceresi:`);
    for (const a of b.lists[w]) console.log(`           - ${N(a)} uykulu baktı`);
    console.log(`         => ${b.lists[w].length} supheli. Hangisi oldugu belirsiz.`);
  } else console.log(`         ${N(w)} hicbir sey gormedi.`);
}

console.log(`\n${'-'.repeat(58)}`);
const L = beats.filter(x => x.kind === 'sleep').slice(0, 2).map(b => b.lists[w]);
console.log(`\n${N(w)}'in kesisimi:`);
console.log(`  1. olum: { ${L[0].map(N).join(', ')} }`);
console.log(`  2. olum: { ${L[1].map(N).join(', ')} }`);
console.log(`  kesisim: { ${inter.map(N).join(', ')} }   <- uykucu: ${N(g.killer.id)}`);
console.log(`\n  Dogru mu: ${inter.includes(g.killer.id) ? 'EVET, listede' : 'HAYIR, kacirdi'}`);
console.log(`  Kesin mi: ${inter.length === 1 ? 'evet, tek isim' : 'hayir, ' + inter.length + ' isim kaldi'}\n`);

// Iki olumden sonra AYAKTA olan herkes ne biliyor?
const S = beats.filter(x => x.kind === 'sleep').slice(0, 2);
const survivors = g.players.filter(p =>
  !S.some(b => b.victim === p.id) && p.id !== g.killer.id);

console.log(`\nIki olumden sonra ayakta olan uyaniklar ne biliyor:\n`);
for (const p of survivors) {
  const a = S[0].lists[p.id], b = S[1].lists[p.id];
  if (!a && !b) { console.log(`  ${N(p.id).padEnd(7)} hicbirini gormedi. Sifir bilgi.`); continue; }
  if (!a || !b) {
    const one = a || b;
    console.log(`  ${N(p.id).padEnd(7)} sadece birini gordu: { ${one.map(N).join(', ')} }`);
    continue;
  }
  const x = a.filter(i => b.includes(i));
  console.log(`  ${N(p.id).padEnd(7)} { ${a.map(N).join(', ')} } n { ${b.map(N).join(', ')} }` +
              ` = { ${x.map(N).join(', ')} }` +
              (x.length === 1 && x[0] === g.killer.id ? '   <- BULDU' : ''));
}
console.log(`\nSonuc: ${g.winner === 'awake' ? 'uyaniklar' : 'uykucu'} kazandi.`);
console.log(`(Botlar konusmuyor ve bildiklerini kullanmiyor. Bilgi masadaydi, kimse almadi.)\n`);
