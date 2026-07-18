# Bekleyenler

Karar verilmiş işler. Tartışması bitti; ne yapıldı, ne kaldı.

---

## ✅ Uykucuya kendi bekleme göstergesi — YAPILDI

`TUNING.cooldownMs` artık uykucunun **private** paketine giriyor (`viewFor` → `me.cooldown`),
uyanıklara gitmiyor (kırmızı çizgi korundu). Ayrıca maddenin asıl derdi olan "iki şart da
sessizce başarısız oluyor, ayırt edemiyor" çözüldü — HUD iki şartı **ayrı** gösteriyor:

- **bekleme X sn** → 2. şart (bekleme dolmamış)
- **HAZIR — kurbanınla göz göze gel** → 1. şart eksik (göz göze değil)
- **GÖZ GÖZE — uyutuluyor…** → ikisi de tamam, hamle işliyor

Göz göze bilgisi de private (`me.eye`, sadece uykucu); uyanıklar bilirse hamle zamanı sızardı.
Bekleme dolunca ince "hazır" sesi de var (yalnız uykucu duyar).

---

## Kapanmış tartışmalar

Tekrar açma, cevabı burada.

**5 saniye içinde kafa çevirmek hamleyi iptal eder mi?** Hayır, ve etmemeli. Ayrıntısı `gizli-uykucu-kurallar.md` → "Bu 5 saniye bir iptal penceresi değil". Özet: hamle basıldığı anda kesinleşir, tanık listesi aynı anda donar, kaçış hiçbir şey kazandırmaz. Gecikmenin işi iptal penceresi açmak değil, hamle anı ile uyuma anını ayırmak.

Alternatifi de değerlendirildi ve **reddedildi:** göz göze şartını 5 sn boyunca sürdürme zorunluluğu (channel). Uykucuyu tabloda 5 sn sabit tutup gerçek risk aldırırdı, ama uyanıklar lehine ciddi kayma yapar — uykucu neredeyse hiç vuramaz hale gelir.

---

## Şu an bekleyen (yeni)

- **Coolify deploy** (gerçek) → `wss://` alan adı. Sonra arkadaşlarla oda.
- **Capacitor → .aab** (native). Yatay kilit manifest'te. **Paket adı** kalıcı — seçilmeli.
- **Görsel doğrulama:** tarayıcı eklentisi oturumda koptu; yeni **lobi tasarımı + ses + chat** kendi makinende reload edip test edilmeli (kod/sözdizimi temiz, tipler geçiyor).
- **Lobi müziği:** şu an prosedürel ambient — gerçek müzik dosyası? (karar bekliyor)
- Ertelendi: voice (Discord/Agora), 360° halka HUD, Play Console adımları.

Detay: `DEPLOY.md`, geniş özet: `README.md`.
