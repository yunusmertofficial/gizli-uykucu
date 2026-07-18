# Gizli Uykucu — mühendislik planı

`gizli-uykucu-kurallar.md` oyunu tarif ediyor. Bu dosya onu nasıl yapacağını tarif ediyor.

Tek geliştirici, akşam mesaisi. Tarihler yok, sıra var.

---

## Asıl soru

Dokümanının son satırında yazıyor: **bakış izlemek eğlenceli mi?**

Bu plandaki her karar o soruya en ucuz yoldan ulaşmak için verildi. Cevap "hayır" çıkarsa, bu plandaki işlerin %80'ini hiç yapmamış olacaksın. Bu bir kayıp değil, planın amacı.

---

## Stack

| Katman | Seçim | Neden |
|---|---|---|
| Dil | TypeScript, iki tarafta | Bitiş noktası web (Discord iframe + Capacitor). İstemci zorunlu JS. İki dil taşımanın maliyeti, kazanmadığın hızdan pahalı. |
| Sunucu | Node + `ws` | Framework yok. Express bile gerekmiyor. |
| Render | Three.js | Motor yok. Sahnen 7 silindir; Unity'nin çözdüğü problemlerin %95'i sende yok. |
| Ses | v0'da Discord, sonra karar | Agora dakika başı ödemeli. Discord Activity'de bedava. |
| Paketleme | Capacitor | Aynı `dist/` hem Discord Activity hem Play Store AAB. |
| Deploy | v0: localhost + ngrok | Prod: tek küçük VPS (~10$/ay). |

**Reddedilenler ve sebepleri** — bunları tekrar tartışma, karar verildi:

- **Flutter / React Native** — native arayüz problemini çözüyorlar. Sende native arayüz yok, tek canvas var. AAB için de gerekmiyorlar; AAB Gradle'ın çıktısı, her yol onu üretir.
- **Unity** — asset pipeline'ı gerçek bir koz. Ama değeri 3D karmaşıklığınla orantılı ve seninki sıfıra yakın. Build 5-20MB (Three.js ~600KB), iterasyon yavaş. **Yeniden bak:** çizerle anlaşıp elinde riglenmiş gerçek karakterler olduğu gün. O zaman gerçek bir gereksinim listen olur; bugün yok.
- **Cocos / Godot / Colyseus / Socket.io** — çözdükleri problemler senin problemin değil, sadece katman ekliyorlar.

---

## Mimari — üç kural

### 1. Sunucu otoriter, her oyuncuya farklı paket

Herkese aynı paketi atıp istemcide filtreleme **yapma.** Oyunun bütün sırrı "kim uykulu bakıyor" bilgisinde; tarayıcıya giderse biri devtools açar ve her turu kazanır.

- **Herkese:** kafa açıları, ışık, kim uyudu, kim suçladı → zaten kamuya açık, gizlemeye çalışma.
- **Sadece o oyuncuya:** konisindeki kişilerin yüz olayları.

Koninin dışındakinin yüz eventi sunucudan **hiç çıkmaz.**

### 2. `viewFor()` tek gizleme noktası

Kod tabanında gizli bilgiyle ilgili başka yer yok. Denetlemen gereken 20 satır var, 2000 değil. `witnesses` listesi sunucuda hesaplanır ve orada ölür.

TypeScript'te `PublicState` ve `PrivateState` diye iki tip tanımla — gizli alanı kamu paketine koyduğunda derleyici bağırsın. Bu oyunda o hata = oyun ölür.

### 3. Tick iki fazlı

```
FAZ A — bütün açılar yerleşir. Hiçbir olay atılmaz.
FAZ B — açılar yerleştikten SONRA olaylar atılır. Tanık listesi ancak burada doğru.
```

**Bu bir tercih değil, bug fix.** Tek fazda yazarsan tanık listesi bayat açılarla hesaplanır: bazı bakışlar konide olmayan birine gider, bazıları konide olana gitmez. Tanıklık sistemi çöker.

Bedava garanti: uykucunun hamlesi de gürültüyle **aynı kuyruğa** girer, aynı kod yolundan çıkar. Ayrı yollardan çıksalardı er ya da geç birinde bir tick farkı olur ve oyun sızardı.

---

## Sıra

### 1 — Sunucu, ekran yok ✅

`rules.js` (saf geometri), `game.js` (state machine + `viewFor`), `sim.js` (7 bot).

