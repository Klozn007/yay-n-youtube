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
  OverwriteType
} = require("discord.js");
const http = require("http");
const https = require("https");

/*
 * KLOZN CREATOR BOT
 * Render + UptimeRobot uyumlu, Discord.js v14
 *
 * GEREKLİ ENV:
 * TOKEN       = Discord bot token
 * CLIENT_ID   = Discord application/client ID
 * GUILD_ID    = Botun kurulacağı sunucu ID
 *
 * İSTEĞE BAĞLI:
 * YOUTUBE_CHANNEL_ID
 * YOUTUBE_RSS=true
 * PORT (Render otomatik verir)
 */

const CONFIG = {
  TOKEN: process.env.TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID,
  PORT: Number(process.env.PORT || 10000),
  YOUTUBE_CHANNEL_ID: process.env.YOUTUBE_CHANNEL_ID || "",
  YOUTUBE_RSS: String(process.env.YOUTUBE_RSS || "false").toLowerCase() === "true",
  VIDEO_CHANNEL: "videolar",
  AUTOMOD: String(process.env.AUTOMOD || "true").toLowerCase() !== "false"
};

if (!CONFIG.TOKEN || !CONFIG.CLIENT_ID || !CONFIG.GUILD_ID) {
  throw new Error("TOKEN, CLIENT_ID ve GUILD_ID .env/Render Environment Variables içinde olmalı.");
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
  YAYINCI: "Yayıncı Ekibi",
  ICERIK: "İçerik Üretici",
  VIP: "VIP İzleyici",
  IZLEYICI: "İzleyici",
  KAYITSIZ: "Kayıtsız",
  BOT: "Bot",
  KADIN: "Kadın"
};

const CATEGORY_NAMES = {
  WELCOME: "👋・HOŞ GELDİN",
  GENERAL: "💬・GENEL",
  STREAM: "🔴・YAYIN",
  CONTENT: "🎬・İÇERİK",
  COMMUNITY: "🎮・TOPLULUK",
  SUPPORT: "🎫・DESTEK",
  STAFF: "🛡️・YÖNETİM",
  LOGS: "🔐・LOGLAR",
  VOICE: "🔊・SES KANALLARI",
  WOMEN: "🌸・KADINLARA ÖZEL"
};

const CHANNEL_NAMES = {
  REGISTER: "kayıt-ol",
  RULES: "kurallar",
  WELCOME: "hos-geldin",
  CHAT: "sohbet",
  MEDIA: "medya",
  BOT: "bot-komutları",
  LIVE: "🔴・canlı-yayın",
  LIVE_CHAT: "yayın-sohbet",
  CLIPS: "klipler",
  VIDEOS: "videolar",
  GAME: "oyun-sohbet",
  LOOKING: "oyuncu-ara",
  EVENTS: "etkinlikler",
  GIVEAWAY: "çekilişler",
  TICKET: "destek",
  SUGGESTION: "öneriler",
  STAFF_CHAT: "yönetim-sohbet",
  MOD_CHAT: "moderasyon",
  APPLICATIONS: "başvurular",
  SERVER_LOG: "sunucu-log",
  MOD_LOG: "moderasyon-log",
  MEMBER_LOG: "üye-log",
  COMMAND_LOG: "komut-log",
  MESSAGE_LOG: "mesaj-log",
  VOICE_LOG: "ses-log",
  GENERAL_VOICE: "Genel Sohbet",
  GAMING_VOICE: "Oyun Odası",
  VIP_VOICE: "VIP Oda",
  STREAM_VOICE: "Yayın Odası",
  STAFF_VOICE: "Yönetim Odası",
  WOMEN_CHAT: "kadın-sohbet",
  WOMEN_VOICE: "Kadınlar Odası"
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
    c.name === name &&
    (parentId === null || c.parentId === parentId)
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
      reason: "KLOZN Creator Bot role sync"
    });
  } else if (name === ROLE_NAMES.KLOZN || name === ROLE_NAMES.YONETIM) {
    // Mevcut rollerin yetkisini de güvenli biçimde senkronla.
    if (!role.permissions.has(PermissionFlagsBits.Administrator)) {
      try {
        await role.setPermissions([PermissionFlagsBits.Administrator], "KLOZN role sync");
      } catch {}
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

function normalOverwrites(guild, roles) {
  return [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    ...[roles.KLOZN, roles.YONETIM, roles.IZLEYICI, roles.VIP, roles.ICERIK, roles.YAYINCI, roles.MOD]
      .filter(Boolean)
      .map(role => ({
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      }))
  ];
}

function registerOverwrites(guild, roles) {
  return [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: roles.KLOZN.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    },
    {
      id: roles.YONETIM.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    },
    {
      id: roles.KAYITSIZ.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    }
  ];
}

function staffOverwrites(guild, roles) {
  return [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    ...[roles.KLOZN, roles.YONETIM, roles.MOD]
      .filter(Boolean)
      .map(role => ({
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      }))
  ];
}

function adminOverwrites(guild, roles) {
  return [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: roles.KLOZN.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    },
    {
      id: roles.YONETIM.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    }
  ];
}

