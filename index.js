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
  ActivityType
} = require('discord.js');
const http = require('http');
const https = require('https');

const CONFIG = {
  TOKEN: process.env.TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID,
  PORT: Number(process.env.PORT || 10000),
  YOUTUBE_CHANNEL_ID: process.env.YOUTUBE_CHANNEL_ID || '',
  YOUTUBE_RSS: String(process.env.YOUTUBE_RSS || 'false').toLowerCase() === 'true',
  AUTOMOD: String(process.env.AUTOMOD || 'true').toLowerCase() !== 'false'
};

if (!CONFIG.TOKEN || !CONFIG.CLIENT_ID || !CONFIG.GUILD_ID) {
  throw new Error('TOKEN, CLIENT_ID ve GUILD_ID Environment Variables içinde olmalı.');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const ROLE_NAMES = {
  KLOZN: 'KLOZN',
  YONETIM: '👑 Yönetim',
  MOD: '🛡️ Moderatör',
  YAYINCI: '🎥 Yayıncı',
  ICERIK: '🎬 İçerik Üreticisi',
  VIP: '⭐ VIP İzleyici',
  IZLEYICI: '👤 İzleyici',
  KAYITSIZ: '📝 Kayıtsız',
  BOT: '🤖 Bot',
  KADIN: '🌸 Kadın'
};

const COLORS = {
  KLOZN: 0x8b0000,
  YONETIM: 0xe74c3c,
  MOD: 0x3498db,
  YAYINCI: 0x9146ff,
  ICERIK: 0x00bfff,
  VIP: 0xf1c40f,
  IZLEYICI: 0x5865f2,
  KAYITSIZ: 0x7f8c8d,
  BOT: 0x2f3136,
  KADIN: 0xff69b4
};

const CATEGORIES = {
  WELCOME: '👋・BAŞLANGIÇ',
  COMMUNITY: '💬・TOPLULUK',
  STREAM: '🔴・YAYIN MERKEZİ',
  CONTENT: '🎬・İÇERİK MERKEZİ',
  CREATOR: '✨・ÜRETİCİ ALANI',
  GAMING: '🎮・OYUN & ETKİNLİK',
  SUPPORT: '🎫・DESTEK',
  STAFF: '🛡️・YÖNETİM',
  LOGS: '🔐・LOGLAR',
  VOICE: '🔊・SES ODALARI',
  WOMEN: '🌸・KADINLARA ÖZEL'
};

const CHANNELS = {
  REGISTER: '📝・kayıt-ol',
  RULES: '📜・kurallar',
  WELCOME: '👋・hos-geldin',
  CHAT: '💬・sohbet',
  MEDIA: '🖼️・medya',
  BOT: '🤖・bot-komutları',
  LIVE: '🔴・canlı-yayın',
  LIVE_CHAT: '💬・yayın-sohbet',
  CLIPS: '✂️・klipler',
  VIDEOS: '▶️・videolar',
  STREAMERS: '🎥・yayıncı-merkezi',
  STREAM_CHAT: '🎙️・yayıncı-sohbet',
  CONTENT_ROOM: '🎬・içerik-üretici-merkezi',
  CONTENT_CHAT: '💡・içerik-fikirleri',
  GAME: '🎮・oyun-sohbet',
  LOOKING: '🔎・oyuncu-ara',
  EVENTS: '🎉・etkinlikler',
  GIVEAWAY: '🎁・çekilişler',
  SUGGESTION: '💡・öneriler',
  TICKET: '🎫・destek-talebi',
  STAFF_CHAT: '👑・yönetim-sohbet',
  MOD_CHAT: '🛡️・moderasyon',
  APPLICATIONS: '📋・başvurular',
  SERVER_LOG: '📜・sunucu-log',
  MOD_LOG: '🛡️・moderasyon-log',
  MEMBER_LOG: '👥・üye-log',
  COMMAND_LOG: '🤖・komut-log',
  MESSAGE_LOG: '💬・mesaj-log',
  VOICE_LOG: '🔊・ses-log',
  GENERAL_VOICE: '💬・Genel Sohbet',
  GAMING_VOICE: '🎮・Oyun Odası',
  STREAM_VOICE: '🔴・Yayın Odası',
  STAFF_VOICE: '🛡️・Yönetim Odası',
  WOMEN_CHAT: '🌸・kadın-sohbet',
  WOMEN_VOICE: '🌸・Kadınlar Odası'
};

function embed(title, description) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setTimestamp()
    .setFooter({ text: 'KLOZN Creator • Sunucu Sistemi' });
}

function isAdmin(interaction) {
  return Boolean(interaction.guild && interaction.member?.permissions?.has(PermissionFlagsBits.Administrator));
}

function findRole(guild, name) {
  return guild.roles.cache.find(r => r.name === name);
}

function findCategory(guild, name) {
  return guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === name);
}

function findChannel(guild, name, parentId = null) {
  return guild.channels.cache.find(c => c.name === name && (parentId === null || c.parentId === parentId));
}

async function fetchGuildState(guild) {
  await guild.roles.fetch();
  await guild.channels.fetch();
  if (guild.members.me) await guild.members.me.fetch();
}

