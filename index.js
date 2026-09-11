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
} = require('discord.js');
const http = require('http');
require('dotenv').config();

// ============================================================
// KLOZN CREATOR BOT v9 — YAYINCI + İÇERİK ÜRETİCİ SUNUCU
// /sunucu-yenile: mevcut kanal/rolleri siler, şablonu sıfırdan kurar.
// DİKKAT: Bu komut yıkıcıdır. Botun Manage Channels + Manage Roles
// + Administrator yetkileri olmalıdır. Bot rolü yönetilecek rollerin
// üstünde olmalıdır.
// ============================================================

const CONFIG = {
  TOKEN: process.env.TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  PORT: Number(process.env.PORT || 10000),
  YOUTUBE_CHANNEL_ID: process.env.YOUTUBE_CHANNEL_ID || '',
  KICK_USERNAME: process.env.KICK_USERNAME || 'KLOZN',
  AUTOMOD: true,
  RESTART_MS: 60 * 60 * 1000,
};

if (!CONFIG.TOKEN || !CONFIG.CLIENT_ID) {
  throw new Error('TOKEN ve CLIENT_ID .env içinde olmalı.');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.Message],
});

const ROLE = {
  KLOZN: 'KLOZN',
  YONETIM: 'Yönetim',
  MOD: 'Moderatör',
  YAYINCI: 'Yayıncı',
  ICERIK: 'İçerik Üreticisi',
  KADIN: 'Kadın Topluluk',
  VIP: 'VIP',
  IZLEYICI: 'İzleyici',
  KAYITSIZ: 'Kayıtsız',
  BOT: 'Bot',
};

const CAT = {
  START: '👋・BAŞLANGIÇ',
  GENERAL: '💬・TOPLULUK',
  STREAM: '🔴・YAYIN MERKEZİ',
  CONTENT: '🎬・İÇERİK ÜRETİM',
  CREATOR: '⭐・YAYINCI & ÜRETİCİ',
  WOMEN: '🌸・KADIN TOPLULUĞU',
  SUPPORT: '🎫・DESTEK',
  STAFF: '🛡️・YÖNETİM',
  LOGS: '🔐・GÜVENLİK LOGLARI',
  VOICE: '🔊・SES ODALARI',
};

const CH = {
  RULES: 'kurallar',
  WELCOME: 'hos-geldin',
  REGISTER: 'kayıt-ol',
  CHAT: 'sohbet',
  MEDIA: 'medya-paylaşım',
  BOT: 'bot-komutları',
  ANNOUNCEMENTS: 'duyurular',
  LIVE: '🔴・canlı-yayın',
  LIVE_CHAT: 'yayın-sohbet',
  CLIPS: 'klipler',
  VIDEOS: 'videolar',
  CONTENT_CHAT: 'içerik-sohbet',
  CREATOR_CHAT: 'yayıncı-sohbet',
  CREATOR_PLANNING: 'içerik-planlama',
  COLLAB: 'iş-birlikleri',
  WOMEN_CHAT: 'kadın-sohbet',
  WOMEN_MEDIA: 'kadın-paylaşım',
  WOMEN_VOICE: 'Kadın Sohbet Odası',
  TICKET: 'destek',
  SUGGESTIONS: 'öneriler',
  STAFF_CHAT: 'yönetim-sohbet',
  MOD_CHAT: 'moderasyon',
  APPLICATIONS: 'başvurular',
  SERVER_LOG: 'sunucu-log',
  MOD_LOG: 'moderasyon-log',
  MEMBER_LOG: 'üye-log',
  COMMAND_LOG: 'komut-log',
  MESSAGE_LOG: 'mesaj-log',
  VOICE_LOG: 'ses-log',
  GENERAL_VOICE: 'Genel Sohbet',
  GAMING_VOICE: 'Oyun Odası',
  STREAM_VOICE: 'Yayın Odası',
  CREATOR_VOICE: 'Üretici Odası',
  STAFF_VOICE: 'Yönetim Odası',
};

const ROLE_DEFS = [
  [ROLE.KLOZN, 0x8b0000, [PermissionFlagsBits.Administrator]],
  [ROLE.YONETIM, 0xff0000, [PermissionFlagsBits.Administrator]],
  [ROLE.MOD, 0x00ff7f, [
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ModerateMembers,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.BanMembers,
  ]],
  [ROLE.YAYINCI, 0x9146ff, []],
  [ROLE.ICERIK, 0x00bfff, []],
  [ROLE.KADIN, 0xff69b4, []],
  [ROLE.VIP, 0xffd700, []],
  [ROLE.IZLEYICI, 0x7289da, []],
  [ROLE.KAYITSIZ, 0x808080, []],
  [ROLE.BOT, 0x5865f2, []],
];

