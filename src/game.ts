// game.js'ten TypeScript'e tasindi.
//
// Bu sinif TAM GERCEGI tutar. Hicbir sey gizlemez.
// Gizleme tek bir yerde yapilir: viewFor(). Boylece denetlenebilir.
//
// TypeScript'in tek isi burada: PublicEvent tipinde `witnesses` YOK. viewFor()
// ancak PublicEvent uretebilir; gizli tanik listesini kamu paketine koyarsan
// derleyici bagirir. Bu oyunda o hata = oyun oldu.
//
// Tek davranissal degisiklik (rules'in "kuyruk" mekanigini calistirmak icin):
// enterScene() artik accuse() icinde degil tick() icinde cagriliyor. Boylece
// AYNI tick'te gelen iki suclama da queue'ya girer (eskiden ikincisi 'scene'
// fazina takilip reddediliyordu). Matematik ve viewFor degismedi; sahne yalnizca
// ~1 tick geç basliyor — olcum sayilarini etkilemez.

import {
  TUNING, KILL_DELAY_MS, SCENE_MS,
  eyeContact, lightLevel, inCone, stepHeading, seatPositions, rng,
} from './rules.js';

export type Role = 'killer' | 'awake';
export type Phase = 'live' | 'scene' | 'over';

export interface Player {
  id: number;
  name: string;
  x: number;
  y: number;
  heading: number;
  target: number;
  alive: boolean;
  bulletUsed: boolean;
  role: Role;
  noiseIn: number;
  clean?: boolean;
  // Botlar (sim/tune/stall...) buraya _prey/_next gibi alanlar iliştirir; JS
  // scriptlerinde tip denetimi yok, burada index imzasi onlara yer acar.
  [scratch: string]: unknown;
}

interface Pending { victim: number; ms: number; striker: number; }
interface Accusation { accuser: number; target: number; }
interface SceneState { ms: number; accuser: number; target: number; }

// ---- Ic olaylar (GERCEK, witnesses dahil). Bunlar sunucuda kalir. ----
export type GameEvent =
  | { t: 'gaze'; actor: number; variant: number; witnesses: number[] }
  | { t: 'sleep'; victim: number; cause: string }
  | { t: 'scene'; accuser: number; target: number; act: number; correct?: boolean };

// ---- Tel tipleri: PublicState + PrivateState. `witnesses` HICBIRINDE yok. ----
export type Phase_ = Phase;
export interface PublicPlayer {
  id: number;
  heading: number;
  alive: boolean;
  bulletUsed: boolean;
  clean: boolean;
  light: number;
}
export type PublicEvent =
  | { t: 'gaze'; actor: number; variant: number }        // <- witnesses YOK
  | { t: 'sleep'; victim: number; cause: string }
  | { t: 'scene'; accuser: number; target: number; act: number; correct?: boolean };
export interface PrivateMe {
  id: number;
  role: Role;
  alive: boolean;
  cone: number[];               // konimdeki id'ler — sadece bana
  cooldown?: number;            // sadece uykucuya: bekleme (sn)
  eye?: boolean;                // sadece uykucuya: biriyle karşılıklı göz göze mi
  striking?: { victim: number; ms: number }; // uykucuya: yolda olan hamle (kim, kaç ms sonra uyur)
}
export interface PublicState {
  public: PublicPlayer[];
  phase: Phase;
}
export interface PrivateState {
  me: PrivateMe;
  events: PublicEvent[];
}
export type View = PublicState & PrivateState;

export class Game {
  rand: () => number;
  players: Player[];
  phase: Phase = 'live';    // live | scene | over
  cooldown = 0;             // uykucunun beklemesi
  pending: Pending[] = [];  // [{ victim, ms, striker }]
  queue: Accusation[] = []; // [{ accuser, target }]
  scene: SceneState | null = null;
  events: GameEvent[] = []; // bu tick'te olanlar
  gazeQueue: number[] = []; // faz B'de atilacak bakislar
  winner: 'awake' | 'killer' | null = null;
  log: string[] = [];

