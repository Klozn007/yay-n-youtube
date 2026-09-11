const {
    Client,
    GatewayIntentBits,
    Partials,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    REST,
    Routes,
    ActivityType
} = require("discord.js");

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

// =====================================================
// KLOZN CREATOR BOT
// =====================================================

const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    GUILD_ID: process.env.DISCORD_GUILD_ID || "",

    // 24/7 / stability
    HEALTH_INTERVAL_MS: 30_000,
    YOUTUBE_INTERVAL_MS: 120_000,
    KICK_INTERVAL_MS: 60_000,
    ERROR_RESTART_DELAY_MS: 5_000,

    // Render Web Service / UptimeRobot
    PORT: Number(process.env.PORT || 10000),
    HOST: "0.0.0.0",

    // Kick kullanıcı adı
    KICK_USERNAME: "KLOZN",

    // YouTube kanal ID
    YOUTUBE_CHANNEL_ID: "YOUTUBE_CHANNEL_ID_BURAYA",

    // YouTube RSS için
    YOUTUBE_RSS: true,

    // Bildirim kanalları
    LIVE_CHANNEL: "🔴・canlı-yayın",
    VIDEO_CHANNEL: "videolar",
    CLIP_CHANNEL: "klipler",

    // Ticket kategorisi
    TICKET_CATEGORY: "🎫・DESTEK",

    // Otomatik moderasyon
    AUTOMOD: true,

    // Mesaj başına maksimum uyarı
    MAX_WARNINGS: 3,

    // XP / persistent data
    XP_PER_MESSAGE: 8,
    XP_COOLDOWN_MS: 30_000,
    DATA_FILE: path.join(__dirname, "data.json")
};

// =====================================================
// ENVIRONMENT VALIDATION
// =====================================================

if (!CONFIG.TOKEN || !CONFIG.CLIENT_ID) {
    console.error("❌ DISCORD_TOKEN ve DISCORD_CLIENT_ID .env içinde tanımlanmalı.");
    process.exit(1);
}

// =====================================================
// PERSISTENT DATA
// =====================================================

const DEFAULT_DATA = { users: {}, warnings: {}, afk: {} };
let db = DEFAULT_DATA;

function loadData() {
    try {
        if (fs.existsSync(CONFIG.DATA_FILE)) {
            db = { ...DEFAULT_DATA, ...JSON.parse(fs.readFileSync(CONFIG.DATA_FILE, "utf8")) };
        }
    } catch (error) {
        console.error("❌ data.json okunamadı, temiz veri ile devam ediliyor:", error.message);
        db = { ...DEFAULT_DATA };
    }
}

let saveTimer = null;
function saveData() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try {
            fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(db, null, 2), "utf8");
        } catch (error) {
            console.error("❌ data.json yazılamadı:", error.message);
        }
    }, 500);
}

function getUserData(guildId, userId) {
    const key = `${guildId}:${userId}`;
    if (!db.users[key]) db.users[key] = { xp: 0, level: 0, messages: 0 };
    return db.users[key];
}

loadData();

// =====================================================
// CLIENT
// =====================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration
    ],

    partials: [
        Partials.Channel,
        Partials.GuildMember,
        Partials.Message,
        Partials.User
    ]
});

// =====================================================
// ROLLER
// =====================================================

const ROLES = {

    KLOZN: "KLOZN",

    YONETIM: "Yönetim",

    YAYINCI: "Yayıncı Ekibi",

    ICERIK: "İçerik Üretici",

    MOD: "Moderatör",

    VIP: "VIP İzleyici",

    IZLEYICI: "İzleyici",

    KAYITSIZ: "Kayıtsız",

    BOT: "Bot"
};

// =====================================================
// KATEGORİLER
// =====================================================

const CATEGORIES = {

    WELCOME: "👋・HOŞ GELDİN",

    GENERAL: "💬・GENEL",

    STREAM: "🔴・YAYIN",

    CONTENT: "🎬・İÇERİK",

    COMMUNITY: "🎮・TOPLULUK",

    SUPPORT: "🎫・DESTEK",

    STAFF: "🛡️・YÖNETİM",

    LOGS: "🔐・LOGLAR",

    VOICE: "🔊・SES KANALLARI"
};

// =====================================================
// KANALLAR
// =====================================================

const CHANNELS = {

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

    STAFF_VOICE: "Yönetim Odası"
};

// =====================================================
// RUNTIME STATE / 24-7 GUARD
// =====================================================

let shuttingDown = false;
let lastReadyAt = 0;
let youtubeTimer = null;
let kickTimer = null;
let healthTimer = null;
let httpServer = null;

function safeInterval(fn, ms, label) {
    return setInterval(async () => {
        try {
            await fn();
        } catch (error) {
            console.error(`❌ ${label} hatası:`, error);
        }
    }, ms);
}

// =====================================================
// RENDER WEB SERVER / HEALTH ENDPOINTS
// =====================================================

function getHealthPayload() {
    const ready = Boolean(client.readyAt);
    return {
        ok: true,
        service: "klozn-discord-bot",
        discord: ready ? "ready" : "connecting",
        guilds: client.guilds.cache.size,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    };
}

function startHttpServer() {
    httpServer = http.createServer((req, res) => {
        const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");

        if (req.method !== "GET") {
            res.writeHead(405);
            return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
        }

        if (url.pathname === "/health" || url.pathname === "/") {
            res.writeHead(200);
            return res.end(JSON.stringify(getHealthPayload()));
        }

        if (url.pathname === "/status") {
            const ready = Boolean(client.readyAt);
            res.writeHead(ready ? 200 : 503);
            return res.end(JSON.stringify({ ...getHealthPayload(), ready }));
        }

        res.writeHead(404);
        return res.end(JSON.stringify({ ok: false, error: "not_found" }));
    });

    httpServer.keepAliveTimeout = 65_000;
    httpServer.headersTimeout = 70_000;
    httpServer.listen(CONFIG.PORT, CONFIG.HOST, () => {
        console.log(`🌐 Render HTTP server: http://${CONFIG.HOST}:${CONFIG.PORT}`);
        console.log(`❤️ Health: /health | 🤖 Bot status: /status`);
    });
    httpServer.on("error", error => console.error("❌ HTTP server hatası:", error));
}