function roleByName(guild, name) {
  return guild.roles.cache.find(r => r.name === name);
}

function admin(interaction) {
  return Boolean(interaction.guild && interaction.member?.permissions?.has(PermissionFlagsBits.Administrator));
}

function staff(interaction) {
  if (!interaction.guild || !interaction.member) return false;
  return admin(interaction) || interaction.member.roles.cache.some(r =>
    [ROLE.MOD, ROLE.YAYINCI, ROLE.ICERIK].includes(r.name)
  );
}

function roleAccess(interaction, allowedRoles = []) {
  if (admin(interaction)) return true;
  return interaction.member?.roles?.cache?.some(r => allowedRoles.includes(r.name));
}

async function safeReply(interaction, payload) {
  if (interaction.replied || interaction.deferred) return interaction.followUp(payload).catch(() => {});
  return interaction.reply(payload).catch(() => {});
}

async function logAction(guild, title, description) {
  const ch = guild.channels.cache.find(c => c.name === CH.SERVER_LOG && c.type === ChannelType.GuildText);
  if (!ch) return;
  await ch.send({ embeds: [new EmbedBuilder().setTitle(title).setDescription(description).setTimestamp().setFooter({ text: 'KLOZN Security' })] }).catch(() => {});
}

async function getOrCreateRole(guild, name, color, permissions) {
  let role = roleByName(guild, name);
  if (!role) {
    role = await guild.roles.create({ name, color, permissions, hoist: true, reason: 'KLOZN sunucu şablonu' });
  } else if (name !== ROLE.KLOZN && !role.managed) {
    await role.setPermissions(permissions).catch(() => {});
    await role.setColor(color).catch(() => {});
  }
  return role;
}

async function createRoles(guild) {
  const roles = {};
  for (const [name, color, permissions] of ROLE_DEFS) roles[name] = await getOrCreateRole(guild, name, color, permissions);
  return roles;
}

function overwrite(id, allow = [], deny = []) {
  return { id, allow, deny };
}

function perms(guild, roles, type) {
  const everyone = guild.roles.everyone.id;
  const base = [overwrite(everyone, [], [PermissionFlagsBits.ViewChannel])];
  const view = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory];
  const talk = [...view, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks];

  if (type === 'public') {
    base.push(overwrite(roles.IZLEYICI.id, talk), overwrite(roles.VIP.id, talk), overwrite(roles.YAYINCI.id, talk), overwrite(roles.ICERIK.id, talk), overwrite(roles.MOD.id, talk), overwrite(roles.KADIN.id, talk));
  } else if (type === 'register') {
    base[0] = overwrite(everyone, view, []);
    base.push(overwrite(roles.KAYITSIZ.id, talk), overwrite(roles.IZLEYICI.id, talk), overwrite(roles.MOD.id, talk));
  } else if (type === 'creator') {
    base.push(overwrite(roles.YAYINCI.id, talk), overwrite(roles.ICERIK.id, talk), overwrite(roles.MOD.id, talk));
  } else if (type === 'women') {
    base.push(overwrite(roles.KADIN.id, talk), overwrite(roles.KLOZN.id, talk), overwrite(roles.YONETIM.id, talk));
  } else if (type === 'staff') {
    base.push(overwrite(roles.MOD.id, talk));
  } else if (type === 'admin') {
    // Sadece Administrator sahibi roller. Üye rolleri burada açıkça verilmez.
    base.push(overwrite(roles.KLOZN.id, talk), overwrite(roles.YONETIM.id, talk));
  }
  return base;
}

async function createCategory(guild, name, roles, type) {
  return guild.channels.create({ name, type: ChannelType.GuildCategory, permissionOverwrites: perms(guild, roles, type), reason: 'KLOZN şablon kategorisi' });
}

async function createText(guild, name, parent, roles, type) {
  return guild.channels.create({ name, type: ChannelType.GuildText, parent: parent.id, permissionOverwrites: perms(guild, roles, type), reason: 'KLOZN şablon kanalı' });
}

