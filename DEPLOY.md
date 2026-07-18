# Yayınlama — Coolify (sunucu) + Play Store (native)

Ses şimdilik yok (sorun değil; oyun botlarla/dış sesle oynanır). Akış: önce sunucuyu
Coolify'de canlıya al, sonra istemciyi Capacitor'la paketleyip `.aab` üret.

## 1) Sunucu → Coolify

Hazır: `Dockerfile`, `.dockerignore`. Sunucu tek portta (PORT, vars. 3000) hem statik
istemciyi hem WebSocket'i servis eder. Volume gerekmez (odalar bellekte).

1. Repoyu Coolify'de yeni **Application** olarak bağla (Dockerfile build).
2. Coolify bir alan adı + otomatik HTTPS verir → `https://gizli.alanadi.com`.
   WebSocket bu alan üzerinden `wss://gizli.alanadi.com` olarak çalışır (Traefik ws upgrade'i geçirir).
3. Deploy. Test: tarayıcıda `https://gizli.alanadi.com/?bots=6` → oyun açılır.

> Not (boykot-api'de yaşadığın): env'ler Dockerfile ARG'a enjekte olur; burada özel env
> gerekmiyor. PORT'u Coolify yönetir.

## 2) İstemci → native'e hazır (yapıldı)

- Three.js **yerele gömüldü** (`public/vendor/three.module.js`) — CDN yok, offline çalışır,
  Play Store "minimum functionality"e uygun.
- Sunucu adresi **yapılandırılabilir**: `window.GU_WS`. Native pakette Coolify adresini ver.

`public/` içine küçük bir config koy (native build bunu okur), örn `public/config.js`:
```html
<!-- sahne-fp.html <head> içine, modülden ÖNCE ekle: -->
<script>window.GU_WS = "wss://gizli.alanadi.com";</script>
```
(Web'de bunu koymazsan `location.host` kullanılır — yani Coolify'de servis edilen sayfa
kendiliğinden doğru sunucuya bağlanır. Sadece **paketlenmiş app** için gerekiyor.)

## 3) Capacitor → .aab → Play Store

```bash
npm i -D @capacitor/cli
npm i @capacitor/core @capacitor/android
npx cap init "Gizli Uykucu" <PAKET_ADI> --web-dir=public
npx cap add android
npx cap sync
npx cap open android          # Android Studio açılır
```
Android Studio'da: Build → Generate Signed Bundle → **.aab** (upload keystore'u SAKLA;
kaybolursa güncelleme yapamazsın — mutalaa'da yaşadığın gibi).

**`<PAKET_ADI>` kalıcıdır** (ör. `com.seninmarkan.gizliuykucu`). Bir kez seç, değiştirilemez.

### Play Console gereksinimleri
- 25$ tek seferlik hesap
- Gizlilik politikası URL'i (bir sayfa yeter)
- Data Safety formu, hedef SDK (güncel), IARC içerik derecesi
- Yatay kilit (FP kamera = koni yatay varsayar; dikeyde bozulur) — Android manifest'te
  `android:screenOrientation="landscape"` veya Capacitor plugin.
- Kişisel hesap: **12 test kullanıcısı / 14 gün** kapalı test (şahıs şirketiyle muaf).

## Sıra (PLAN'a göre)
Mağaza yayını "5. adım"dan sonra: önce Coolify + ngrok/link ile 7 arkadaşınla oyna,
"bakış izlemek eğlenceli mi?" sorusunu cevapla. Cevap "evet"se `.aab`'a geç.
