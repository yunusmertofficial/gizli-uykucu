# Gizli Uykucu — ağ katmanı

Çalışan oyun mantığı + çalışan 3D sahne, artık **sunucu-otoriter çok oyunculu**
olarak bağlı. 7 gerçek istemci, WebSocket, her oyuncuya farklı paket.

## Çalıştır

```bash
npm install
npm run dev          # sunucu + statik dosyalar, http://localhost:3000
```

- **Tek başına test:** `http://localhost:3000/?bots=6` — 6 bot + sen, tur hemen başlar.
- **İki sekme + 5 bot:** sekme 1 `?bots=5` (oda kodu görünür), sekme 2 parametresiz
  aynı odaya girer, 7'ye dolunca tur başlar. `?room=KOD` ile belirli odaya katıl.
- **ngrok:** `ngrok http 3000` → link arkadaşlara. (İstemci `ws`/`wss`'i otomatik seçer.)

## Ölçüm scriptleri (taşındıktan sonra da çalışır)

```bash
npm run sim        # sızıntı testi — 0 vermeli (en önemlisi)
npm run tune       # şüpheli listesi ~3.1 kişi (110°/6sn)
npm run stall      # sabırlı uykucu < açgözlü uykucu
npm run anlasma    # kurşunsuz masada 4 disiplinli → %100 donma
npm run anlat      # bir turun anlatımı
npm run typecheck  # tsc --noEmit (rules.ts + game.ts + server.ts)
```

## Mimari (kırmızı çizgiler korundu)

1. **`viewFor()` tek gizleme noktası.** Tanık listesi (`witnesses`) sunucuda hesaplanır,
   orada ölür. `PublicEvent` tipinde `witnesses` alanı YOK — kamu paketine koymaya
   kalkarsan derleyici reddeder.
2. **İki fazlı tick.** FAZ A açılar yerleşir, FAZ B olaylar atılır. Uykucunun hamlesi
   gürültüyle aynı kuyruğa (`gazeQueue`) girer, aynı kod yolundan çıkar.
3. **İstemci oyun mantığı çalıştırmaz.** `sahne-fp.html` sadece `state` paketini çizer;
   15Hz state → 60fps için gelen açıya lerp'ler. Gürültü sunucuda üretilir.

## Tasarım notları (görev metninden sapmalar)

- **`strike` telde yok.** Protokol yalnız `aim` + `accuse`. Uykucunun hamlesi için özel
  düğme yok; sunucu, göz göze + bekleme bittiğinde **otomatik** ateşler. Uykucunun tek
  denetimi `aim` — hamle gürültüden ayırt edilemez kalır.
- **`enterScene()` artık `tick()` içinde** (eskiden `accuse()` içindeydi). Böylece aynı
  tick'te gelen iki suçlama da kuyruğa girer ve ikisi de yanar (kabul #6). Matematik ve
  `viewFor` değişmedi; sahne yalnızca ~1 tick geç başlar.
- **`sahne-fp.html` orijinalde `sahne.html` ile birebir aynıydı** (tepeden orbit kamera,
  gömülü oyun kopyası). Gömülü mantık silindi, gerçek state bağlandı ve kamera **birinci
  şahsa** çevrildi: kamera senin sandalyende, kafanın baktığı yöne bakar, FOV = koni
  (`CONE_DEG` yatay → ekran oranından dikeye çevrilir). Sürükle = kafanı çevir (aim
  sunucuya gider, otorite açıyı geri yollar, istemci lerp'ler — tahmin yok). Suçlama
  sahnesinde / uyuduğunda kamera yükselip donmuş masayı tepeden gösterir. Kendi gövdeni
  görmezsin. Her oyuncunun üstünde **isim etiketi** var (3D kafa → her kare ekrana
  yansıtılır; ölünce soluk). Kurşun için ayrı düğme yok: **bir oyuncuya (gövdenin herhangi
  yerine) tıkla** = suçla. Tıklayınca kafan o kişiye **döner** (suçlarken ona bakıyor
  olursun); kurşun ömürde bir olduğu için iki aşamalı (1. tık dön+hedefle "suçla?", 2. tık
  ateşler, Esc iptal; sentetik çift-tık'a karşı 300ms debounce). Suçlama sahnesinde
  **suçlayan mavi, hedef kırmızı** parlar + etiketleri vurgulanır ve 3 perde banner'ı
  oynar (X suçluyor… → X → Y → sonuç). 360° halka HUD henüz yok (istenirse eklenir).