async function createVoice(guild, name, parent, roles, type) {
  return guild.channels.create({ name, type: ChannelType.GuildVoice, parent: parent.id, permissionOverwrites: perms(guild, roles, type), reason: 'KLOZN şablon ses kanalı' });
}

async function deleteAllChannels(guild) {
  // Cache ile yetinmez; fetch ile sunucudaki güncel liste alınır.
  const fetched = await guild.channels.fetch();
  const channels = [...fetched.values()].filter(Boolean);
  // Önce normal kanallar, sonra kategoriler. Her silme ayrı await edilir.
  for (const channel of channels.filter(c => c.type !== ChannelType.GuildCategory)) {
    await channel.delete('KLOZN /sunucu-yenile: eski kanallar temizleniyor').catch(err => console.error('KANAL SİLME:', channel.name, err.message));
  }
  const categories = channels.filter(c => c.type === ChannelType.GuildCategory);
  for (const category of categories) {
    await category.delete('KLOZN /sunucu-yenile: eski kategoriler temizleniyor').catch(err => console.error('KATEGORİ SİLME:', category.name, err.message));
  }
}

async function deleteManagedRoles(guild) {
  const protectedIds = new Set([guild.roles.everyone.id, guild.members.me?.roles?.highest?.id]);
  const fetched = await guild.roles.fetch();
  for (const role of fetched.values()) {
    if (protectedIds.has(role.id) || role.managed) continue;
    // Şablonun tanıdığı roller ile aynı isimde olanları yenile.
    if (ROLE_DEFS.some(([name]) => name === role.name)) {
      await role.delete('KLOZN /sunucu-yenile: eski şablon rolü').catch(err => console.error('ROL SİLME:', role.name, err.message));
    }
  }
}

async function seedWelcome(register) {
  await register.send({
    embeds: [new EmbedBuilder()
      .setTitle('🎥 KLOZN CREATOR COMMUNITY')
      .setDescription('Yayıncılar, içerik üreticileri ve topluluk için düzenlenmiş sunucu.\n\n**Kayıt olmak için aşağıdaki butona bas.**')
      .addFields(
        { name: '🔴 Yayın', value: 'Canlı yayın ve yayın sohbeti', inline: true },
        { name: '🎬 İçerik', value: 'Video, klip ve üretici alanları', inline: true },
        { name: '🌸 Kadın Topluluğu', value: 'Sadece Kadın Topluluk rolü + yetkili roller', inline: true },
      ).setTimestamp().setFooter({ text: 'KLOZN • Creator Community' })],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('klozn_register').setLabel('Kayıt Ol').setEmoji('✅').setStyle(ButtonStyle.Success))],
  });
}

async function setupServer(guild) {
  console.log(`[SETUP] ${guild.name} için sıfırlama başlıyor...`);
  const me = guild.members.me || await guild.members.fetchMe();
  if (!me.permissions.has(PermissionFlagsBits.Administrator)) throw new Error('Botun Administrator yetkisi yok.');

  await deleteAllChannels(guild);
  await deleteManagedRoles(guild);
  const roles = await createRoles(guild);

  const start = await createCategory(guild, CAT.START, roles, 'register');
  const rules = await createText(guild, CH.RULES, start, roles, 'register');
  const welcome = await createText(guild, CH.WELCOME, start, roles, 'register');
  const register = await createText(guild, CH.REGISTER, start, roles, 'register');

  const general = await createCategory(guild, CAT.GENERAL, roles, 'public');
  for (const n of [CH.CHAT, CH.MEDIA, CH.BOT, CH.ANNOUNCEMENTS]) await createText(guild, n, general, roles, 'public');

  const stream = await createCategory(guild, CAT.STREAM, roles, 'public');
  for (const n of [CH.LIVE, CH.LIVE_CHAT]) await createText(guild, n, stream, roles, 'public');

  const content = await createCategory(guild, CAT.CONTENT, roles, 'public');
  for (const n of [CH.VIDEOS, CH.CLIPS, CH.CONTENT_CHAT]) await createText(guild, n, content, roles, 'public');

  const creator = await createCategory(guild, CAT.CREATOR, roles, 'creator');
  for (const n of [CH.CREATOR_CHAT, CH.CREATOR_PLANNING, CH.COLLAB]) await createText(guild, n, creator, roles, 'creator');

  const women = await createCategory(guild, CAT.WOMEN, roles, 'women');
  for (const n of [CH.WOMEN_CHAT, CH.WOMEN_MEDIA]) await createText(guild, n, women, roles, 'women');

  const support = await createCategory(guild, CAT.SUPPORT, roles, 'public');
  for (const n of [CH.TICKET, CH.SUGGESTIONS]) await createText(guild, n, support, roles, 'public');

  const staffCat = await createCategory(guild, CAT.STAFF, roles, 'staff');
  for (const n of [CH.STAFF_CHAT, CH.MOD_CHAT, CH.APPLICATIONS]) await createText(guild, n, staffCat, roles, 'staff');

  const logs = await createCategory(guild, CAT.LOGS, roles, 'admin');
  for (const n of [CH.SERVER_LOG, CH.MOD_LOG, CH.MEMBER_LOG, CH.COMMAND_LOG, CH.MESSAGE_LOG, CH.VOICE_LOG]) await createText(guild, n, logs, roles, 'admin');

  const voice = await createCategory(guild, CAT.VOICE, roles, 'public');
  for (const n of [CH.GENERAL_VOICE, CH.GAMING_VOICE, CH.STREAM_VOICE, CH.CREATOR_VOICE]) await createVoice(guild, n, voice, roles, 'public');
  await createVoice(guild, CH.STAFF_VOICE, voice, roles, 'staff');
  await createVoice(guild, CH.WOMEN_VOICE, women, roles, 'women');

  await rules.send({ embeds: [new EmbedBuilder().setTitle('📜 KLOZN KURALLARI').setDescription('Saygılı ol • Reklam/spam yapma • Taciz ve nefret söylemi yasaktır • Yetkili kararlarına uy • Kişisel bilgileri paylaşma.').setTimestamp()] });
  await seedWelcome(register);
  console.log(`[SETUP] ${guild.name}: şablon tamamlandı.`);
  return { roles: ROLE_DEFS.length, categories: 10, channels: guild.channels.cache.size };
}

