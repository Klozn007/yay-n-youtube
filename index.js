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
  Routes
} = require("discord.js");
const http = require("http");
const https = require("https");

const CONFIG = {
  TOKEN: process.env.TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID,
  PORT: Number(process.env.PORT || 10000),
  YOUTUBE_CHANNEL_ID: process.env.YOUTUBE_CHANNEL_ID || "",
  YOUTUBE_RSS: String(process.env.YOUTUBE_RSS || "false").toLowerCase() === "true",
  AUTOMOD: String(process.env.AUTOMOD || "true").toLowerCase() !== "false"
};

if (!CONFIG.TOKEN || !CONFIG.CLIENT_ID || !CONFIG.GUILD_ID) {
  throw new Error("TOKEN, CLIENT_ID ve GUILD_ID Environment Variables içinde olmalı.");
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
  KLOZN: "KLOZN",
  YONETIM: "Yönetim",
  MOD: "Moderatör",
  YAYINCI: "🎥 Yayıncı",
  ICERIK: "🎬 İçerik Üreticisi",
  VIP: "⭐ VIP İzleyici",
  IZLEYICI: "👤 İzleyici",
  KAYITSIZ: "📝 Kayıtsız",
  BOT: "🤖 Bot",
  KADIN: "🌸 Kadın"
};

const CATEGORY_NAMES = {
  WELCOME: "👋・BAŞLANGIÇ",
  GENERAL: "💬・TOPLULUK",
  STREAM: "🔴・YAYIN MERKEZİ",
  CONTENT: "🎬・İÇERİK MERKEZİ",
  CREATOR: "✨・ÜRETİCİ ALANI",
  COMMUNITY: "🎮・OYUN & ETKİNLİK",
  SUPPORT: "🎫・DESTEK",
  STAFF: "🛡️・YÖNETİM",
  LOGS: "🔐・LOGLAR",
  VOICE: "🔊・SES ODALARI",
  WOMEN: "🌸・KADINLARA ÖZEL"
};

const CHANNEL_NAMES = {
  REGISTER: "📝・kayıt-ol",
  RULES: "📜・kurallar",
  WELCOME: "👋・hos-geldin",
  CHAT: "💬・sohbet",
  MEDIA: "🖼️・medya",
  BOT: "🤖・bot-komutları",
  LIVE: "🔴・canlı-yayın",
  LIVE_CHAT: "💬・yayın-sohbet",
  CLIPS: "✂️・klipler",
  VIDEOS: "▶️・videolar",
  STREAMERS: "🎥・yayıncı-odası",
  STREAM_CHAT: "🎙️・yayıncı-sohbet",
  CONTENT_ROOM: "🎬・icerik-üretici-odası",
  CONTENT_CHAT: "💡・icerik-fikirleri",
  GAME: "🎮・oyun-sohbet",
  LOOKING: "🔎・oyuncu-ara",
  EVENTS: "🎉・etkinlikler",
  GIVEAWAY: "🎁・çekilişler",
  SUGGESTION: "💡・öneriler",
  TICKET: "🎫・destek",
  STAFF_CHAT: "🛡️・yönetim-sohbet",
  MOD_CHAT: "🔨・moderasyon",
  APPLICATIONS: "📋・başvurular",
  SERVER_LOG: "📜・sunucu-log",
  MOD_LOG: "🔨・moderasyon-log",
  MEMBER_LOG: "👥・üye-log",
  COMMAND_LOG: "🤖・komut-log",
  MESSAGE_LOG: "💬・mesaj-log",
  VOICE_LOG: "🔊・ses-log",
  GENERAL_VOICE: "💬・Genel Sohbet",
  GAMING_VOICE: "🎮・Oyun Odası",
  STREAM_VOICE: "🔴・Yayın Odası",
  STAFF_VOICE: "🛡️・Yönetim Odası",
  WOMEN_CHAT: "🌸・kadın-sohbet",
  WOMEN_VOICE: "🌸・Kadınlar Odası"
};

const COLORS = {
  KLOZN: 0x8b0000,
  YONETIM: 0xff0000,
  MOD: 0x00ff7f,
  YAYINCI: 0x9146ff,
  ICERIK: 0x00bfff,
  VIP: 0xffd700,
  IZLEYICI: 0x5865f2,
  KAYITSIZ: 0x808080,
  BOT: 0x5865f2,
  KADIN: 0xff69b4
};

