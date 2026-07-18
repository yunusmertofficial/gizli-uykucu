// Sunucu: Node + ws. Framework yok, Express bile yok.
//
// Otoriter dongu: her tick her oyuncu icin viewFor() cagirilir ve YALNIZ o
// oyuncuya gonderilir. Gizli bilgi (tanik listeleri) sunucuda kalir.
//
// Tel protokolu (icat degil, gorevden birebir):
//   istemci -> sunucu : { t:'aim', h }          { t:'accuse', target }
//   sunucu -> istemci : { t:'welcome', id, seats, names }
//                       { t:'state', ...viewFor }      (15Hz)
//                       { t:'over', winner, killer }
//                       { t:'wait', code, have, need } (lobi)
//
// Uykucunun hamlesi ('strike') telde YOK — tasarim geregi ozel dugme yok.
// Sunucu, uykucu icin goz goze + bekleme bittiginde OTOMATIK ates eder;
// uykucunun tek denetimi 'aim'. Boylece hamle gurultuden ayirt edilemez kalir.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { Game, viewFor, Player } from './game.js';
import { TICK_MS, eyeContact, angleDiff, seatPositions, TUNING } from './rules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 3000;
const SEATS = 7;
const NAMES_POOL = ['Ali', 'Ece', 'Can', 'Deniz', 'Zeynep', 'Burak', 'Mert'];
const PANIC_P = 0.0012; // bot uyaniklarin tick basina kor kursun egilimi

// ---------------------------------------------------------------- statik dosya
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/sahne-fp.html';
  const file = path.join(PUBLIC, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403).end('403'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('404'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(buf);
  });
});

// ---------------------------------------------------------------- oda / lobi
interface BotScratch { prey?: Player; next?: number; }
interface Member { ws: WebSocket | null; name: string; bot: boolean; }

class Room {
  code: string;
  members: Member[] = [];
  game: Game | null = null;
  started = false;
  timer: NodeJS.Timeout | null = null;
  scratch = new Map<number, BotScratch>();
  killerArmed = -1;                 // insan uykucunun seçtiği kurban (tıkla = uyut)

  constructor(code: string) { this.code = code; }

  armStrike(id: number, target: number): void {
    // Yalnız uykucu kurban seçebilir. Uyutma göz göze + bekleme dolunca gerçekleşir.
    if (this.game && this.game.killer?.id === id) this.killerArmed = target;
  }