const moderationCommands = new Set(['duyuru', 'ban', 'mute', 'temizle']);

const commands = [
  { name: 'sunucu-yenile', description: 'Sunucudaki tüm kanalları ve şablon rollerini silip sıfırdan kurar.', default_member_permissions: PermissionFlagsBits.Administrator.toString() },
  { name: 'kurulum', description: 'KLOZN şablonunu sıfırdan kurar.', default_member_permissions: PermissionFlagsBits.Administrator.toString() },
  { name: 'duyuru', description: 'Duyuru gönderir.', default_member_permissions: PermissionFlagsBits.Administrator.toString(), options: [{ name: 'mesaj', description: 'Duyuru', type: 3, required: true }] },
  { name: 'ban', description: 'Üyeyi yasaklar.', default_member_permissions: PermissionFlagsBits.Administrator.toString(), options: [{ name: 'uye', description: 'Üye', type: 6, required: true }, { name: 'sebep', description: 'Sebep', type: 3 }] },
  { name: 'mute', description: 'Üyeyi susturur.', default_member_permissions: PermissionFlagsBits.Administrator.toString(), options: [{ name: 'uye', description: 'Üye', type: 6, required: true }, { name: 'sure', description: 'Dakika', type: 4, required: true, min_value: 1, max_value: 40320 }, { name: 'sebep', description: 'Sebep', type: 3 }] },
  { name: 'temizle', description: 'Mesajları temizler.', default_member_permissions: PermissionFlagsBits.Administrator.toString(), options: [{ name: 'miktar', description: '1-100', type: 4, required: true, min_value: 1, max_value: 100 }] },
  { name: 'klip', description: 'Klip kanalına klip yollar.', options: [{ name: 'link', description: 'Klip linki', type: 3, required: true }, { name: 'baslik', description: 'Başlık', type: 3, required: true }] },
  { name: 'bilgi', description: 'Bot ve sunucu sistemi hakkında bilgi.' },
  { name: 'kadin-ver', description: 'Bir üyeye Kadın Topluluk rolü verir.', default_member_permissions: PermissionFlagsBits.Administrator.toString(), options: [{ name: 'uye', description: 'Üye', type: 6, required: true }] },
  { name: 'kadin-al', description: 'Bir üyeden Kadın Topluluk rolünü alır.', default_member_permissions: PermissionFlagsBits.Administrator.toString(), options: [{ name: 'uye', description: 'Üye', type: 6, required: true }] },
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
  await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: commands });
}