function isAdmin(interaction) {
  return Boolean(
    interaction.guild &&
    interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

function findRole(guild, name) {
  return guild.roles.cache.find(r => r.name === name);
}

function findCategory(guild, name) {
  return guild.channels.cache.find(
    c => c.type === ChannelType.GuildCategory && c.name === name
  );
}

function findChannel(guild, name, parentId = null) {
  return guild.channels.cache.find(c =>
    c.name === name && (parentId === null || c.parentId === parentId)
  );
}

async function ensureRole(guild, name, color, permissions = []) {
  let role = findRole(guild, name);
  if (!role) {
    role = await guild.roles.create({
      name,
      color,
      permissions,
      hoist: true,
      reason: "KLOZN Creator template"
    });
  } else {
    try {
      await role.setColor(color, "KLOZN template sync");
      await role.setHoist(true, "KLOZN template sync");
      if (name === ROLE_NAMES.KLOZN || name === ROLE_NAMES.YONETIM) {
        await role.setPermissions([PermissionFlagsBits.Administrator], "KLOZN admin role sync");
      }
    } catch (err) {
      console.warn(`Rol güncellenemedi: ${name}: ${err.message}`);
    }
  }
  return role;
}

async function createRoles(guild) {
  return {
    KLOZN: await ensureRole(guild, ROLE_NAMES.KLOZN, COLORS.KLOZN, [PermissionFlagsBits.Administrator]),
    YONETIM: await ensureRole(guild, ROLE_NAMES.YONETIM, COLORS.YONETIM, [PermissionFlagsBits.Administrator]),
    MOD: await ensureRole(guild, ROLE_NAMES.MOD, COLORS.MOD, [
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ModerateMembers
    ]),
    YAYINCI: await ensureRole(guild, ROLE_NAMES.YAYINCI, COLORS.YAYINCI),
    ICERIK: await ensureRole(guild, ROLE_NAMES.ICERIK, COLORS.ICERIK),
    VIP: await ensureRole(guild, ROLE_NAMES.VIP, COLORS.VIP),
    IZLEYICI: await ensureRole(guild, ROLE_NAMES.IZLEYICI, COLORS.IZLEYICI),
    KAYITSIZ: await ensureRole(guild, ROLE_NAMES.KAYITSIZ, COLORS.KAYITSIZ),
    BOT: await ensureRole(guild, ROLE_NAMES.BOT, COLORS.BOT),
    KADIN: await ensureRole(guild, ROLE_NAMES.KADIN, COLORS.KADIN)
  };
}

const textAllow = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory
];

function overwritesForEveryone(guild, roles) {
  return [
    { id: guild.roles.everyone.id, allow: textAllow },
    ...[
      roles.KLOZN, roles.YONETIM, roles.MOD, roles.YAYINCI,
      roles.ICERIK, roles.VIP, roles.IZLEYICI
    ].map(role => ({ id: role.id, allow: textAllow }))
  ];
}

function registrationOverwrites(guild, roles) {
  return [
    {
      id: guild.roles.everyone.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
    },
    { id: roles.KLOZN.id, allow: textAllow },
    { id: roles.YONETIM.id, allow: textAllow },
    { id: roles.KAYITSIZ.id, allow: textAllow }
  ];
}

function adminOnlyOverwrites(guild, roles) {
  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.KLOZN.id, allow: textAllow },
    { id: roles.YONETIM.id, allow: textAllow }
  ];
}

function staffOverwrites(guild, roles) {
  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.KLOZN.id, allow: textAllow },
    { id: roles.YONETIM.id, allow: textAllow },
    { id: roles.MOD.id, allow: textAllow }
  ];
}

function creatorOverwrites(guild, roles) {
  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.KLOZN.id, allow: textAllow },
    { id: roles.YONETIM.id, allow: textAllow },
    { id: roles.YAYINCI.id, allow: textAllow },
    { id: roles.ICERIK.id, allow: textAllow }
  ];
}

function womenOverwrites(guild, roles) {
  const allow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak
  ];
  return [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
    },
    { id: roles.KADIN.id, allow },
    { id: roles.KLOZN.id, allow },
    { id: roles.YONETIM.id, allow }
  ];
}

async function createCategory(guild, name, overwrites) {
  return guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
    permissionOverwrites: overwrites,
    reason: "KLOZN Creator template"
  });
}

async function createText(guild, name, parent, overwrites, topic = "") {
  return guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: parent.id,
    topic,
    permissionOverwrites: overwrites,
    reason: "KLOZN Creator template"
  });
}

async function createVoice(guild, name, parent, overwrites) {
  return guild.channels.create({
    name,
    type: ChannelType.GuildVoice,
    parent: parent.id,
    permissionOverwrites: overwrites,
    reason: "KLOZN Creator template"
  });
}