`sim.js` içindeki **sızıntı testini silme.** İlk çalıştırmada gerçek bir bug yakaladı (yukarıdaki iki fazlı tick). Her değişiklikten sonra çalıştır.

Bot sayıları (%60 uykucu, 84 sn tur) **denge verisi değil** — botlar konuşmuyor. Söyledikleri tek şey: oyun bitiyor, iki taraf da kazanabiliyor, kilitlenmiyor. Adımın işi buydu.

### 2 — Sahne ✅

`sahne.html` (tepeden), `sahne-fp.html` (birinci şahıs).

`createCharacter()` dört şey döndürüyor: `root`, `neck`, `setSleeping()`, `playGaze()`. Render döngüsü bu dörtten başka bir şey bilmiyor — silindir olduğunun farkında değil.

**glTF geçişi:** aynı dört şeyi döndüren bir fonksiyon yaz. Dosyanın geri kalanına dokunma.

```js
async function createCharacter(url) {
  const gltf = await loader.loadAsync(url);
  const neck = gltf.scene.getObjectByName('Neck');
  const mixer = new THREE.AnimationMixer(gltf.scene);
  return { root: gltf.scene, neck,
           setSleeping: v => slump.play(),
           playGaze: () => yawn.reset().play(),
           update: dt => mixer.update(dt) };
}
```

`neck` prosedürel kalıyor — animasyon klibi değil, `neck.rotation.y = -heading`. Çizerinden kafa dönüş animasyonu isteme; **rigde adı belli bir boyun kemiği** şart koş, o kadar.

### 3 — Ağ ← ŞİMDİ BURADASIN

`ws`, 7 gerçek istemci, `viewFor()` çıktısı. Sahne farkı anlamayacak — `sahne-fp.html` içindeki oyun kopyasını silip gerçek state'i besle.

15Hz yeter. Refleks yok, çarpışma yok. İstemci tarafı tahmin (client-side prediction) **gerekmiyor**: kafa dönüşü gecikmeye duyarlı değil, sunucu açıyı yollar, istemci lerp'ler.

### 4 — Suçlama sahnesi

Donma, üç perde, kuyruk. `game.js`'te var, `sahne-fp.html`'de var, ağa bağlanacak.

Botlar henüz **eşzamanlı iki suçlama** senaryosunu tetiklemedi. Elle test et: iki istemci aynı tick'te bassın. Kuyruktakinin iptal hakkı yok — ikisi de yanmalı.

### 5 — DUR VE OYNA

Discord'da 7 arkadaş, 10 tur. **Bu adım planın sebebi.**

`TUNING` tek yerde, canlı değiştir:

| Sayı | Başlangıç | Etkisi |
|---|---|---|
| Koni | 110° | Dar = uyanıklar lehine |
| Gürültü | 6 sn | Sık = hamle kaybolur, uykucu lehine |
| Bekleme | 45 sn | Kısa = uykucu hızlı toplar |
| Eşik | 3 kişi | Yüksek = uykucu lehine |

Buradan sonrası bu turların sonucuna bağlı. Karakter, matchmaking, mağaza — hiçbiri bu satırın üstünde değil, çünkü hiçbiri asıl soruya cevap vermiyor.

---

## Bulunmuş tuzaklar

**Global gölgeleme.** `const top` = `window.top` çakışması. Klasik script'te ölümcül, `<script type="module">` içinde imkânsız. Modül kullan. ESLint `env: browser` + `no-redeclare` otomatik yakalar. Node'daki sözdizimi kontrolü yakalamaz.

**Dikey ekran ile "kamera = koni" bağdaşmıyor.** Three.js'te `camera.fov` dikey. 110° yatay → yatay ekranda 77° dikey (sorunsuz), dikey ekranda **144°** (kullanılamaz). Kırparsan gerçekte 43° yatay görürsün ama oyun "4 kişi konindeydi" der. Çözüm:

```js
await discordSdk.commands.setOrientationLockState({
  lock_state: Common.OrientationLockStateTypeObject.LANDSCAPE,
  picture_in_picture_lock_state: Common.OrientationLockStateTypeObject.LANDSCAPE,
  grid_lock_state: Common.OrientationLockStateTypeObject.UNLOCKED,
});
```