  // forcedKiller: bots modunda insanın rolü seçmesi için (null = rastgele, normal oyun).
  // rand() yine tüketilir → RNG akışı değişmez, ölçüm scriptleri etkilenmez.
  constructor(names: string[], seed = 1, forcedKiller: number | null = null) {
    this.rand = rng(seed);
    const seats = seatPositions(names.length);
    let killerSeat = Math.floor(this.rand() * names.length);
    if (forcedKiller !== null && forcedKiller >= 0 && forcedKiller < names.length) killerSeat = forcedKiller;

    this.players = names.map((name, i) => ({
      id: i,
      name,
      x: seats[i].x,
      y: seats[i].y,
      heading: Math.atan2(-seats[i].y, -seats[i].x), // merkeze bakarak basla
      target: Math.atan2(-seats[i].y, -seats[i].x),
      alive: true,
      bulletUsed: false,
      role: (i === killerSeat ? 'killer' : 'awake') as Role,
      noiseIn: this.rand() * TUNING.noiseMs,
    }));
  }

  get alive(): Player[] { return this.players.filter(p => p.alive); }
  get killer(): Player | undefined { return this.players.find(p => p.role === 'killer'); }

  aim(id: number, heading: number): void {
    if (this.phase !== 'live') return;      // girdi kilitli
    const p = this.players[id];
    if (p && p.alive) p.target = heading;
  }

  // Uykucunun tek hamlesi. Iki sart.
  strike(id: number, victimId: number): boolean {
    if (this.phase !== 'live') return false;
    const k = this.players[id];
    const v = this.players[victimId];
    if (!k || k.role !== 'killer' || !k.alive) return false;
    if (!v || !v.alive || v === k) return false;
    if (this.cooldown > 0) return false;              // sart 2
    if (!eyeContact(k, v)) return false;              // sart 1
    if (this.pending.some(p => p.victim === victimId)) return false;

    this.cooldown = TUNING.cooldownMs;
    this.pending.push({ victim: victimId, ms: KILL_DELAY_MS, striker: id });
    this.gazeQueue.push(id);            // faz B'de atilacak, gurultuyle ayni kuyrukta
    return true;
  }

  // Kursun. Omurde bir kez, sadece uyanikken.
  // (enterScene BURADA cagrilmiyor — bkz. dosya basi notu. Sadece kuyruga girer.)
  accuse(accuserId: number, targetId: number): boolean {
    if (this.phase !== 'live') return false;           // sahne sirasinda kilitli
    const a = this.players[accuserId];
    const t = this.players[targetId];
    if (!a || !a.alive || a.bulletUsed) return false;
    if (!t || !t.alive || t === a) return false;

    a.bulletUsed = true;                               // kursun aninda yanar
    this.queue.push({ accuser: accuserId, target: targetId });
    return true;
  }

  enterScene(): void {
    this.phase = 'scene';
    this.scene = { ms: SCENE_MS, ...this.queue[0] };
    const { accuser, target } = this.scene;
    this.events.push({ t: 'scene', accuser, target, act: 1 });
  }

  // Herkesin kendi kendine attigi uykulu bakis. Uykucunun hamlesiyle ayni sekil.
  emitGaze(p: Player): void {
    const witnesses = this.players
      .filter(w => w.alive && w !== p && inCone(w, this.players).includes(p))
      .map(w => w.id);
    this.events.push({
      t: 'gaze',
      actor: p.id,
      variant: Math.floor(this.rand() * 3),   // esner / kisar / dalar — kozmetik
      witnesses,                               // sunucuda kalir, filtre bunu kullanir
    });
  }

  tick(dtMs: number): GameEvent[] {
    this.events = [];
    if (this.phase === 'over') return this.events;

    if (this.phase === 'scene') {
      this.scene!.ms -= dtMs;
      if (this.scene!.ms <= 0) this.resolveScene();
      return this.events;                      // her sey donuk
    }

    // phase === 'live': bekleyen suclama varsa masa DONAR, sahne baslar.
    // (Ayni tick'te gelen tum suclamalar zaten queue'da; ilk basan sahneye cikar.)
    if (this.queue.length) {
      this.enterScene();
      return this.events;
    }

    const dt = dtMs / 1000;

    // FAZ A — butun acilar yerlesir. Burada hicbir olay atilmaz.
    for (const p of this.alive) {
      p.heading = stepHeading(p.heading, p.target, dt);
      p.noiseIn -= dtMs;
      if (p.noiseIn <= 0) {
        p.noiseIn = TUNING.noiseMs * (0.6 + this.rand() * 0.8);
        this.gazeQueue.push(p.id);
      }
    }

    // FAZ B — acilar yerlestikten SONRA olaylar atilir.
    // Tanik listesi ancak burada dogru hesaplanabilir.
    for (const id of this.gazeQueue) this.emitGaze(this.players[id]);
    this.gazeQueue = [];

    if (this.cooldown > 0) this.cooldown -= dtMs;

    for (const s of [...this.pending]) {
      s.ms -= dtMs;
      if (s.ms <= 0) {
        this.pending.splice(this.pending.indexOf(s), 1);
        this.putToSleep(s.victim, 'strike');
      }
    }

    this.checkWin();
    return this.events;
  }