async function ensureRole(guild, name, color, permissions = []) {
  let role = findRole(guild, name);
  if (!role) {
    role = await guild.roles.create({
      name,
      color,
      permissions,
      hoist: true,
      mentionable: false,
      reason: 'KLOZN Creator şablon rolü'
    });
  } else {
    await role.edit({ color, hoist: true }, 'KLOZN rol senkronizasyonu').catch(() => {});
    if (permissions.length && (name === ROLE_NAMES.KLOZN || name === ROLE_NAMES.YONETIM || name === ROLE_NAMES.MOD)) {
      await role.setPermissions(permissions, 'KLOZN rol izin senkronizasyonu').catch(() => {});
    }
  }
  return role;
}

async function createRoles(guild) {
  const roles = {};
  roles.KLOZN = await ensureRole(guild, ROLE_NAMES.KLOZN, COLORS.KLOZN, [PermissionFlagsBits.Administrator]);
  roles.YONETIM = await ensureRole(guild, ROLE_NAMES.YONETIM, COLORS.YONETIM, [PermissionFlagsBits.Administrator]);
  roles.MOD = await ensureRole(guild, ROLE_NAMES.MOD, COLORS.MOD, [
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ModerateMembers,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.BanMembers
  ]);
  roles.YAYINCI = await ensureRole(guild, ROLE_NAMES.YAYINCI, COLORS.YAYINCI);
  roles.ICERIK = await ensureRole(guild, ROLE_NAMES.ICERIK, COLORS.ICERIK);
  roles.VIP = await ensureRole(guild, ROLE_NAMES.VIP, COLORS.VIP);
  roles.IZLEYICI = await ensureRole(guild, ROLE_NAMES.IZLEYICI, COLORS.IZLEYICI);
  roles.KAYITSIZ = await ensureRole(guild, ROLE_NAMES.KAYITSIZ, COLORS.KAYITSIZ);
  roles.BOT = await ensureRole(guild, ROLE_NAMES.BOT, COLORS.BOT);
  roles.KADIN = await ensureRole(guild, ROLE_NAMES.KADIN, COLORS.KADIN);
  return roles;
}

const TEXT_ALLOW = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory
];

const VOICE_ALLOW = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.Connect,
  PermissionFlagsBits.Speak
];

function everyoneDeny() {
  return [{ id: 'EVERYONE', deny: [PermissionFlagsBits.ViewChannel] }];
}

function publicOverwrites(guild, roles) {
  return [
    { id: guild.roles.everyone.id, allow: TEXT_ALLOW },
    { id: roles.IZLEYICI.id, allow: TEXT_ALLOW },
    { id: roles.VIP.id, allow: TEXT_ALLOW },
    { id: roles.YAYINCI.id, allow: TEXT_ALLOW },
    { id: roles.ICERIK.id, allow: TEXT_ALLOW },
    { id: roles.KADIN.id, allow: TEXT_ALLOW },
    { id: roles.MOD.id, allow: TEXT_ALLOW },
    { id: roles.YONETIM.id, allow: TEXT_ALLOW },
    { id: roles.KLOZN.id, allow: TEXT_ALLOW }
  ];
}

function registeredOnly(guild, roles) {
  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    { id: roles.IZLEYICI.id, allow: TEXT_ALLOW },
    { id: roles.VIP.id, allow: TEXT_ALLOW },
    { id: roles.YAYINCI.id, allow: TEXT_ALLOW },
    { id: roles.ICERIK.id, allow: TEXT_ALLOW },
    { id: roles.KADIN.id, allow: TEXT_ALLOW },
    { id: roles.MOD.id, allow: TEXT_ALLOW },
    { id: roles.YONETIM.id, allow: TEXT_ALLOW },
    { id: roles.KLOZN.id, allow: TEXT_ALLOW }
  ];
}

