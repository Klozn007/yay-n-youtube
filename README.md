# KLOZN V8

## Render Environment Variables
- `TOKEN` = Discord bot token
- `CLIENT_ID` = Discord application/client ID
- `GUILD_ID` = optional test server ID (guild command registration is faster); leave empty for global commands
- `HOURLY_RESTART` = `false` recommended; `true` enables a controlled hourly process restart

## Render
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`

The bot binds to `0.0.0.0:$PORT` and exposes `/health` for UptimeRobot.

## UptimeRobot
Monitor Type: HTTP(s)
URL: `https://YOUR-SERVICE.onrender.com/health`
Recommended interval: 5 minutes.

## Important Discord permissions
The bot needs Administrator permission. Its bot role must be above roles it must create/manage. Discord-managed roles cannot be deleted by the bot.

## Women area
`👩 Kadın` is an explicit access role. The bot does not infer gender. Other members can see the channel/category but cannot read history, send messages, or connect to the women voice channel. `Administrator` can access it.

## Destructive rebuild
`/sunucu-yenile onay:true` deletes all deletable channels and non-managed roles, then recreates the KLOZN structure. This is intentionally destructive.