function womenOverwrites(guild, roles) {
  // Kadın kanallarını normal üyeler GÖREMEZ.
  // Kadın rolü ve Administrator yetkili roller görebilir/girebilir.
  return [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
    },
    {
      id: roles.KADIN.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak
      ]
    },
    {
      id: roles.KLOZN.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak
      ]
    },
    {
      id: roles.YONETIM.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak
      ]
    }
  ];
}

async function ensureCategory(guild, name, overwrites) {
  let category = findCategory(guild, name);

  if (!category) {
    category = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      permissionOverwrites: overwrites,
      reason: "KLOZN Creator Bot category sync"
    });
  } else {
    try {
      await category.permissionOverwrites.set(overwrites, "KLOZN category permission sync");
    } catch {}
  }

  return category;
}

async function ensureChannel(guild, name, parent, type, overwrites) {
  let channel = findChannel(guild, name, parent.id);

  if (!channel) {
    channel = await guild.channels.create({
      name,
      type,
      parent: parent.id,
      permissionOverwrites: overwrites,
      reason: "KLOZN Creator Bot channel sync"
    });
  } else {
    try {
      await channel.permissionOverwrites.set(overwrites, "KLOZN channel permission sync");
      if (channel.parentId !== parent.id) await channel.setParent(parent.id);
    } catch {}
  }

  return channel;
}