  // Yazışma — sesli kuralın aynısı: ölü, canlılara yazamaz; kendi arasında (rüya) yazar.
  chat(id: number, raw: string): void {
    const text = String(raw).replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!text) return;
    const from = this.members[id]?.name ?? 'oyuncu';
    let channel: 'lobby' | 'live' | 'dead' = 'lobby';
    let reaches = (_mid: number) => true;                    // lobide herkes
    if (this.started && this.game) {
      const senderAlive = this.game.players[id]?.alive ?? false;
      channel = senderAlive ? 'live' : 'dead';
      reaches = (mid) => (this.game!.players[mid]?.alive ?? false) === senderAlive;
    }
    const payload = JSON.stringify({ t: 'chat', from, text, channel });
    for (let mid = 0; mid < this.members.length; mid++) {
      const m = this.members[mid];
      if (m.bot || !m.ws || m.ws.readyState !== WebSocket.OPEN) continue;
      if (reaches(mid)) m.ws.send(payload);
    }
  }

  get count() { return this.members.length; }
  get full() { return this.members.length >= SEATS; }

  addHuman(ws: WebSocket, name: string): number {
    const id = this.members.length;
    this.members.push({ ws, name: name || NAMES_POOL[id] || `P${id}`, bot: false });
    return id;
  }
  addBots(n: number): void {
    while (n-- > 0 && !this.full) {
      const id = this.members.length;
      this.members.push({ ws: null, name: NAMES_POOL[id] || `Bot${id}`, bot: true });
    }
  }

  // Lobi durumu: oda kodu + katılanlar. Kurucu (index 0) başlatabilir.
  broadcastLobby(): void {
    const players = this.members.filter(m => !m.bot).map(m => m.name);
    for (let id = 0; id < this.members.length; id++) {
      if (this.members[id].bot) continue;
      this.members[id].ws?.send(JSON.stringify({
        t: 'lobby', code: this.code, players, you: id, host: id === 0,
        count: players.length, max: SEATS,
      }));
    }
  }

  start(forcedKiller: number | null = null): void {
    if (this.started) return;
    this.started = true;
    const names = this.members.map(m => m.name);
    const seed = Math.floor(Math.random() * 0x7fffffff);
    this.game = new Game(names, seed, forcedKiller);

    const seats = seatPositions(SEATS);
    for (let id = 0; id < this.members.length; id++) {
      this.members[id].ws?.send(JSON.stringify({ t: 'welcome', id, seats, names }));
    }
    this.timer = setInterval(() => this.step(), TICK_MS);
  }

  private step(): void {
    const g = this.game!;
    if (g.phase === 'over') return;

    // 1) Bot kararlari (aim). Uykucu bot sadece nisan alir; ates otomatik.
    if (g.phase === 'live') {
      for (let id = 0; id < this.members.length; id++) {
        if (!this.members[id].bot) continue;
        const p = g.players[id];
        if (p.alive) this.botAim(g, p);
      }
      // Bot uyaniklarin nadir kor kursunu (insan kendi karar verir).
      if (g.rand() < PANIC_P) {
        const shooter = g.alive.find(p =>
          this.members[p.id].bot && p.role === 'awake' && !p.bulletUsed);
        if (shooter) {
          const opts = g.alive.filter(x => x !== shooter && !x.clean);
          if (opts.length) g.accuse(shooter.id, opts[Math.floor(g.rand() * opts.length)].id);
        }
      }
      // 2) Uykucunun otomatik hamlesi (insan ya da bot fark etmez).
      this.autoStrike(g);
    }

    // 3) Otoriter tick.
    const events = g.tick(TICK_MS);

    // 4) Her insana KENDI paketi.
    for (let id = 0; id < this.members.length; id++) {
      const ws = this.members[id].ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) continue;
      ws.send(JSON.stringify({ t: 'state', ...viewFor(g, id, events) }));
    }

    if (g.winner !== null) {   // winner yalniz oyun bittiginde set edilir
      const payload = JSON.stringify({ t: 'over', winner: g.winner, killer: g.killer?.id });
      for (const m of this.members) {
        if (m.ws && m.ws.readyState === WebSocket.OPEN) m.ws.send(payload);
      }
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    }
  }

  private botAim(g: Game, p: Player): void {
    let sc = this.scratch.get(p.id);
    if (!sc) { sc = {}; this.scratch.set(p.id, sc); }
    if (p.role === 'killer') {
      const o = g.alive.filter(x => x !== p);
      if (!o.length) return;
      if (!sc.prey || !sc.prey.alive) sc.prey = o[Math.floor(g.rand() * o.length)];
      g.aim(p.id, Math.atan2(sc.prey.y - p.y, sc.prey.x - p.x));
    } else {
      sc.next = (sc.next ?? 0) - TICK_MS;
      if (sc.next <= 0) {
        sc.next = 2000 + g.rand() * 4000;
        const o = g.alive.filter(x => x !== p);
        const t = o[Math.floor(g.rand() * o.length)];
        if (t) g.aim(p.id, Math.atan2(t.y - p.y, t.x - p.x));
      }
    }
  }

  // Uykucunun hamlesi: göz göze + bekleme bitince kurban uyur.
  //   BOT uykucu  -> en doğru nişan aldığı, göz göze olan kurbanı otomatik seçer.
  //   İNSAN uykucu -> yalnızca kendi TIKLAYIP seçtiği kurbanı (killerArmed) uyutur.
  private autoStrike(g: Game): void {
    if (g.cooldown > 0) return;
    const k = g.killer;
    if (!k || !k.alive) return;
    const killerIsBot = this.members[k.id]?.bot;
    let victim = -1;
    if (killerIsBot) {
      let best = Infinity;
      for (const v of g.alive) {
        if (v === k || g.pending.some(s => s.victim === v.id) || !eyeContact(k, v)) continue;
        const d = angleDiff(k.heading, Math.atan2(v.y - k.y, v.x - k.x));
        if (d < best) { best = d; victim = v.id; }
      }
    } else if (this.killerArmed >= 0) {
      const t = g.players[this.killerArmed];
      if (t && t.alive && t !== k && !g.pending.some(s => s.victim === t.id) && eyeContact(k, t))
        victim = t.id;
    }
    if (victim >= 0) g.strike(k.id, victim);
  }

  removeHumanBySocket(ws: WebSocket): void {
    if (this.started) {
      for (const m of this.members) if (m.ws === ws) m.ws = null;
      // Tüm insanlar ayrıldıysa odayı temizle (bellekte birikmesin).
      if (this.members.every(m => m.bot || !m.ws)) {
        if (this.timer) clearInterval(this.timer);
        rooms.delete(this.code);
      }
      return;
    }
    // Lobide: çıkanı sil, kalanlara güncel listeyi yolla, oda boşsa sil.
    const idx = this.members.findIndex(m => m.ws === ws);
    if (idx >= 0) this.members.splice(idx, 1);
    if (this.members.length === 0) rooms.delete(this.code);
    else this.broadcastLobby();
  }
}