async function setupServer(guild) {
  const roles = await createRoles(guild);
  const normal = overwritesForEveryone(guild, roles);
  const register = registrationOverwrites(guild, roles);
  const admin = adminOnlyOverwrites(guild, roles);
  const staff = staffOverwrites(guild, roles);
  const creator = creatorOverwrites(guild, roles);
  const women = womenOverwrites(guild, roles);

  const welcome = await createCategory(guild, CATEGORY_NAMES.WELCOME, register);
  const registerChannel = await createText(guild, CHANNEL_NAMES.REGISTER, welcome, register, "Sunucuya kayıt olmak için butonu kullan.");
  await createText(guild, CHANNEL_NAMES.RULES, welcome, register, "Sunucu kuralları.");
  await createText(guild, CHANNEL_NAMES.WELCOME, welcome, register, "Yeni üyeler burada karşılanır.");

  const general = await createCategory(guild, CATEGORY_NAMES.GENERAL, normal);
  await createText(guild, CHANNEL_NAMES.CHAT, general, normal);
  await createText(guild, CHANNEL_NAMES.MEDIA, general, normal);
  await createText(guild, CHANNEL_NAMES.BOT, general, normal);

  const stream = await createCategory(guild, CATEGORY_NAMES.STREAM, normal);
  await createText(guild, CHANNEL_NAMES.LIVE, stream, normal, "Canlı yayın bildirimleri.");
  await createText(guild, CHANNEL_NAMES.LIVE_CHAT, stream, normal);
  await createText(guild, CHANNEL_NAMES.CLIPS, stream, normal);

  const content = await createCategory(guild, CATEGORY_NAMES.CONTENT, normal);
  await createText(guild, CHANNEL_NAMES.VIDEOS, content, normal, "Yeni videolar.");
  await createText(guild, CHANNEL_NAMES.SUGGESTION, content, normal);
  await createText(guild, CHANNEL_NAMES.MEDIA, content, normal);

  const creatorCat = await createCategory(guild, CATEGORY_NAMES.CREATOR, creator);
  await createText(guild, CHANNEL_NAMES.STREAMERS, creatorCat, creator);
  await createText(guild, CHANNEL_NAMES.STREAM_CHAT, creatorCat, creator);
  await createText(guild, CHANNEL_NAMES.CONTENT_ROOM, creatorCat, creator);
  await createText(guild, CHANNEL_NAMES.CONTENT_CHAT, creatorCat, creator);

  const community = await createCategory(guild, CATEGORY_NAMES.COMMUNITY, normal);
  await createText(guild, CHANNEL_NAMES.GAME, community, normal);
  await createText(guild, CHANNEL_NAMES.LOOKING, community, normal);
  await createText(guild, CHANNEL_NAMES.EVENTS, community, normal);
  await createText(guild, CHANNEL_NAMES.GIVEAWAY, community, normal);

  const support = await createCategory(guild, CATEGORY_NAMES.SUPPORT, normal);
  await createText(guild, CHANNEL_NAMES.TICKET, support, normal);
  await createText(guild, CHANNEL_NAMES.SUGGESTION, support, normal);

  const staffCat = await createCategory(guild, CATEGORY_NAMES.STAFF, staff);
  await createText(guild, CHANNEL_NAMES.STAFF_CHAT, staffCat, admin);
  await createText(guild, CHANNEL_NAMES.MOD_CHAT, staffCat, staff);
  await createText(guild, CHANNEL_NAMES.APPLICATIONS, staffCat, staff);

  const logs = await createCategory(guild, CATEGORY_NAMES.LOGS, admin);
  await createText(guild, CHANNEL_NAMES.SERVER_LOG, logs, admin);
  await createText(guild, CHANNEL_NAMES.MOD_LOG, logs, admin);
  await createText(guild, CHANNEL_NAMES.MEMBER_LOG, logs, admin);
  await createText(guild, CHANNEL_NAMES.COMMAND_LOG, logs, admin);
  await createText(guild, CHANNEL_NAMES.MESSAGE_LOG, logs, admin);
  await createText(guild, CHANNEL_NAMES.VOICE_LOG, logs, admin);

  const voice = await createCategory(guild, CATEGORY_NAMES.VOICE, normal);
  await createVoice(guild, CHANNEL_NAMES.GENERAL_VOICE, voice, normal);
  await createVoice(guild, CHANNEL_NAMES.GAMING_VOICE, voice, normal);
  await createVoice(guild, CHANNEL_NAMES.STREAM_VOICE, voice, normal);
  await createVoice(guild, CHANNEL_NAMES.STAFF_VOICE, voice, staff);

  const womenCat = await createCategory(guild, CATEGORY_NAMES.WOMEN, women);
  await createText(guild, CHANNEL_NAMES.WOMEN_CHAT, womenCat, women);
  await createVoice(guild, CHANNEL_NAMES.WOMEN_VOICE, womenCat, women);

  await registerChannel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🎉 KLOZN COMMUNITY • KAYIT")
        .setDescription(
          "Sunucuya hoş geldin!\n\n" +
          "✅ **Kayıt Ol** butonuna basarak normal topluluk kanallarına erişebilirsin.\n\n" +
          "🎥 Yayıncı ve 🎬 İçerik Üreticisi alanları yalnızca ilgili role sahip kişilere açıktır.\n" +
          "🌸 Kadınlara özel alanı yalnızca **Kadın** rolü ve **Yönetici** yetkisi olan roller görebilir."
        )
        .setTimestamp()
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("klozn_register")
          .setLabel("Kayıt Ol")
          .setEmoji("✅")
          .setStyle(ButtonStyle.Success)
      )
    ]
  });

  return { roleCount: Object.keys(roles).length };
}

