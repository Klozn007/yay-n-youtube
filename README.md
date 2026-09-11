# KLOZN Creator Bot v9

## Dosyalar
- index.js
- package.json
- .env.example

## Render / Discord ayarları
1. GitHub'a `index.js` ve `package.json` yükle.
2. Render Environment Variables bölümüne `.env.example` içindeki değerleri ekle.
3. `TOKEN` = Discord bot token
4. `CLIENT_ID` = Discord Developer Portal Application ID
5. `GUILD_ID` = Sunucu ID (önerilir; slash komutları anında güncellenir)
6. `RESTART_HOURS=1` botu kontrollü olarak yaklaşık her 1 saatte bir yeniden başlatır.
7. Start Command: `npm start`

## Önemli
- `/sunucu-yenile` mevcut kanalları siler ve şablonu yeniden oluşturur.
- Şablonun yönettiği eski roller temizlenir; @everyone, managed roller ve botun üst rolü korunur.
- `/sunucu-yenile`, `/ban`, `/kick`, `/mute`, `/warn`, `/temizle`, `/rol-ver` vb. yönetim komutları yalnızca Discord'da Administrator yetkisine sahip üyelerde çalışır.
- `Yayıncı` ve `İçerik Üreticisi` rolleri creator kanallarına erişir.
- `🌸・KADINLARA ÖZEL` kategorisi yalnızca `Kadın Üye`, `Kadın Yönetim`, `KLOZN` ve `Yönetim` rollerine görünür.
- Discord rolü tek başına bir kişinin cinsiyetini doğrulamaz; erişim rol tabanlıdır.