function registrationOverwrites(guild, roles) {
  return [
    { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
    { id: roles.KAYITSIZ.id, allow: TEXT_ALLOW },
    { id: roles.IZLEYICI.id, allow: TEXT_ALLOW },
    { id: roles.VIP.id, allow: TEXT_ALLOW },
    { id: roles.YAYINCI.id, allow: TEXT_ALLOW },
    { id: roles.ICERIK.id, allow: TEXT_ALLOW },
    { id: roles.KADIN.id, allow: TEXT_ALLOW },
    { id: roles.MOD.id, allow: TEXT_ALLOW },
    { id: roles.YONETIM.id, allow: TEXT_ALLOW },
    { id: roles.KLOZN.id, allow: TEXT_ALLOW }
  ];
}

function readOnlyEveryone(guild, roles) {
  return [
    { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
    { id: roles.KAYITSIZ.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
    { id: roles.IZLEYICI.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
    { id: roles.VIP.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
    { id: roles.YAYINCI.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
    { id: roles.ICERIK.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
    { id: roles.KADIN.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
    { id: roles.MOD.id, allow: TEXT_ALLOW },
    { id: roles.YONETIM.id, allow: TEXT_ALLOW },
    { id: roles.KLOZN.id, allow: TEXT_ALLOW }
  ];
}

function roleOnly(guild, roleList) {
  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    ...roleList.map(r => ({ id: r.id, allow: TEXT_ALLOW }))
  ];
}

function staffOnly(guild, roles) {
  return roleOnly(guild, [roles.MOD, roles.YONETIM, roles.KLOZN]);
}

function adminOnly(guild, roles) {
  return roleOnly(guild, [roles.YONETIM, roles.KLOZN]);
}

function creatorOnly(guild, roles) {
  return roleOnly(guild, [roles.YAYINCI, roles.ICERIK, roles.YONETIM, roles.KLOZN]);
}

function publisherOnly(guild, roles) {
  return roleOnly(guild, [roles.YAYINCI, roles.YONETIM, roles.KLOZN]);
}

function contentOnly(guild, roles) {
  return roleOnly(guild, [roles.ICERIK, roles.YONETIM, roles.KLOZN]);
}

function womenOnly(guild, roles) {
  // Kanal adı herkes tarafından görülebilir; içerik ve ses bağlantısı sadece Kadın/Yönetim/KLOZN'a açıktır.
  return [
    { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
    { id: roles.KAYITSIZ.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
    { id: roles.IZLEYICI.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
    { id: roles.VIP.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
    { id: roles.YAYINCI.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
    { id: roles.ICERIK.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
    { id: roles.MOD.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
    { id: roles.KADIN.id, allow: [...TEXT_ALLOW, ...VOICE_ALLOW] },
    { id: roles.YONETIM.id, allow: [...TEXT_ALLOW, ...VOICE_ALLOW] },
    { id: roles.KLOZN.id, allow: [...TEXT_ALLOW, ...VOICE_ALLOW] }
  ];
}

async function createCategory(guild, name, overwrites) {
  return guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
    permissionOverwrites: overwrites,
    reason: 'KLOZN Creator şablonu'
  });
}

async function createText(guild, name, parent, overwrites, topic = '') {
  return guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: parent.id,
    topic,
    permissionOverwrites: overwrites,
    reason: 'KLOZN Creator şablonu'
  });
}

async function createVoice(guild, name, parent, overwrites) {
  return guild.channels.create({
    name,
    type: ChannelType.GuildVoice,
    parent: parent.id,
    permissionOverwrites: overwrites,
    reason: 'KLOZN Creator şablonu'
  });
}

async function setupServer(guild) {
  await fetchGuildState(guild);
  const roles = await createRoles(guild);

  // Kayıtsız sadece başlangıç alanını görebilir.
  const welcome = await createCategory(guild, CATEGORIES.WELCOME, registrationOverwrites(guild, roles));
  const register = await createText(guild, CHANNELS.REGISTER, welcome, registrationOverwrites(guild, roles), 'Kayıt olmak için butona bas.');
  await createText(guild, CHANNELS.RULES, welcome, readOnlyEveryone(guild, roles), 'Sunucu kuralları.');
  await createText(guild, CHANNELS.WELCOME, welcome, readOnlyEveryone(guild, roles), 'Yeni üyeler burada karşılanır.');

  const community = await createCategory(guild, CATEGORIES.COMMUNITY, registeredOnly(guild, roles));
  await createText(guild, CHANNELS.CHAT, community, registeredOnly(guild, roles));
  await createText(guild, CHANNELS.MEDIA, community, registeredOnly(guild, roles));
  await createText(guild, CHANNELS.BOT, community, registeredOnly(guild, roles));

  const stream = await createCategory(guild, CATEGORIES.STREAM, registeredOnly(guild, roles));
  await createText(guild, CHANNELS.LIVE, stream, readOnlyEveryone(guild, roles), 'Yayın bildirimleri.');
  await createText(guild, CHANNELS.LIVE_CHAT, stream, registeredOnly(guild, roles));
  await createText(guild, CHANNELS.CLIPS, stream, registeredOnly(guild, roles));
  await createText(guild, CHANNELS.STREAMERS, stream, publisherOnly(guild, roles));

  const content = await createCategory(guild, CATEGORIES.CONTENT, registeredOnly(guild, roles));
  await createText(guild, CHANNELS.VIDEOS, content, readOnlyEveryone(guild, roles), 'Yeni videolar.');
  await createText(guild, CHANNELS.CONTENT_ROOM, content, contentOnly(guild, roles));
  await createText(guild, CHANNELS.CONTENT_CHAT, content, contentOnly(guild, roles));

  const creator = await createCategory(guild, CATEGORIES.CREATOR, creatorOnly(guild, roles));
  await createText(guild, CHANNELS.STREAM_CHAT, creator, publisherOnly(guild, roles));
  await createText(guild, CHANNELS.CONTENT_CHAT, creator, contentOnly(guild, roles));
  await createText(guild, CHANNELS.APPLICATIONS, creator, creatorOnly(guild, roles));

  const gaming = await createCategory(guild, CATEGORIES.GAMING, registeredOnly(guild, roles));
  await createText(guild, CHANNELS.GAME, gaming, registeredOnly(guild, roles));
  await createText(guild, CHANNELS.LOOKING, gaming, registeredOnly(guild, roles));
  await createText(guild, CHANNELS.EVENTS, gaming, registeredOnly(guild, roles));
  await createText(guild, CHANNELS.GIVEAWAY, gaming, registeredOnly(guild, roles));
  await createText(guild, CHANNELS.SUGGESTION, gaming, registeredOnly(guild, roles));

  const support = await createCategory(guild, CATEGORIES.SUPPORT, registeredOnly(guild, roles));
  await createText(guild, CHANNELS.TICKET, support, registeredOnly(guild, roles));

  const staff = await createCategory(guild, CATEGORIES.STAFF, staffOnly(guild, roles));
  await createText(guild, CHANNELS.STAFF_CHAT, staff, adminOnly(guild, roles));
  await createText(guild, CHANNELS.MOD_CHAT, staff, staffOnly(guild, roles));
  await createText(guild, CHANNELS.APPLICATIONS, staff, staffOnly(guild, roles));

  const logs = await createCategory(guild, CATEGORIES.LOGS, adminOnly(guild, roles));
  await createText(guild, CHANNELS.SERVER_LOG, logs, adminOnly(guild, roles));
  await createText(guild, CHANNELS.MOD_LOG, logs, staffOnly(guild, roles));
  await createText(guild, CHANNELS.MEMBER_LOG, logs, staffOnly(guild, roles));
  await createText(guild, CHANNELS.COMMAND_LOG, logs, staffOnly(guild, roles));
  await createText(guild, CHANNELS.MESSAGE_LOG, logs, staffOnly(guild, roles));
  await createText(guild, CHANNELS.VOICE_LOG, logs, staffOnly(guild, roles));

  const voice = await createCategory(guild, CATEGORIES.VOICE, registeredOnly(guild, roles));
  await createVoice(guild, CHANNELS.GENERAL_VOICE, voice, [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel] },
    { id: roles.IZLEYICI.id, allow: VOICE_ALLOW },
    { id: roles.VIP.id, allow: VOICE_ALLOW },
    { id: roles.YAYINCI.id, allow: VOICE_ALLOW },
    { id: roles.ICERIK.id, allow: VOICE_ALLOW },
    { id: roles.KADIN.id, allow: VOICE_ALLOW },
    { id: roles.MOD.id, allow: VOICE_ALLOW },
    { id: roles.YONETIM.id, allow: VOICE_ALLOW },
    { id: roles.KLOZN.id, allow: VOICE_ALLOW }
  ]);
  await createVoice(guild, CHANNELS.GAMING_VOICE, voice, registeredOnly(guild, roles));
  await createVoice(guild, CHANNELS.STREAM_VOICE, voice, publisherOnly(guild, roles));
  await createVoice(guild, CHANNELS.STAFF_VOICE, voice, staffOnly(guild, roles));

  const women = await createCategory(guild, CATEGORIES.WOMEN, womenOnly(guild, roles));
  await createText(guild, CHANNELS.WOMEN_CHAT, women, womenOnly(guild, roles), 'Kadın rolüne sahip üyelerin özel alanı.');
  await createVoice(guild, CHANNELS.WOMEN_VOICE, women, womenOnly(guild, roles));

  await register.send({
    embeds: [embed(
      '🎉 KLOZN CREATOR • KAYIT MERKEZİ',
      'Sunucuya hoş geldin!\n\n' +
      '📝 **Kayıt Ol** butonuna basınca **📝 Kayıtsız** rolün kaldırılır ve **👤 İzleyici** rolün verilir.\n\n' +
      '🎥 **Yayıncı** ve 🎬 **İçerik Üreticisi** alanları sadece ilgili role sahip üyelerindir.\n' +
      '🌸 **Kadınlara Özel** alanlar sadece **🌸 Kadın** rolü + yönetim tarafından görülebilir.\n' +
      '🛡️ Moderasyon ve 🔐 log kanalları normal üyelere kapalıdır.'
    )],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('klozn_register').setLabel('Kayıt Ol').setEmoji('✅').setStyle(ButtonStyle.Success)
    )]
  });

  return { roleCount: Object.keys(roles).length, channelCount: guild.channels.cache.size };
}

async function deleteAllChannels(guild) {
  await guild.channels.fetch();
  const channels = [...guild.channels.cache.values()]
    .filter(c => c.id !== guild.id && !c.isThread?.())
    .sort((a, b) => (a.type === ChannelType.GuildCategory ? 1 : 0) - (b.type === ChannelType.GuildCategory ? 1 : 0));

  let deleted = 0;
  const failed = [];
  for (const channel of channels) {
    try {
      await channel.delete('KLOZN /sunucu-yenile - tüm mevcut kanalları sil');
      deleted++;
    } catch (err) {
      failed.push(`${channel.name} (${channel.id})`);
      console.error(`[KANAL SİLİNEMEDİ] ${channel.name}:`, err.message);
    }
  }
  return { deleted, failed };
}

async function deleteAllManageableRoles(guild) {
  await guild.roles.fetch();
  if (guild.members.me) await guild.members.me.fetch();
  const highest = guild.members.me?.roles?.highest?.position ?? 0;
  const roles = [...guild.roles.cache.values()]
    .filter(r => r.id !== guild.id && !r.managed)
    .sort((a, b) => b.position - a.position);

  let deleted = 0;
  const failed = [];
  let managed = 0;
  for (const role of roles) {
    if (role.position >= highest) {
      failed.push(`${role.name} (${role.id}) - bot rolünün üstünde`);
      continue;
    }
    try {
      await role.delete('KLOZN /sunucu-yenile - tüm yönetilebilir rolleri sil');
      deleted++;
    } catch (err) {
      failed.push(`${role.name} (${role.id})`);
      console.error(`[ROL SİLİNEMEDİ] ${role.name}:`, err.message);
    }
  }
  managed = guild.roles.cache.filter(r => r.managed).size;
  return { deleted, failed, managed };
}

async function refreshServer(guild) {
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.Administrator)) {
    throw new Error('Botun Administrator yetkisi olmalı.');
  }

  // Tam sıfırlama: önce tüm kanallar, sonra yönetilebilir tüm roller.
  const channels = await deleteAllChannels(guild);
  const roles = await deleteAllManageableRoles(guild);
  const setup = await setupServer(guild);

  return {
    deletedChannels: channels.deleted,
    failedChannels: channels.failed,
    deletedRoles: roles.deleted,
    failedRoles: roles.failed,
    managedRolesRemaining: roles.managed,
    ...setup
  };
}

async function logAction(guild, title, description) {
  const channel = findChannel(guild, CHANNELS.SERVER_LOG);
  if (!channel?.isTextBased()) return;
  await channel.send({ embeds: [embed(title, description)] }).catch(() => {});
}

const adminPerm = PermissionFlagsBits.Administrator.toString();
const commands = [
  { name: 'sunucu-yenile', description: 'Mevcut kanalları ve yönetilebilir rolleri tamamen silip şablonu yeniden kurar.', default_member_permissions: adminPerm },
  { name: 'kurulum', description: 'KLOZN Creator sunucu şablonunu kurar.', default_member_permissions: adminPerm },
  {
    name: 'rol-ver', description: 'Bir üyeye KLOZN rolü verir veya kaldırır.', default_member_permissions: adminPerm,
    options: [
      { name: 'uye', description: 'Üye', type: 6, required: true },
      { name: 'rol', description: 'Verilecek rol', type: 3, required: true, choices: [
        { name: '🎥 Yayıncı', value: 'YAYINCI' },
        { name: '🎬 İçerik Üreticisi', value: 'ICERIK' },
        { name: '⭐ VIP İzleyici', value: 'VIP' },
        { name: '🌸 Kadın', value: 'KADIN' },
        { name: '👤 İzleyici', value: 'IZLEYICI' }
      ]},
      { name: 'islem', description: 'Rol işlemi', type: 3, required: true, choices: [{ name: 'Ver', value: 'ver' }, { name: 'Kaldır', value: 'kaldir' }] }
    ]
  },
  { name: 'duyuru', description: 'Sunucuda duyuru gönderir.', default_member_permissions: adminPerm, options: [{ name: 'mesaj', description: 'Duyuru', type: 3, required: true }] },
  { name: 'ban', description: 'Üyeyi yasaklar.', default_member_permissions: adminPerm, options: [{ name: 'uye', description: 'Üye', type: 6, required: true }, { name: 'sebep', description: 'Sebep', type: 3, required: false }] },
  { name: 'mute', description: 'Üyeyi süreli susturur.', default_member_permissions: adminPerm, options: [{ name: 'uye', description: 'Üye', type: 6, required: true }, { name: 'sure', description: 'Dakika', type: 4, required: true, min_value: 1, max_value: 10080 }, { name: 'sebep', description: 'Sebep', type: 3, required: false }] },
  { name: 'temizle', description: 'Mesajları temizler.', default_member_permissions: adminPerm, options: [{ name: 'miktar', description: '1-100', type: 4, required: true, min_value: 1, max_value: 100 }] },
  { name: 'ticket-kur', description: 'Destek panelini gönderir.', default_member_permissions: adminPerm },
  { name: 'klip', description: 'Klipler kanalına klip gönderir.', options: [{ name: 'link', description: 'Klip bağlantısı', type: 3, required: true }, { name: 'baslik', description: 'Başlık', type: 3, required: true }] },
  { name: 'bilgi', description: 'Bot ve sunucu sistemi hakkında bilgi verir.' },
  { name: 'ping', description: 'Bot gecikmesini gösterir.' }
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
  await rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID), { body: commands });
  // Eski global komutlar varsa temizle; böylece eski /komutlar görünmez.
  await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: [] }).catch(err => console.warn('Global komut temizleme:', err.message));
  console.log(`✅ ${commands.length} guild slash komutu kaydedildi; eski global komutlar temizlendi.`);
}