async function deleteAllChannels(guild) {
  await guild.channels.fetch();
  const channels = [...guild.channels.cache.values()]
    .filter(c => c.id !== guild.id)
    .sort((a, b) => {
      const ac = a.type === ChannelType.GuildCategory ? 1 : 0;
      const bc = b.type === ChannelType.GuildCategory ? 1 : 0;
      return ac - bc;
    });

  let deleted = 0;
  let failed = 0;

  for (const channel of channels) {
    try {
      await channel.delete("KLOZN /sunucu-yenile - tam kanal sıfırlama");
      deleted++;
    } catch (err) {
      failed++;
      console.warn(`Kanal silinemedi [${channel.name}] ${channel.id}: ${err.message}`);
    }
  }
  return { deleted, failed };
}

async function deleteAllManageableRoles(guild) {
  await guild.roles.fetch();
  const me = guild.members.me;
  const highest = me?.roles?.highest?.position ?? 0;
  let deleted = 0;
  let failed = 0;
  let managed = 0;

  const roles = [...guild.roles.cache.values()]
    .filter(role => role.id !== guild.id && !role.managed);

  for (const role of roles.sort((a, b) => b.position - a.position)) {
    if (role.position >= highest) {
      failed++;
      console.warn(`Rol silinemedi [${role.name}]: Bot rolü bu rolün üstünde olmalı.`);
      continue;
    }
    try {
      await role.delete("KLOZN /sunucu-yenile - tam rol sıfırlama");
      deleted++;
    } catch (err) {
      failed++;
      console.warn(`Rol silinemedi [${role.name}] ${role.id}: ${err.message}`);
    }
  }

  managed = guild.roles.cache.filter(r => r.managed).size;
  return { deleted, failed, managed };
}

async function refreshServer(guild) {
  // Kanallar önce, roller sonra: eski izin referanslarının takılmasını önler.
  const channelResult = await deleteAllChannels(guild);
  const roleResult = await deleteAllManageableRoles(guild);
  const setup = await setupServer(guild);

  return {
    deletedChannels: channelResult.deleted,
    failedChannels: channelResult.failed,
    deletedRoles: roleResult.deleted,
    failedRoles: roleResult.failed,
    managedRolesRemaining: roleResult.managed,
    ...setup
  };
}

async function logAction(guild, title, description) {
  const channel = findChannel(guild, CHANNEL_NAMES.SERVER_LOG);
  if (!channel?.isTextBased()) return;
  try {
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setTimestamp()
          .setFooter({ text: "KLOZN Security & Logs" })
      ]
    });
  } catch {}
}