async function setupServer(guild) {
  if (!guild) throw new Error("Sunucu bulunamadı.");

  const roles = await createRoles(guild);
  const normal = normalOverwrites(guild, roles);
  const register = registerOverwrites(guild, roles);
  const staff = staffOverwrites(guild, roles);
  const admin = adminOverwrites(guild, roles);
  const women = womenOverwrites(guild, roles);

  const welcome = await ensureCategory(guild, CATEGORY_NAMES.WELCOME, register);
  const registerChannel = await ensureChannel(guild, CHANNEL_NAMES.REGISTER, welcome, ChannelType.GuildText, register);
  await ensureChannel(guild, CHANNEL_NAMES.RULES, welcome, ChannelType.GuildText, register);
  await ensureChannel(guild, CHANNEL_NAMES.WELCOME, welcome, ChannelType.GuildText, register);

  const general = await ensureCategory(guild, CATEGORY_NAMES.GENERAL, normal);
  await ensureChannel(guild, CHANNEL_NAMES.CHAT, general, ChannelType.GuildText, normal);
  await ensureChannel(guild, CHANNEL_NAMES.MEDIA, general, ChannelType.GuildText, normal);
  await ensureChannel(guild, CHANNEL_NAMES.BOT, general, ChannelType.GuildText, normal);

  const stream = await ensureCategory(guild, CATEGORY_NAMES.STREAM, normal);
  await ensureChannel(guild, CHANNEL_NAMES.LIVE, stream, ChannelType.GuildText, normal);
  await ensureChannel(guild, CHANNEL_NAMES.LIVE_CHAT, stream, ChannelType.GuildText, normal);

  const content = await ensureCategory(guild, CATEGORY_NAMES.CONTENT, normal);
  await ensureChannel(guild, CHANNEL_NAMES.CLIPS, content, ChannelType.GuildText, normal);
  await ensureChannel(guild, CHANNEL_NAMES.VIDEOS, content, ChannelType.GuildText, normal);

  const community = await ensureCategory(guild, CATEGORY_NAMES.COMMUNITY, normal);
  for (const name of [
    CHANNEL_NAMES.GAME,
    CHANNEL_NAMES.LOOKING,
    CHANNEL_NAMES.EVENTS,
    CHANNEL_NAMES.GIVEAWAY
  ]) {
    await ensureChannel(guild, name, community, ChannelType.GuildText, normal);
  }

  const support = await ensureCategory(guild, CATEGORY_NAMES.SUPPORT, normal);
  await ensureChannel(guild, CHANNEL_NAMES.TICKET, support, ChannelType.GuildText, normal);
  await ensureChannel(guild, CHANNEL_NAMES.SUGGESTION, support, ChannelType.GuildText, normal);

  const staffCat = await ensureCategory(guild, CATEGORY_NAMES.STAFF, staff);
  await ensureChannel(guild, CHANNEL_NAMES.STAFF_CHAT, staffCat, ChannelType.GuildText, admin);
  await ensureChannel(guild, CHANNEL_NAMES.MOD_CHAT, staffCat, ChannelType.GuildText, staff);
  await ensureChannel(guild, CHANNEL_NAMES.APPLICATIONS, staffCat, ChannelType.GuildText, staff);

  const logs = await ensureCategory(guild, CATEGORY_NAMES.LOGS, admin);
  for (const name of [
    CHANNEL_NAMES.SERVER_LOG,
    CHANNEL_NAMES.MOD_LOG,
    CHANNEL_NAMES.MEMBER_LOG,
    CHANNEL_NAMES.COMMAND_LOG,
    CHANNEL_NAMES.MESSAGE_LOG,
    CHANNEL_NAMES.VOICE_LOG
  ]) {
    await ensureChannel(guild, name, logs, ChannelType.GuildText, admin);
  }

  const voice = await ensureCategory(guild, CATEGORY_NAMES.VOICE, normal);
  for (const name of [
    CHANNEL_NAMES.GENERAL_VOICE,
    CHANNEL_NAMES.GAMING_VOICE,
    CHANNEL_NAMES.VIP_VOICE,
    CHANNEL_NAMES.STREAM_VOICE
  ]) {
    await ensureChannel(guild, name, voice, ChannelType.GuildVoice, normal);
  }
  await ensureChannel(guild, CHANNEL_NAMES.STAFF_VOICE, voice, ChannelType.GuildVoice, staff);

  // KADINLARA ÖZEL SİSTEM
  const womenCat = await ensureCategory(guild, CATEGORY_NAMES.WOMEN, women);
  const womenChat = await ensureChannel(guild, CHANNEL_NAMES.WOMEN_CHAT, womenCat, ChannelType.GuildText, women);
  await ensureChannel(guild, CHANNEL_NAMES.WOMEN_VOICE, womenCat, ChannelType.GuildVoice, women);

  // Kayıt mesajı: her yenilemede spam oluşturmaması için sadece kanal boşsa gönder.
  try {
    const recent = await registerChannel.messages.fetch({ limit: 10 });
    const hasBotPanel = recent.some(m =>
      m.author?.id === client.user.id &&
      m.components?.some(row => row.components?.some(c => c.customId === "klozn_register"))
    );

    if (!hasBotPanel) {
      await registerChannel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🎥 KLOZN COMMUNITY")
            .setDescription(
              "Sunucunun normal kanallarına erişmek için aşağıdaki butondan kayıt ol.\n\n" +
              "🔴 Yayınlar\n▶️ YouTube\n🎬 Klipler\n🎮 Oyunlar\n💬 Topluluk\n🎁 Etkinlikler"
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
    }
  } catch (err) {
    console.error("Kayıt paneli hatası:", err.message);
  }

  return {
    roleCount: Object.keys(roles).length,
    womenCategory: womenCat,
    womenChat
  };
}

const MANAGED_CATEGORY_NAMES = new Set(Object.values(CATEGORY_NAMES));
const MANAGED_ROLE_NAMES = new Set(Object.values(ROLE_NAMES));

async function refreshServer(guild) {
  if (!guild) throw new Error("Sunucu bulunamadı.");
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.Administrator)) {
    throw new Error("Botun Administrator yetkisi olmalı.");
  }

  // /sunucu-yenile = KLOZN'un yönettiği yapıyı GERÇEKTEN sıfırdan kurar.
  // Manuel/alakasız kategori ve kanallara dokunulmaz.
  // Kadın kategorisi de MANAGED_CATEGORY_NAMES içinde olduğu için tamamen
  // silinip yeni Kadın rolü + izinleriyle tekrar oluşturulur.
  const managedCategories = guild.channels.cache.filter(
    c => c.type === ChannelType.GuildCategory && MANAGED_CATEGORY_NAMES.has(c.name)
  );

  let deletedChannels = 0;
  let deletedCategories = 0;
  let failedChannels = 0;

  for (const category of managedCategories.values()) {
    const children = guild.channels.cache.filter(c => c.parentId === category.id);
    for (const channel of children.values()) {
      try {
        await channel.delete("KLOZN /sunucu-yenile: managed channel reset");
        deletedChannels++;
      } catch (err) {
        failedChannels++;
        console.error(`[SUNUCU-YENILE] Kanal silinemedi (${channel.name}):`, err.message);
      }
    }

    try {
      await category.delete("KLOZN /sunucu-yenile: managed category reset");
      deletedCategories++;
    } catch (err) {
      console.error(`[SUNUCU-YENILE] Kategori silinemedi (${category.name}):`, err.message);
    }
  }

  // Önce botun oluşturduğu/yönettiği roller sıfırlanır.
  // @everyone, botun kendi managed rolü ve botun üstündeki roller ASLA silinmez.
  let deletedRoles = 0;
  let failedRoles = 0;
  const botHighest = guild.members.me.roles.highest.position;
  const managedRoles = guild.roles.cache.filter(
    r => !r.managed && MANAGED_ROLE_NAMES.has(r.name) && r.id !== guild.id
  );

  for (const role of managedRoles.values()) {
    if (role.managed || role.id === guild.id || role.position >= botHighest) {
      failedRoles++;
      console.warn(`[SUNUCU-YENILE] Rol silinmedi (hiyerarşi/managed): ${role.name}`);
      continue;
    }

    try {
      await role.delete("KLOZN /sunucu-yenile: managed role reset");
      deletedRoles++;
    } catch (err) {
      failedRoles++;
      console.error(`[SUNUCU-YENILE] Rol silinemedi (${role.name}):`, err.message);
    }
  }

  const result = await setupServer(guild);
  return {
    deletedChannels,
    deletedCategories,
    deletedRoles,
    failedChannels,
    failedRoles,
    ...result
  };
}