async function handleCommand(interaction) {
  const command = interaction.commandName;
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: '❌ Bu komut sadece sunucuda kullanılabilir.', ephemeral: true });

  const adminCommands = new Set(['sunucu-yenile', 'kurulum', 'rol-ver', 'duyuru', 'ban', 'mute', 'temizle', 'ticket-kur']);
  if (adminCommands.has(command) && !isAdmin(interaction)) {
    return interaction.reply({ content: '🔒 Bu komut sadece **Yönetici** yetkisine sahip kişiler içindir.', ephemeral: true });
  }

  if (command === 'ping') return interaction.reply({ content: `🏓 Pong! API: **${client.ws.ping}ms**`, ephemeral: true });

  if (command === 'bilgi') {
    return interaction.reply({ embeds: [embed('🎥 KLOZN CREATOR',
      '🔴 Yayıncı merkezi\n🎬 İçerik üreticisi merkezi\n🌸 Kadınlara özel alan\n🛡️ Moderasyon alanı\n🔐 Log sistemi\n\n♻️ **/sunucu-yenile** tüm yönetilebilir kanal ve rolleri silip şablonu sıfırdan kurar.')], ephemeral: true });
  }

  if (command === 'sunucu-yenile') {
    await interaction.reply({ content: '⚠️ **TAM SUNUCU YENİLEME BAŞLADI.**\n\n🗑️ Kanallar siliniyor...\n🎭 Yönetilebilir roller siliniyor...\n🏗️ Roller + kategoriler + kanallar yeniden kuruluyor...\n\n⏳ Lütfen işlem bitene kadar botu kapatma.', ephemeral: true });
    try {
      const result = await refreshServer(guild);
      await interaction.editReply(
        '✅ **SUNUCU TAMAMEN YENİLENDİ!**\n\n' +
        `🗑️ Silinen kanal: **${result.deletedChannels}**\n` +
        `⚠️ Silinemeyen kanal: **${result.failedChannels.length}**\n` +
        `🎭 Silinen rol: **${result.deletedRoles}**\n` +
        `⚠️ Silinemeyen rol: **${result.failedRoles.length}**\n` +
        `🏗️ Oluşturulan şablon rolü: **${result.roleCount}**\n\n` +
        '👤 Kayıtsız → sadece başlangıç/kayıt alanı\n' +
        '👤 İzleyici → normal topluluk alanları\n' +
        '🎥 Yayıncı → yayıncı alanları\n' +
        '🎬 İçerik Üreticisi → içerik alanları\n' +
        '🌸 Kadın → kadınlara özel alanlar\n' +
        '🛡️ Moderatör → moderasyon alanları\n' +
        '👑 Yönetim/KLOZN → yönetim + loglar'
      );
      await logAction(guild, '♻️ TAM SUNUCU YENİLEME', `${interaction.user.tag} sunucu şablonunu sıfırdan kurdu.`);
    } catch (err) {
      console.error('SUNUCU YENİLEME HATASI:', err);
      await interaction.editReply(`❌ **Yenileme başarısız:** ${err.message}\n\nBotun Administrator yetkisini ve bot rolünün diğer rollerin üstünde olduğunu kontrol et.`).catch(() => {});
    }
    return;
  }

  if (command === 'kurulum') {
    await interaction.reply({ content: '⚙️ KLOZN şablonu kuruluyor...', ephemeral: true });
    try {
      const result = await setupServer(guild);
      await interaction.editReply(`✅ Kurulum tamamlandı. 🎭 ${result.roleCount} şablon rolü hazırlandı.`);
    } catch (err) {
      await interaction.editReply(`❌ Kurulum başarısız: ${err.message}`);
    }
    return;
  }

  if (command === 'rol-ver') {
    const member = interaction.options.getMember('uye');
    const key = interaction.options.getString('rol', true);
    const action = interaction.options.getString('islem', true);
    const role = findRole(guild, ROLE_NAMES[key]);
    if (!member || !role) return interaction.reply({ content: '❌ Üye veya rol bulunamadı. Önce /kurulum ya da /sunucu-yenile çalıştır.', ephemeral: true });
    try {
      if (action === 'ver') {
        await member.roles.add(role, 'KLOZN rol yönetimi');
        if (key === 'IZLEYICI') {
          const unreg = findRole(guild, ROLE_NAMES.KAYITSIZ);
          if (unreg) await member.roles.remove(unreg, 'KLOZN kayıt rolü temizleme');
        }
        return interaction.reply({ content: `✅ ${member} → **${role.name}** rolü verildi.`, ephemeral: true });
      }
      await member.roles.remove(role, 'KLOZN rol yönetimi');
      return interaction.reply({ content: `✅ ${member} → **${role.name}** rolü kaldırıldı.`, ephemeral: true });
    } catch (err) {
      return interaction.reply({ content: `❌ Rol işlemi başarısız: ${err.message}`, ephemeral: true });
    }
  }

  if (command === 'duyuru') {
    const mesaj = interaction.options.getString('mesaj', true);
    await interaction.channel.send({ content: '@everyone', embeds: [embed('📢 KLOZN DUYURU', mesaj)] });
    return interaction.reply({ content: '✅ Duyuru gönderildi.', ephemeral: true });
  }

  if (command === 'ban') {
    const member = interaction.options.getMember('uye');
    if (!member?.bannable) return interaction.reply({ content: '❌ Bu üyeyi banlayamıyorum. Bot rol sırasını kontrol et.', ephemeral: true });
    await member.ban({ reason: interaction.options.getString('sebep') || 'KLOZN moderasyon' });
    return interaction.reply({ content: `🔨 **${member.user.tag}** banlandı.`, ephemeral: true });
  }

  if (command === 'mute') {
    const member = interaction.options.getMember('uye');
    const minutes = interaction.options.getInteger('sure', true);
    if (!member?.moderatable) return interaction.reply({ content: '❌ Bu üyeyi susturamıyorum.', ephemeral: true });
    await member.timeout(minutes * 60 * 1000, interaction.options.getString('sebep') || 'KLOZN moderasyon');
    return interaction.reply({ content: `🔇 **${member.user.tag}** ${minutes} dakika susturuldu.`, ephemeral: true });
  }

  if (command === 'temizle') {
    const amount = interaction.options.getInteger('miktar', true);
    if (!interaction.channel?.isTextBased() || !('bulkDelete' in interaction.channel)) return interaction.reply({ content: '❌ Bu kanalda toplu silme yapılamıyor.', ephemeral: true });
    const deleted = await interaction.channel.bulkDelete(amount, true);
    return interaction.reply({ content: `🧹 **${deleted.size}** mesaj temizlendi.`, ephemeral: true });
  }

  if (command === 'ticket-kur') {
    const support = findCategory(guild, CATEGORIES.SUPPORT);
    const channel = support && findChannel(guild, CHANNELS.TICKET, support.id);
    if (!channel?.isTextBased()) return interaction.reply({ content: '❌ Destek kanalı bulunamadı. Önce /sunucu-yenile çalıştır.', ephemeral: true });
    await channel.send({
      embeds: [embed('🎫 KLOZN DESTEK', 'Destek talebi açmak için aşağıdaki butona bas.')],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('klozn_ticket').setLabel('Ticket Aç').setEmoji('🎫').setStyle(ButtonStyle.Primary))]
    });
    return interaction.reply({ content: '✅ Ticket paneli gönderildi.', ephemeral: true });
  }

  if (command === 'klip') {
    const member = interaction.member;
    const allowed = [ROLE_NAMES.YAYINCI, ROLE_NAMES.ICERIK, ROLE_NAMES.MOD, ROLE_NAMES.YONETIM, ROLE_NAMES.KLOZN].some(n => member.roles.cache.some(r => r.name === n));
    if (!allowed) return interaction.reply({ content: '🎥 Bu komut sadece Yayıncı/İçerik Üreticisi/Yönetim içindir.', ephemeral: true });
    const channel = findChannel(guild, CHANNELS.CLIPS);
    if (!channel?.isTextBased()) return interaction.reply({ content: '❌ Klip kanalı bulunamadı.', ephemeral: true });
    const link = interaction.options.getString('link', true);
    const title = interaction.options.getString('baslik', true);
    await channel.send({ embeds: [new EmbedBuilder().setTitle(`✂️ ${title}`).setDescription(`🔗 [Klibi izle](${link})`).addFields({ name: '👤 Paylaşan', value: interaction.user.toString() }).setTimestamp()] });
    return interaction.reply({ content: '🎬 Klip paylaşıldı.', ephemeral: true });
  }
}

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) return handleCommand(interaction);
    if (!interaction.isButton()) return;

    if (interaction.customId === 'klozn_register') {
      const guild = interaction.guild;
      const member = interaction.member;
      const viewer = findRole(guild, ROLE_NAMES.IZLEYICI);
      const unregistered = findRole(guild, ROLE_NAMES.KAYITSIZ);
      if (!viewer) return interaction.reply({ content: '❌ İzleyici rolü bulunamadı. /sunucu-yenile çalıştır.', ephemeral: true });
      await member.roles.add(viewer, 'KLOZN kayıt');
      if (unregistered && member.roles.cache.has(unregistered.id)) await member.roles.remove(unregistered, 'KLOZN kayıt tamamlandı');
      return interaction.reply({ content: '🎉 **Kayıt tamamlandı!** Normal topluluk kanallarına erişimin açıldı.', ephemeral: true });
    }

    if (interaction.customId === 'klozn_ticket') {
      const guild = interaction.guild;
      const support = findCategory(guild, CATEGORIES.SUPPORT);
      const roles = await createRoles(guild);
      const existing = guild.channels.cache.find(c => c.name === `ticket-${interaction.user.id}`);
      if (existing) return interaction.reply({ content: `🎫 Zaten açık ticket'ın var: ${existing}`, ephemeral: true });
      const ticket = await guild.channels.create({
        name: `ticket-${interaction.user.id}`,
        type: ChannelType.GuildText,
        parent: support?.id,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: TEXT_ALLOW },
          { id: roles.MOD.id, allow: TEXT_ALLOW },
          { id: roles.YONETIM.id, allow: TEXT_ALLOW },
          { id: roles.KLOZN.id, allow: TEXT_ALLOW }
        ],
        reason: 'KLOZN ticket'
      });
      await ticket.send({
        content: `${interaction.user}`,
        embeds: [embed('🎫 KLOZN DESTEK', 'Destek talebin oluşturuldu. Yetkili bekleyebilirsin.')],
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('klozn_ticket_close').setLabel('Ticket Kapat').setEmoji('🔒').setStyle(ButtonStyle.Danger))]
      });
      return interaction.reply({ content: `🎫 Ticket oluşturuldu: ${ticket}`, ephemeral: true });
    }

    if (interaction.customId === 'klozn_ticket_close') {
      if (!isAdmin(interaction)) return interaction.reply({ content: '🔒 Ticket kapatmak için Yönetici gerekir.', ephemeral: true });
      await interaction.reply({ content: '🔒 Ticket kapatılıyor...', ephemeral: true });
      setTimeout(() => interaction.channel?.delete('KLOZN ticket kapatma').catch(() => {}), 800);
    }
  } catch (err) {
    console.error('[INTERACTION ERROR]', err);
    const reply = { content: '❌ İşlem sırasında hata oluştu. Render loglarını kontrol et.', ephemeral: true };
    try {
      if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
      else await interaction.reply(reply);
    } catch {}
  }
});