const commands = [
  {
    name: "sunucu-yenile",
    description: "Kanalları ve yönetilebilir rolleri silip KLOZN şablonunu sıfırdan kurar.",
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  {
    name: "kurulum",
    description: "KLOZN şablonunu kurar.",
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  {
    name: "kadin-rol",
    description: "Üyeye Kadın rolü verir veya kaldırır.",
    default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    options: [
      { name: "uye", description: "Üye", type: 6, required: true },
      {
        name: "islem",
        description: "Rol işlemi",
        type: 3,
        required: true,
        choices: [
          { name: "Ver", value: "ver" },
          { name: "Kaldır", value: "kaldir" }
        ]
      }
    ]
  },
  {
    name: "duyuru",
    description: "Sunucuda duyuru gönderir.",
    default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    options: [
      { name: "mesaj", description: "Duyuru metni", type: 3, required: true }
    ]
  },
  {
    name: "ban",
    description: "Üyeyi yasaklar.",
    default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    options: [
      { name: "uye", description: "Yasaklanacak üye", type: 6, required: true },
      { name: "sebep", description: "Sebep", type: 3, required: false }
    ]
  },
  {
    name: "mute",
    description: "Üyeyi süreli susturur.",
    default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    options: [
      { name: "uye", description: "Susturulacak üye", type: 6, required: true },
      { name: "sure", description: "Dakika", type: 4, required: true, min_value: 1, max_value: 10080 },
      { name: "sebep", description: "Sebep", type: 3, required: false }
    ]
  },
  {
    name: "temizle",
    description: "Mesajları temizler.",
    default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    options: [
      { name: "miktar", description: "1-100", type: 4, required: true, min_value: 1, max_value: 100 }
    ]
  },
  {
    name: "ticket-kur",
    description: "Destek ticket paneli gönderir.",
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  {
    name: "klip",
    description: "Klip kanalına klip gönderir.",
    options: [
      { name: "link", description: "Klip bağlantısı", type: 3, required: true },
      { name: "baslik", description: "Klip başlığı", type: 3, required: true }
    ]
  },
  { name: "bilgi", description: "Bot hakkında bilgi gösterir." },
  { name: "ping", description: "Bot gecikmesini gösterir." }
];

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(CONFIG.TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
    { body: commands }
  );

  try {
    await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: [] });
  } catch (err) {
    console.warn("Global komut temizleme uyarısı:", err.message);
  }

  console.log(`✅ ${commands.length} slash komut guild'e kaydedildi.`);
}

