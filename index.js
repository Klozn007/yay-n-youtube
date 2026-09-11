const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
  MessageFlags,
} = require("discord.js");
const http = require("http");

const CONFIG = {
  TOKEN: process.env.TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID,
  PORT: Number(process.env.PORT || 10000),
  AUTOMOD: String(process.env.AUTOMOD ?? "true").toLowerCase() !== "false",
};

if (!CONFIG.TOKEN || !CONFIG.CLIENT_ID || !CONFIG.GUILD_ID) {
  throw new Error("TOKEN, CLIENT_ID ve GUILD_ID Render Environment Variables içinde zorunludur.");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const R = {
  KLOZN: "KLOZN",
  YONETIM: "Yönetim",
  MOD: "🛡️ Moderatör",
  YAYINCI: "🎥 Yayıncı",
  ICERIK: "🎬 İçerik Üreticisi",
  VIP: "⭐ VIP",
  IZLEYICI: "👤 İzleyici",
  KAYITSIZ: "📝 Kayıtsız",
  BOT: "🤖 Bot",
  KADIN: "🌸 Kadın",
};

const C = {
  START: "👋・BAŞLANGIÇ",
  COMMUNITY: "💬・TOPLULUK",
  STREAM: "🔴・YAYINCI MERKEZİ",
  CREATOR: "🎬・İÇERİK ÜRETİCİ MERKEZİ",
  FUN: "🎮・OYUN & ETKİNLİK",
  SUPPORT: "🎫・DESTEK MERKEZİ",
  STAFF: "🛡️・MODERASYON",
  LOGS: "🔐・LOG MERKEZİ",
  VOICE: "🔊・SES ODALARI",
  WOMEN: "🌸・KADINLARA ÖZEL",
};

const TICKET_TYPES = {
  genel: { label: "🎫 Genel Destek", channel: "genel", emoji: "🎫" },
  teknik: { label: "🛠️ Teknik Destek", channel: "teknik", emoji: "🛠️" },
  partner: { label: "🤝 Partnerlik", channel: "partner", emoji: "🤝" },
  yayin: { label: "🔴 Yayıncı Destek", channel: "yayinci", emoji: "🔴" },
  icerik: { label: "🎬 İçerik Üretici Destek", channel: "icerik", emoji: "🎬" },
  kadin: { label: "🌸 Kadın Destek", channel: "kadin", emoji: "🌸" },
  sikayet: { label: "⚠️ Şikayet / Bildirim", channel: "sikayet", emoji: "⚠️" },
};

const CH = {
  REGISTER: "📝・kayıt-ol",
  RULES: "📜・kurallar",
  WELCOME: "👋・hos-geldin",
  ANNOUNCE: "📢・duyurular",
  CHAT: "💬・sohbet",
  MEDIA: "🖼️・medya",
  BOT: "🤖・bot-komutları",
  LIVE: "🔴・canlı-yayın",
  LIVECHAT: "💬・yayın-sohbet",
  CLIPS: "✂️・klipler",
  STREAM_PLAN: "📅・yayın-planı",
  STREAM_CHAT: "🎙️・yayıncı-sohbet",
  STREAM_VOICE: "🎥・yayıncı-ses",
  VIDEOS: "▶️・videolar",
  IDEAS: "💡・içerik-fikirleri",
  CONTENT_PLAN: "📅・içerik-planı",
  CONTENT_CHAT: "🎬・üretici-sohbet",
  CONTENT_VOICE: "🎬・üretici-ses",
  GAME: "🎮・oyun-sohbet",
  LOOKING: "🔎・oyuncu-ara",
  EVENTS: "🎉・etkinlikler",
  GIVEAWAY: "🎁・çekilişler",
  SUGGEST: "💡・öneriler",
  TICKET: "🎫・ticket-panel",
  STAFF_CHAT: "🛡️・moderatör-sohbet",
  STAFF_LOG: "📋・ceza-kayıtları",
  APPLICATIONS: "📋・başvurular",
  SERVER_LOG: "📜・sunucu-log",
  MEMBER_LOG: "👥・üye-log",
  COMMAND_LOG: "🤖・komut-log",
  MESSAGE_LOG: "💬・mesaj-log",
  VOICE_LOG: "🔊・ses-log",
  GENERAL_VOICE: "💬・Genel Sohbet",
  GAMING_VOICE: "🎮・Oyun Odası",
  MUSIC_VOICE: "🎵・Müzik Odası",
  STREAM_VOICE: "🔴・Yayın Odası",
  STAFF_VOICE: "🛡️・Yönetim Odası",
  WOMEN_CHAT: "🌸・kadın-sohbet",
  WOMEN_VOICE: "🌸・Kadınlar Odası",
};

const ALL_TEMPLATE_CATEGORIES = Object.values(C);

const roleColor = {
  [R.KLOZN]: 0x8b0000,
  [R.YONETIM]: 0xff0000,
  [R.MOD]: 0x00d084,
  [R.YAYINCI]: 0x9146ff,
  [R.ICERIK]: 0x00bfff,
  [R.VIP]: 0xffd700,
  [R.IZLEYICI]: 0x5865f2,
  [R.KAYITSIZ]: 0x808080,
  [R.BOT]: 0x5865f2,
  [R.KADIN]: 0xff69b4,
};

const text = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
];

function admin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}
function hasRole(interaction, role) {
  return interaction.member?.roles?.cache?.some(r => r.name === role) ?? false;
}
function isCreator(interaction) {
  return admin(interaction) || hasRole(interaction, R.KLOZN) ||
    hasRole(interaction, R.YONETIM) || hasRole(interaction, R.YAYINCI) ||
    hasRole(interaction, R.ICERIK);
}

function role(guild, name) {
  return guild.roles.cache.find(r => r.name === name);
}
function cat(guild, name) {
  return guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === name);
}
function channel(guild, name) {
  return guild.channels.cache.find(c => c.name === name);
}

async function getOrCreateRole(guild, name) {
  let r = role(guild, name);
  if (!r) {
    r = await guild.roles.create({
      name,
      color: roleColor[name] ?? 0x5865f2,
      hoist: true,
      permissions: [R.KLOZN, R.YONETIM].includes(name)
        ? [PermissionFlagsBits.Administrator]
        : name === R.MOD
          ? [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers]
          : [],
      reason: "KLOZN template role",
    });
  } else {
    const permissions =
      [R.KLOZN, R.YONETIM].includes(name)
        ? [PermissionFlagsBits.Administrator]
        : name === R.MOD
          ? [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers]
          : [];
    await r.setColor(roleColor[name] ?? 0x5865f2, "KLOZN template sync").catch(() => {});
    await r.setPermissions(permissions, "KLOZN template sync").catch(() => {});
    await r.setHoist(true, "KLOZN template sync").catch(() => {});
  }
  return r;
}