client.on('guildMemberAdd', async member => {
  try {
    const role = findRole(member.guild, ROLE_NAMES.KAYITSIZ);
    if (role) await member.roles.add(role, 'KLOZN yeni üye - kayıtsız');
    await logAction(member.guild, '👤 ÜYE GİRDİ', `**Üye:** ${member.user.tag}\n**ID:** ${member.id}`);
  } catch (err) {
    console.error('guildMemberAdd:', err.message);
  }
});

client.on('guildMemberRemove', async member => {
  await logAction(member.guild, '🚪 ÜYE ÇIKTI', `**Üye:** ${member.user.tag}\n**ID:** ${member.id}`).catch(() => {});
});

const BAD_WORDS = ['discord.gg/', 'http://', 'https://', '@everyone', '@here'];
client.on('messageCreate', async message => {
  if (!CONFIG.AUTOMOD || !message.guild || message.author.bot) return;
  try {
    if (message.member?.permissions?.has(PermissionFlagsBits.Administrator)) return;
    const content = message.content.toLowerCase();
    if (!BAD_WORDS.some(word => content.includes(word.toLowerCase()))) return;
    await message.delete().catch(() => {});
    await message.member?.timeout(60_000, 'KLOZN AutoMod').catch(() => {});
    await logAction(message.guild, '🛡️ AUTOMOD', `**Üye:** ${message.author.tag}\n**Kanal:** ${message.channel}\n**İçerik:** ${message.content}`);
  } catch (err) {
    console.error('AutoMod:', err.message);
  }
});

