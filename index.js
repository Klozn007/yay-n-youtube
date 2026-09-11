require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  Events,
  ActivityType,
} = require('discord.js');
const http = require('http');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || '';
const PORT = Number(process.env.PORT || 10000);
const HOURLY_RESTART = String(process.env.HOURLY_RESTART || 'false').toLowerCase() === 'true';
const RESTART_DELAY_MS = 15000;

if (!TOKEN || !CLIENT_ID) {
  throw new Error('TOKEN ve CLIENT_ID Render Environment Variables içinde olmalı.');
}

// -----------------------------
// HTTP / Render health server
// -----------------------------
const startedAt = Date.now();
const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/health' || url.pathname === '/') {
    const payload = {
      status: 'ok',
      botReady: client.isReady(),
      guilds: client.guilds.cache.size,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(payload));
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[HTTP] Health server listening on 0.0.0.0:${PORT}`);
});

// -----------------------------
// Persistent local JSON storage
// -----------------------------
const DATA_DIR = path.join(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'database.json');

function loadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error('[DB READ]', err.message);
    return fallback;
  }
}

const db = loadJson(DB_FILE, {
  version: 8,
  guilds: {},
  users: {},
  cases: {},
});

function saveDb() {
  try {
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    console.error('[DB WRITE]', err.message);
  }
}

function guildCfg(guildId) {
  if (!db.guilds[guildId]) {
    db.guilds[guildId] = {
      roles: {},
      channels: {},
      setupVersion: 0,
      lockdown: false,
      womenArea: { roleId: null, categoryId: null, channels: {} },
    };
  }
  return db.guilds[guildId];
}

function userCfg(guildId, userId) {
  const key = `${guildId}:${userId}`;
  if (!db.users[key]) {
    db.users[key] = { coins: 0, xp: 0, level: 1, dailyAt: 0, workAt: 0, warnings: [] };
  }
  return db.users[key];
}

function caseList(guildId) {
  if (!db.cases[guildId]) db.cases[guildId] = [];
  return db.cases[guildId];
}

function addCase(guildId, type, targetId, moderatorId, reason) {
  const list = caseList(guildId);
  const item = {
    id: list.length ? list[list.length - 1].id + 1 : 1,
    type,
    targetId,
    moderatorId,
    reason: reason || 'Belirtilmedi.',
    createdAt: Date.now(),
  };
  list.push(item);
  if (list.length > 5000) list.splice(0, list.length - 5000);
  saveDb();
  return item;
}

// -----------------------------
// Discord client
// -----------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User],
});

const ADMIN = PermissionsBitField.Flags.Administrator;
const MOD = PermissionsBitField.Flags.ModerateMembers;
const MANAGE_MESSAGES = PermissionsBitField.Flags.ManageMessages;

const ROLE_NAMES = {
  owner: '👑 Sunucu Sahibi',
  admin: '🛡️ Yönetici',
  headMod: '🔨 Baş Moderatör',
  mod: '🛡️ Moderatör',
  support: '🎫 Destek Sorumlusu',
  event: '🎉 Etkinlik Sorumlusu',
  bot: '🤖 Bot',
  booster: '💎 Booster',
  vip: '🏆 VIP',
  active: '⭐ Aktif Üye',
  member: '👤 Üye',
  women: '👩 Kadın',
};

const ROLE_COLORS = {
  owner: 0xF1C40F,
  admin: 0xE74C3C,
  headMod: 0xE67E22,
  mod: 0x3498DB,
  support: 0x2ECC71,
  event: 0x9B59B6,
  bot: 0x5865F2,
  booster: 0xFF73FA,
  vip: 0xF1C40F,
  active: 0xFEE75C,
  member: 0x95A5A6,
  women: 0xFF69B4,
};

const PUBLIC_LAYOUT = [
  ['📌 BİLGİ', [
    ['📜・kurallar', 'text', 'readonly'],
    ['📢・duyurular', 'text', 'readonly'],
    ['📋・bilgilendirme', 'text', 'readonly'],
    ['🗓️・etkinlikler', 'text', 'readonly'],
    ['❓・sss', 'text', 'readonly'],
  ]],
  ['💬 TOPLULUK', [
    ['💬・genel', 'text', 'public'],
    ['🤖・bot-komutları', 'text', 'public'],
    ['📸・medya', 'text', 'public'],
    ['🎮・oyun', 'text', 'public'],
    ['💡・öneriler', 'text', 'public'],
    ['🧩・topluluk-etkinlikleri', 'text', 'public'],
  ]],
  ['🔊 SES KANALLARI', [
    ['🔊 Genel Sohbet', 'voice', 'public'],
    ['🎮 Oyun 1', 'voice', 'public'],
    ['🎮 Oyun 2', 'voice', 'public'],
  ]],
  ['🎫 DESTEK', [
    ['🎫・ticket', 'text', 'public'],
    ['📮・başvuru', 'text', 'public'],
    ['🤝・destek', 'text', 'public'],
  ]],
  ['🏆 ETKİNLİK', [
    ['🎉・etkinlik', 'text', 'public'],
    ['🏅・çekiliş', 'text', 'public'],
    ['🏆・kazananlar', 'text', 'readonly'],
  ]],
  ['🤖 BOT', [
    ['🤖・komutlar', 'text', 'public'],
    ['📊・bot-log', 'text', 'admin'],
    ['📈・istatistik', 'text', 'public'],
  ]],
  ['🔐 YÖNETİM', [
    ['📋・loglar', 'text', 'admin'],
    ['🛡️・mod-log', 'text', 'admin'],
    ['🚨・automod-log', 'text', 'admin'],
    ['👥・yetkili', 'text', 'admin'],
    ['🔒・yönetim', 'text', 'admin'],
    ['🔊 Yetkili Ses', 'voice', 'admin'],
  ]],
];

const WOMEN_LAYOUT = [
  ['👩 KADINLARA ÖZEL', [
    ['👩・kadın-sohbet', 'text'],
    ['📸・kadın-medya', 'text'],
    ['🌸・kadın-etkinlik', 'text'],
    ['📌・kadın-bilgi', 'text'],
    ['🔊・kadın-ses', 'voice'],
  ]],
];

function makeEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(0x5865F2)
    .setTimestamp();
}

function isAdmin(interaction) {
  if (!interaction.guild || !interaction.member) return false;
  return interaction.guild.ownerId === interaction.user.id ||
    interaction.member.permissions.has(ADMIN);
}

function isMod(interaction) {
  return isAdmin(interaction) || interaction.member.permissions.has(MOD);
}

function isSupport(interaction) {
  const cfg = guildCfg(interaction.guild.id);
  return isAdmin(interaction) || interaction.member.roles.cache.has(cfg.roles.support);
}

function canModerate(actor, target) {
  if (!actor || !target) return false;
  if (target.id === actor.id || target.id === target.guild.ownerId) return false;
  return target.roles.highest.position < actor.roles.highest.position;
}

async function safeReply(interaction, payload) {
  try {
    if (interaction.replied) return await interaction.followUp(payload);
    if (interaction.deferred) return await interaction.editReply(payload);
    return await interaction.reply(payload);
  } catch (err) {
    if (err.code !== 10062 && err.code !== 40060) console.error('[REPLY]', err.message);
  }
}

async function logAction(guild, key, title, description) {
  const cfg = guildCfg(guild.id);
  const id = cfg.channels[key];
  if (!id) return;
  const channel = guild.channels.cache.get(id);
  if (!channel?.isTextBased()) return;
  await channel.send({ embeds: [makeEmbed(title, description)] }).catch(() => {});
}

function permissionOverwrites(guild, cfg, access) {
  const everyone = guild.roles.everyone.id;
  const admin = cfg.roles.admin;
  const support = cfg.roles.support;
  const women = cfg.roles.women;
  const base = [{ id: everyone, deny: [PermissionsBitField.Flags.ViewChannel] }];

  if (access === 'public') {
    return [{ id: everyone, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
      { id: admin, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }];
  }
  if (access === 'readonly') {
    return [{ id: everyone, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages] },
      { id: admin, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }];
  }
  if (access === 'admin') {
    return [{ id: everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: admin, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }];
  }
  if (access === 'women') {
    return [{ id: everyone, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.Connect] },
      { id: women, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] },
      { id: admin, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] }];
  }
  return base;
}

async function ensureRole(guild, key, permissions = []) {
  const cfg = guildCfg(guild.id);
  let role = cfg.roles[key] ? guild.roles.cache.get(cfg.roles[key]) : null;
  if (!role) role = guild.roles.cache.find(r => r.name === ROLE_NAMES[key] && !r.managed);
  if (!role) {
    role = await guild.roles.create({
      name: ROLE_NAMES[key],
      color: ROLE_COLORS[key],
      permissions,
      hoist: ['owner', 'admin', 'mod', 'support', 'women'].includes(key),
      reason: 'KLOZN V8 server synchronization',
    });
  }
  cfg.roles[key] = role.id;
  return role;
}

async function ensureCategory(guild, name, access = 'public') {
  let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === name);
  const cfg = guildCfg(guild.id);
  if (!category) {
    category = await guild.channels.create({ name, type: ChannelType.GuildCategory, permissionOverwrites: permissionOverwrites(guild, cfg, access) });
  } else {
    await category.permissionOverwrites.set(permissionOverwrites(guild, cfg, access)).catch(() => {});
  }
  return category;
}

async function ensureChannel(guild, name, kind, parent, access) {
  let channel = guild.channels.cache.find(c => c.name === name && c.type === (kind === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText));
  const cfg = guildCfg(guild.id);
  const opts = {
    name,
    type: kind === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText,
    parent: parent.id,
    permissionOverwrites: permissionOverwrites(guild, cfg, access),
    reason: 'KLOZN V8 server synchronization',
  };
  if (!channel) channel = await guild.channels.create(opts);
  else {
    if (channel.parentId !== parent.id) await channel.setParent(parent.id).catch(() => {});
    await channel.permissionOverwrites.set(opts.permissionOverwrites).catch(() => {});
  }
  return channel;
}

async function ensureWomenArea(guild) {
  const cfg = guildCfg(guild.id);
  const womenRole = await ensureRole(guild, 'women');
  const category = await ensureCategory(guild, '👩 KADINLARA ÖZEL', 'women');
  const channels = {};
  for (const [name, kind] of WOMEN_LAYOUT[0][1]) {
    const key = name.includes('kadın-sohbet') ? 'chat' :
      name.includes('kadın-medya') ? 'media' :
      name.includes('kadın-etkinlik') ? 'event' :
      name.includes('kadın-bilgi') ? 'info' : 'voice';
    channels[key] = await ensureChannel(guild, name, kind, category, 'women');
  }
  cfg.roles.women = womenRole.id;
  cfg.womenArea = {
    roleId: womenRole.id,
    categoryId: category.id,
    channels: Object.fromEntries(Object.entries(channels).map(([k, v]) => [k, v.id])),
    policy: 'VISIBLE_BUT_LOCKED_FOR_OTHERS',
  };
  saveDb();
  return { role: womenRole, category, channels };
}

async function setupServer(guild) {
  const me = guild.members.me || await guild.members.fetchMe();
  if (!me.permissions.has(ADMIN)) throw new Error('Botun Administrator yetkisi olmalı.');

  const cfg = guildCfg(guild.id);
  await ensureRole(guild, 'owner', [ADMIN]);
  await ensureRole(guild, 'admin', [ADMIN]);
  await ensureRole(guild, 'headMod', [ADMIN]);
  await ensureRole(guild, 'mod', [MOD, MANAGE_MESSAGES]);
  await ensureRole(guild, 'support', []);
  await ensureRole(guild, 'event', []);
  await ensureRole(guild, 'bot', []);
  await ensureRole(guild, 'booster', []);
  await ensureRole(guild, 'vip', []);
  await ensureRole(guild, 'active', []);
  await ensureRole(guild, 'member', []);
  await ensureRole(guild, 'women', []);

  // Do not attempt to move managed roles. Bot role hierarchy must be fixed in Discord.
  const map = {};
  for (const [catName, channels] of PUBLIC_LAYOUT) {
    const access = catName === '🔐 YÖNETİM' ? 'admin' : 'public';
    const cat = await ensureCategory(guild, catName, access);
    for (const [name, kind, channelAccess] of channels) {
      const c = await ensureChannel(guild, name, kind, cat, channelAccess);
      map[name] = c.id;
    }
  }

  cfg.channels = {
    rules: map['📜・kurallar'], announcements: map['📢・duyurular'], info: map['📋・bilgilendirme'],
    events: map['🗓️・etkinlikler'], faq: map['❓・sss'], general: map['💬・genel'],
    commands: map['🤖・bot-komutları'], media: map['📸・medya'], games: map['🎮・oyun'],
    suggestions: map['💡・öneriler'], ticket: map['🎫・ticket'], applications: map['📮・başvuru'],
    support: map['🤝・destek'], event: map['🎉・etkinlik'], giveaway: map['🏅・çekiliş'],
    winners: map['🏆・kazananlar'], botlog: map['📊・bot-log'], stats: map['📈・istatistik'],
    logs: map['📋・loglar'], modlog: map['🛡️・mod-log'], automod: map['🚨・automod-log'],
    staff: map['👥・yetkili'], management: map['🔒・yönetim'],
  };

  const women = await ensureWomenArea(guild);
  cfg.setupVersion = 8;
  saveDb();

  const rules = guild.channels.cache.get(cfg.channels.rules);
  if (rules && rules.isTextBased() && rules.messages.cache.size === 0) {
    await rules.send({ embeds: [makeEmbed('📜 Sunucu Kuralları', '1. Saygılı olun.\n2. Spam/reklam yapmayın.\n3. Taciz, tehdit ve dolandırıcılık yasaktır.\n4. Yetkili kararlarına uyun.\n5. Discord Kuralları ve Topluluk Kuralları geçerlidir.')] }).catch(() => {});
  }

  return { cfg, women };
}

async function destructiveRebuild(guild) {
  const me = guild.members.me || await guild.members.fetchMe();
  if (!me.permissions.has(ADMIN)) throw new Error('Botun Administrator yetkisi olmalı.');

  // Remove every deletable channel. Discord-managed/system channels may refuse deletion.
  const channels = [...guild.channels.cache.values()].sort((a, b) => b.rawPosition - a.rawPosition);
  let deletedChannels = 0;
  for (const ch of channels) {
    if (ch.deletable) {
      await ch.delete('KLOZN V8 /sunucu-yenile').then(() => deletedChannels++).catch(() => {});
    }
  }

  // Remove every deletable non-managed role except the bot's own managed role.
  let deletedRoles = 0;
  const roles = [...guild.roles.cache.values()].sort((a, b) => b.position - a.position);
  for (const role of roles) {
    if (role.id === guild.id || role.managed || !role.deletable) continue;
    await role.delete('KLOZN V8 /sunucu-yenile').then(() => deletedRoles++).catch(() => {});
  }

  // Clear cached config and rebuild from zero.
  delete db.guilds[guild.id];
  saveDb();
  const rebuilt = await setupServer(guild);
  await logAction(guild, 'botlog', '♻️ Sunucu Yenilendi', `Silinen kanal: **${deletedChannels}**\nSilinen rol: **${deletedRoles}**\nYeni kadın alanı ve izin matrisi tekrar oluşturuldu.`);
  return { ...rebuilt, deletedChannels, deletedRoles };
}

// -----------------------------
// Slash commands - one single registry
// -----------------------------
const commands = [
  new SlashCommandBuilder().setName('setup').setDescription('Sunucu yapısını kurar/senkronize eder.'),
  new SlashCommandBuilder().setName('sunucu-yenile').setDescription('Mevcut kanalları ve rolleri silip yapıyı sıfırdan kurar.')
    .addBooleanOption(o => o.setName('onay').setDescription('Silme ve yeniden kurma işlemini onayla.').setRequired(true)),
  new SlashCommandBuilder().setName('kadin-rol').setDescription('Kadın özel alan erişim rolünü verir/alır.')
    .addStringOption(o => o.setName('islem').setDescription('İşlem').setRequired(true).addChoices({ name: 'Ver', value: 'ver' }, { name: 'Al', value: 'al' }))
    .addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true)),
  new SlashCommandBuilder().setName('ban').setDescription('Üyeyi yasaklar.').addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true)).addStringOption(o => o.setName('sebep').setDescription('Sebep')),
  new SlashCommandBuilder().setName('kick').setDescription('Üyeyi atar.').addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true)).addStringOption(o => o.setName('sebep').setDescription('Sebep')),
  new SlashCommandBuilder().setName('timeout').setDescription('Üyeye timeout verir.').addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true)).addIntegerOption(o => o.setName('dakika').setDescription('1-40320').setRequired(true).setMinValue(1).setMaxValue(40320)).addStringOption(o => o.setName('sebep').setDescription('Sebep')),
  new SlashCommandBuilder().setName('warn').setDescription('Üyeyi uyarır.').addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true)).addStringOption(o => o.setName('sebep').setDescription('Sebep').setRequired(true)),
  new SlashCommandBuilder().setName('warnings').setDescription('Uyarıları gösterir.').addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true)),
  new SlashCommandBuilder().setName('unwarn').setDescription('Son uyarıyı kaldırır.').addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true)),
  new SlashCommandBuilder().setName('clear').setDescription('Mesajları temizler.').addIntegerOption(o => o.setName('miktar').setDescription('1-100').setRequired(true).setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder().setName('purge').setDescription('Mesajları toplu temizler.').addIntegerOption(o => o.setName('miktar').setDescription('1-100').setRequired(true).setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder().setName('lock').setDescription('Kanalı kilitler.'),
  new SlashCommandBuilder().setName('unlock').setDescription('Kanalı açar.'),
  new SlashCommandBuilder().setName('slowmode').setDescription('Slowmode ayarlar.').addIntegerOption(o => o.setName('saniye').setDescription('0-21600').setRequired(true).setMinValue(0).setMaxValue(21600)),
  new SlashCommandBuilder().setName('lockdown').setDescription('Genel kanalları kilitler/açar.').addBooleanOption(o => o.setName('aktif').setDescription('Açık/kapalı').setRequired(true)),
  new SlashCommandBuilder().setName('unban').setDescription('ID ile ban kaldırır.').addStringOption(o => o.setName('userid').setDescription('Discord ID').setRequired(true)),
  new SlashCommandBuilder().setName('modpanel').setDescription('Yönetim panelini açar.'),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Sunucu bilgilerini gösterir.'),
  new SlashCommandBuilder().setName('userinfo').setDescription('Kullanıcı bilgilerini gösterir.').addUserOption(o => o.setName('uye').setDescription('Üye')),
  new SlashCommandBuilder().setName('avatar').setDescription('Avatar gösterir.').addUserOption(o => o.setName('uye').setDescription('Üye')),
  new SlashCommandBuilder().setName('bilgi').setDescription('Bot bilgilerini gösterir.'),
  new SlashCommandBuilder().setName('level').setDescription('Seviye bilgisi.').addUserOption(o => o.setName('uye').setDescription('Üye')),
  new SlashCommandBuilder().setName('balance').setDescription('Coin bakiyeni gösterir.'),
  new SlashCommandBuilder().setName('daily').setDescription('Günlük coin ödülü.'),
  new SlashCommandBuilder().setName('work').setDescription('Çalışarak coin kazan.'),
  new SlashCommandBuilder().setName('transfer').setDescription('Coin gönderir.').addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true)).addIntegerOption(o => o.setName('miktar').setDescription('Miktar').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Coin sıralaması.'),
  new SlashCommandBuilder().setName('rapor').setDescription('Bir kullanıcıyı yetkililere bildirir.').addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true)).addStringOption(o => o.setName('sebep').setDescription('Sebep').setRequired(true).setMaxLength(500)),
  new SlashCommandBuilder().setName('raporlar').setDescription('Açık raporları gösterir.'),
  new SlashCommandBuilder().setName('case').setDescription('Moderasyon geçmişini gösterir.').addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true)),
  new SlashCommandBuilder().setName('ticket-panel').setDescription('Ticket panelini kurar.'),
  new SlashCommandBuilder().setName('ticket-kapat').setDescription('Bulunduğun ticketı kapatır.'),
  new SlashCommandBuilder().setName('duyuru').setDescription('Duyuru gönderir.').addStringOption(o => o.setName('mesaj').setDescription('Mesaj').setRequired(true).setMaxLength(2000)),
  new SlashCommandBuilder().setName('automod').setDescription('Basit AutoMod aç/kapat.').addBooleanOption(o => o.setName('aktif').setDescription('Aktif').setRequired(true)),
  new SlashCommandBuilder().setName('restart').setDescription('Botu kontrollü olarak yeniden başlatır.'),
].map(c => c.toJSON());

const adminOnly = new Set([
  'setup', 'sunucu-yenile', 'kadin-rol', 'ban', 'kick', 'timeout', 'warn', 'warnings', 'unwarn',
  'clear', 'purge', 'lock', 'unlock', 'slowmode', 'lockdown', 'unban', 'modpanel', 'case', 'raporlar',
  'ticket-panel', 'duyuru', 'automod', 'restart'
]);

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const route = GUILD_ID ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) : Routes.applicationCommands(CLIENT_ID);
  await rest.put(route, { body: commands });
  console.log(`[COMMANDS] ${commands.length} slash komutu tek registry ile kaydedildi.`);
}

function scheduleRestart(reason = 'hourly') {
  console.log(`[RESTART] ${reason} — ${RESTART_DELAY_MS / 1000}s sonra process.exit(0)`);
  setTimeout(() => process.exit(0), RESTART_DELAY_MS);
}

// -----------------------------
// ONE interaction handler
// -----------------------------
client.on(Events.InteractionCreate, async interaction => {
  try {
    // Buttons
    if (interaction.isButton()) {
      if (!interaction.guild) return;
      if (interaction.customId === 'ticket_create') {
        const cfg = guildCfg(interaction.guild.id);
        const existing = interaction.guild.channels.cache.find(c => c.name === `ticket-${interaction.user.id}`);
        if (existing) return safeReply(interaction, { content: `🎫 Zaten açık ticketın var: ${existing}`, ephemeral: true });
        const parent = cfg.channels.ticket ? interaction.guild.channels.cache.get(cfg.channels.ticket)?.parent : null;
        await interaction.deferReply({ ephemeral: true });
        const channel = await interaction.guild.channels.create({
          name: `ticket-${interaction.user.id}`,
          type: ChannelType.GuildText,
          parent: parent?.id,
          permissionOverwrites: [
            { id: interaction.guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
            { id: cfg.roles.support, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
            { id: cfg.roles.admin, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
          ],
        });
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_close').setLabel('Kapat').setEmoji('🔒').setStyle(ButtonStyle.Danger));
        await channel.send({ content: `${interaction.user}`, embeds: [makeEmbed('🎫 Ticket Açıldı', 'Destek ekibi en kısa sürede ilgilenecek.')], components: [row] });
        await logAction(interaction.guild, 'botlog', '🎫 Ticket', `${interaction.user.tag} → ${channel.name}`);
        return interaction.editReply(`✅ Ticket oluşturuldu: ${channel}`);
      }
      if (interaction.customId === 'ticket_close') {
        if (!isSupport(interaction) && !interaction.channel?.name?.startsWith('ticket-')) return safeReply(interaction, { content: '❌ Bu ticketı kapatamazsın.', ephemeral: true });
        await interaction.reply({ content: '🔒 Ticket 5 saniye içinde kapatılıyor.', ephemeral: true });
        setTimeout(() => interaction.channel?.delete('Ticket closed').catch(() => {}), 5000);
        return;
      }
      if (interaction.customId === 'panel_restart') {
        if (!isAdmin(interaction)) return safeReply(interaction, { content: '❌ Sadece yönetici.', ephemeral: true });
        await interaction.reply({ content: '♻️ Bot kontrollü yeniden başlatılıyor...', ephemeral: true });
        return scheduleRestart('panel');
      }
      return;
    }

    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const name = interaction.commandName;

    if (adminOnly.has(name) && !isAdmin(interaction)) {
      return safeReply(interaction, { content: '🔒 Bu komut yalnızca Discord **Administrator** yetkisine sahip kişiler tarafından kullanılabilir.', ephemeral: true });
    }

    // Long-running commands acknowledge immediately: prevents 10062 Unknown interaction.
    if (['setup', 'sunucu-yenile', 'modpanel', 'kadin-rol', 'lockdown', 'ticket-panel', 'duyuru', 'restart'].includes(name)) {
      await interaction.deferReply({ ephemeral: true });
    }

    if (name === 'setup') {
      const result = await setupServer(interaction.guild);
      await logAction(interaction.guild, 'botlog', '⚙️ Setup', `${interaction.user.tag} tarafından sunucu senkronize edildi.`);
      return interaction.editReply(`✅ Sunucu senkronize edildi.\n👩 Kadın rolü: <@&${result.women.role.id}>\n👩 Kadın alanı: **${result.women.category.name}**`);
    }

    if (name === 'sunucu-yenile') {
      if (!interaction.options.getBoolean('onay')) return interaction.editReply('❌ Yenileme iptal edildi. Silme işlemi için `onay:true` seçmelisin.');
      await interaction.editReply('♻️ Mevcut kanallar ve roller temizleniyor. Yeni yapı kuruluyor...');
      const result = await destructiveRebuild(interaction.guild);
      return interaction.editReply(`✅ **Sunucu sıfırdan yeniden oluşturuldu.**\n🗑️ Silinen kanallar: **${result.deletedChannels}**\n🎭 Silinen roller: **${result.deletedRoles}**\n👩 Kadın rolü: <@&${result.women.role.id}>\n🔐 Kadın alanı: rol + Administrator erişimli.`);
    }

    if (name === 'kadin-rol') {
      const target = await interaction.guild.members.fetch(interaction.options.getUser('uye').id).catch(() => null);
      const women = await ensureWomenArea(interaction.guild);
      if (!target) return interaction.editReply('❌ Üye bulunamadı.');
      if (!women.role.editable) return interaction.editReply('❌ Kadın rolü botun rol hiyerarşisinin üstünde. Discord Rol Ayarları bölümünden bot rolünü yukarı taşı.');
      const action = interaction.options.getString('islem');
      if (target.id === interaction.guild.ownerId) return interaction.editReply('❌ Sunucu sahibine bu rol işlemi uygulanamaz.');
      if (action === 'ver') {
        await target.roles.add(women.role, `Kadın alanı erişimi | ${interaction.user.tag}`);
        await logAction(interaction.guild, 'modlog', '👩 Kadın Rolü Verildi', `${target} ← ${interaction.user}`);
        return interaction.editReply(`✅ ${target} kullanıcısına <@&${women.role.id}> verildi.`);
      }
      await target.roles.remove(women.role, `Kadın alanı erişimi kaldırıldı | ${interaction.user.tag}`);
      await logAction(interaction.guild, 'modlog', '👩 Kadın Rolü Alındı', `${target} ← ${interaction.user}`);
      return interaction.editReply(`✅ ${target} kullanıcısından <@&${women.role.id}> alındı.`);
    }

    if (['ban', 'kick', 'timeout'].includes(name)) {
      const member = await interaction.guild.members.fetch(interaction.options.getUser('uye').id).catch(() => null);
      if (!member) return safeReply(interaction, { content: '❌ Üye bulunamadı.', ephemeral: true });
      if (!canModerate(interaction.member, member) && interaction.guild.ownerId !== interaction.user.id) return safeReply(interaction, { content: '❌ Rol hiyerarşisi nedeniyle bu üyeye işlem uygulayamazsın.', ephemeral: true });
      const reason = interaction.options.getString('sebep') || 'Belirtilmedi.';
      if (name === 'ban') await member.ban({ reason });
      if (name === 'kick') await member.kick(reason);
      if (name === 'timeout') await member.timeout(interaction.options.getInteger('dakika') * 60000, reason);
      const type = name.toUpperCase();
      addCase(interaction.guild.id, type, member.id, interaction.user.id, reason);
      await safeReply(interaction, { content: `✅ **${member.user.tag}** için ${type} uygulandı.`, ephemeral: true });
      return logAction(interaction.guild, 'modlog', `🛡️ ${type}`, `${member.user.tag}\nYetkili: ${interaction.user}\nSebep: ${reason}`);
    }

    if (name === 'warn') {
      const target = interaction.options.getUser('uye');
      const reason = interaction.options.getString('sebep');
      const data = userCfg(interaction.guild.id, target.id);
      data.warnings.push({ reason, moderatorId: interaction.user.id, at: Date.now() });
      const c = addCase(interaction.guild.id, 'WARN', target.id, interaction.user.id, reason);
      saveDb();
      await safeReply(interaction, { content: `⚠️ ${target} uyarıldı. Toplam uyarı: **${data.warnings.length}** (Case #${c.id})`, ephemeral: true });
      return logAction(interaction.guild, 'modlog', '⚠️ Warn', `${target}\nSebep: ${reason}\nYetkili: ${interaction.user}`);
    }

    if (name === 'warnings') {
      const target = interaction.options.getUser('uye');
      const data = userCfg(interaction.guild.id, target.id);
      const text = data.warnings.length ? data.warnings.map((w, i) => `${i + 1}. ${w.reason} — <@${w.moderatorId}>`).join('\n') : 'Uyarı yok.';
      return safeReply(interaction, { embeds: [makeEmbed(`⚠️ ${target.tag}`, text)], ephemeral: true });
    }

    if (name === 'unwarn') {
      const target = interaction.options.getUser('uye');
      const data = userCfg(interaction.guild.id, target.id);
      if (!data.warnings.length) return interaction.editReply('ℹ️ Bu kullanıcının uyarısı yok.');
      const removed = data.warnings.pop();
      saveDb();
      return interaction.editReply(`✅ ${target} kullanıcısının son uyarısı kaldırıldı: **${removed.reason}**`);
    }

    if (name === 'clear' || name === 'purge') {
      const n = interaction.options.getInteger('miktar');
      const deleted = await interaction.channel.bulkDelete(n, true);
      return safeReply(interaction, { content: `🧹 **${deleted.size}** mesaj silindi.`, ephemeral: true });
    }

    if (name === 'lock' || name === 'unlock') {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: name === 'lock' ? false : null });
      return safeReply(interaction, { content: name === 'lock' ? '🔒 Kanal kilitlendi.' : '🔓 Kanal açıldı.', ephemeral: true });
    }

    if (name === 'slowmode') {
      await interaction.channel.setRateLimitPerUser(interaction.options.getInteger('saniye'));
      return safeReply(interaction, { content: '🐢 Slowmode güncellendi.', ephemeral: true });
    }

    if (name === 'lockdown') {
      const active = interaction.options.getBoolean('aktif');
      const cfg = guildCfg(interaction.guild.id);
      const keys = ['general', 'media', 'games', 'suggestions', 'event'];
      let changed = 0;
      for (const key of keys) {
        const ch = cfg.channels[key] && interaction.guild.channels.cache.get(cfg.channels[key]);
        if (ch?.isTextBased()) {
          await ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: active ? false : null }).catch(() => {});
          changed++;
        }
      }
      cfg.lockdown = active; saveDb();
      return interaction.editReply(`${active ? '🚨 Lockdown aktif' : '🔓 Lockdown kapatıldı'}. **${changed}** kanal güncellendi.`);
    }

    if (name === 'unban') {
      const id = interaction.options.getString('userid');
      await interaction.guild.bans.remove(id, `Unban | ${interaction.user.tag}`);
      return safeReply(interaction, { content: `✅ <@${id}> ban listesinden çıkarıldı.`, ephemeral: true });
    }

    if (name === 'modpanel') {
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('panel_restart').setLabel('Kontrollü Restart').setEmoji('♻️').setStyle(ButtonStyle.Danger));
      return interaction.editReply({ embeds: [makeEmbed('🛡️ KLOZN Yönetim Paneli', 'Bu panel yalnızca Administrator yetkisine sahip yöneticiler içindir.')], components: [row] });
    }

    if (name === 'serverinfo') {
      return safeReply(interaction, { embeds: [makeEmbed(`📊 ${interaction.guild.name}`, `👥 Üye: **${interaction.guild.memberCount}**\n📁 Kanal: **${interaction.guild.channels.cache.size}**\n🎭 Rol: **${interaction.guild.roles.cache.size}**\n🚀 Boost: **${interaction.guild.premiumSubscriptionCount || 0}**\n👑 Sahip: <@${interaction.guild.ownerId}>`)] });
    }

    if (name === 'userinfo') {
      const user = interaction.options.getUser('uye') || interaction.user;
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      return safeReply(interaction, { embeds: [new EmbedBuilder().setTitle(`👤 ${user.tag}`).setThumbnail(user.displayAvatarURL()).addFields(
        { name: 'ID', value: user.id },
        { name: 'Hesap', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>` },
        { name: 'Roller', value: member?.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => r.toString()).join(' ') || 'Yok' },
      ).setColor(0x5865F2)] });
    }

    if (name === 'avatar') {
      const user = interaction.options.getUser('uye') || interaction.user;
      return safeReply(interaction, { embeds: [new EmbedBuilder().setTitle(`🖼️ ${user.tag}`).setImage(user.displayAvatarURL({ size: 1024 })).setColor(0x5865F2)] });
    }

    if (name === 'bilgi') {
      return safeReply(interaction, { embeds: [makeEmbed('🤖 KLOZN V8', `Discord.js **14.27.x**\nSunucu: **${client.guilds.cache.size}**\nPing: **${client.ws.ping}ms**\nUptime: **${Math.floor(client.uptime / 1000)}s**\nRender health: **/health**`)] });
    }

    if (['balance', 'daily', 'work', 'transfer', 'leaderboard', 'level'].includes(name)) {
      const data = userCfg(interaction.guild.id, interaction.user.id);
      if (name === 'balance') return safeReply(interaction, { content: `💰 Bakiyen: **${data.coins}** coin` });
      if (name === 'daily') {
        if (Date.now() - data.dailyAt < 86400000) return safeReply(interaction, { content: '⏰ Günlük ödülü zaten aldın.', ephemeral: true });
        const amount = 500 + Math.floor(Math.random() * 501); data.coins += amount; data.dailyAt = Date.now(); saveDb();
        return safeReply(interaction, { content: `🎁 **${amount}** coin aldın. Bakiye: **${data.coins}**` });
      }
      if (name === 'work') {
        if (Date.now() - data.workAt < 3600000) return safeReply(interaction, { content: '⏰ /work için saatte bir kez bekleme süresi var.', ephemeral: true });
        const amount = 100 + Math.floor(Math.random() * 401); data.coins += amount; data.workAt = Date.now(); saveDb();
        return safeReply(interaction, { content: `💼 **${amount}** coin kazandın.` });
      }
      if (name === 'transfer') {
        const target = interaction.options.getUser('uye'); const amount = interaction.options.getInteger('miktar');
        if (target.bot || target.id === interaction.user.id || data.coins < amount) return safeReply(interaction, { content: '❌ Geçersiz kullanıcı veya yetersiz bakiye.', ephemeral: true });
        const targetData = userCfg(interaction.guild.id, target.id); targetData.coins += amount; data.coins -= amount; saveDb();
        return safeReply(interaction, { content: `💸 ${target} kullanıcısına **${amount}** coin gönderildi.` });
      }
      if (name === 'leaderboard') {
        const rows = Object.entries(db.users).filter(([k]) => k.startsWith(`${interaction.guild.id}:`)).sort((a, b) => b[1].coins - a[1].coins).slice(0, 10);
        return safeReply(interaction, { embeds: [makeEmbed('🏆 Coin Sıralaması', rows.length ? rows.map(([k, d], i) => `${i + 1}. <@${k.split(':')[1]}> — **${d.coins}**`).join('\n') : 'Henüz veri yok.')] });
      }
      const target = interaction.options.getUser('uye') || interaction.user; const d = userCfg(interaction.guild.id, target.id);
      return safeReply(interaction, { embeds: [makeEmbed(`⭐ ${target.username}`, `Level: **${d.level}**\nXP: **${d.xp}**`)] });
    }

    if (name === 'rapor') {
      const target = interaction.options.getUser('uye'); const reason = interaction.options.getString('sebep');
      if (target.id === interaction.user.id) return safeReply(interaction, { content: '❌ Kendini raporlayamazsın.', ephemeral: true });
      const reports = db.reports || (db.reports = {}); const list = reports[interaction.guild.id] || (reports[interaction.guild.id] = []);
      const item = { id: list.length ? list[list.length - 1].id + 1 : 1, targetId: target.id, reporterId: interaction.user.id, reason, status: 'OPEN', createdAt: Date.now() };
      list.push(item); saveDb();
      await logAction(interaction.guild, 'modlog', `🚨 Yeni Rapor #${item.id}`, `${target}\n**Sebep:** ${reason}\n**Bildiren:** ${interaction.user}`);
      return safeReply(interaction, { content: `✅ Rapor oluşturuldu. #${item.id}`, ephemeral: true });
    }

    if (name === 'raporlar') {
      const list = (db.reports?.[interaction.guild.id] || []).filter(x => x.status === 'OPEN').slice(-20).reverse();
      return safeReply(interaction, { embeds: [makeEmbed('🚨 Açık Raporlar', list.length ? list.map(x => `#${x.id} <@${x.targetId}> — ${x.reason} — <@${x.reporterId}>`).join('\n') : 'Açık rapor yok.')], ephemeral: true });
    }

    if (name === 'case') {
      const target = interaction.options.getUser('uye');
      const list = caseList(interaction.guild.id).filter(x => x.targetId === target.id).slice(-15).reverse();
      return safeReply(interaction, { embeds: [makeEmbed(`📁 ${target.tag} Moderasyon Geçmişi`, list.length ? list.map(x => `#${x.id} **${x.type}** — ${x.reason} — <@${x.moderatorId}>`).join('\n') : 'Kayıt bulunamadı.')], ephemeral: true });
    }

    if (name === 'ticket-panel') {
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_create').setLabel('Ticket Aç').setEmoji('🎫').setStyle(ButtonStyle.Primary));
      await interaction.channel.send({ embeds: [makeEmbed('🎫 Destek Merkezi', 'Destek almak için aşağıdaki butona bas.')], components: [row] });
      return interaction.editReply('✅ Ticket paneli gönderildi.');
    }

    if (name === 'ticket-kapat') {
      if (!interaction.channel.name.startsWith('ticket-')) return safeReply(interaction, { content: '❌ Bu komut ticket kanalında kullanılmalı.', ephemeral: true });
      await interaction.reply({ content: '🔒 Ticket 5 saniye içinde kapanıyor.', ephemeral: true });
      return setTimeout(() => interaction.channel.delete('Ticket closed').catch(() => {}), 5000);
    }

    if (name === 'duyuru') {
      const message = interaction.options.getString('mesaj');
      await interaction.channel.send({ content: '@everyone', embeds: [makeEmbed('📢 KLOZN DUYURU', message)] });
      await logAction(interaction.guild, 'botlog', '📢 Duyuru', `${interaction.user.tag} tarafından gönderildi.`);
      return interaction.editReply('✅ Duyuru gönderildi.');
    }

    if (name === 'automod') {
      const active = interaction.options.getBoolean('aktif');
      const cfg = guildCfg(interaction.guild.id); cfg.automod = active; saveDb();
      return safeReply(interaction, { content: `🛡️ AutoMod **${active ? 'aktif' : 'kapalı'}**.`, ephemeral: true });
    }

    if (name === 'restart') {
      await interaction.editReply('♻️ Bot kontrollü olarak yeniden başlatılıyor. Render process 0 çıkışından sonra servisi tekrar başlatır.');
      return scheduleRestart(`manual by ${interaction.user.tag}`);
    }
  } catch (err) {
    console.error('[INTERACTION ERROR]', err);
    return safeReply(interaction, { content: `❌ İşlem sırasında hata oluştu: ${err.message || 'Bilinmeyen hata'}`, ephemeral: true });
  }
});

// -----------------------------
// Public message systems
// -----------------------------
const spamMap = new Map();
const BAD_WORDS = ['amk', 'aq', 'siktir', 'orospu', 'yarrak'];

client.on(Events.MessageCreate, async message => {
  if (!message.guild || message.author.bot) return;
  const cfg = guildCfg(message.guild.id);
  const user = userCfg(message.guild.id, message.author.id);
  user.xp += Math.floor(Math.random() * 8) + 5;
  const newLevel = Math.floor(Math.sqrt(user.xp / 100)) + 1;
  if (newLevel > user.level) {
    user.level = newLevel;
    await message.channel.send({ embeds: [makeEmbed('🎉 Level Atladın!', `${message.author} artık **Level ${newLevel}**!`)] }).catch(() => {});
  }
  saveDb();

  if (cfg.automod === false) return;
  if (message.member?.permissions.has(ADMIN)) return;

  if (BAD_WORDS.some(w => message.content.toLowerCase().includes(w))) {
    await message.delete().catch(() => {});
    await logAction(message.guild, 'automod', '🤬 AutoMod', `${message.author} uygunsuz mesaj nedeniyle mesajı silindi.`);
    return;
  }

  const now = Date.now();
  const arr = (spamMap.get(`${message.guild.id}:${message.author.id}`) || []).filter(t => now - t < 5000);
  arr.push(now); spamMap.set(`${message.guild.id}:${message.author.id}`, arr);
  if (arr.length >= 7 && message.member?.moderatable) {
    await message.member.timeout(30000, 'KLOZN AutoMod spam').catch(() => {});
    spamMap.delete(`${message.guild.id}:${message.author.id}`);
    await logAction(message.guild, 'automod', '🚨 Spam', `${message.author} 30 saniye timeoutlandı.`);
  }
});

client.on(Events.GuildMemberAdd, async member => {
  const cfg = guildCfg(member.guild.id);
  const welcomeId = cfg.channels?.info;
  const ch = welcomeId && member.guild.channels.cache.get(welcomeId);
  if (ch?.isTextBased()) await ch.send({ embeds: [makeEmbed('👋 Hoş Geldin!', `${member} sunucuya katıldı. Toplam: **${member.guild.memberCount}**`)] }).catch(() => {});
  await logAction(member.guild, 'logs', '👤 Üye Katıldı', `${member.user.tag} (${member.id})`);
});

client.on(Events.GuildMemberRemove, async member => {
  await logAction(member.guild, 'logs', '🚪 Üye Ayrıldı', `${member.user.tag} (${member.id})`);
});

client.on(Events.GuildRoleCreate, role => logAction(role.guild, 'logs', '🎭 Rol Oluşturuldu', `${role.name} (${role.id})`));
client.on(Events.GuildRoleDelete, role => logAction(role.guild, 'logs', '🗑️ Rol Silindi', `${role.name} (${role.id})`));
client.on(Events.ChannelCreate, channel => channel.guild && logAction(channel.guild, 'logs', '📁 Kanal Oluşturuldu', `${channel.name} (${channel.id})`));
client.on(Events.ChannelDelete, channel => channel.guild && logAction(channel.guild, 'logs', '🗑️ Kanal Silindi', `${channel.name} (${channel.id})`));

client.on(Events.Error, err => console.error('[DISCORD CLIENT ERROR]', err));
client.on(Events.Warn, info => console.warn('[DISCORD WARN]', info));
process.on('unhandledRejection', err => console.error('[UNHANDLED REJECTION]', err));
process.on('uncaughtException', err => console.error('[UNCAUGHT EXCEPTION]', err));

client.once(Events.ClientReady, async ready => {
  console.log('╔══════════════════════════════════════╗');
  console.log(`║ KLOZN V8 — ${ready.user.tag}`);
  console.log(`║ Guilds: ${ready.client.guilds.cache.size}`);
  console.log('║ Status: ONLINE');
  console.log('║ Interaction handler: SINGLE');
  console.log('║ Render health: /health');
  console.log('╚══════════════════════════════════════╝');
  ready.user.setPresence({ activities: [{ name: `${ready.client.guilds.cache.size} sunucu | /bilgi`, type: ActivityType.Watching }], status: 'online' });
  try {
    await registerCommands();
  } catch (err) {
    console.error('[COMMAND REGISTER]', err);
  }
  if (HOURLY_RESTART) {
    setTimeout(() => scheduleRestart('hourly restart'), 60 * 60 * 1000);
  }
});

client.login(TOKEN).catch(err => {
  console.error('[LOGIN FAILED]', err);
  process.exit(1);
});