async function createRoles(guild) {
  const out = {};
  for (const [key, name] of Object.entries(R)) out[key] = await getOrCreateRole(guild, name);
  return out;
}

function everyoneNormal(guild, roles) {
  return [
    { id: guild.roles.everyone.id, allow: text },
    ...[roles.IZLEYICI, roles.VIP, roles.YAYINCI, roles.ICERIK, roles.MOD, roles.KLOZN, roles.YONETIM]
      .map(r => ({ id: r.id, allow: text })),
  ];
}
function registeredOnly(guild, roles) {
  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.KAYITSIZ.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.IZLEYICI.id, allow: text },
    { id: roles.VIP.id, allow: text },
    { id: roles.YAYINCI.id, allow: text },
    { id: roles.ICERIK.id, allow: text },
    { id: roles.MOD.id, allow: text },
    { id: roles.KLOZN.id, allow: text },
    { id: roles.YONETIM.id, allow: text },
  ];
}
function creatorOnly(guild, roles) {
  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.KAYITSIZ.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.IZLEYICI.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.VIP.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.MOD.id, allow: text },
    { id: roles.YAYINCI.id, allow: text },
    { id: roles.ICERIK.id, allow: text },
    { id: roles.KLOZN.id, allow: text },
    { id: roles.YONETIM.id, allow: text },
  ];
}
function streamOnly(guild, roles) {
  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.KAYITSIZ.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.IZLEYICI.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.VIP.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.ICERIK.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.MOD.id, allow: text },
    { id: roles.YAYINCI.id, allow: text },
    { id: roles.KLOZN.id, allow: text },
    { id: roles.YONETIM.id, allow: text },
  ];
}
function contentOnly(guild, roles) {
  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.KAYITSIZ.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.IZLEYICI.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.VIP.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.YAYINCI.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.MOD.id, allow: text },
    { id: roles.ICERIK.id, allow: text },
    { id: roles.KLOZN.id, allow: text },
    { id: roles.YONETIM.id, allow: text },
  ];
}
function staffOnly(guild, roles) {
  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.KAYITSIZ.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.IZLEYICI.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.VIP.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.YAYINCI.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.ICERIK.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.MOD.id, allow: text },
    { id: roles.KLOZN.id, allow: text },
    { id: roles.YONETIM.id, allow: text },
  ];
}
function adminOnly(guild, roles) {
  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.KAYITSIZ.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.IZLEYICI.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.VIP.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.YAYINCI.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.ICERIK.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.MOD.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.KLOZN.id, allow: text },
    { id: roles.YONETIM.id, allow: text },
  ];
}
function womenOnly(guild, roles) {
  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
    { id: roles.KAYITSIZ.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.IZLEYICI.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.VIP.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.YAYINCI.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.ICERIK.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.MOD.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.KADIN.id, allow: [...text, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
    { id: roles.KLOZN.id, allow: [...text, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
    { id: roles.YONETIM.id, allow: [...text, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
  ];
}

async function makeCategory(guild, name, overwrites) {
  return guild.channels.create({ name, type: ChannelType.GuildCategory, permissionOverwrites: overwrites, reason: "KLOZN template" });
}
async function makeText(guild, name, parent, overwrites, topic = "") {
  return guild.channels.create({ name, type: ChannelType.GuildText, parent: parent.id, topic, permissionOverwrites: overwrites, reason: "KLOZN template" });
}
async function makeVoice(guild, name, parent, overwrites) {
  return guild.channels.create({ name, type: ChannelType.GuildVoice, parent: parent.id, permissionOverwrites: overwrites, reason: "KLOZN template" });
}

async function buildTemplate(guild) {
  await guild.channels.fetch();
  await guild.roles.fetch();
  const roles = await createRoles(guild);

  const start = await makeCategory(guild, C.START, registeredOnly(guild, roles));
  const reg = await makeText(guild, CH.REGISTER, start, [
    { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
    { id: roles.KAYITSIZ.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
    { id: roles.KLOZN.id, allow: text },
    { id: roles.YONETIM.id, allow: text },
  ]);
  await makeText(guild, CH.RULES, start, [
    { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
    { id: roles.KAYITSIZ.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
    { id: roles.IZLEYICI.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
    { id: roles.KLOZN.id, allow: text },
    { id: roles.YONETIM.id, allow: text },
  ]);
  await makeText(guild, CH.WELCOME, start, [
    { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
    { id: roles.KAYITSIZ.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
    { id: roles.IZLEYICI.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
    { id: roles.KLOZN.id, allow: text },
    { id: roles.YONETIM.id, allow: text },
  ]);

  const community = await makeCategory(guild, C.COMMUNITY, registeredOnly(guild, roles));
  for (const n of [CH.ANNOUNCE, CH.CHAT, CH.MEDIA, CH.BOT]) await makeText(guild, n, community, registeredOnly(guild, roles));

  const stream = await makeCategory(guild, C.STREAM, streamOnly(guild, roles));
  for (const n of [CH.LIVE, CH.LIVECHAT, CH.CLIPS, CH.STREAM_PLAN, CH.STREAM_CHAT]) await makeText(guild, n, stream, streamOnly(guild, roles));
  await makeVoice(guild, CH.STREAM_VOICE, stream, streamOnly(guild, roles));

  const creator = await makeCategory(guild, C.CREATOR, contentOnly(guild, roles));
  for (const n of [CH.VIDEOS, CH.IDEAS, CH.CONTENT_PLAN, CH.CONTENT_CHAT]) await makeText(guild, n, creator, contentOnly(guild, roles));
  await makeVoice(guild, CH.CONTENT_VOICE, creator, contentOnly(guild, roles));

  const fun = await makeCategory(guild, C.FUN, registeredOnly(guild, roles));
  for (const n of [CH.GAME, CH.LOOKING, CH.EVENTS, CH.GIVEAWAY, CH.SUGGEST]) await makeText(guild, n, fun, registeredOnly(guild, roles));

  const support = await makeCategory(guild, C.SUPPORT, registeredOnly(guild, roles));
  await makeText(guild, CH.TICKET, support, registeredOnly(guild, roles));

  const staff = await makeCategory(guild, C.STAFF, staffOnly(guild, roles));
  for (const n of [CH.STAFF_CHAT, CH.STAFF_LOG, CH.APPLICATIONS]) await makeText(guild, n, staff, staffOnly(guild, roles));

  const logs = await makeCategory(guild, C.LOGS, adminOnly(guild, roles));
  for (const n of [CH.SERVER_LOG, CH.MEMBER_LOG, CH.COMMAND_LOG, CH.MESSAGE_LOG, CH.VOICE_LOG]) await makeText(guild, n, logs, adminOnly(guild, roles));

  const voice = await makeCategory(guild, C.VOICE, registeredOnly(guild, roles));
  for (const n of [CH.GENERAL_VOICE, CH.GAMING_VOICE, CH.MUSIC_VOICE]) await makeVoice(guild, n, voice, registeredOnly(guild, roles));

  const women = await makeCategory(guild, C.WOMEN, womenOnly(guild, roles));
  await makeText(guild, CH.WOMEN_CHAT, women, womenOnly(guild, roles));
  await makeVoice(guild, CH.WOMEN_VOICE, women, womenOnly(guild, roles));

  await reg.send({
    embeds: [new EmbedBuilder()
      .setTitle("🌸 KLOZN COMMUNITY • KAYIT")
      .setDescription(
        "Sunucuya hoş geldin! 👋\n\n" +
        "Aşağıdaki butona basarak **👤 İzleyici** rolünü alabilirsin.\n\n" +
        "🔴 Yayıncı Merkezi → sadece 🎥 Yayıncı\n" +
        "🎬 İçerik Merkezi → sadece 🎬 İçerik Üreticisi\n" +
        "🛡️ Moderasyon → sadece Moderatör + Yönetim\n" +
        "🔐 Loglar → sadece Yönetim\n" +
        "🌸 Kadınlara Özel → sadece 🌸 Kadın + Yönetim"
      ).setTimestamp()],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("klozn_register").setLabel("Kayıt Ol").setEmoji("✅").setStyle(ButtonStyle.Success)
    )],
  });

  return roles;
}

async function fullReset(guild) {
  await guild.channels.fetch();
  let deletedChannels = 0, failedChannels = 0;
  const channels = [...guild.channels.cache.values()].filter(c => c.id !== guild.id);
  // Children first, categories last.
  channels.sort((a, b) => (a.type === ChannelType.GuildCategory ? 1 : 0) - (b.type === ChannelType.GuildCategory ? 1 : 0));
  for (const ch of channels) {
    try { await ch.delete("KLOZN /sunucu-yenile"); deletedChannels++; }
    catch (e) { failedChannels++; console.warn("Kanal silinemedi:", ch.name, e.message); }
  }

  await guild.roles.fetch();
  const me = guild.members.me;
  const highest = me?.roles?.highest?.position ?? 0;
  let deletedRoles = 0, failedRoles = 0;
  for (const r of [...guild.roles.cache.values()].filter(x => !x.managed && x.id !== guild.id).sort((a,b)=>b.position-a.position)) {
    if (r.position >= highest) { failedRoles++; continue; }
    try { await r.delete("KLOZN /sunucu-yenile"); deletedRoles++; }
    catch (e) { failedRoles++; console.warn("Rol silinemedi:", r.name, e.message); }
  }

  const roles = await buildTemplate(guild);
  return { deletedChannels, failedChannels, deletedRoles, failedRoles, roles: Object.keys(roles).length };
}

const commands = [
  { name: "sunucu-yenile", description: "Sunucuyu tamamen sıfırlayıp KLOZN şablonunu kurar.", default_member_permissions: PermissionFlagsBits.Administrator.toString() },
  { name: "kurulum", description: "KLOZN kanal ve rol şablonunu kurar.", default_member_permissions: PermissionFlagsBits.Administrator.toString() },
  { name: "duyuru", description: "Duyuru gönderir.", default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    options: [{ name: "mesaj", description: "Duyuru metni", type: 3, required: true }] },
  { name: "say", description: "Bot adına mesaj gönderir.", default_member_permissions: PermissionFlagsBits.ManageMessages.toString(),
    options: [{ name: "mesaj", description: "Gönderilecek mesaj", type: 3, required: true }] },
  { name: "embed", description: "Bot adına embed mesaj gönderir.", default_member_permissions: PermissionFlagsBits.ManageMessages.toString(),
    options: [{ name: "baslik", description: "Başlık", type: 3, required: true }, { name: "aciklama", description: "Açıklama", type: 3, required: true }] },

  { name: "ban", description: "Üyeyi sunucudan yasaklar.", default_member_permissions: PermissionFlagsBits.BanMembers.toString(),
    options: [{ name: "uye", description: "Üye", type: 6, required: true }, { name: "sebep", description: "Sebep", type: 3, required: false }] },
  { name: "unban", description: "Kullanıcının banını kaldırır.", default_member_permissions: PermissionFlagsBits.BanMembers.toString(),
    options: [{ name: "kullanici_id", description: "Kullanıcı ID", type: 3, required: true }] },
  { name: "kick", description: "Üyeyi sunucudan atar.", default_member_permissions: PermissionFlagsBits.KickMembers.toString(),
    options: [{ name: "uye", description: "Üye", type: 6, required: true }, { name: "sebep", description: "Sebep", type: 3, required: false }] },
  { name: "mute", description: "Üyeyi süreli susturur.", default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
    options: [{ name: "uye", description: "Üye", type: 6, required: true }, { name: "dakika", description: "Dakika", type: 4, required: true, min_value: 1, max_value: 10080 }, { name: "sebep", description: "Sebep", type: 3, required: false }] },
  { name: "unmute", description: "Üyenin susturmasını kaldırır.", default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
    options: [{ name: "uye", description: "Üye", type: 6, required: true }] },
  { name: "uyar", description: "Üyeye uyarı verir ve moderasyon loguna kaydeder.", default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
    options: [{ name: "uye", description: "Üye", type: 6, required: true }, { name: "sebep", description: "Sebep", type: 3, required: true }] },
  { name: "temizle", description: "Mesajları toplu siler.", default_member_permissions: PermissionFlagsBits.ManageMessages.toString(),
    options: [{ name: "miktar", description: "1-100", type: 4, required: true, min_value: 1, max_value: 100 }] },
  { name: "yavas-mod", description: "Kanala yavaş mod uygular.", default_member_permissions: PermissionFlagsBits.ManageChannels.toString(),
    options: [{ name: "saniye", description: "0-21600 saniye", type: 4, required: true, min_value: 0, max_value: 21600 }] },
  { name: "kilitle", description: "Mevcut kanalı üyeler için kilitler.", default_member_permissions: PermissionFlagsBits.ManageChannels.toString() },
  { name: "kilit-ac", description: "Mevcut kanalın kilidini açar.", default_member_permissions: PermissionFlagsBits.ManageChannels.toString() },

  { name: "kadin-rol", description: "Üyeye Kadın rolü verir veya kaldırır.", default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
    options: [{ name: "uye", description: "Üye", type: 6, required: true }, { name: "islem", description: "Ver veya kaldır", type: 3, required: true,
      choices: [{ name: "Ver", value: "ver" }, { name: "Kaldır", value: "kaldir" }] }] },
  { name: "rol-ver", description: "Yayıncı, İçerik Üreticisi veya VIP rolü verir.", default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
    options: [{ name: "uye", description: "Üye", type: 6, required: true }, { name: "rol", description: "Rol", type: 3, required: true,
      choices: [{ name: "🎥 Yayıncı", value: "yayinci" }, { name: "🎬 İçerik Üreticisi", value: "icerik" }, { name: "⭐ VIP", value: "vip" }, { name: "👤 İzleyici", value: "izleyici" }] }] },
  { name: "rol-al", description: "Üyeden bir KLOZN rolünü alır.", default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
    options: [{ name: "uye", description: "Üye", type: 6, required: true }, { name: "rol", description: "Rol", type: 3, required: true,
      choices: [{ name: "🎥 Yayıncı", value: "yayinci" }, { name: "🎬 İçerik Üreticisi", value: "icerik" }, { name: "⭐ VIP", value: "vip" }, { name: "👤 İzleyici", value: "izleyici" }, { name: "🌸 Kadın", value: "kadin" }] }] },

  { name: "kullanici-bilgi", description: "Bir üyenin bilgilerini gösterir.",
    options: [{ name: "uye", description: "Üye", type: 6, required: false }] },
  { name: "avatar", description: "Üyenin avatarını gösterir.",
    options: [{ name: "uye", description: "Üye", type: 6, required: false }] },
  { name: "sunucu-bilgi", description: "Sunucu bilgilerini gösterir." },
  { name: "rol-bilgi", description: "Bir rolün bilgilerini gösterir.",
    options: [{ name: "rol", description: "Rol", type: 8, required: true }] },
  { name: "ping", description: "Bot gecikmesini gösterir." },
  { name: "bilgi", description: "Bot ve sunucu sistemini gösterir." },

  { name: "anket", description: "Basit bir anket oluşturur.", default_member_permissions: PermissionFlagsBits.ManageMessages.toString(),
    options: [{ name: "soru", description: "Anket sorusu", type: 3, required: true }] },
  { name: "ticket-kur", description: "Gelişmiş ticket panelini oluşturur.", default_member_permissions: PermissionFlagsBits.Administrator.toString() },
  { name: "ticket-kapat", description: "Mevcut ticketı kapatır.", default_member_permissions: PermissionFlagsBits.ManageChannels.toString() },
  { name: "ticket-ekle", description: "Ticketa üye ekler.", default_member_permissions: PermissionFlagsBits.ManageChannels.toString(),
    options: [{ name: "uye", description: "Eklenecek üye", type: 6, required: true }] },
  { name: "ticket-cikar", description: "Ticketdan üye çıkarır.", default_member_permissions: PermissionFlagsBits.ManageChannels.toString(),
    options: [{ name: "uye", description: "Çıkarılacak üye", type: 6, required: true }] },
  { name: "ticket-devret", description: "Ticketı başka yetkiliye devreder.", default_member_permissions: PermissionFlagsBits.ManageChannels.toString(),
    options: [{ name: "uye", description: "Ticket sorumlusu", type: 6, required: true }] },
  { name: "ticket-bilgi", description: "Mevcut ticket bilgilerini gösterir." },
  { name: "klip", description: "Klip paylaşır. Sadece Yayıncı/İçerik Üreticisi/Yönetim.", options: [
      { name: "link", description: "Klip bağlantısı", type: 3, required: true },
      { name: "baslik", description: "Klip başlığı", type: 3, required: true }
    ] },
];

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(CONFIG.TOKEN);
  await rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID), { body: commands });
  // Eski global komutların görünmesini engelle.
  await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: [] }).catch(() => {});
  console.log(`✅ ${commands.length} guild slash komutu kaydedildi.`);
}

async function log(guild, title, description) {
  const ch = channel(guild, CH.SERVER_LOG);
  if (!ch?.isTextBased()) return;
  await ch.send({ embeds: [new EmbedBuilder().setTitle(title).setDescription(description).setTimestamp()] }).catch(() => {});
}

async function commandHandler(i) {
  const g = i.guild;
  const name = i.commandName;

  // Discord UI'da default permissions ayrıca uygulanır; bu sunucu tarafındaki ikinci güvenlik katmanıdır.
  const permissionMap = {
    "sunucu-yenile": () => admin(i),
    "kurulum": () => admin(i),
    "duyuru": () => admin(i),
    "ban": () => i.memberPermissions?.has(PermissionFlagsBits.BanMembers),
    "mute": () => i.memberPermissions?.has(PermissionFlagsBits.ModerateMembers),
    "temizle": () => i.memberPermissions?.has(PermissionFlagsBits.ManageMessages),
    "kadin-rol": () => i.memberPermissions?.has(PermissionFlagsBits.ManageRoles),
    "rol-ver": () => i.memberPermissions?.has(PermissionFlagsBits.ManageRoles),
    "ticket-kur": () => admin(i),
    "ticket-kapat": () => i.memberPermissions?.has(PermissionFlagsBits.ManageChannels),
    "ticket-ekle": () => i.memberPermissions?.has(PermissionFlagsBits.ManageChannels),
    "ticket-cikar": () => i.memberPermissions?.has(PermissionFlagsBits.ManageChannels),
    "ticket-devret": () => i.memberPermissions?.has(PermissionFlagsBits.ManageChannels),
    "say": () => i.memberPermissions?.has(PermissionFlagsBits.ManageMessages),
    "embed": () => i.memberPermissions?.has(PermissionFlagsBits.ManageMessages),
    "unban": () => i.memberPermissions?.has(PermissionFlagsBits.BanMembers),
    "kick": () => i.memberPermissions?.has(PermissionFlagsBits.KickMembers),
    "unmute": () => i.memberPermissions?.has(PermissionFlagsBits.ModerateMembers),
    "uyar": () => i.memberPermissions?.has(PermissionFlagsBits.ModerateMembers),
    "yavas-mod": () => i.memberPermissions?.has(PermissionFlagsBits.ManageChannels),
    "kilitle": () => i.memberPermissions?.has(PermissionFlagsBits.ManageChannels),
    "kilit-ac": () => i.memberPermissions?.has(PermissionFlagsBits.ManageChannels),
    "rol-al": () => i.memberPermissions?.has(PermissionFlagsBits.ManageRoles),
    "anket": () => i.memberPermissions?.has(PermissionFlagsBits.ManageMessages),
  };
  if (permissionMap[name] && !permissionMap[name]()) {
    return i.reply({ content: "🔒 Bu komutu kullanmak için gerekli yönetim iznine sahip değilsin.", flags: MessageFlags.Ephemeral });
  }

  if (name === "ping") return i.reply({ content: `🏓 Pong! **${client.ws.ping}ms**`, flags: MessageFlags.Ephemeral });
  if (name === "bilgi") return i.reply({
    embeds: [new EmbedBuilder().setTitle("🎥 KLOZN CREATOR").setDescription(
      "🔴 Yayıncı Merkezi\n🎬 İçerik Üretici Merkezi\n🛡️ Moderasyon\n🎫 Destek\n🌸 Kadınlara Özel\n🔐 Log Merkezi"
    )], flags: MessageFlags.Ephemeral
  });

  if (name === "sunucu-yenile") {
    await i.reply({ content: "♻️ **Tam sunucu yenileme başladı.** Kanallar ve yönetilebilir roller silinip şablon baştan kuruluyor...", flags: MessageFlags.Ephemeral });
    try {
      const x = await fullReset(g);
      await i.editReply(`✅ **Sunucu tamamen yenilendi!**\n🗑️ Kanallar: ${x.deletedChannels}\n⚠️ Silinemeyen kanallar: ${x.failedChannels}\n🎭 Roller: ${x.deletedRoles}\n⚠️ Silinemeyen roller: ${x.failedRoles}\n🏗️ Yeni roller: ${x.roles}`);
    } catch (e) {
      console.error("FULL RESET:", e);
      await i.editReply(`❌ Yenileme sırasında hata oluştu: \`${e.message}\``);
    }
    return;
  }

  if (name === "kurulum") {
    await i.reply({ content: "🏗️ KLOZN şablonu kuruluyor...", flags: MessageFlags.Ephemeral });
    try { await buildTemplate(g); await i.editReply("✅ Şablon kuruldu."); }
    catch (e) { await i.editReply(`❌ Kurulum hatası: ${e.message}`); }
    return;
  }

  if (name === "duyuru") {
    const msg = i.options.getString("mesaj", true);
    await g.channels.cache.find(c => c.name === CH.ANNOUNCE)?.send({ embeds: [new EmbedBuilder().setTitle("📢 KLOZN DUYURU").setDescription(msg).setTimestamp()] });
    return i.reply({ content: "✅ Duyuru gönderildi.", flags: MessageFlags.Ephemeral });
  }

  if (name === "ban") {
    const m = i.options.getMember("uye"); if (!m?.bannable) return i.reply({ content: "❌ Bu üyeyi banlayamıyorum.", flags: MessageFlags.Ephemeral });
    await m.ban({ reason: i.options.getString("sebep") || "Belirtilmedi" });
    return i.reply({ content: `🔨 ${m.user.tag} banlandı.`, flags: MessageFlags.Ephemeral });
  }

  if (name === "mute") {
    const m = i.options.getMember("uye"); const mins = i.options.getInteger("dakika", true);
    if (!m?.moderatable) return i.reply({ content: "❌ Bu üyeyi susturamıyorum.", flags: MessageFlags.Ephemeral });
    await m.timeout(mins * 60000, i.options.getString("sebep") || "Belirtilmedi");
    return i.reply({ content: `🔇 ${m.user.tag} ${mins} dakika susturuldu.`, flags: MessageFlags.Ephemeral });
  }

  if (name === "temizle") {
    const amount = i.options.getInteger("miktar", true);
    if (!i.channel?.isTextBased() || !("bulkDelete" in i.channel)) return i.reply({ content: "❌ Bu kanalda kullanılamaz.", flags: MessageFlags.Ephemeral });
    const result = await i.channel.bulkDelete(amount, true);
    return i.reply({ content: `🧹 ${result.size} mesaj silindi.`, flags: MessageFlags.Ephemeral });
  }

  if (name === "kadin-rol") {
    const m = i.options.getMember("uye"), action = i.options.getString("islem", true), r = role(g, R.KADIN);
    if (!m || !r) return i.reply({ content: "❌ Üye veya Kadın rolü bulunamadı.", flags: MessageFlags.Ephemeral });
    if (action === "ver") await m.roles.add(r); else await m.roles.remove(r);
    return i.reply({ content: action === "ver" ? `🌸 ${m} kullanıcısına Kadın rolü verildi.` : `🌸 ${m} kullanıcısından Kadın rolü kaldırıldı.`, flags: MessageFlags.Ephemeral });
  }

  if (name === "rol-ver") {
    const m = i.options.getMember("uye"), which = i.options.getString("rol", true);
    const map = { yayinci: R.YAYINCI, icerik: R.ICERIK, vip: R.VIP, izleyici: R.IZLEYICI };
    const r = role(g, map[which]);
    if (!m || !r) return i.reply({ content: "❌ Üye veya rol bulunamadı.", flags: MessageFlags.Ephemeral });
    await m.roles.add(r);
    return i.reply({ content: `✅ ${m} → **${r.name}** verildi.`, flags: MessageFlags.Ephemeral });
  }


  if (name === "say") {
    const msg = i.options.getString("mesaj", true);
    await i.channel.send({ content: msg });
    return i.reply({ content: "✅ Mesaj gönderildi.", flags: MessageFlags.Ephemeral });
  }

  if (name === "embed") {
    const title = i.options.getString("baslik", true);
    const desc = i.options.getString("aciklama", true);
    await i.channel.send({ embeds: [new EmbedBuilder().setTitle(title).setDescription(desc).setTimestamp()] });
    return i.reply({ content: "✅ Embed gönderildi.", flags: MessageFlags.Ephemeral });
  }

  if (name === "kick") {
    const m = i.options.getMember("uye");
    if (!m?.kickable) return i.reply({ content: "❌ Bu üyeyi atamıyorum. Rol hiyerarşisini kontrol et.", flags: MessageFlags.Ephemeral });
    await m.kick(i.options.getString("sebep") || "Belirtilmedi");
    return i.reply({ content: `👢 ${m.user.tag} sunucudan atıldı.`, flags: MessageFlags.Ephemeral });
  }

  if (name === "unban") {
    const id = i.options.getString("kullanici_id", true);
    await g.bans.remove(id);
    return i.reply({ content: `✅ \`${id}\` kullanıcısının banı kaldırıldı.`, flags: MessageFlags.Ephemeral });
  }

  if (name === "unmute") {
    const m = i.options.getMember("uye");
    if (!m?.moderatable) return i.reply({ content: "❌ Bu üyede işlem yapamıyorum.", flags: MessageFlags.Ephemeral });
    await m.timeout(null, "KLOZN unmute");
    return i.reply({ content: `🔊 ${m.user.tag} susturması kaldırıldı.`, flags: MessageFlags.Ephemeral });
  }

  if (name === "uyar") {
    const m = i.options.getMember("uye");
    const reason = i.options.getString("sebep", true);
    if (!m) return i.reply({ content: "❌ Üye bulunamadı.", flags: MessageFlags.Ephemeral });
    await log(g, "⚠️ Üye Uyarıldı", `**Üye:** ${m}\\n**Yetkili:** ${i.user}\\n**Sebep:** ${reason}`);
    return i.reply({ content: `⚠️ ${m.user.tag} uyarıldı ve loglandı.`, flags: MessageFlags.Ephemeral });
  }

  if (name === "yavas-mod") {
    if (!i.channel?.isTextBased() || !("setRateLimitPerUser" in i.channel)) return i.reply({ content: "❌ Bu kanalda kullanılamaz.", flags: MessageFlags.Ephemeral });
    const seconds = i.options.getInteger("saniye", true);
    await i.channel.setRateLimitPerUser(seconds, "KLOZN yavaş mod");
    return i.reply({ content: seconds ? `🐢 Yavaş mod **${seconds} saniye** yapıldı.` : "🐇 Yavaş mod kapatıldı.", flags: MessageFlags.Ephemeral });
  }

  if (name === "kilitle" || name === "kilit-ac") {
    if (!i.channel?.isTextBased()) return i.reply({ content: "❌ Bu kanalda kullanılamaz.", flags: MessageFlags.Ephemeral });
    const locked = name === "kilitle";
    await i.channel.permissionOverwrites.edit(g.roles.everyone, {
      SendMessages: locked ? false : null,
    }, { reason: `KLOZN ${name}` });
    return i.reply({ content: locked ? "🔒 Kanal kilitlendi." : "🔓 Kanalın kilidi açıldı." });
  }

  if (name === "rol-al") {
    const m = i.options.getMember("uye"), which = i.options.getString("rol", true);
    const map = { yayinci: R.YAYINCI, icerik: R.ICERIK, vip: R.VIP, izleyici: R.IZLEYICI, kadin: R.KADIN };
    const r = role(g, map[which]);
    if (!m || !r) return i.reply({ content: "❌ Üye veya rol bulunamadı.", flags: MessageFlags.Ephemeral });
    await m.roles.remove(r);
    return i.reply({ content: `🗑️ ${m} → **${r.name}** kaldırıldı.`, flags: MessageFlags.Ephemeral });
  }

  if (name === "kullanici-bilgi") {
    const m = i.options.getMember("uye") || i.member;
    const roles = m.roles.cache.filter(r => r.id !== g.id).map(r => r.name).join(", ") || "Rol yok";
    return i.reply({ embeds: [new EmbedBuilder()
      .setTitle(`👤 ${m.user.tag}`)
      .setThumbnail(m.user.displayAvatarURL({ size: 512 }))
      .addFields(
        { name: "🆔 ID", value: m.id, inline: true },
        { name: "📅 Hesap", value: `<t:${Math.floor(m.user.createdTimestamp/1000)}:R>`, inline: true },
        { name: "🏠 Katılım", value: m.joinedTimestamp ? `<t:${Math.floor(m.joinedTimestamp/1000)}:R>` : "Bilinmiyor", inline: true },
        { name: "🎭 Roller", value: roles.slice(0, 1024) }
      ).setTimestamp()] });
  }

  if (name === "avatar") {
    const m = i.options.getMember("uye") || i.member;
    return i.reply({ embeds: [new EmbedBuilder().setTitle(`🖼️ ${m.user.tag} Avatar`)
      .setImage(m.user.displayAvatarURL({ extension: "png", size: 1024 }))] });
  }

  if (name === "sunucu-bilgi") {
    return i.reply({ embeds: [new EmbedBuilder().setTitle(`🏠 ${g.name}`)
      .setThumbnail(g.iconURL({ size: 512 }))
      .addFields(
        { name: "👥 Üye", value: String(g.memberCount), inline: true },
        { name: "💬 Kanal", value: String(g.channels.cache.size), inline: true },
        { name: "🎭 Rol", value: String(g.roles.cache.size), inline: true },
        { name: "🚀 Boost", value: String(g.premiumSubscriptionCount ?? 0), inline: true }
      ).setTimestamp()] });
  }

  if (name === "rol-bilgi") {
    const r = i.options.getRole("rol", true);
    return i.reply({ embeds: [new EmbedBuilder().setTitle(`🎭 ${r.name}`)
      .addFields(
        { name: "🆔 ID", value: r.id, inline: true },
        { name: "👥 Üye", value: String(r.members.size), inline: true },
        { name: "📌 Pozisyon", value: String(r.position), inline: true },
        { name: "🎨 Renk", value: r.hexColor, inline: true }
      ).setTimestamp()] });
  }

  if (name === "anket") {
    const question = i.options.getString("soru", true);
    const msg = await i.channel.send({ embeds: [new EmbedBuilder().setTitle("📊 ANKET").setDescription(`**${question}**\n\n👍 Evet\n👎 Hayır`).setFooter({ text: `Oluşturan: ${i.user.tag}` })] });
    await msg.react("👍");
    await msg.react("👎");
    return i.reply({ content: "📊 Anket oluşturuldu.", flags: MessageFlags.Ephemeral });
  }

  if (name === "ticket-kur") {
    const ch = channel(g, CH.TICKET);
    if (!ch?.isTextBased()) return i.reply({ content: "❌ Ticket panel kanalı bulunamadı. Önce `/kurulum` çalıştır.", flags: MessageFlags.Ephemeral });

    const embed = new EmbedBuilder()
      .setTitle("🎫 KLOZN DESTEK MERKEZİ")
      .setDescription(
        "Sorununa uygun destek kategorisini seç ve özel ticket oluştur.\n\n" +
        "🎫 **Genel Destek** — Genel sorular\n" +
        "🛠️ **Teknik Destek** — Bot / Discord / teknik sorunlar\n" +
        "🤝 **Partnerlik** — İş birliği ve reklam\n" +
        "🔴 **Yayıncı Destek** — Yayıncı sistemi\n" +
        "🎬 **İçerik Üretici** — İçerik ve üretici desteği\n" +
        "🌸 **Kadın Destek** — Kadınlara özel destek\n" +
        "⚠️ **Şikayet / Bildirim** — Bildirim ve şikayetler\n\n" +
        "🔒 Ticketlar sadece sen ve yetkili ekip tarafından görülebilir."
      )
      .setFooter({ text: "KLOZN Support System • V2" })
      .setTimestamp();

    const rows = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_type_genel").setLabel("Genel").setEmoji("🎫").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ticket_type_teknik").setLabel("Teknik").setEmoji("🛠️").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ticket_type_partner").setLabel("Partnerlik").setEmoji("🤝").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ticket_type_yayin").setLabel("Yayıncı").setEmoji("🔴").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("ticket_type_icerik").setLabel("İçerik").setEmoji("🎬").setStyle(ButtonStyle.Success),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_type_kadin").setLabel("Kadın Destek").setEmoji("🌸").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ticket_type_sikayet").setLabel("Şikayet").setEmoji("⚠️").setStyle(ButtonStyle.Danger),
      ),
    ];

    await ch.send({ embeds: [embed], components: rows });
    return i.reply({ content: "✅ Gelişmiş ticket paneli gönderildi.", flags: MessageFlags.Ephemeral });
  }

  if (name === "ticket-kapat") {
    if (!i.channel?.name.startsWith("ticket-")) return i.reply({ content: "❌ Bu komut sadece ticket kanalında kullanılabilir.", flags: MessageFlags.Ephemeral });
    await i.reply({ content: "🔒 Ticket kapatılıyor..." });
    setTimeout(() => i.channel.delete("KLOZN ticket-kapat").catch(() => {}), 1200);
    return;
  }

  if (name === "ticket-ekle" || name === "ticket-cikar") {
    if (!i.channel?.name.startsWith("ticket-")) return i.reply({ content: "❌ Bu komut sadece ticket kanalında kullanılabilir.", flags: MessageFlags.Ephemeral });
    const m = i.options.getMember("uye");
    if (!m) return i.reply({ content: "❌ Üye bulunamadı.", flags: MessageFlags.Ephemeral });
    const allow = name === "ticket-ekle";
    await i.channel.permissionOverwrites.edit(m.id, { ViewChannel: allow, SendMessages: allow, ReadMessageHistory: allow });
    return i.reply({ content: allow ? `➕ ${m} ticketa eklendi.` : `➖ ${m} tickettan çıkarıldı.` });
  }

  if (name === "ticket-devret") {
    if (!i.channel?.name.startsWith("ticket-")) return i.reply({ content: "❌ Bu komut sadece ticket kanalında kullanılabilir.", flags: MessageFlags.Ephemeral });
    const m = i.options.getMember("uye");
    if (!m) return i.reply({ content: "❌ Üye bulunamadı.", flags: MessageFlags.Ephemeral });
    await i.channel.permissionOverwrites.edit(m.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
    return i.reply({ content: `🤝 Ticket ${m} kullanıcısına devredildi.` });
  }

  if (name === "ticket-bilgi") {
    if (!i.channel?.name.startsWith("ticket-")) return i.reply({ content: "❌ Bu komut sadece ticket kanalında kullanılabilir.", flags: MessageFlags.Ephemeral });
    const overwrites = i.channel.permissionOverwrites.cache.filter(x => x.allow.has(PermissionFlagsBits.ViewChannel));
    return i.reply({
      embeds: [new EmbedBuilder()
        .setTitle("🎫 Ticket Bilgileri")
        .addFields(
          { name: "📌 Kanal", value: i.channel.toString(), inline: true },
          { name: "👁️ Görüntüleyebilen", value: String(overwrites.size), inline: true },
          { name: "🕒 Oluşturulma", value: `<t:${Math.floor(i.channel.createdTimestamp / 1000)}:R>`, inline: true }
        )
        .setTimestamp()],
      flags: MessageFlags.Ephemeral
    });
  }


  if (name === "klip") {
    if (!isCreator(i)) return i.reply({ content: "🔒 Bu komut yalnızca Yayıncı, İçerik Üreticisi veya Yönetim içindir.", flags: MessageFlags.Ephemeral });
    const ch = channel(g, CH.CLIPS);
    if (!ch?.isTextBased()) return i.reply({ content: "❌ Klip kanalı bulunamadı.", flags: MessageFlags.Ephemeral });
    const link = i.options.getString("link", true), title = i.options.getString("baslik", true);
    await ch.send({ embeds: [new EmbedBuilder().setTitle(`🎬 ${title}`).setDescription(`🔗 [Klibi izle](${link})`).addFields({ name: "👤 Paylaşan", value: i.user.toString() }).setTimestamp()] });
    return i.reply({ content: "🎬 Klip paylaşıldı.", flags: MessageFlags.Ephemeral });
  }
}

client.on("interactionCreate", async i => {
  try {
    if (i.isChatInputCommand()) return commandHandler(i);
    if (!i.isButton()) return;

    if (i.customId === "klozn_register") {
      const g = i.guild, member = i.member, viewer = role(g, R.IZLEYICI), unreg = role(g, R.KAYITSIZ);
      if (!viewer) return i.reply({ content: "❌ İzleyici rolü bulunamadı.", flags: MessageFlags.Ephemeral });
      await member.roles.add(viewer);
      if (unreg) await member.roles.remove(unreg).catch(() => {});
      return i.reply({ content: "🎉 **Kayıt tamamlandı!** Topluluk kanallarına erişimin açıldı.", flags: MessageFlags.Ephemeral });
    }

    if (i.customId.startsWith("ticket_type_")) {
      const type = i.customId.replace("ticket_type_", "");
      const info = TICKET_TYPES[type];
      if (!info) return i.reply({ content: "❌ Geçersiz ticket türü.", flags: MessageFlags.Ephemeral });

      const g = i.guild;
      const existing = g.channels.cache.find(c => c.name === `ticket-${info.channel}-${i.user.id}`);
      if (existing) return i.reply({ content: `🎫 Bu kategoride zaten açık ticketın var: ${existing}`, flags: MessageFlags.Ephemeral });

      const parent = cat(g, C.SUPPORT);
      const roles = await createRoles(g);
      const isWomen = type === "kadin";
      const staffRoles = [roles.MOD.id, roles.KLOZN.id, roles.YONETIM.id];

      const overwrites = [
        { id: g.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: i.user.id, allow: text },
        ...staffRoles.map(id => ({ id, allow: text })),
      ];

      // Kadın destek ticketı da kadın rolüne özel görünür; yönetim/moderasyon yine erişebilir.
      if (isWomen) overwrites.push({ id: roles.KADIN.id, allow: text });

      const ticket = await g.channels.create({
        name: `ticket-${info.channel}-${i.user.id}`,
        type: ChannelType.GuildText,
        parent: parent?.id,
        permissionOverwrites: overwrites,
        topic: `${info.label} • ${i.user.tag}`,
        reason: `KLOZN ticket ${type}`,
      });

      const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("klozn_ticket_close").setLabel("Kapat").setEmoji("🔒").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("klozn_ticket_claim").setLabel("Üstlen").setEmoji("🙋").setStyle(ButtonStyle.Success),
      );

      await ticket.send({
        content: `${i.user} <@&${roles.MOD.id}>`,
        embeds: [new EmbedBuilder()
          .setTitle(`${info.emoji} ${info.label}`)
          .setDescription(
            `Merhaba ${i.user}, destek talebin oluşturuldu.\n\n` +
            `📌 **Kategori:** ${info.label}\n` +
            `👤 **Talep sahibi:** ${i.user}\n\n` +
            `Sorununu ayrıntılı şekilde yaz. Yetkili ekip burada yardımcı olacak.\n` +
            `🔒 Ticketı kapatmak için aşağıdaki butonu kullanabilirsin.`
          )
          .setFooter({ text: "KLOZN Support System" })
          .setTimestamp()],
        components: [controls],
      });

      await log(g, "🎫 Yeni Ticket", `**Tür:** ${info.label}\\n**Kullanıcı:** ${i.user}\\n**Kanal:** ${ticket}`);
      return i.reply({ content: `🎫 ${info.label} ticketın oluşturuldu: ${ticket}`, flags: MessageFlags.Ephemeral });
    }

    // Eski paneldeki tek buton da çalışmaya devam etsin.
    if (i.customId === "klozn_ticket") {
      i.customId = "ticket_type_genel";
      const fake = { ...i };
      // Eski butonu yeni sisteme yönlendirmek için aynı kodu tetiklemek yerine kullanıcıya yeni paneli kullanmasını söyle.
      return i.reply({ content: "🎫 Gelişmiş ticket panelini kullanarak kategori seçebilirsin. Yetkili `/ticket-kur` ile yeni paneli gönderebilir.", flags: MessageFlags.Ephemeral });
    }

    if (i.customId === "klozn_ticket_claim") {
      if (!admin(i) && !hasRole(i, R.MOD) && !hasRole(i, R.YONETIM) && !hasRole(i, R.KLOZN)) return i.reply({ content: "🔒 Sadece yetkili ekip ticketı üstlenebilir.", flags: MessageFlags.Ephemeral });
      await i.channel.permissionOverwrites.edit(i.user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      await i.reply({ content: `🙋 Ticket ${i.user} tarafından üstlenildi.` });
      return;
    }

    if (i.customId === "klozn_ticket_close") {
      if (!admin(i) && !hasRole(i, R.MOD) && !hasRole(i, R.YONETIM) && !hasRole(i, R.KLOZN)) return i.reply({ content: "🔒 Yetkin yok.", flags: MessageFlags.Ephemeral });
      await i.reply({ content: "🔒 Ticket kapatılıyor..." });
      setTimeout(() => i.channel?.delete("KLOZN ticket close").catch(() => {}), 1200);
    }
  } catch (e) {
    console.error("INTERACTION ERROR:", e);
    const payload = { content: "❌ Komut işlenirken hata oluştu. Render loglarını kontrol et.", flags: MessageFlags.Ephemeral };
    try { if (i.replied || i.deferred) await i.followUp(payload); else await i.reply(payload); } catch {}
  }
});

client.on("guildMemberAdd", async m => {
  const r = role(m.guild, R.KAYITSIZ);
  if (r) await m.roles.add(r).catch(() => {});
});

client.on("messageCreate", async m => {
  if (!CONFIG.AUTOMOD || !m.guild || m.author.bot || m.member?.permissions.has(PermissionFlagsBits.Administrator)) return;
  const bad = ["discord.gg/", "@everyone", "@here"];
  if (!bad.some(x => m.content.toLowerCase().includes(x.toLowerCase()))) return;
  await m.delete().catch(() => {});
  await m.member?.timeout(60000, "KLOZN AutoMod").catch(() => {});
});

const health = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, ready: client.isReady(), guilds: client.guilds.cache.size, uptime: Math.floor(process.uptime()) }));
  }
  res.writeHead(404); res.end("Not Found");
});
health.listen(CONFIG.PORT, "0.0.0.0", () => console.log(`🌐 Health server :${CONFIG.PORT}`));

client.once("ready", async () => {
  console.log(`🚀 KLOZN v11 aktif: ${client.user.tag}`);
  client.user.setPresence({ activities: [{ name: "KLOZN Creator", type: 3 }], status: "online" });
  try {
    await registerCommands();
    const g = client.guilds.cache.get(CONFIG.GUILD_ID);
    if (!g) console.error("❌ GUILD_ID sunucusu bulunamadı.");
    else console.log(`🏠 Sunucu hazır: ${g.name}`);
  } catch (e) { console.error("READY ERROR:", e); }
});

process.on("unhandledRejection", e => console.error("UNHANDLED:", e));
process.on("uncaughtException", e => console.error("UNCAUGHT:", e));

client.login(CONFIG.TOKEN);