let lastYouTubeVideo = null;
function checkYouTube() {
  if (!CONFIG.YOUTUBE_RSS || !CONFIG.YOUTUBE_CHANNEL_ID) return;
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(CONFIG.YOUTUBE_CHANNEL_ID)}`;
  https.get(url, response => {
    let data = '';
    response.on('data', chunk => { data += chunk; });
    response.on('end', async () => {
      const idMatch = data.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
      const titleMatch = data.match(/<media:title>(.*?)<\/media:title>/);
      if (!idMatch) return;
      const videoId = idMatch[1];
      if (lastYouTubeVideo === videoId) return;
      lastYouTubeVideo = videoId;
      const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
      const channel = guild && findChannel(guild, CHANNELS.VIDEOS);
      if (!channel?.isTextBased()) return;
      await channel.send({ embeds: [embed('▶️ KLOZN YENİ VİDEO', `**${titleMatch ? titleMatch[1] : 'Yeni YouTube Videosu'}**\n\n🔗 https://www.youtube.com/watch?v=${videoId}`)] }).catch(() => {});
    });
  }).on('error', err => console.error('YouTube RSS:', err.message));
}

const healthServer = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, service: 'KLOZN Discord Bot', discordReady: client.isReady(), guilds: client.guilds.cache.size, uptimeSeconds: Math.floor(process.uptime()), timestamp: new Date().toISOString() }));
    return;
  }
  res.writeHead(404);
  res.end('Not Found');
});