startHttpServer();

// =====================================================
// CLIENT READY
// =====================================================

async function refreshPresence() {
    if (!client.user) return;
    client.user.setPresence({
        activities: [{
            name: "Klozn • Kick & YouTube",
            type: ActivityType.Watching
        }],
        status: "online"
    });
}

client.once("clientReady", async () => {

    lastReadyAt = Date.now();

    console.log(`
╔══════════════════════════════════════╗
║        KLOZN CREATOR BOT              ║
╠══════════════════════════════════════╣
║ Bot        : ${client.user.tag}
║ Sunucular  : ${client.guilds.cache.size}
║ Durum      : AKTİF
║ Yetki      : ADMIN ONLY
╚══════════════════════════════════════╝
    `);

    await refreshPresence();

    await registerCommands();

    console.log("Slash komutları yüklendi.");

    if (CONFIG.YOUTUBE_RSS) {
        if (youtubeTimer) clearInterval(youtubeTimer);
        youtubeTimer = safeInterval(checkYouTube, CONFIG.YOUTUBE_INTERVAL_MS, "YouTube");
    }

    // Kick kontrolü
    if (kickTimer) clearInterval(kickTimer);
    kickTimer = safeInterval(checkKick, CONFIG.KICK_INTERVAL_MS, "Kick");

    // Basit sağlık/heartbeat kontrolü.
    if (healthTimer) clearInterval(healthTimer);
    healthTimer = setInterval(() => {
        const wsStatus = client.ws?.status;
        console.log(
            `[HEALTH] ${new Date().toISOString()} | guilds=${client.guilds.cache.size} | ws=${wsStatus} | ready=${Boolean(lastReadyAt)}`
        );
    }, CONFIG.HEALTH_INTERVAL_MS);

    // Discord oturumundan sonra presence'ı düzenli olarak yenile.
    setInterval(() => {
        if (client.readyAt) refreshPresence().catch(err => console.error("❌ Presence hatası:", err));
    }, 60_000);
});

// Gateway yeniden bağlandığında presence'ı tekrar gönder.
client.on("shardResume", () => {
    refreshPresence().catch(err => console.error("❌ Presence yenileme hatası:", err));
});

// =====================================================
// SLASH COMMANDS
// =====================================================

const commands = [

    {
        name: "kurulum",
        description: "Klozn Discord sistemini kurar.",
        default_member_permissions:
            PermissionFlagsBits.Administrator.toString()
    },

    {
        name: "duyuru",
        description: "Sunucuda duyuru yapar.",
        options: [
            {
                name: "mesaj",
                description: "Duyuru mesajı",
                type: 3,
                required: true
            }
        ],

        default_member_permissions:
            PermissionFlagsBits.Administrator.toString()
    },

    {
        name: "ban",
        description: "Üyeyi sunucudan yasaklar.",
        options: [
            {
                name: "üye",
                description: "Yasaklanacak üye",
                type: 6,
                required: true
            },
            {
                name: "sebep",
                description: "Ban sebebi",
                type: 3,
                required: false
            }
        ],

        default_member_permissions:
            PermissionFlagsBits.Administrator.toString()
    },

    {
        name: "mute",
        description: "Üyeyi susturur.",
        options: [
            {
                name: "üye",
                description: "Susturulacak üye",
                type: 6,
                required: true
            },
            {
                name: "süre",
                description: "Dakika",
                type: 4,
                required: true
            },
            {
                name: "sebep",
                description: "Sebep",
                type: 3,
                required: false
            }
        ],

        default_member_permissions:
            PermissionFlagsBits.Administrator.toString()
    },

    {
        name: "temizle",
        description: "Mesajları temizler.",
        options: [
            {
                name: "miktar",
                description: "Silinecek mesaj sayısı",
                type: 4,
                required: true
            }
        ],

        default_member_permissions:
            PermissionFlagsBits.Administrator.toString()
    },

    {
        name: "ticket-kur",
        description: "Ticket sistemini kurar.",
        default_member_permissions:
            PermissionFlagsBits.Administrator.toString()
    },

    {
        name: "klip",
        description: "Klip kanalına klip gönderir.",
        options: [
            {
                name: "link",
                description: "Klip linki",
                type: 3,
                required: true
            },
            {
                name: "başlık",
                description: "Klip başlığı",
                type: 3,
                required: true
            }
        ]
    },

    {
        name: "bilgi",
        description: "Klozn hakkında bilgi gösterir.",
        default_member_permissions:
            PermissionFlagsBits.Administrator.toString()
    },

    {
        name: "yardim",
        description: "Bot komutlarını gösterir."
    },

    {
        name: "sunucu",
        description: "Sunucu istatistiklerini gösterir."
    },

    {
        name: "level",
        description: "Seviye ve XP bilgini gösterir."
    },

    {
        name: "afk",
        description: "AFK durumunu ayarlar.",
        options: [{ name: "sebep", description: "AFK sebebi", type: 3, required: false }]
    },

    {
        name: "uyari",
        description: "Bir üyeye uyarı verir.",
        default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
        options: [
            { name: "üye", description: "Uyarılacak üye", type: 6, required: true },
            { name: "sebep", description: "Uyarı sebebi", type: 3, required: false }
        ]
    },

    {
        name: "uyarilar",
        description: "Bir üyenin uyarılarını gösterir.",
        default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
        options: [{ name: "üye", description: "Üye", type: 6, required: true }]
    },

    {
        name: "kilit",
        description: "Mevcut kanalı kilitler.",
        default_member_permissions: PermissionFlagsBits.ManageChannels.toString()
    },

    {
        name: "kilitac",
        description: "Mevcut kanalın kilidini açar.",
        default_member_permissions: PermissionFlagsBits.ManageChannels.toString()
    }

];

