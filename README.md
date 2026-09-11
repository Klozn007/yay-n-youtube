# KLOZN Discord Bot — Render + UptimeRobot 24/7

Bu sürüm Render Web Service + UptimeRobot için tasarlanmıştır. PM2 kullanılmaz; Render process yaşam döngüsünü yönetir. Bot ayrıca `0.0.0.0:$PORT` üzerinde HTTP sunucusu açar.

## Render
1. Projeyi GitHub'a yükle.
2. Render → New → Web Service ile repo'yu bağla.
3. Build Command: `npm ci`
4. Start Command: `npm start`
5. Health Check Path: `/health`
6. Environment Variables: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`

`render.yaml` kullanıyorsan ayarlar otomatik gelir.

## UptimeRobot
Render'ın verdiği `https://...onrender.com` adresiyle HTTP(s) monitor oluştur:
- URL: `https://...onrender.com/status`
- Method: GET
- Interval: 5 minutes (planının izin verdiği en kısa aralık)
- Expected status: 200

`/health` Render'ın process sağlık kontrolü içindir. `/status` ise Discord Gateway hazır olduğunda 200, hazır değilse 503 döndürür.

## 24/7 gerçeği
Render Free web services 15 dakika inbound trafik gelmezse sleep olabilir; düzenli UptimeRobot istekleri idle sleep'i önlemeye yardımcı olur. Ancak Free plan yine de aylık 750 saat sınırına ve Render'ın zaman zaman yeniden başlatmasına tabidir. Gerçek üretim seviyesinde always-on çalışma için ücretli Render compute planı önerilir.

## Veri
`data.json` Render'ın ephemeral filesystem'inde tutulur; restart/redeploy/sleep durumlarında kalıcı değildir. XP, uyarı ve AFK verileri kalıcı olacaksa veritabanına geçirilmelidir.

## Discord
Gerekli privileged intents: Guild Members ve Message Content. Developer Portal'da açılmalıdır.

## Lokal test
```bash
npm ci
npm start
```
Kontrol: `http://localhost:10000/health` ve `http://localhost:10000/status`

## Güvenlik
Tokenı GitHub'a veya sohbetlere koyma; `.env` dosyasını commit etme.