healthServer.listen(CONFIG.PORT, '0.0.0.0', () => console.log(`🌐 HTTP health server: 0.0.0.0:${CONFIG.PORT}`));

client.once('ready', async readyClient => {
  console.log('==========================================');
  console.log(`🚀 KLOZN CREATOR BOT AKTİF • v10.0.0`);
  console.log(`🤖 Bot: ${readyClient.user.tag}`);
  console.log(`🏠 Guild cache: ${readyClient.guilds.cache.size}`);
  console.log(`🎯 Hedef Guild: ${CONFIG.GUILD_ID}`);
  console.log('🔐 /sunucu-yenile: SADECE YÖNETİCİ');
  console.log('👤 Kayıtsız: sadece başlangıç alanı');
  console.log('🌸 Kadın: sadece KADIN + Yönetim/KLOZN');
  console.log('==========================================');

  readyClient.user.setPresence({ activities: [{ name: 'KLOZN Creator', type: ActivityType.Watching }], status: 'online' });

  try {
    await registerCommands();
  } catch (err) {
    console.error('Slash komut kayıt hatası:', err);
  }

  const guild = readyClient.guilds.cache.get(CONFIG.GUILD_ID);
  if (!guild) {
    console.error('❌ GUILD_ID ile belirtilen sunucu bulunamadı.');
    return;
  }
  try {
    await fetchGuildState(guild);
    console.log('✅ Discord sunucu önbelleği hazır.');
  } catch (err) {
    console.error('Guild fetch:', err.message);
  }

  if (CONFIG.YOUTUBE_RSS) {
    checkYouTube();
    setInterval(checkYouTube, 120_000);
  }

  setInterval(() => console.log(`[HEALTH] ready=${readyClient.isReady()} guilds=${readyClient.guilds.cache.size} ping=${readyClient.ws.ping} uptime=${Math.floor(process.uptime())}s`), 60_000);
});

client.on('error', err => console.error('[DISCORD CLIENT ERROR]', err));
client.on('shardError', err => console.error('[DISCORD SHARD ERROR]', err));
process.on('unhandledRejection', err => console.error('[UNHANDLED REJECTION]', err));
process.on('uncaughtException', err => console.error('[UNCAUGHT EXCEPTION]', err));

client.login(CONFIG.TOKEN).catch(err => {
  console.error('❌ Discord login başarısız:', err);
  process.exit(1);
});