const rooms = new Map<string, Room>();

function newCode(): string {
  let c: string;
  do { c = String(Math.floor(100000 + Math.random() * 900000)); } while (rooms.has(c));
  return c;
}

// ---------------------------------------------------------------- ws
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const q = new URL(req.url ?? '/', 'http://localhost').searchParams;
  const name = (q.get('name') ?? '').slice(0, 16);
  const bots = Math.max(0, Math.min(SEATS - 1, Number(q.get('bots')) || 0));
  const create = q.get('create') === '1';
  const wanted = q.get('room');

  let room: Room;
  if (bots > 0) {
    // Botlarla tek başına: yeni oda, doldur, hemen başla. İstenirse rol seçilir.
    room = new Room(newCode());
    rooms.set(room.code, room);
    room.addHuman(ws, name);   // insan = koltuk 0
    room.addBots(bots);
    const role = q.get('role');
    let forced: number | null = null;
    if (role === 'killer') forced = 0;                                          // insan uykucu
    else if (role === 'awake') forced = 1 + Math.floor(Math.random() * (room.count - 1)); // bir bot uykucu
    room.start(forced);
  } else if (create) {
    // Oda kur: kurucu = ilk üye (index 0). Başlatmayı kurucu tetikler.
    room = new Room(newCode());
    rooms.set(room.code, room);
    room.addHuman(ws, name);
    room.broadcastLobby();
  } else if (wanted && rooms.has(wanted) && !rooms.get(wanted)!.started && !rooms.get(wanted)!.full) {
    // Odaya katıl.
    room = rooms.get(wanted)!;
    room.addHuman(ws, name);
    room.broadcastLobby();
  } else {
    ws.send(JSON.stringify({ t: 'error', msg: wanted ? 'Oda bulunamadı, dolu ya da başlamış.' : 'Geçersiz istek.' }));
    ws.close();
    return;
  }

  const R = room;
  ws.on('message', (data) => {
    let msg: unknown;
    try { msg = JSON.parse(String(data)); } catch { return; }
    if (typeof msg !== 'object' || msg === null) return;
    const m = msg as { t?: string; h?: number; target?: number; text?: string };

    // Lobi: yalnız kurucu (index 0) başlatır; boş koltuklar bota dönüşür.
    if (m.t === 'start') {
      if (!R.started && R.members[0]?.ws === ws) { R.addBots(SEATS - R.count); R.start(); }
      return;
    }
    // id'yi dinamik bul (lobi çıkışları indeksleri kaydırabilir; oyun başlayınca sabit).
    const myId = R.members.findIndex(mem => mem.ws === ws);
    if (myId < 0) return;
    if (m.t === 'chat' && typeof m.text === 'string') { R.chat(myId, m.text); return; }  // lobide de çalışır
    if (!R.game) return;
    // Girdi doğrulaması game.ts içinde: sahnede reddedilir, ölü gönderemez, kurşun bir kez.
    if (m.t === 'aim' && typeof m.h === 'number') R.game.aim(myId, m.h);
    else if (m.t === 'accuse' && typeof m.target === 'number') R.game.accuse(myId, m.target);
    else if (m.t === 'strike' && typeof m.target === 'number') R.armStrike(myId, m.target); // uykucu: uyut
  });

  ws.on('close', () => R.removeHumanBySocket(ws));
  ws.on('error', () => { /* yut */ });
});

server.listen(PORT, () => {
  console.log(`Gizli Uykucu sunucu:  http://localhost:${PORT}`);
  console.log(`  botlarla:   http://localhost:${PORT}/?bots=6`);
  console.log(`  oda kur:    ?create=1   ·   odaya katıl: ?room=KOD   (istemci lobisinden)`);
  console.log(`  TUNING:`, TUNING);
});