  putToSleep(id: number, cause: string): void {
    const p = this.players[id];
    if (!p.alive) return;
    p.alive = false;
    this.events.push({ t: 'sleep', victim: id, cause });
    this.log.push(`${p.name} uyudu (${cause})`);
  }

  resolveScene(): void {
    const { accuser, target } = this.queue.shift()!;
    const t = this.players[target];
    const a = this.players[accuser];

    if (t.role === 'killer') {
      this.events.push({ t: 'scene', accuser, target, act: 3, correct: true });
      this.log.push(`${a.name} -> ${t.name}: DOGRU. Uyaniklar kazandi.`);
      this.phase = 'over';
      this.winner = 'awake';
      this.queue = [];
      return;
    }

    this.events.push({ t: 'scene', accuser, target, act: 3, correct: false });
    this.log.push(`${a.name} -> ${t.name}: yanlis. ${t.name} temiz, ${a.name} uyudu.`);
    t.clean = true;                     // masa artik onu listeden siliyor
    this.putToSleep(accuser, 'bullet');

    if (this.checkWin()) { this.queue = []; return; }
    if (this.queue.length) this.enterScene();   // siradaki suclama — iptal hakki yok
    else { this.phase = 'live'; this.scene = null; }
  }

  checkWin(): boolean {
    if (this.phase === 'over') return true;
    if (this.alive.length <= TUNING.winThreshold) {
      this.phase = 'over';
      this.winner = 'killer';
      this.log.push('Masa 3 kisiye indi. Uykucu kazandi.');
      return true;
    }
    return false;
  }
}

// ---- FILTRE ----
// Tek gizleme noktasi. Buradan sizan bilgi oyunu oldurur.
// Donen tip View = PublicState & PrivateState. `witnesses` tiplerde yok:
// gaze olayini witnesses ile kurmaya kalkarsan derleyici reddeder.

export function viewFor(game: Game, id: number, events: GameEvent[]): View {
  const me = game.players[id];
  const cone = me.alive
    ? inCone(me, game.players).map(p => p.id)
    : game.alive.map(p => p.id);

  const publicPlayers: PublicPlayer[] = game.players.map(p => ({
    id: p.id,
    heading: Math.round(p.heading * 1000) / 1000,
    alive: p.alive,
    bulletUsed: p.bulletUsed,
    clean: !!p.clean,
    light: p.alive ? lightLevel(p, game.players) : 0,
  }));

  const publicEvents: PublicEvent[] = events
    .filter(e => (e.t === 'gaze' ? (me.alive ? e.witnesses.includes(id) : true) : true))
    .map((e): PublicEvent =>
      e.t === 'gaze'
        ? { t: 'gaze', actor: e.actor, variant: e.variant } //  <- witnesses ASLA cikmaz
        : e,
    );

  return {
    // Kamuya acik katman — herkes zaten goruyor, gizlemeye calisma.
    public: publicPlayers,
    phase: game.phase,
    // Sadece bana ait.
    me: {
      id,
      role: me.role,
      alive: me.alive,
      cone,
      cooldown: me.role === 'killer' ? Math.max(0, game.cooldown) : undefined,
      // Uykucuya özel: şu an biriyle karşılıklı göz göze mi? Hamlenin 1. şartı.
      // Sadece uykucunun paketinde; uyanıklar bunu bilirse hamle zamanı sızardı.
      eye: me.role === 'killer'
        ? game.alive.some(p => p !== me && eyeContact(me, p))
        : undefined,
      // Uykucuya özel: yolda olan hamlem (kimi uyuttuğum + kaç ms sonra uyuyacağı).
      // Sadece uykucu görür; sızmaz. Kurbanın uyuması zaten kamuya açık olacak ama
      // "5 sn içinde uyuyacak" ön bilgisi yalnızca hamleyi yapan uykucuya gösterilir.
      striking: me.role === 'killer'
        ? (() => { const p = game.pending.find(x => x.striker === id); return p ? { victim: p.victim, ms: p.ms } : undefined; })()
        : undefined,
    },
    // Olaylar: yuz katmani sadece konimdekiler icin.
    events: publicEvents,
  };
}
