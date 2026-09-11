# KLOZN Discord Bot V6

Render + UptimeRobot uyumlu, temiz komut kayıt sistemi ve Administrator-only slash komutları.

## Render
Build: `npm install`
Start: `npm start`
Health: `/health`
UptimeRobot: `/status`

Environment Variables:
- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID`
- `NODE_ENV=production`

## Discord Bot Permissions / Intents
Botu sunucuya eklerken en az şu izinler gerekir: View Channels, Send Messages, Embed Links, Read Message History, Manage Messages, Manage Channels, Manage Roles, Moderate Members, Kick Members, Ban Members, Mention Everyone (duyuruda kullanılacaksa).
Message Content ve Server Members intentlerini Discord Developer Portal'dan aç.

## Slash command duplicates
`DISCORD_GUILD_ID` doluysa komutlar doğrudan sunucuya kaydedilir ve global application commands boşaltılır. Kod ayrıca komut listesini isim bazında tekilleştirir.

## Admin-only
Tüm slash komutları Discord tarafında `Administrator` default permission ile yayınlanır ve interaction sırasında ikinci bir Administrator kontrolünden geçirilir. Butonla açılan ticket gibi kullanıcı etkileşimleri slash komut değildir ve normal kullanıcılar tarafından kullanılabilir.

## UptimeRobot
HTTP(s) monitor ile `https://SENIN-RENDER-URL/status` adresini 5 dakikada bir kontrol et. `/status` Discord bağlantısı hazır değilse 503 döndürür.

## Data
Varsayılan olarak `data/klozn.json` kullanılır. Render'ın ephemeral diskinde kalıcı veri garanti edilmez; kalıcı production verisi için harici DB eklenmesi önerilir.