async function handleCommand(interaction) {
  const command = interaction.commandName;
  const guild = interaction.guild;

  const adminCommands = new Set([
    "sunucu-yenile", "kurulum", "kadin-rol", "duyuru",
    "ban", "mute", "temizle", "ticket-kur"
  ]);

  if (adminCommands.has(command) && !isAdmin(interaction)) {
    return interaction.reply({
      content: "🔒 Bu komut yalnızca **Administrator / Yönetici** yetkisine sahip kişiler içindir.",
      ephemeral: true
    });
  }

  if (command === "ping") {
    return interaction.reply({
      content: `🏓 Pong! API: **${client.ws.ping}ms**`,
      ephemeral: true
    });
  }

  if (command === "bilgi") {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎥 KLOZN CREATOR")
          .setDescription(
            "🔴 Yayın Merkezi\n" +
            "🎬 İçerik Merkezi\n" +
            "✨ Yayıncı & İçerik Üreticisi alanları\n" +
            "🌸 Kadınlara özel gizli alan\n" +
            "🎫 Ticket • 🛡️ Moderasyon • 🔐 Log\n\n" +
            "♻️ /sunucu-yenile = tam şablon sıfırlama"
          )
          .setTimestamp()
      ],
      ephemeral: true
    });
  }

  if (command === "sunucu-yenile") {
    await interaction.reply({
      content:
        "⚠️ **TAM SUNUCU YENİLEME BAŞLADI.**\n\n" +
        "🗑️ Mevcut kanallar siliniyor.\n" +
        "🎭 Yönetilebilir roller siliniyor.\n" +
        "🏗️ Yeni roller + kategoriler + kanallar kuruluyor.\n\n" +
        "⏳ Bu işlem birkaç dakika sürebilir.",
      ephemeral: true
    });

    try {
      const result = await refreshServer(guild);
      await interaction.editReply(
        "✅ **KLOZN sunucu şablonu sıfırdan kuruldu!**\n\n" +
        `🗑️ Silinen kanal: **${result.deletedChannels}**\n` +
        `⚠️ Silinemeyen kanal: **${result.failedChannels}**\n` +
        `🎭 Silinen rol: **${result.deletedRoles}**\n` +
        `⚠️ Silinemeyen rol: **${result.failedRoles}**\n` +
        `🏗️ Yeni roller: **${result.roleCount}**\n\n` +
        "🎥 Yayıncı alanı: **Yayıncı** + Yönetici\n" +
        "🎬 İçerik üretici alanı: **İçerik Üreticisi** + Yönetici\n" +
        "🌸 Kadın alanı: **Kadın** + Yönetici\n\n" +
        "🔐 Kadın kanallarını Kadın rolü olmayan normal üyeler **göremez**."
      );
      await logAction(guild, "♻️ TAM SUNUCU YENİLEME", `${interaction.user.tag} tam şablon yenileme yaptı.`);
    } catch (err) {
      console.error("SUNUCU YENİLEME HATASI:", err);
      try {
        await interaction.editReply(`❌ **Yenileme başarısız:** ${err.message}`);
      } catch {}
    }
    return;
  }

  if (command === "kurulum") {
    await interaction.reply({ content: "⚙️ KLOZN şablonu kuruluyor...", ephemeral: true });
    try {
      const result = await setupServer(guild);
      await interaction.editReply(`✅ Kurulum tamamlandı. 🎭 ${result.roleCount} rol oluşturuldu.`);
    } catch (err) {
      await interaction.editReply(`❌ Kurulum başarısız: ${err.message}`);
    }
    return;
  }

  if (command === "kadin-rol") {
    const member = interaction.options.getMember("uye");
    const action = interaction.options.getString("islem", true);
    const role = findRole(guild, ROLE_NAMES.KADIN);

    if (!member || !role) {
      return interaction.reply({
        content: "❌ Üye veya Kadın rolü bulunamadı. Önce /kurulum çalıştır.",
        ephemeral: true
      });
    }

    try {
      if (action === "ver") {
        await member.roles.add(role, "KLOZN yönetici kadın rolü");
        await interaction.reply({ content: `🌸 ${member} kullanıcısına **Kadın** rolü verildi.`, ephemeral: true });
      } else {
        await member.roles.remove(role, "KLOZN yönetici kadın rolü kaldırma");
        await interaction.reply({ content: `🌸 ${member} kullanıcısından **Kadın** rolü kaldırıldı.`, ephemeral: true });
      }
    } catch (err) {
      await interaction.reply({ content: `❌ Rol işlemi başarısız: ${err.message}`, ephemeral: true });
    }
    return;
  }

  if (command === "duyuru") {
    const mesaj = interaction.options.getString("mesaj", true);
    if (!interaction.channel?.isTextBased()) {
      return interaction.reply({ content: "❌ Bu kanalda duyuru gönderemiyorum.", ephemeral: true });
    }
    const embed = new EmbedBuilder()
      .setTitle("📢 KLOZN DUYURU")
      .setDescription(mesaj)
      .setFooter({ text: `Yetkili: ${interaction.user.tag}` })
      .setTimestamp();
    await interaction.channel.send({ content: "@everyone", embeds: [embed] });
    await interaction.reply({ content: "✅ Duyuru gönderildi.", ephemeral: true });
    return;
  }

  if (command === "ban") {
    const member = interaction.options.getMember("uye");
    const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi.";
    if (!member || !member.bannable) {
      return interaction.reply({ content: "❌ Bu üyeyi banlayamıyorum. Bot rol sırasını kontrol et.", ephemeral: true });
    }
    await member.ban({ reason });
    await interaction.reply({ content: `🔨 **${member.user.tag}** banlandı.`, ephemeral: true });
    return;
  }

  if (command === "mute") {
    const member = interaction.options.getMember("uye");
    const minutes = interaction.options.getInteger("sure", true);
    const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi.";
    if (!member || !member.moderatable) {
      return interaction.reply({ content: "❌ Bu üyeyi susturamıyorum.", ephemeral: true });
    }
    await member.timeout(minutes * 60 * 1000, reason);
    await interaction.reply({ content: `🔇 **${member.user.tag}** ${minutes} dakika susturuldu.`, ephemeral: true });
    return;
  }

  if (command === "temizle") {
    const amount = interaction.options.getInteger("miktar", true);
    if (!interaction.channel?.isTextBased() || !("bulkDelete" in interaction.channel)) {
      return interaction.reply({ content: "❌ Bu kanalda toplu silme yapılamıyor.", ephemeral: true });
    }
    const deleted = await interaction.channel.bulkDelete(amount, true);
    await interaction.reply({ content: `🧹 **${deleted.size}** mesaj temizlendi.`, ephemeral: true });
    return;
  }

  if (command === "ticket-kur") {
    const support = findCategory(guild, CATEGORY_NAMES.SUPPORT);
    if (!support) return interaction.reply({ content: "❌ Önce /kurulum çalıştır.", ephemeral: true });

    const channel = findChannel(guild, CHANNEL_NAMES.TICKET, support.id);
    if (!channel?.isTextBased()) return interaction.reply({ content: "❌ Destek kanalı bulunamadı.", ephemeral: true });

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎫 KLOZN DESTEK")
          .setDescription("Destek talebi açmak için aşağıdaki butona bas.")
          .setTimestamp()
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("klozn_ticket")
            .setLabel("Ticket Aç")
            .setEmoji("🎫")
            .setStyle(ButtonStyle.Primary)
        )
      ]
    });

    await interaction.reply({ content: "✅ Ticket paneli gönderildi.", ephemeral: true });
    return;
  }

  if (command === "klip") {
    const link = interaction.options.getString("link", true);
    const title = interaction.options.getString("baslik", true);
    const channel = findChannel(guild, CHANNEL_NAMES.CLIPS);
    if (!channel?.isTextBased()) {
      return interaction.reply({ content: "❌ Klip kanalı bulunamadı.", ephemeral: true });
    }
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(`🎬 ${title}`)
          .setDescription(`🔗 **[KLİBİ İZLE](${link})**`)
          .addFields({ name: "👤 Paylaşan", value: interaction.user.toString() })
          .setTimestamp()
      ]
    });
    await interaction.reply({ content: "🎬 Klip paylaşıldı.", ephemeral: true });
  }
}

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
      return;
    }

    if (!interaction.isButton()) return;

    if (interaction.customId === "klozn_register") {
      const guild = interaction.guild;
      const member = interaction.member;
      const viewerRole = findRole(guild, ROLE_NAMES.IZLEYICI);
      const unregistered = findRole(guild, ROLE_NAMES.KAYITSIZ);

      if (!viewerRole) {
        return interaction.reply({ content: "❌ İzleyici rolü bulunamadı.", ephemeral: true });
      }

      await member.roles.add(viewerRole, "KLOZN kayıt");
      if (unregistered && member.roles.cache.has(unregistered.id)) {
        await member.roles.remove(unregistered, "KLOZN kayıt");
      }

      await interaction.reply({
        content: "🎉 **Kayıt tamamlandı!** Normal topluluk kanallarına erişimin açıldı.",
        ephemeral: true
      });
      return;
    }

    if (interaction.customId === "klozn_ticket") {
      const guild = interaction.guild;
      const userName = interaction.user.username.toLowerCase().replace(/[^a-z0-9-_]/g, "").slice(0, 20) || interaction.user.id.slice(-6);
      const existing = guild.channels.cache.find(c => c.name === `ticket-${userName}`);
      if (existing) {
        return interaction.reply({ content: `🎫 Zaten açık ticket'ın var: ${existing}`, ephemeral: true });
      }

      const support = findCategory(guild, CATEGORY_NAMES.SUPPORT);
      const roles = await createRoles(guild);
      const overwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: textAllow },
        ...[roles.KLOZN, roles.YONETIM, roles.MOD].map(role => ({ id: role.id, allow: textAllow }))
      ];

      const ticket = await guild.channels.create({
        name: `ticket-${userName}`,
        type: ChannelType.GuildText,
        parent: support?.id,
        permissionOverwrites: overwrites,
        reason: "KLOZN ticket"
      });

      await ticket.send({
        content: `${interaction.user}`,
        embeds: [
          new EmbedBuilder()
            .setTitle("🎫 KLOZN DESTEK")
            .setDescription("Destek talebin oluşturuldu.")
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("klozn_ticket_close")
              .setLabel("Ticket Kapat")
              .setEmoji("🔒")
              .setStyle(ButtonStyle.Danger)
          )
        ]
      });

      await interaction.reply({ content: `🎫 Ticket oluşturuldu: ${ticket}`, ephemeral: true });
      return;
    }

    if (interaction.customId === "klozn_ticket_close") {
      if (!isAdmin(interaction)) {
        return interaction.reply({ content: "🔒 Ticket kapatmak için Administrator yetkisi gerekir.", ephemeral: true });
      }
      await interaction.reply({ content: "🔒 Ticket kapatılıyor...", ephemeral: true });
      setTimeout(() => interaction.channel?.delete("KLOZN ticket close").catch(() => {}), 1000);
    }
  } catch (err) {
    console.error("[INTERACTION ERROR]", err);
    try {
      const reply = { content: "❌ İşlem sırasında hata oluştu. Render loglarını kontrol et.", ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
      else await interaction.reply(reply);
    } catch {}
  }
});