// =====================================================
// KOMUT KAYDI
// =====================================================

async function registerCommands() {

    const rest = new REST({
        version: "10"
    }).setToken(CONFIG.TOKEN);

    const route = CONFIG.GUILD_ID
        ? Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID)
        : Routes.applicationCommands(CONFIG.CLIENT_ID);

    await rest.put(route, { body: commands });
}

// =====================================================
// ADMIN KONTROLÜ
// =====================================================

function isAdmin(interaction) {

    if (!interaction.guild) return false;

    return interaction.member.permissions.has(
        PermissionFlagsBits.Administrator
    );
}

// =====================================================
// KOMUT GÜVENLİK DUVARI
// =====================================================

client.on("interactionCreate", async interaction => {

    if (!interaction.isChatInputCommand()) return;

    /*
    =====================================================
    TÜM KOMUTLAR İÇİN ADMIN KONTROLÜ
    =====================================================
    */

    if (!isAdmin(interaction)) {

        return interaction.reply({

            content:
                "🔒 **Bu botun komutlarını sadece Yönetici yetkisine sahip kişiler kullanabilir.**",

            ephemeral: true
        });
    }

    try {
        const extraHandled = await handleExtraCommand(interaction);
        if (extraHandled !== false) return;
        await handleCommand(interaction);
    } catch (error) {
        console.error("❌ Komut hatası:", error);

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: "❌ Komut çalıştırılırken beklenmeyen bir hata oluştu.",
                ephemeral: true
            }).catch(() => {});
        } else {
            await interaction.followUp({
                content: "❌ Komut çalıştırılırken beklenmeyen bir hata oluştu.",
                ephemeral: true
            }).catch(() => {});
        }
    }
});

// =====================================================
// KOMUTLAR
// =====================================================