async function logAction(guild, title, description) {
  const channel = findChannel(guild, CHANNEL_NAMES.SERVER_LOG);
  if (!channel || !channel.isTextBased()) return;

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
    name: "kurulum",
    description: "KLOZN sistemini kurar/senkronlar.",
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  {
    name: "sunucu-yenile",
    description: "KLOZN'un yönettiği kanalları, kategorileri ve rolleri sıfırdan yeniler.",
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  {
    name: "duyuru",
    description: "Sunucuda duyuru gönderir.",
    options: [
      { name: "mesaj", description: "Duyuru metni", type: 3, required: true }
    ],
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  {
    name: "ban",
    description: "Üyeyi sunucudan yasaklar.",
    options: [
      { name: "üye", description: "Yasaklanacak üye", type: 6, required: true },
      { name: "sebep", description: "Sebep", type: 3, required: false }
    ],
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  {
    name: "mute",
    description: "Üyeyi süreli susturur.",
    options: [
      { name: "üye", description: "Susturulacak üye", type: 6, required: true },
      { name: "süre", description: "Dakika", type: 4, required: true, min_value: 1, max_value: 10080 },
      { name: "sebep", description: "Sebep", type: 3, required: false }
    ],
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  {
    name: "temizle",
    description: "Mesajları toplu siler.",
    options: [
      { name: "miktar", description: "1-100", type: 4, required: true, min_value: 1, max_value: 100 }
    ],
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  {
    name: "ticket-kur",
    description: "Ticket paneli gönderir.",
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  {
    name: "kadin-rol",
    description: "Bir üyeye kadınlara özel rolünü verir veya kaldırır.",
    options: [
      { name: "üye", description: "Üye", type: 6, required: true },
      {
        name: "işlem",
        description: "Rol işlemi",
        type: 3,
        required: true,
        choices: [
          { name: "Ver", value: "ver" },
          { name: "Kaldır", value: "kaldir" }
        ]
      }
    ],
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  {
    name: "klip",
    description: "Klip kanalına klip gönderir.",
    options: [
      { name: "link", description: "Klip linki", type: 3, required: true },
      { name: "başlık", description: "Klip başlığı", type: 3, required: true }
    ]
  },
  {
    name: "bilgi",
    description: "Bot hakkında bilgi gösterir."
  },
  {
    name: "ping",
    description: "Bot gecikmesini gösterir."
  }
];

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(CONFIG.TOKEN);

  // Global yerine GUILD_ID kullanıyoruz: komutlar anında bu sunucuya gelir
  // ve eski global duplicate komutlar oluşmaz.
  await rest.put(
    Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
    { body: commands }
  );

  // Eski global komutları temizle.
  try {
    await rest.put(
      Routes.applicationCommands(CONFIG.CLIENT_ID),
      { body: [] }
    );
  } catch (err) {
    console.error("Global komut temizleme uyarısı:", err.message);
  }

  console.log(`✅ ${commands.length} slash komut ${CONFIG.GUILD_ID} sunucusuna kaydedildi.`);
}

async function handleCommand(interaction) {
  const command = interaction.commandName;
  const guild = interaction.guild;

  const adminCommands = new Set([
    "kurulum",
    "sunucu-yenile",
    "duyuru",
    "ban",
    "mute",
    "temizle",
    "ticket-kur",
    "kadin-rol"
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
            "🔴 Yayın sistemi\n▶️ YouTube bildirimleri\n🎬 Klip sistemi\n🎫 Ticket\n🛡️ Moderasyon\n🌸 Kadınlara özel alan\n🔐 Log sistemi\n\n" +
            "Bot Render üzerinde çalışacak şekilde optimize edilmiştir."
          )
          .setTimestamp()
      ],
      ephemeral: true
    });
  }

  if (command === "kurulum") {
    await interaction.reply({ content: "⚙️ KLOZN sunucu kurulumu/senkronu başlıyor...", ephemeral: true });
    try {
      const result = await setupServer(guild);
      await interaction.editReply(
        `✅ Kurulum tamamlandı.\n🎭 ${result.roleCount} rol kontrol edildi.\n🌸 Kadınlara özel kategori/kanallar senkronlandı.`
      );
      await logAction(guild, "⚙️ KURULUM", `${interaction.user.tag} kurulum/senkron çalıştırdı.`);
    } catch (err) {
      console.error(err);
      await interaction.editReply(`❌ Kurulum başarısız: \`${err.message}\``);
    }
    return;
  }

  if (command === "sunucu-yenile") {
    await interaction.reply({
      content:
        "♻️ **Sunucu yenileme başlıyor...**\n" +
        "KLOZN'un yönettiği kategori/kanallar ve roller silinip yeniden oluşturulacak. " +
        "Manuel/alakasız kanallara dokunulmayacak.",
      ephemeral: true
    });

    try {
      const result = await refreshServer(guild);
      await interaction.editReply(
        `✅ **Sunucu sistemi tamamen sıfırdan yenilendi.**\n` +
        `🗑️ Silinen kanal: **${result.deletedChannels}**\n` +
        `🗑️ Silinen kategori: **${result.deletedCategories}**\n` +
        `🎭 Silinen/yeni oluşturulan yönetilen rol: **${result.deletedRoles}** / **${result.roleCount}**\n` +
        `🌸 Kadın rolü + kadın kanalları yeniden oluşturuldu.\n` +
        (result.failedChannels || result.failedRoles ? `⚠️ Atlanan işlem: kanal **${result.failedChannels}**, rol **${result.failedRoles}** (hiyerarşi/Discord kısıtı).` : "")
      );
      await logAction(guild, "♻️ SUNUCU YENİLE", `${interaction.user.tag} /sunucu-yenile çalıştırdı.`);
    } catch (err) {
      console.error(err);
      await interaction.editReply(`❌ Yenileme başarısız: \`${err.message}\``);
    }
    return;
  }

  if (command === "duyuru") {
    const mesaj = interaction.options.getString("mesaj", true);
    await guild.channels.fetch();
    if (!interaction.channel?.isTextBased()) {
      return interaction.reply({ content: "❌ Bu kanalda duyuru gönderemiyorum.", ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle("📢 KLOZN DUYURU")
      .setDescription(mesaj)
      .setTimestamp()
      .setFooter({ text: `Yetkili: ${interaction.user.tag}` });

    await interaction.channel.send({ content: "@everyone", embeds: [embed] });
    await interaction.reply({ content: "✅ Duyuru gönderildi.", ephemeral: true });
    await logAction(guild, "📢 DUYURU", `${interaction.user.tag} duyuru gönderdi.`);
    return;
  }

  if (command === "ban") {
    const member = interaction.options.getMember("üye");
    const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi.";

    if (!member || !member.bannable) {
      return interaction.reply({ content: "❌ Bu üyeyi banlayamıyorum. Rol sırasını ve bot yetkilerini kontrol et.", ephemeral: true });
    }

    await member.ban({ reason });
    await interaction.reply({ content: `🔨 **${member.user.tag}** banlandı.`, ephemeral: true });
    await logAction(guild, "🔨 BAN", `**Üye:** ${member.user.tag}\n**Yetkili:** ${interaction.user.tag}\n**Sebep:** ${reason}`);
    return;
  }

  if (command === "mute") {
    const member = interaction.options.getMember("üye");
    const minutes = interaction.options.getInteger("süre", true);
    const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi.";

    if (!member || !member.moderatable) {
      return interaction.reply({ content: "❌ Bu üyeyi susturamıyorum.", ephemeral: true });
    }

    await member.timeout(minutes * 60 * 1000, reason);
    await interaction.reply({ content: `🔇 **${member.user.tag}** ${minutes} dakika susturuldu.`, ephemeral: true });
    await logAction(guild, "🔇 MUTE", `**Üye:** ${member.user.tag}\n**Yetkili:** ${interaction.user.tag}\n**Süre:** ${minutes} dakika\n**Sebep:** ${reason}`);
    return;
  }

  if (command === "temizle") {
    const amount = interaction.options.getInteger("miktar", true);

    if (!interaction.channel?.isTextBased() || !("bulkDelete" in interaction.channel)) {
      return interaction.reply({ content: "❌ Bu kanalda toplu mesaj silinemiyor.", ephemeral: true });
    }

    const deleted = await interaction.channel.bulkDelete(amount, true);
    await interaction.reply({ content: `🧹 **${deleted.size}** mesaj temizlendi.`, ephemeral: true });
    await logAction(guild, "🧹 TEMİZLE", `${interaction.user.tag} ${deleted.size} mesaj temizledi.`);
    return;
  }

  if (command === "ticket-kur") {
    const support = findCategory(guild, CATEGORY_NAMES.SUPPORT);
    if (!support) {
      return interaction.reply({ content: "❌ Önce /kurulum çalıştır.", ephemeral: true });
    }

    const existing = findChannel(guild, CHANNEL_NAMES.TICKET, support.id);
    if (!existing) await ensureChannel(guild, CHANNEL_NAMES.TICKET, support, ChannelType.GuildText, normalOverwrites(guild, await createRoles(guild)));

    await interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎫 KLOZN DESTEK")
          .setDescription("Destek almak için aşağıdaki butona bas.")
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

  if (command === "kadin-rol") {
    const member = interaction.options.getMember("üye");
    const action = interaction.options.getString("işlem", true);
    const role = findRole(guild, ROLE_NAMES.KADIN);

    if (!member || !role) {
      return interaction.reply({ content: "❌ Üye veya Kadın rolü bulunamadı. Önce /kurulum çalıştır.", ephemeral: true });
    }

    if (action === "ver") {
      await member.roles.add(role, "KLOZN kadın rolü - yönetici");
      await interaction.reply({ content: `🌸 ${member} kullanıcısına Kadın rolü verildi.`, ephemeral: true });
    } else {
      await member.roles.remove(role, "KLOZN kadın rolü kaldırma - yönetici");
      await interaction.reply({ content: `🌸 ${member} kullanıcısından Kadın rolü kaldırıldı.`, ephemeral: true });
    }
    return;
  }

  if (command === "klip") {
    const link = interaction.options.getString("link", true);
    const title = interaction.options.getString("başlık", true);
    const channel = findChannel(guild, CHANNEL_NAMES.CLIPS);

    if (!channel?.isTextBased()) {
      return interaction.reply({ content: "❌ Klip kanalı bulunamadı. /kurulum çalıştır.", ephemeral: true });
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

    await interaction.reply({ content: "🎬 Klip başarıyla paylaşıldı.", ephemeral: true });
    return;
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
      const unregisteredRole = findRole(guild, ROLE_NAMES.KAYITSIZ);

      if (!viewerRole) {
        return interaction.reply({ content: "❌ İzleyici rolü bulunamadı. /kurulum çalıştır.", ephemeral: true });
      }

      if (member.roles.cache.has(viewerRole.id)) {
        return interaction.reply({ content: "✅ Zaten kayıtlısın.", ephemeral: true });
      }

      await member.roles.add(viewerRole, "KLOZN kayıt");
      if (unregisteredRole && member.roles.cache.has(unregisteredRole.id)) {
        await member.roles.remove(unregisteredRole, "KLOZN kayıt");
      }

      await interaction.reply({
        content: "🎉 **Kayıt tamamlandı!** Normal kanallara erişimin açıldı.",
        ephemeral: true
      });

      await logAction(guild, "📝 KAYIT", `${member.user.tag} kayıt oldu.`);
      return;
    }

    if (interaction.customId === "klozn_ticket") {
      const guild = interaction.guild;
      const userName = interaction.user.username.toLowerCase().replace(/[^a-z0-9-_]/g, "").slice(0, 20) || interaction.user.id.slice(-6);
      const existing = guild.channels.cache.find(c => c.name === `ticket-${userName}`);

      if (existing) {
        return interaction.reply({ content: `🎫 Zaten açık ticket'ın var: ${existing}`, ephemeral: true });
      }

      const roles = await createRoles(guild);
      const support = findCategory(guild, CATEGORY_NAMES.SUPPORT);
      const overwrites = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        },
        ...[roles.KLOZN, roles.YONETIM, roles.MOD].map(role => ({
          id: role.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        }))
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
            .setDescription("Destek talebin oluşturuldu. Yetkili ekip ilgilenecektir.")
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
      await logAction(guild, "🎫 TICKET", `${interaction.user.tag} ticket açtı: ${ticket.name}`);
      return;
    }

    if (interaction.customId === "klozn_ticket_close") {
      if (!isAdmin(interaction)) {
        return interaction.reply({ content: "🔒 Ticket kapatmak için Administrator yetkisi gerekir.", ephemeral: true });
      }

      await interaction.reply({ content: "🔒 Ticket kapatılıyor...", ephemeral: true });
      await logAction(interaction.guild, "🔒 TICKET KAPATILDI", `${interaction.user.tag} tarafından ${interaction.channel.name} kapatıldı.`);

      setTimeout(async () => {
        try { await interaction.channel.delete("KLOZN ticket close"); } catch {}
      }, 1200);
    }
  } catch (err) {
    console.error("[INTERACTION ERROR]", err);
    try {
      const reply = { content: "❌ İşlem sırasında bir hata oluştu. Logları kontrol et.", ephemeral: true };
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
  } catch {}
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

      const channel = findChannel(guild, CONFIG.VIDEO_CHANNEL);
      if (!channel?.isTextBased()) return;

      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("▶️ KLOZN YENİ VİDEO")
            .setDescription(`**${title}**\n\n📺 YouTube'da şimdi yayında!`)
            .addFields({
              name: "🔗 Video",
              value: `https://www.youtube.com/watch?v=${videoId}`
            })
            .setTimestamp()
        ]
      }).catch(() => {});
    });
  }).on("error", err => console.error("YouTube RSS:", err.message));
}