client.on("guildMemberAdd", async member => {
  try {
    const role = findRole(member.guild, ROLE_NAMES.KAYITSIZ);
    if (role) await member.roles.add(role, "KLOZN yeni üye");
    await logAction(member.guild, "👤 ÜYE GİRDİ", `**Üye:** ${member.user.tag}\n**ID:** ${member.id}`);
  } catch (err) {
    console.error("guildMemberAdd:", err.message);
  }
});

client.on("guildMemberRemove", async member => {
  try {
    await logAction(member.guild, "🚪 ÜYE ÇIKTI", `**Üye:** ${member.user.tag}\n**ID:** ${member.id}`);
  } catch {}
});

const BAD_WORDS = ["discord.gg/", "http://", "https://", "@everyone", "@here"];

client.on("messageCreate", async message => {
  if (!CONFIG.AUTOMOD || !message.guild || message.author.bot) return;
  try {
    if (message.member?.permissions?.has(PermissionFlagsBits.Administrator)) return;
    const content = message.content.toLowerCase();
    if (!BAD_WORDS.some(word => content.includes(word.toLowerCase()))) return;
    await message.delete().catch(() => {});
    await message.member?.timeout(60_000, "KLOZN AutoMod").catch(() => {});
    await logAction(
      message.guild,
      "🛡️ AUTOMOD",
      `**Üye:** ${message.author.tag}\n**Kanal:** ${message.channel}\n**İçerik:** ${message.content}`
    );
  } catch (err) {
    console.error("AutoMod:", err.message);
  }
});