async function handleCommand(interaction) {

    const command = interaction.commandName;

    // =================================================
    // KURULUM
    // =================================================

    if (command === "kurulum") {

        await interaction.reply({

            content:
                "⚙️ **KLOZN Creator Discord kurulumu başlatılıyor...**",

            ephemeral: true
        });

        try {

            await setupServer(interaction.guild);

            await interaction.editReply({

                content:
                    "✅ **KLOZN Creator Discord kurulumu tamamlandı!**\n\n" +

                    "🎭 Roller\n" +
                    "📁 Kategoriler\n" +
                    "🔐 Yetkiler\n" +
                    "📝 Kayıt sistemi\n" +
                    "🎫 Ticket sistemi\n" +
                    "📋 Log sistemi\n" +
                    "🛡️ AutoMod\n" +

                    "\nbaşarıyla oluşturuldu."

            });

        } catch (error) {

            console.error(error);

            await interaction.editReply({

                content:
                    "❌ Kurulum sırasında hata oluştu."
            });
        }
    }

    // =================================================
    // DUYURU
    // =================================================

    if (command === "duyuru") {

        const mesaj =
            interaction.options.getString("mesaj");

        const embed = new EmbedBuilder()

            .setTitle("📢 KLOZN DUYURU")

            .setDescription(mesaj)

            .setFooter({
                text: "KLOZN • Creator Community"
            })

            .setTimestamp();

        await interaction.channel.send({

            content: "@everyone",

            embeds: [embed]
        });

        await interaction.reply({

            content: "✅ Duyuru gönderildi.",

            ephemeral: true
        });

        await logAction(
            interaction.guild,
            "📢 Duyuru",
            `${interaction.user} tarafından duyuru gönderildi.`
        );
    }

    // =================================================
    // BAN
    // =================================================

    if (command === "ban") {

        const member =
            interaction.options.getMember("üye");

        const reason =
            interaction.options.getString("sebep") ||
            "Sebep belirtilmedi.";

        if (!member) {

            return interaction.reply({

                content: "❌ Üye bulunamadı.",

                ephemeral: true
            });
        }

        if (!member.bannable) {

            return interaction.reply({

                content:
                    "❌ Bu üyeyi yasaklayamıyorum. Rol sırasını kontrol et.",

                ephemeral: true
            });
        }

        await member.ban({

            reason: reason

        });

        await interaction.reply({

            content:
                `🔨 **${member.user.tag}** sunucudan yasaklandı.\nSebep: ${reason}`,

            ephemeral: true
        });

        await logAction(

            interaction.guild,

            "🔨 BAN",

            `**Üye:** ${member.user.tag}\n**Yetkili:** ${interaction.user.tag}\n**Sebep:** ${reason}`
        );
    }

    // =================================================
    // MUTE
    // =================================================

    if (command === "mute") {

        const member =
            interaction.options.getMember("üye");

        const minutes =
            interaction.options.getInteger("süre");

        const reason =
            interaction.options.getString("sebep") ||
            "Sebep belirtilmedi.";

        if (!member) {

            return interaction.reply({

                content: "❌ Üye bulunamadı.",

                ephemeral: true
            });
        }

        if (!member.moderatable) {

            return interaction.reply({

                content:
                    "❌ Bu üyeyi susturamıyorum.",

                ephemeral: true
            });
        }

        await member.timeout(

            minutes * 60 * 1000,

            reason

        );

        await interaction.reply({

            content:
                `🔇 **${member.user.tag}** ${minutes} dakika susturuldu.`,

            ephemeral: true
        });

        await logAction(

            interaction.guild,

            "🔇 MUTE",

            `**Üye:** ${member.user.tag}\n**Yetkili:** ${interaction.user.tag}\n**Süre:** ${minutes} dakika\n**Sebep:** ${reason}`
        );
    }

    // =================================================
    // TEMİZLE
    // =================================================

    if (command === "temizle") {

        const amount =
            interaction.options.getInteger("miktar");

        if (amount < 1 || amount > 100) {

            return interaction.reply({

                content:
                    "❌ 1 ile 100 arasında bir sayı gir.",

                ephemeral: true
            });
        }

        const deleted =
            await interaction.channel.bulkDelete(
                amount,
                true
            );

        await interaction.reply({

            content:
                `🧹 **${deleted.size}** mesaj temizlendi.`,

            ephemeral: true
        });

        await logAction(

            interaction.guild,

            "🧹 MESAJ TEMİZLEME",

            `**Yetkili:** ${interaction.user.tag}\n**Miktar:** ${deleted.size}\n**Kanal:** ${interaction.channel}`
        );
    }

    // =================================================
    // KLİP
    // =================================================

    if (command === "klip") {

        const link =
            interaction.options.getString("link");

        const title =
            interaction.options.getString("başlık");

        const channel =
            interaction.guild.channels.cache.find(

                c =>
                    c.name === CHANNELS.CLIPS

            );

        if (!channel) {

            return interaction.reply({

                content:
                    "❌ Klip kanalı bulunamadı.",

                ephemeral: true
            });
        }

        const embed =
            new EmbedBuilder()

                .setTitle(`🎬 ${title}`)

                .setDescription(
                    `🔗 **[KLİBİ İZLE](${link})**`
                )

                .addFields({

                    name: "👤 Paylaşan",

                    value:
                        interaction.user.toString()

                })

                .setFooter({

                    text:
                        "KLOZN • Clip Center"

                })

                .setTimestamp();

        await channel.send({

            embeds: [embed]

        });

        await interaction.reply({

            content:
                "🎬 Klip başarıyla paylaşıldı.",

            ephemeral: true
        });
    }

    // =================================================
    // TICKET
    // =================================================

    if (command === "ticket-kur") {

        const category =
            interaction.guild.channels.cache.find(

                c =>
                    c.type === ChannelType.GuildCategory &&
                    c.name === CONFIG.TICKET_CATEGORY

            );

        if (!category) {

            return interaction.reply({

                content:
                    "❌ Ticket kategorisi bulunamadı.",

                ephemeral: true
            });
        }

        const embed =
            new EmbedBuilder()

                .setTitle("🎫 KLOZN DESTEK")

                .setDescription(
                    "Destek ekibine ulaşmak için aşağıdaki butona bas.\n\n" +
                    "📌 Yönetim\n" +
                    "🛠️ Teknik destek\n" +
                    "📺 Yayın sorunları\n" +
                    "💬 Diğer konular"
                );

        const row =
            new ActionRowBuilder()

                .addComponents(

                    new ButtonBuilder()

                        .setCustomId(
                            "klozn_ticket"
                        )

                        .setLabel(
                            "Ticket Aç"
                        )

                        .setEmoji("🎫")

                        .setStyle(
                            ButtonStyle.Primary
                        )
                );

        await interaction.channel.send({

            embeds: [embed],

            components: [row]
        });

        await interaction.reply({

            content:
                "✅ Ticket sistemi kuruldu.",

            ephemeral: true
        });
    }

    // =================================================
    // BİLGİ
    // =================================================

    if (command === "bilgi") {

        const embed =
            new EmbedBuilder()

                .setTitle("🎥 KLOZN CREATOR")

                .setDescription(
                    "🔴 Kick Yayınları\n" +
                    "▶️ YouTube İçerikleri\n" +
                    "🎬 Klipler\n" +
                    "🎮 Oyun Topluluğu\n" +
                    "🎁 Etkinlikler\n" +
                    "🎫 Destek\n\n" +

                    "**KLOZN**\n" +
                    "Yayıncı • İçerik Üretici"
                );

        await interaction.reply({

            embeds: [embed],

            ephemeral: true
        });
    }
}

// =====================================================
// BUTON SİSTEMİ
// =====================================================

client.on("interactionCreate", async interaction => {

    if (!interaction.isButton()) return;

    // =================================================
    // TICKET
    // =================================================

    if (
        interaction.customId === "klozn_ticket"
    ) {

        const guild =
            interaction.guild;

        const existing =
            guild.channels.cache.find(

                c =>
                    c.name ===
                    `ticket-${interaction.user.username.toLowerCase()}`

            );

        if (existing) {

            return interaction.reply({

                content:
                    `🎫 Zaten açık bir ticket'ın var: ${existing}`,

                ephemeral: true
            });
        }

        const category =
            guild.channels.cache.find(

                c =>
                    c.type === ChannelType.GuildCategory &&
                    c.name === CONFIG.TICKET_CATEGORY

            );

        const adminRoles =
            guild.roles.cache.filter(

                r =>
                    r.name === ROLES.KLOZN ||
                    r.name === ROLES.YONETIM ||
                    r.name === ROLES.MOD

            );

        const overwrites = [

            {
                id: guild.roles.everyone.id,

                deny: [
                    PermissionFlagsBits.ViewChannel
                ]
            },

            {
                id: interaction.user.id,

                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory
                ]
            }
        ];

        adminRoles.forEach(role => {

            overwrites.push({

                id: role.id,

                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory
                ]
            });

        });

        const ticket =
            await guild.channels.create({

                name:
                    `ticket-${interaction.user.username}`,

                type:
                    ChannelType.GuildText,

                parent:
                    category?.id,

                permissionOverwrites:
                    overwrites

            });

        const closeRow =
            new ActionRowBuilder()

                .addComponents(

                    new ButtonBuilder()

                        .setCustomId(
                            "klozn_ticket_close"
                        )

                        .setLabel(
                            "Ticket Kapat"
                        )

                        .setEmoji("🔒")

                        .setStyle(
                            ButtonStyle.Danger
                        )
                );

        await ticket.send({

            content:
                `${interaction.user}`,

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        "🎫 KLOZN DESTEK TICKET"
                    )

                    .setDescription(
                        "Destek talebin oluşturuldu.\n\n" +
                        "Yetkili ekibimiz en kısa sürede ilgilenecektir."
                    )

            ],

            components: [
                closeRow
            ]
        });

        await interaction.reply({

            content:
                `🎫 Ticket oluşturuldu: ${ticket}`,

            ephemeral: true
        });

        await logAction(

            guild,

            "🎫 TICKET",

            `${interaction.user.tag} yeni ticket oluşturdu: ${ticket.name}`
        );
    }

    // =================================================
    // TICKET KAPAT
    // =================================================

    if (
        interaction.customId ===
        "klozn_ticket_close"
    ) {

        if (!isAdmin(interaction)) {

            return interaction.reply({

                content:
                    "🔒 Ticket kapatma yetkin yok.",

                ephemeral: true
            });
        }

        await interaction.reply({

            content:
                "🔒 Ticket kapatılıyor...",

            ephemeral: true
        });

        await logAction(

            interaction.guild,

            "🔒 TICKET KAPATILDI",

            `${interaction.user.tag} tarafından ${interaction.channel.name} kapatıldı.`
        );

        setTimeout(() => {

            interaction.channel.delete();

        }, 1500);
    }

});