// Render health server
const healthServer = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
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
  console.log(`🌐 HTTP sağlık sunucusu 0.0.0.0:${CONFIG.PORT}`);
});

client.once("ready", async () => {
  console.log("==========================================");
  console.log("🚀 KLOZN CREATOR BOT AKTİF");
  console.log(`🤖 Bot: ${client.user.tag}`);
  console.log(`🏠 Guild cache: ${client.guilds.cache.size}`);
  console.log(`🎯 Hedef Guild: ${CONFIG.GUILD_ID}`);
  console.log("🔐 Moderasyon: ADMIN ONLY");
  console.log("🌸 Kadın kanalları: KADIN + ADMIN");
  console.log("==========================================");

  client.user.setPresence({
    activities: [{ name: "Klozn • Discord", type: 3 }],
    status: "online"
  });

  try {
    await registerCommands();
  } catch (err) {
    console.error("Slash komut kayıt hatası:", err);
  }

  const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
  if (!guild) {
    console.error("❌ GUILD_ID ile belirtilen sunucu bulunamadı. Bot sunucuda mı?");
    return;
  }

  // Açılışta sadece rol/kategori/kanal izinlerini senkronla.
  // Silme işlemi yalnızca /sunucu-yenile ile yapılır.
  try {
    await setupServer(guild);
    console.log("✅ Açılış senkronizasyonu tamamlandı.");
  } catch (err) {
    console.error("Kurulum senkron hatası:", err);
  }

  if (CONFIG.YOUTUBE_RSS) {
    checkYouTube();
    setInterval(checkYouTube, 120_000);
  }

  // Render/Discord tarafında bağlantı hatası olsa bile kontrollü logla.
  setInterval(() => {
    console.log(
      `[HEALTH] ready=${client.isReady()} guilds=${client.guilds.cache.size} ping=${client.ws.ping} uptime=${Math.floor(process.uptime())}s`
    );
  }, 60_000);
});

client.on("error", err => console.error("[DISCORD CLIENT ERROR]", err));
client.on("shardError", err => console.error("[DISCORD SHARD ERROR]", err));

process.on("unhandledRejection", err => {
  console.error("[UNHANDLED REJECTION]", err);
});

process.on("uncaughtException", err => {
  console.error("[UNCAUGHT EXCEPTION]", err);
  // Botu kasıtlı olarak anında öldürmüyoruz; Render yeniden başlatmasını gerektirecek
  // kritik durumlarda process yöneticisi devreye girebilir.
});

client.login(CONFIG.TOKEN).catch(err => {
  console.error("❌ Discord login başarısız:", err);
  process.exit(1);
});