let lastYouTubeVideo = null;

function checkYouTube() {
  if (!CONFIG.YOUTUBE_RSS || !CONFIG.YOUTUBE_CHANNEL_ID) return;

  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(CONFIG.YOUTUBE_CHANNEL_ID)}`;

  https.get(url, response => {
    let data = "";
    response.on("data", chunk => { data += chunk; });
    response.on("end", async () => {
      const idMatch = data.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
      const titleMatch = data.match(/<media:title>(.*?)<\/media:title>/);
      if (!idMatch) return;

      const videoId = idMatch[1];
      const title = titleMatch ? titleMatch[1] : "Yeni YouTube Videosu";
      if (lastYouTubeVideo === videoId) return;
      lastYouTubeVideo = videoId;

      const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
      if (!guild) return;
      const channel = findChannel(guild, CHANNEL_NAMES.VIDEOS);
      if (!channel?.isTextBased()) return;

      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("▶️ KLOZN YENİ VİDEO")
            .setDescription(`**${title}**\n\n📺 YouTube'da şimdi yayında!`)
            .addFields({ name: "🔗 Video", value: `https://www.youtube.com/watch?v=${videoId}` })
            .setTimestamp()
        ]
      }).catch(() => {});
    });
  }).on("error", err => console.error("YouTube RSS:", err.message));
}

const healthServer = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      ok: true,
      service: "KLOZN Discord Bot",
      discordReady: client.isReady(),
      guilds: client.guilds.cache.size,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    }));
    return;
  }
  res.writeHead(404);
  res.end("Not Found");
});

healthServer.listen(CONFIG.PORT, "0.0.0.0", () => {
  console.log(`🌐 HTTP health server: 0.0.0.0:${CONFIG.PORT}`);
});

client.once("ready", async () => {
  console.log("==========================================");
  console.log("🚀 KLOZN CREATOR BOT AKTİF • v9.0.0");
  console.log(`🤖 Bot: ${client.user.tag}`);
  console.log(`🏠 Guild cache: ${client.guilds.cache.size}`);
  console.log(`🎯 Hedef Guild: ${CONFIG.GUILD_ID}`);
  console.log("🔐 /sunucu-yenile: ADMIN ONLY");
  console.log("🌸 Kadın: KADIN + ADMIN");
  console.log("==========================================");

  client.user.setPresence({
    activities: [{ name: "KLOZN Creator", type: 3 }],
    status: "online"
  });

  try {
    await registerCommands();
  } catch (err) {
    console.error("Slash komut kayıt hatası:", err);
  }

  const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
  if (!guild) {
    console.error("❌ GUILD_ID ile belirtilen sunucu bulunamadı.");
    return;
  }

  // Açılışta otomatik silme yok. Tam sıfırlama sadece /sunucu-yenile ile yapılır.
  try {
    await guild.roles.fetch();
    await guild.channels.fetch();
    console.log("✅ Discord sunucu önbelleği hazır.");
  } catch (err) {
    console.error("Guild fetch:", err.message);
  }

  if (CONFIG.YOUTUBE_RSS) {
    checkYouTube();
    setInterval(checkYouTube, 120_000);
  }

  setInterval(() => {
    console.log(
      `[HEALTH] ready=${client.isReady()} guilds=${client.guilds.cache.size} ping=${client.ws.ping} uptime=${Math.floor(process.uptime())}s`
    );
  }, 60_000);
});

client.on("error", err => console.error("[DISCORD CLIENT ERROR]", err));
client.on("shardError", err => console.error("[DISCORD SHARD ERROR]", err));
process.on("unhandledRejection", err => console.error("[UNHANDLED REJECTION]", err));
process.on("uncaughtException", err => console.error("[UNCAUGHT EXCEPTION]", err));

client.login(CONFIG.TOKEN).catch(err => {
  console.error("❌ Discord login başarısız:", err);
  process.exit(1);
});