// =====================================================
// YENİ ÜYE
// =====================================================

client.on("guildMemberAdd", async member => {

    const role =
        member.guild.roles.cache.find(

            r =>
                r.name === ROLES.KAYITSIZ

        );

    if (role) {

        try {

            await member.roles.add(role);

        } catch (error) {

            console.error(error);
        }
    }

    await logAction(

        member.guild,

        "👤 ÜYE GİRDİ",

        `**Üye:** ${member.user.tag}\n**ID:** ${member.id}`
    );
});

// =====================================================
// ÜYE ÇIKTI
// =====================================================

client.on("guildMemberRemove", async member => {

    await logAction(

        member.guild,

        "🚪 ÜYE ÇIKTI",

        `**Üye:** ${member.user.tag}\n**ID:** ${member.id}`
    );
});

// =====================================================
// MESAJ SİLİNDİ
// =====================================================

client.on("messageDelete", async message => {

    if (!message.guild) return;

    if (message.author?.bot) return;

    await logAction(

        message.guild,

        "🗑️ MESAJ SİLİNDİ",

        `**Kullanıcı:** ${message.author?.tag || "Bilinmiyor"}\n` +
        `**Kanal:** ${message.channel}\n` +
        `**Mesaj:** ${message.content || "İçerik yok"}`
    );
});

// =====================================================
// MESAJ DÜZENLENDİ
// =====================================================

client.on("messageUpdate", async (oldMessage, newMessage) => {

    if (!oldMessage.guild) return;

    if (oldMessage.author?.bot) return;

    if (oldMessage.content === newMessage.content) return;

    await logAction(

        oldMessage.guild,

        "✏️ MESAJ DÜZENLENDİ",

        `**Kullanıcı:** ${oldMessage.author?.tag}\n` +
        `**Kanal:** ${oldMessage.channel}\n\n` +
        `**Eski:** ${oldMessage.content || "Yok"}\n` +
        `**Yeni:** ${newMessage.content || "Yok"}`
    );
});

// =====================================================
// AUTOMOD
// =====================================================

const BAD_WORDS = [

    "discord.gg/",
    "http://",
    "https://",
    "@everyone",
    "@here"

];

client.on("messageCreate", async message => {

    if (!CONFIG.AUTOMOD) return;

    if (!message.guild) return;

    if (message.author.bot) return;

    // AFK temizleme + mention bildirimi
    const afkKey = `${message.guild.id}:${message.author.id}`;
    if (db.afk[afkKey]) {
        delete db.afk[afkKey];
        saveData();
        await message.reply("👋 AFK durumun kaldırıldı.").catch(() => {});
    }

    for (const mentioned of message.mentions.users.values()) {
        const info = db.afk[`${message.guild.id}:${mentioned.id}`];
        if (info) {
            await message.reply(`💤 **${mentioned.username}** şu anda AFK: ${info.reason}`).catch(() => {});
            break;
        }
    }

    // Basit XP sistemi: kullanıcı başına cooldown ile spam önlenir.
    const userData = getUserData(message.guild.id, message.author.id);
    const now = Date.now();
    const lastXp = userData.lastXpAt || 0;
    if (now - lastXp >= CONFIG.XP_COOLDOWN_MS) {
        userData.lastXpAt = now;
        userData.xp += CONFIG.XP_PER_MESSAGE;
        userData.messages += 1;
        const newLevel = Math.floor(userData.xp / 100);
        if (newLevel > userData.level) {
            userData.level = newLevel;
            await message.channel.send(`🎉 <@${message.author.id}> **Seviye ${newLevel}** oldun!`).catch(() => {});
        }
        saveData();
    }

    // ADMINLERE AUTOMOD UYGULAMA

    if (
        message.member.permissions.has(
            PermissionFlagsBits.Administrator
        )
    ) return;

    const content =
        message.content.toLowerCase();

    const detected =
        BAD_WORDS.some(
            word =>
                content.includes(
                    word.toLowerCase()
                )
        );

    if (!detected) return;

    try {

        await message.delete();

    } catch {}

    try {

        await message.member.timeout(

            60 * 1000,

            "Klozn AutoMod"

        );

    } catch {}

    await logAction(

        message.guild,

        "🛡️ AUTOMOD",

        `**Üye:** ${message.author.tag}\n` +
        `**Kanal:** ${message.channel}\n` +
        `**İçerik:** ${message.content}`
    );
});