async function handleCommand(i) {
  const cmd = i.commandName;

  if (cmd === 'sunucu-yenile' || cmd === 'kurulum') {
    if (!admin(i)) return safeReply(i, { content: '🔒 Sadece Administrator yetkisi olan kullanıcı/roller kullanabilir.', ephemeral: true });
    await safeReply(i, { content: '♻️ **Sunucu sıfırlanıyor...** Eski kanallar ve şablon roller silinip yeniden oluşturulacak.', ephemeral: true });
    try {
      const result = await setupServer(i.guild);
      await i.editReply(`✅ **Sunucu yenilendi.**\n🎭 ${result.roles} şablon rolü\n📁 ${result.categories} kategori\n📝 Yeni kanal sistemi oluşturuldu.\n\n⚠️ Eski kanalların silinemediği durumlar loglarda gösterilir.`);
      await logAction(i.guild, '♻️ SUNUCU YENİLENDİ', `${i.user.tag} /sunucu-yenile çalıştırdı.`);
    } catch (e) {
      console.error(e);
      await i.editReply(`❌ Yenileme başarısız: **${e.message}**`);
    }
    return;
  }

  if (moderationCommands.has(cmd) && !admin(i)) return safeReply(i, { content: '🔒 Bu moderasyon komutu için Administrator yetkisi gerekir.', ephemeral: true });

  if (cmd === 'duyuru') {
    const mesaj = i.options.getString('mesaj');
    await i.channel.send({ content: '@everyone', embeds: [new EmbedBuilder().setTitle('📢 DUYURU').setDescription(mesaj).setTimestamp()] });
    return safeReply(i, { content: '✅ Duyuru gönderildi.', ephemeral: true });
  }

  if (cmd === 'ban') {
    const member = i.options.getMember('uye');
    if (!member?.bannable) return safeReply(i, { content: '❌ Bu üyeyi banlayamıyorum. Bot rol sırasını kontrol et.', ephemeral: true });
    const reason = i.options.getString('sebep') || 'Sebep belirtilmedi.';
    await member.ban({ reason });
    await logAction(i.guild, '🔨 BAN', `${member.user.tag} — ${i.user.tag} — ${reason}`);
    return safeReply(i, { content: `🔨 **${member.user.tag}** banlandı.`, ephemeral: true });
  }

  if (cmd === 'mute') {
    const member = i.options.getMember('uye');
    const minutes = i.options.getInteger('sure');
    if (!member?.moderatable) return safeReply(i, { content: '❌ Bu üyeyi susturamıyorum. Rol sırasını kontrol et.', ephemeral: true });
    await member.timeout(minutes * 60 * 1000, i.options.getString('sebep') || 'KLOZN mute');
    return safeReply(i, { content: `🔇 ${member.user.tag} ${minutes} dakika susturuldu.`, ephemeral: true });
  }

  if (cmd === 'temizle') {
    const amount = i.options.getInteger('miktar');
    const deleted = await i.channel.bulkDelete(amount, true);
    return safeReply(i, { content: `🧹 ${deleted.size} mesaj temizlendi.`, ephemeral: true });
  }

  if (cmd === 'klip') {
    if (!roleAccess(i, [ROLE.YAYINCI, ROLE.ICERIK])) return safeReply(i, { content: '🔒 /klip sadece Yayıncı veya İçerik Üreticisi rolü olanlara açık.', ephemeral: true });
    const channel = i.guild.channels.cache.find(c => c.name === CH.CLIPS && c.type === ChannelType.GuildText);
    if (!channel) return safeReply(i, { content: '❌ Klip kanalı bulunamadı. /sunucu-yenile çalıştır.', ephemeral: true });
    const link = i.options.getString('link');
    const title = i.options.getString('baslik');
    await channel.send({ embeds: [new EmbedBuilder().setTitle(`🎬 ${title}`).setDescription(`[KLİBİ İZLE](${link})`).addFields({ name: 'Paylaşan', value: i.user.toString() }).setTimestamp()] });
    return safeReply(i, { content: '🎬 Klip paylaşıldı.', ephemeral: true });
  }

  if (cmd === 'bilgi') {
    return safeReply(i, { embeds: [new EmbedBuilder().setTitle('🎥 KLOZN CREATOR BOT').setDescription('🔴 Yayıncı sistemi\n🎬 İçerik üretici sistemi\n🌸 Kadın Topluluğu alanı\n🛡️ Yönetim & moderasyon\n♻️ /sunucu-yenile ile sıfırdan kurulum').setTimestamp()], ephemeral: true });
  }

  if (cmd === 'kadin-ver' || cmd === 'kadin-al') {
    if (!admin(i)) return safeReply(i, { content: '🔒 Bu işlem için Administrator gerekir.', ephemeral: true });
    const member = i.options.getMember('uye');
    const role = roleByName(i.guild, ROLE.KADIN);
    if (!member || !role) return safeReply(i, { content: '❌ Üye veya Kadın Topluluk rolü bulunamadı.', ephemeral: true });
    if (cmd === 'kadin-ver') await member.roles.add(role, 'KLOZN kadın topluluk rolü');
    else await member.roles.remove(role, 'KLOZN kadın topluluk rolü kaldırma');
    return safeReply(i, { content: cmd === 'kadin-ver' ? `🌸 ${member} Kadın Topluluk rolünü aldı.` : `🌸 ${member} Kadın Topluluk rolünden çıkarıldı.`, ephemeral: true });
  }
}

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;
  try { await handleCommand(i); } catch (e) { console.error('[COMMAND]', e); await safeReply(i, { content: '❌ Komut çalışırken hata oluştu.', ephemeral: true }); }
});