**Mobil ısınma, FPS değil.** Discord termal API veriyor (`NOMINAL/FAIR/SERIOUS/CRITICAL`) — vermesi tek başına bunun gerçek bir problem olduğunu söylüyor. Ama senin sahnende kamera sabit, gölge yok, postprocessing yok. Isınırsan suçlusu Three.js değil sensin.

- `setPixelRatio(Math.min(devicePixelRatio, 1.5))` — mobilde 2 değil. Isınmanın **bir numaralı sebebi** piksel sayısı, poligon değil.
- SERIOUS gelince pixel ratio 1, koni şeffaflığı kapalı.
- Texture 1K şart koş. Karakter ekranda 200 piksel; 4K çöp ve bellek yakar.
- `--discord-safe-area-inset-*` — çentik.

**Play Store `minimum functionality`.** "Web sitesini WebView'a sarmış" uygulamalar reddediliyor. Capacitor'da `webDir` ile asset'leri **pakete göm**; `server.url` ile uzak adrese işaret etme — tam o satır seni reddettirir.

**12 test kullanıcısı, 14 kesintisiz gün.** 13 Kasım 2023 sonrası açılmış **kişisel** Play Console hesapları için zorunlu. Tüzel kişilikle (şahıs şirketi) kayıt olursan **tamamen muaf.**

Ama şunu gör: kural senin 5. adımın. 12 kişiye 14 gün oynatman gerekiyor; zaten oynatman gerekiyordu. Aynı 14 günde yap.

---

## Dağıtım — tek repo, iki hedef

Web'de kalmanın kazancı: kapılardan birini seçmek zorunda değilsin.

**Discord Activity**
- SDK npm'den, MIT, kayıt/lisans/aidat ücreti yok
- Ses **bedava**, 7 kişi zaten aynı kanalda
- Mobil ayrı bir anahtar — Portal'dan iOS/Android'i aç
- CSP proxy: dış istekler Portal'daki URL Mappings'ten geçer
- SDK kimin konuştuğunu söyleyebiliyor → **bakış-konuşma korelasyonu bedava**, senin oyununun tam kalbinde
- Komisyon sadece Discord'un ödeme sisteminden satış yaparsan: 1M$ ömürlük gelire kadar %15, sonrası %30

**Play Store**
```bash
npx cap add android && npx cap sync && npx cap open android
```
→ signed bundle → `.aab`. WebView = Chromium, tarayıcıyla aynı motor.
- 25$ tek seferlik, gizlilik politikası URL'i, Data Safety, IARC, güncel target SDK
- Ses artık Agora'dan **parayla**, dakika başı, oyuncu sayısıyla doğrusal
- Sesli sohbet = UGC → bildirme, engelleme, müdahale eden bir süreç. Form değil, **iş.** Discord'da bunu Discord yapıyordu.

**Sıra: Discord'da çık, tutarsa mağazaya taşı.** Tersi yolda 7 kişiyi kendin bulmaya çalışırken ölürsün. Kod aynı kod.

---

## Açık kalanlar

**Bakış izlemek eğlenceli mi?** — 5. adım cevaplayacak. Başka hiçbir şey cevaplamayacak.

**Sıradan oyuncuların bakınma sebebi yeterli mi?** Kimse bakınmazsa şüphelenen tek başına sırıtır. Şu an tek sebep "gördüğün tartışmada işe yarar".

**Uyuma anı da duraklamalı mı?** Aynı dramayı bedavaya verir → uyanıklar lehine ciddi kayma. Test edilmedi.

**Birinci şahısta suçlama sahnesi.** Kamera yükselince donmuş masayı görüyorsun. Dokümanındaki "bilgi satın alma" kameranın kendisi oluyor. Bunu ben uydurmadım, sende yazıyordu. Ama gerçekten iyi hissettiriyor mu — bilmiyoruz.

**Telefonda kaç FPS?** Ölçülmedi. `sahne-fp.html` telefonda aç.

---

## Kırmızı çizgiler

1. `viewFor()` dışında hiçbir yerde filtreleme yok.
2. Sızıntı testi her değişiklikten sonra çalışır.
3. Gürültü sunucuda üretilir, istemcide değil. İstemcide üretirsen hamle gürültüden ayrışır ve oyun biter.
4. Uykucunun hamlesi ile gürültü aynı kod yolundan çıkar. Hep.
5. 5. adımdan önce karakter yok.