// =====================================================
// LOG SİSTEMİ
// =====================================================

async function logAction(
    guild,
    title,
    description
) {

    const channel =
        guild.channels.cache.find(

            c =>
                c.name ===
                CHANNELS.SERVER_LOG

        );

    if (!channel) return;

    const embed =
        new EmbedBuilder()

            .setTitle(title)

            .setDescription(description)

            .setTimestamp()

            .setFooter({

                text:
                    "KLOZN Security & Logs"

            });

    try {

        await channel.send({

            embeds: [embed]

        });

    } catch {}
}

// =====================================================
// YOUTUBE
// =====================================================

let lastYouTubeVideo = null;

async function checkYouTube() {

    if (
        !CONFIG.YOUTUBE_CHANNEL_ID ||
        CONFIG.YOUTUBE_CHANNEL_ID.includes("BURAYA")
    ) return;

    const url =
        `https://www.youtube.com/feeds/videos.xml?channel_id=${CONFIG.YOUTUBE_CHANNEL_ID}`;

    https.get(url, response => {

        let data = "";

        response.on(
            "data",
            chunk => data += chunk
        );

        response.on(
            "end",
            async () => {

                const idMatch =
                    data.match(
                        /<yt:videoId>(.*?)<\/yt:videoId>/
                    );

                const titleMatch =
                    data.match(
                        /<media:title>(.*?)<\/media:title>/
                    );

                if (!idMatch) return;

                const videoId =
                    idMatch[1];

                const title =
                    titleMatch
                        ? titleMatch[1]
                        : "Yeni YouTube Videosu";

                if (
                    lastYouTubeVideo === videoId
                ) return;

                lastYouTubeVideo =
                    videoId;

                for (
                    const guild of client.guilds.cache.values()
                ) {

                    const channel =
                        guild.channels.cache.find(

                            c =>
                                c.name ===
                                CONFIG.VIDEO_CHANNEL

                        );

                    if (!channel) continue;

                    const embed =
                        new EmbedBuilder()

                            .setTitle(
                                "▶️ KLOZN YENİ VİDEO"
                            )

                            .setDescription(
                                `**${title}**\n\n` +
                                `📺 YouTube'da şimdi yayında!`
                            )

                            .addFields({

                                name:
                                    "🔗 Video",

                                value:
                                    `https://www.youtube.com/watch?v=${videoId}`

                            })

                            .setTimestamp();

                    await channel.send({

                        content:
                            "@everyone",

                        embeds: [
                            embed
                        ]
                    });
                }
            }
        );

    }).on("error", () => {});
}

// =====================================================
// KICK
// =====================================================

let kickLive = false;

async function checkKick() {

    /*
    Kick API bağlantısını CONFIG.KICK_USERNAME
    üzerinden kullanacak şekilde burada tutuluyor.

    API erişim bilgileri eklenince:
    ONLINE  -> canlı yayın mesajı
    OFFLINE -> durum güncellemesi
    */

    if (!CONFIG.KICK_USERNAME) return;

    // Kick API entegrasyon noktası.
    // API endpoint/token bilgilerini burada
    // sunucu hesabına göre yapılandırabilirsin.
}

// =====================================================
// SUNUCU KURULUMU
// =====================================================

