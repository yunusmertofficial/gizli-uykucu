// Gizli Uykucu — kurallar ve geometri.
// Bu dosyada ag yok, ekran yok, zaman yok. Sadece saf fonksiyonlar.
//
// rules.js'ten TypeScript'e tasindi. MATEMATIK BIREBIR AYNI — sadece tipler eklendi.
// TUNING mutable birakildi: tune.js Object.assign ile uzerine yaziyor.

export const TAU = Math.PI * 2;

// Ayarlanacak dort sayi (dokumandan).
export const TUNING = {
  coneDeg: 110,      // dar = uyaniklar lehine
  noiseMs: 6000,     // sik = hamle kaybolur, uykucu lehine
  cooldownMs: 45000, // kisa = uykucu hizli toplar
  winThreshold: 3,   // masa buraya inerse uykucu kazanir
};

// Sabit iki sayi.
export const KILL_DELAY_MS = 5000;
export const SCENE_MS = 5000;

export const TICK_HZ = 15;
export const TICK_MS = 1000 / TICK_HZ;

// Kafa donus hizi: aninda degil, yumusak. rad/sn.
export const TURN_RATE = 2.2;

export const halfCone = (): number => (TUNING.coneDeg / 2) * Math.PI / 180;

// Geometri icin yeterli yapisal tipler (game.ts'deki Player bunlari saglar).
export interface Point { x: number; y: number; heading: number; }
export interface Body extends Point { alive: boolean; }

// Iki aci arasindaki en kisa fark, her zaman [0, PI].
export function angleDiff(a: number, b: number): number {
  return Math.abs(((a - b + Math.PI) % TAU + TAU) % TAU - Math.PI);
}

// a, b: { x, y, heading }
// a'nin konisi b'yi kapsiyor mu?
export function sees(a: Point, b: Point): boolean {
  const bearing = Math.atan2(b.y - a.y, b.x - a.x);
  return angleDiff(a.heading, bearing) < halfCone();
}

// Karsilikli. Uykucunun hamlesinin birinci sarti.
export function eyeContact(a: Point, b: Point): boolean {
  return sees(a, b) && sees(b, a);
}

// Kac kisinin konisindesin. Isik bu.
export function lightLevel<T extends Body>(target: T, players: T[]): number {
  return players.filter(p => p !== target && p.alive && sees(p, target)).length;
}

// Konindeki herkes. Yuz katmani sadece bunlar icin gonderilir.
export function inCone<T extends Body>(viewer: T, players: T[]): T[] {
  return players.filter(p => p !== viewer && p.alive && sees(viewer, p));
}

// Aciyi hedefe dogru en kisa yoldan yaklastir.
export function stepHeading(current: number, target: number, dt: number): number {
  const delta = ((target - current + Math.PI) % TAU + TAU) % TAU - Math.PI;
  const maxStep = TURN_RATE * dt;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

// Sandalyeler sabit. Halka, esit aralikli, ilk koltuk altta.
export function seatPositions(n: number, radius = 100): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const a = Math.PI / 2 + (i / n) * TAU;
    return { x: Math.cos(a) * radius, y: Math.sin(a) * radius };
  });
}

// Tohumlu RNG — testler tekrarlanabilir olsun diye.
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