client.on('interactionCreate', async i => {
  if (!i.isButton() || i.customId !== 'klozn_register') return;
  const viewer = roleByName(i.guild, ROLE.IZLEYICI);
  const unregistered = roleByName(i.guild, ROLE.KAYITSIZ);
  if (!viewer) return safeReply(i, { content: '❌ İzleyici rolü bulunamadı.', ephemeral: true });
  if (!i.member.roles.cache.has(viewer.id)) await i.member.roles.add(viewer);
  if (unregistered && i.member.roles.cache.has(unregistered.id)) await i.member.roles.remove(unregistered);
  return safeReply(i, { content: '🎉 Kayıt tamamlandı. Topluluk kanallarına erişimin açıldı.', ephemeral: true });
});

client.on('guildMemberAdd', async member => {
  const role = roleByName(member.guild, ROLE.KAYITSIZ);
  if (role) await member.roles.add(role).catch(() => {});
  await logAction(member.guild, '👤 ÜYE GİRDİ', `${member.user.tag} (${member.id})`);
});

const BAD_WORDS = ['discord.gg/', '@everyone', '@here'];
client.on('messageCreate', async message => {
  if (!CONFIG.AUTOMOD || !message.guild || message.author.bot || !message.member) return;
  if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
  if (!BAD_WORDS.some(w => message.content.toLowerCase().includes(w.toLowerCase()))) return;
  await message.delete().catch(() => {});
  await message.member.timeout(60_000, 'KLOZN AutoMod').catch(() => {});
  await logAction(message.guild, '🛡️ AUTOMOD', `${message.author.tag} — ${message.channel}`);
});

client.on('error', err => console.error('[DISCORD CLIENT ERROR]', err));
client.on('warn', msg => console.warn('[DISCORD WARN]', msg));

// Discord "guilds undefined" tarzı hatalarda process'i düşürmek yerine logla.
process.on('unhandledRejection', reason => console.error('[UNHANDLED REJECTION]', reason));
process.on('uncaughtException', err => console.error('[UNCAUGHT EXCEPTION]', err));

// Render için HTTP health server.
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, ready: client.isReady(), guilds: client.guilds?.cache?.size || 0, uptime: process.uptime() }));
});
server.listen(CONFIG.PORT, '0.0.0.0', () => console.log(`[HTTP] Health server listening on 0.0.0.0:${CONFIG.PORT}`));

// Her 1 saatte kontrollü restart. Render üzerinde proses kapanınca servis yeniden başlatılır.
setTimeout(function hourlyRestart() {
  console.log('[SYSTEM] 1 saatlik kontrollü restart başlatılıyor...');
  process.exit(0);
}, CONFIG.RESTART_MS);

client.once('ready', async () => {
  console.log(`🚀 KLOZN BOT AKTİF: ${client.user.tag} | guilds=${client.guilds.cache.size}`);
  client.user.setPresence({ activities: [{ name: 'KLOZN • Creator Community', type: 3 }], status: 'online' });
  try {
    await registerCommands();
    console.log(`✅ ${commands.length} slash komut sunucuya/genel API'ye kaydedildi.`);
  } catch (e) {
    console.error('[SLASH REGISTER]', e);
  }
});

client.login(CONFIG.TOKEN).catch(err => {
  console.error('[LOGIN]', err);
  process.exit(1);
});