async function setupServer(guild) {

    console.log(
        "KLOZN sunucu kurulumu başlıyor..."
    );

    const roles =
        await createRoles(guild);

    /*
    -----------------------------------------------------
    HOŞ GELDİN
    -----------------------------------------------------
    */

    const welcome =
        await createCategory(

            guild,

            CATEGORIES.WELCOME,

            roles,

            "register"

        );

    const register =
        await createChannel(

            guild,

            CHANNELS.REGISTER,

            welcome,

            roles,

            "register"

        );

    await createChannel(

        guild,

        CHANNELS.RULES,

        welcome,

        roles,

        "register"

    );

    await createChannel(

        guild,

        CHANNELS.WELCOME,

        welcome,

        roles,

        "register"

    );

    /*
    -----------------------------------------------------
    GENEL
    -----------------------------------------------------
    */

    const general =
        await createCategory(

            guild,

            CATEGORIES.GENERAL,

            roles,

            "normal"

        );

    await createChannel(
        guild,
        CHANNELS.CHAT,
        general,
        roles,
        "normal"
    );

    await createChannel(
        guild,
        CHANNELS.MEDIA,
        general,
        roles,
        "normal"
    );

    await createChannel(
        guild,
        CHANNELS.BOT,
        general,
        roles,
        "normal"
    );

    /*
    -----------------------------------------------------
    YAYIN
    -----------------------------------------------------
    */

    const stream =
        await createCategory(

            guild,

            CATEGORIES.STREAM,

            roles,

            "normal"

        );

    await createChannel(
        guild,
        CHANNELS.LIVE,
        stream,
        roles,
        "normal"
    );

    await createChannel(
        guild,
        CHANNELS.LIVE_CHAT,
        stream,
        roles,
        "normal"
    );

    /*
    -----------------------------------------------------
    İÇERİK
    -----------------------------------------------------
    */

    const content =
        await createCategory(

            guild,

            CATEGORIES.CONTENT,

            roles,

            "normal"

        );

    await createChannel(
        guild,
        CHANNELS.CLIPS,
        content,
        roles,
        "normal"
    );

    await createChannel(
        guild,
        CHANNELS.VIDEOS,
        content,
        roles,
        "normal"
    );

    /*
    -----------------------------------------------------
    TOPLULUK
    -----------------------------------------------------
    */

    const community =
        await createCategory(

            guild,

            CATEGORIES.COMMUNITY,

            roles,

            "normal"

        );

    for (
        const channelName of [
            CHANNELS.GAME,
            CHANNELS.LOOKING,
            CHANNELS.EVENTS,
            CHANNELS.GIVEAWAY
        ]
    ) {

        await createChannel(
            guild,
            channelName,
            community,
            roles,
            "normal"
        );
    }

    /*
    -----------------------------------------------------
    DESTEK
    -----------------------------------------------------
    */

    const support =
        await createCategory(

            guild,

            CATEGORIES.SUPPORT,

            roles,

            "normal"

        );

    await createChannel(
        guild,
        CHANNELS.TICKET,
        support,
        roles,
        "normal"
    );

    await createChannel(
        guild,
        CHANNELS.SUGGESTION,
        support,
        roles,
        "normal"
    );

    /*
    -----------------------------------------------------
    YÖNETİM
    -----------------------------------------------------
    */

    const staff =
        await createCategory(

            guild,

            CATEGORIES.STAFF,

            roles,

            "staff"

        );

    await createChannel(
        guild,
        CHANNELS.STAFF_CHAT,
        staff,
        roles,
        "admin"
    );

    await createChannel(
        guild,
        CHANNELS.MOD_CHAT,
        staff,
        roles,
        "staff"
    );

    await createChannel(
        guild,
        CHANNELS.APPLICATIONS,
        staff,
        roles,
        "staff"
    );

    /*
    -----------------------------------------------------
    LOGLAR
    -----------------------------------------------------
    */

    const logs =
        await createCategory(

            guild,

            CATEGORIES.LOGS,

            roles,

            "admin"

        );

    for (
        const channelName of [

            CHANNELS.SERVER_LOG,

            CHANNELS.MOD_LOG,

            CHANNELS.MEMBER_LOG,

            CHANNELS.COMMAND_LOG,

            CHANNELS.MESSAGE_LOG,

            CHANNELS.VOICE_LOG

        ]
    ) {

        await createChannel(

            guild,

            channelName,

            logs,

            roles,

            "admin"

        );
    }

    /*
    -----------------------------------------------------
    SES
    -----------------------------------------------------
    */

    const voice =
        await createCategory(

            guild,

            CATEGORIES.VOICE,

            roles,

            "normal"

        );

    await createChannel(
        guild,
        CHANNELS.GENERAL_VOICE,
        voice,
        roles,
        "normal",
        ChannelType.GuildVoice
    );

    await createChannel(
        guild,
        CHANNELS.GAMING_VOICE,
        voice,
        roles,
        "normal",
        ChannelType.GuildVoice
    );

    await createChannel(
        guild,
        CHANNELS.VIP_VOICE,
        voice,
        roles,
        "normal",
        ChannelType.GuildVoice
    );

    await createChannel(
        guild,
        CHANNELS.STREAM_VOICE,
        voice,
        roles,
        "normal",
        ChannelType.GuildVoice
    );

    await createChannel(
        guild,
        CHANNELS.STAFF_VOICE,
        voice,
        roles,
        "staff",
        ChannelType.GuildVoice
    );

    /*
    -----------------------------------------------------
    KAYIT MESAJI
    -----------------------------------------------------
    */

    // Kayıt mesajını tekrar tekrar göndermemek için mevcut mesajları kontrol et.
    const existingRegisterMessages = await register.messages.fetch({ limit: 20 }).catch(() => null);
    const hasRegisterPanel = existingRegisterMessages?.some(
        m => m.author.id === client.user.id &&
             m.components?.some(row =>
                 row.components?.some(component => component.customId === "klozn_register")
             )
    );

    if (!hasRegisterPanel) {
        await register.send({

        embeds: [

            new EmbedBuilder()

                .setTitle(
                    "🎥 KLOZN COMMUNITY"
                )

                .setDescription(

                    "Klozn yayın ve içerik topluluğuna hoş geldin!\n\n" +

                    "Sunucunun tamamına erişmek için aşağıdaki butona bas.\n\n" +

                    "🔴 Kick Yayınları\n" +
                    "▶️ YouTube İçerikleri\n" +
                    "🎬 Klipler\n" +
                    "🎮 Oyunlar\n" +
                    "💬 Topluluk\n" +
                    "🎁 Etkinlikler"

                )

                .setFooter({

                    text:
                        "KLOZN • Creator Community"

                })

        ],

        components: [

            new ActionRowBuilder()

                .addComponents(

                    new ButtonBuilder()

                        .setCustomId(
                            "klozn_register"
                        )

                        .setLabel(
                            "Kayıt Ol"
                        )

                        .setEmoji("✅")

                        .setStyle(
                            ButtonStyle.Success
                        )
                )
        ]
        });
    }

    console.log(
        "KLOZN sunucu kurulumu tamamlandı."
    );
}

// =====================================================
// ROL OLUŞTUR
// =====================================================

async function createRoles(guild) {

    const roles = {};

    roles.KLOZN =
        await getRole(

            guild,

            ROLES.KLOZN,

            0x8B0000,

            [PermissionFlagsBits.Administrator]

        );

    roles.YONETIM =
        await getRole(

            guild,

            ROLES.YONETIM,

            0xFF0000,

            [
                PermissionFlagsBits.Administrator
            ]

        );

    roles.YAYINCI =
        await getRole(

            guild,

            ROLES.YAYINCI,

            0x9146FF

        );

    roles.ICERIK =
        await getRole(

            guild,

            ROLES.ICERIK,

            0x00BFFF

        );

    roles.MOD =
        await getRole(

            guild,

            ROLES.MOD,

            0x00FF7F,

            [
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.ModerateMembers
            ]

        );

    roles.VIP =
        await getRole(

            guild,

            ROLES.VIP,

            0xFFD700

        );

    roles.IZLEYICI =
        await getRole(

            guild,

            ROLES.IZLEYICI,

            0x7289DA

        );

    roles.KAYITSIZ =
        await getRole(

            guild,

            ROLES.KAYITSIZ,

            0x808080

        );

    roles.BOT =
        await getRole(

            guild,

            ROLES.BOT,

            0x5865F2

        );

    return roles;
}

// =====================================================
// ROLE HELPER
// =====================================================

async function getRole(
    guild,
    name,
    color = 0xFFFFFF,
    permissions = []
) {

    let role =
        guild.roles.cache.find(
            r => r.name === name
        );

    if (!role) {

        role =
            await guild.roles.create({

                name,

                color,

                permissions,

                hoist: true,

                reason:
                    "KLOZN Creator Bot"
            });
    }

    return role;
}

// =====================================================
// CATEGORY
// =====================================================

async function createCategory(
    guild,
    name,
    roles,
    type
) {

    let category =
        guild.channels.cache.find(

            c =>
                c.type === ChannelType.GuildCategory &&
                c.name === name

        );

    if (!category) {

        category =
            await guild.channels.create({

                name,

                type:
                    ChannelType.GuildCategory,

                permissionOverwrites:
                    getPermissions(
                        guild,
                        roles,
                        type
                    )

            });
    }

    return category;
}

// =====================================================
// CHANNEL
// =====================================================

async function createChannel(
    guild,
    name,
    parent,
    roles,
    type,
    channelType = ChannelType.GuildText
) {

    let channel =
        guild.channels.cache.find(

            c =>
                c.name === name &&
                c.parentId === parent.id

        );

    if (!channel) {

        channel =
            await guild.channels.create({

                name,

                type: channelType,

                parent: parent.id,

                permissionOverwrites:
                    getPermissions(
                        guild,
                        roles,
                        type
                    )

            });
    }

    return channel;
}

// =====================================================
// PERMISSIONS
// =====================================================

function getPermissions(
    guild,
    roles,
    type
) {

    const everyone =
        guild.roles.everyone.id;

    const permissions = [

        {
            id: everyone,

            deny: [
                PermissionFlagsBits.ViewChannel
            ]
        },

        {
            id: roles.KLOZN.id,

            allow: [
                PermissionFlagsBits.ViewChannel
            ]
        },

        {
            id: roles.YONETIM.id,

            allow: [
                PermissionFlagsBits.ViewChannel
            ]
        }

    ];

    // =================================================
    // KAYITSIZ
    // =================================================

    if (type === "register") {

        permissions.push({

            id: roles.KAYITSIZ.id,

            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
            ]

        });

        return permissions;
    }

    // =================================================
    // NORMAL
    // =================================================

    if (type === "normal") {

        for (
            const role of [

                roles.IZLEYICI,
                roles.VIP,
                roles.ICERIK,
                roles.YAYINCI,
                roles.MOD

            ]
        ) {

            permissions.push({

                id: role.id,

                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory
                ]

            });

        }

        return permissions;
    }

    // =================================================
    // STAFF
    // =================================================

    if (type === "staff") {

        permissions.push({

            id: roles.MOD.id,

            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
            ]

        });

        return permissions;
    }

    // =================================================
    // ADMIN
    // =================================================

    if (type === "admin") {

        return permissions;
    }

    return permissions;
}

// =====================================================
// KAYIT BUTONU
// =====================================================

client.on("interactionCreate", async interaction => {

    if (!interaction.isButton()) return;

    if (
        interaction.customId !==
        "klozn_register"
    ) return;

    const guild =
        interaction.guild;

    const member =
        interaction.member;

    const viewerRole =
        guild.roles.cache.find(

            r =>
                r.name ===
                ROLES.IZLEYICI

        );

    const unregisteredRole =
        guild.roles.cache.find(

            r =>
                r.name ===
                ROLES.KAYITSIZ

        );

    if (!viewerRole) {

        return interaction.reply({

            content:
                "❌ İzleyici rolü bulunamadı.",

            ephemeral: true
        });
    }

    if (
        member.roles.cache.has(
            viewerRole.id
        )
    ) {

        return interaction.reply({

            content:
                "✅ Zaten kayıtlısın.",

            ephemeral: true
        });
    }

    await member.roles.add(
        viewerRole
    );

    if (
        unregisteredRole &&
        member.roles.cache.has(
            unregisteredRole.id
        )
    ) {

        await member.roles.remove(
            unregisteredRole
        );
    }

    await interaction.reply({

        content:
            "🎉 **Kayıt tamamlandı!**\n" +
            "Klozn topluluğunun tüm normal kanallarına erişimin açıldı.",

        ephemeral: true
    });

    await logAction(

        guild,

        "📝 KAYIT",

        `${member.user.tag} sunucuya kayıt oldu.`
    );
});

// =====================================================
// LOGIN
// =====================================================

process.on("unhandledRejection", error => {
    console.error("❌ unhandledRejection:", error);
});

process.on("uncaughtException", error => {
    console.error("❌ uncaughtException:", error);
    // PM2/Docker gibi bir process manager'ın yeniden başlatabilmesi için
    // bozuk state ile devam etmek yerine kontrollü şekilde çıkıyoruz.
    if (!shuttingDown) {
        shuttingDown = true;
        setTimeout(() => process.exit(1), CONFIG.ERROR_RESTART_DELAY_MS).unref();
    }
});

async function gracefulShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`🛑 ${signal} alındı, bot kapatılıyor...`);

    if (youtubeTimer) clearInterval(youtubeTimer);
    if (kickTimer) clearInterval(kickTimer);
    if (healthTimer) clearInterval(healthTimer);

    try {
        client.destroy();
        if (httpServer) {
            await new Promise(resolve => httpServer.close(() => resolve()));
        }
    } finally {
        setTimeout(() => process.exit(0), 1_000).unref();
    }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

client.login(CONFIG.TOKEN).catch(error => {
    console.error("❌ Discord login başarısız:", error);
    process.exit(1);
});