require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  Client, GatewayIntentBits, Partials, PermissionsBitField, PermissionFlagsBits,
  ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  SlashCommandBuilder, REST, Routes, Events, ActivityType, Collection
} = require('discord.js');

const VERSION = '6.0.0';
const PORT = Number(process.env.PORT || 10000);
const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID || '';
const NODE_ENV = process.env.NODE_ENV || 'production';
const DATA_FILE = path.join(process.cwd(), 'data', 'klozn.json');

if (!TOKEN || !CLIENT_ID) throw new Error('DISCORD_TOKEN ve DISCORD_CLIENT_ID Render Environment Variables içinde olmalı.');
fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

const defaults = () => ({
  version: VERSION,
  guilds: {},
  cases: {},
  users: {},
  giveaways: {},
  afk: {},
  tickets: {},
  stats: {},
  settings: {}
});
function loadDB() {
  try {
    if (!fs.existsSync(DATA_FILE)) return defaults();
    return { ...defaults(), ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
  } catch (e) {
    console.error('[DB READ]', e);
    return defaults();
  }
}
const db = loadDB();
let saveTimer;
function saveDB() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); } catch (e) { console.error('[DB WRITE]', e); }
  }, 250);
}

function guildData(guildId) {
  if (!db.guilds[guildId]) {
    db.guilds[guildId] = {
      prefix: '/',
      logChannelId: null,
      welcomeChannelId: null,
      welcomeMessage: 'Hoş geldin {user}! {server} sunucusuna hoş geldin.',
      leaveChannelId: null,
      leaveMessage: '{user} sunucudan ayrıldı.',
      ticketCategoryId: null,
      ticketSupportRoleId: null,
      suggestionChannelId: null,
      giveawayChannelId: null,
      lockdown: false,
      automod: { enabled: true, antiInvite: true, antiLink: false, antiCaps: false, antiMentionSpam: true, mentionLimit: 8, spamLimit: 7 },
      levels: { enabled: true, xpMin: 5, xpMax: 12, cooldownMs: 60000 },
      roles: {}
    };
    saveDB();
  }
  return db.guilds[guildId];
}
function userData(guildId, userId) {
  db.users[guildId] ||= {};
  db.users[guildId][userId] ||= { xp: 0, level: 0, warnings: [], messages: 0 };
  return db.users[guildId][userId];
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User]
});

const cooldowns = new Collection();
const spamTracker = new Collection();
const commands = [];
const commandNames = new Set();
function addCommand(builder, handler, options = {}) {
  const data = builder.setDefaultMemberPermissions(PermissionFlagsBits.Administrator).setDMPermission(false).toJSON();
  if (commandNames.has(data.name)) return;
  commandNames.add(data.name);
  commands.push(data);
  handlers.set(data.name, handler);
}
const handlers = new Collection();

function embed(title, description, color = 0x5865F2) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description || '\u200b').setTimestamp().setFooter({ text: `KLOZN v${VERSION}` });
}
function isAdmin(i) { return !!i.guild && !!i.member?.permissions?.has(PermissionFlagsBits.Administrator); }
async function adminOnly(i) {
  if (isAdmin(i)) return true;
  if (!i.replied && !i.deferred) await i.reply({ content: '🔒 Bu komut yalnızca **Administrator** yetkisine sahip kullanıcılar içindir.', ephemeral: true });
  return false;
}
function botMember(guild) { return guild.members.me || guild.members.cache.get(client.user.id); }
function canActOn(guild, member) {
  if (!member) return false;
  const me = botMember(guild);
  return !!me && member.id !== guild.ownerId && member.id !== me.id && member.roles.highest.position < me.roles.highest.position;
}
async function logAction(guild, title, description, color = 0x5865F2) {
  try {
    const id = guildData(guild.id).logChannelId;
    const ch = id ? guild.channels.cache.get(id) : guild.channels.cache.find(c => c.name === '📋・loglar');
    if (ch?.isTextBased()) await ch.send({ embeds: [embed(title, description, color)] });
  } catch (e) { console.error('[LOG]', e.message); }
}
function nextCase(guildId) {
  db.cases[guildId] ||= [];
  const n = (db.cases[guildId].at(-1)?.id || 0) + 1;
  return n;
}
function addCase(guild, type, moderator, target, reason) {
  db.cases[guild.id] ||= [];
  db.cases[guild.id].push({ id: nextCase(guild.id), type, moderatorId: moderator.id, targetId: target.id, reason, at: Date.now() });
  saveDB();
}
function parseDuration(input) {
  const m = String(input || '').trim().match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n * ({ s: 1000, m: 60000, h: 3600000, d: 86400000 })[m[2].toLowerCase()];
}
function safeText(s, max = 1000) { return String(s || '').slice(0, max); }

// ---------- SETUP ----------
const ROLE_DEFS = [
  ['👑', 'KLOZN Yönetim', 0xF1C40F], ['🛡️', 'KLOZN Moderasyon', 0x3498DB], ['🎫', 'KLOZN Destek', 0x2ECC71], ['🤖', 'KLOZN Bot', 0x5865F2]
];
async function getOrCreateRole(guild, name, color) {
  let role = guild.roles.cache.find(r => r.name === name);
  if (!role) role = await guild.roles.create({ name, color, reason: 'KLOZN otomatik kurulum' });
  return role;
}
async function getOrCreateCategory(guild, name) {
  let c = guild.channels.cache.find(x => x.type === ChannelType.GuildCategory && x.name === name);
  if (!c) c = await guild.channels.create({ name, type: ChannelType.GuildCategory, reason: 'KLOZN otomatik kurulum' });
  return c;
}
async function getOrCreateText(guild, name, parent, overwrites) {
  let c = guild.channels.cache.find(x => x.type === ChannelType.GuildText && x.name === name);
  if (!c) c = await guild.channels.create({ name, type: ChannelType.GuildText, parent: parent?.id, permissionOverwrites: overwrites, reason: 'KLOZN otomatik kurulum' });
  return c;
}
async function setupGuild(guild) {
  const cfg = guildData(guild.id);
  for (const [emoji, name, color] of ROLE_DEFS) cfg.roles[name] = (await getOrCreateRole(guild, `${emoji} ${name}`, color)).id;
  const general = await getOrCreateCategory(guild, '📁 KLOZN GENEL');
  const management = await getOrCreateCategory(guild, '🔐 KLOZN YÖNETİM');
  const ticket = await getOrCreateText(guild, '🎫・ticket', general);
  const logs = await getOrCreateText(guild, '📋・loglar', management);
  const commandsCh = await getOrCreateText(guild, '🤖・bot-komutları', general);
  cfg.ticketCategoryId = ticket.parentId;
  cfg.logChannelId = logs.id;
  cfg.welcomeChannelId ||= commandsCh.id;
  saveDB();
  await logs.send({ embeds: [embed('🟢 KLOZN Kurulum', 'KLOZN V6 sunucu altyapısı hazır. Bu mesaj yalnızca ilk/manuel kurulumlarda gönderilir.')] }).catch(() => {});
  await ticket.send({ embeds: [embed('🎫 Destek Merkezi', 'Destek almak için aşağıdaki butona bas.', 0x2ECC71)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_open').setLabel('Ticket Aç').setEmoji('🎫').setStyle(ButtonStyle.Success))] }).catch(() => {});
  return cfg;
}

// ---------- COMMANDS ----------
addCommand(new SlashCommandBuilder().setName('kurulum').setDescription('KLOZN sunucu altyapısını kurar/günceller'), async i => {
  await i.deferReply({ ephemeral: true }); await setupGuild(i.guild); await i.editReply({ embeds: [embed('✅ Kurulum tamamlandı', 'Roller, kanallar, log ve ticket altyapısı hazır.')] });
});
addCommand(new SlashCommandBuilder().setName('yardim').setDescription('KLOZN komut merkezini gösterir'), async i => {
  const groups = {
    '🛡️ Moderasyon': '/ban /kick /timeout /untimeout /warn /uyarilar /uyaritemizle /purge /kilit /kilitac /slowmode',
    '⚙️ Yönetim': '/kurulum /ayarlar /sunucu /botdurum /duyuru /embed /lockdown /unlockdown /rolver /rolal /takmaad',
    '🎫 Topluluk': '/ticket-panel /ticket-kapat /oneri-panel /anket /cekilis-baslat /cekilis-bitir /cekilis-yenile',
    '🛡️ Güvenlik': '/automod /guvenlik /karantina /audit',
    '📊 Bilgi': '/kullanici /rolbilgi /kanalbilgi /istatistik /leaderboard /xp-sifirla',
    '🔧 Sistem': '/log-ayarla /hosgeldin-ayarla /ayrilis-ayarla /durum-ayarla'
  };
  await i.reply({ embeds: [embed('🤖 KLOZN Komut Merkezi', Object.entries(groups).map(([k,v]) => `**${k}**\n${v}`).join('\n\n'))], ephemeral: true });
});
addCommand(new SlashCommandBuilder().setName('sunucu').setDescription('Sunucu bilgilerini gösterir'), async i => {
  const g = i.guild; await i.reply({ embeds: [embed(`🏠 ${g.name}`, `**Sahip:** <@${g.ownerId}>\n**Üye:** ${g.memberCount}\n**Kanal:** ${g.channels.cache.size}\n**Rol:** ${g.roles.cache.size}\n**Boost:** ${g.premiumSubscriptionCount || 0}\n**ID:** ${g.id}`)] });
});
addCommand(new SlashCommandBuilder().setName('botdurum').setDescription('Bot ve gateway durumunu gösterir'), async i => {
  await i.reply({ embeds: [embed('🤖 KLOZN Durum', `**Sürüm:** ${VERSION}\n**Web:** aktif\n**Discord:** ${client.ws.status === 0 ? 'READY' : 'BAĞLANTI BEKLENİYOR'}\n**Sunucu:** ${client.guilds.cache.size}\n**Ping:** ${client.ws.ping} ms\n**Node:** ${process.version}\n**Uptime:** ${Math.floor(process.uptime())} saniye`)] });
});
addCommand(new SlashCommandBuilder().setName('ayarlar').setDescription('Sunucu bot ayarlarını gösterir'), async i => {
  const c = guildData(i.guild.id); await i.reply({ embeds: [embed('⚙️ Ayarlar', `**Log:** ${c.logChannelId ? `<#${c.logChannelId}>` : 'Ayarlanmadı'}\n**Ticket:** ${c.ticketCategoryId ? `<#${c.ticketCategoryId}>` : 'Ayarlanmadı'}\n**Welcome:** ${c.welcomeChannelId ? `<#${c.welcomeChannelId}>` : 'Ayarlanmadı'}\n**AutoMod:** ${c.automod.enabled ? 'Açık' : 'Kapalı'}\n**Anti Invite:** ${c.automod.antiInvite ? 'Açık' : 'Kapalı'}\n**Level:** ${c.levels.enabled ? 'Açık' : 'Kapalı'}\n**Lockdown:** ${c.lockdown ? 'Açık' : 'Kapalı'}`)], ephemeral: true });
});
addCommand(new SlashCommandBuilder().setName('log-ayarla').setDescription('Log kanalını ayarlar').addChannelOption(o=>o.setName('kanal').setDescription('Log kanalı').addChannelTypes(ChannelType.GuildText).setRequired(true)), async i => { const c=guildData(i.guild.id); c.logChannelId=i.options.getChannel('kanal').id; saveDB(); await i.reply({content:'✅ Log kanalı ayarlandı.',ephemeral:true}); });
addCommand(new SlashCommandBuilder().setName('duyuru').setDescription('Embed duyuru gönderir').addStringOption(o=>o.setName('mesaj').setDescription('Duyuru metni').setRequired(true)).addBooleanOption(o=>o.setName('everyone').setDescription('@everyone kullan')), async i=>{ const m=i.options.getString('mesaj'); const ev=i.options.getBoolean('everyone')||false; await i.channel.send({content:ev?'@everyone':undefined,allowedMentions:ev?{parse:['everyone']}:{parse:[]},embeds:[embed('📢 KLOZN DUYURU',m)]}); await i.reply({content:'✅ Duyuru gönderildi.',ephemeral:true}); await logAction(i.guild,'📢 Duyuru',`${i.user} tarafından gönderildi.`); });
addCommand(new SlashCommandBuilder().setName('embed').setDescription('Özel embed mesaj gönderir').addStringOption(o=>o.setName('baslik').setDescription('Başlık').setRequired(true)).addStringOption(o=>o.setName('aciklama').setDescription('Açıklama').setRequired(true)), async i=>{ await i.channel.send({embeds:[embed(i.options.getString('baslik'),i.options.getString('aciklama'))]}); await i.reply({content:'✅ Embed gönderildi.',ephemeral:true}); });

// Moderation
addCommand(new SlashCommandBuilder().setName('ban').setDescription('Üyeyi banlar').addUserOption(o=>o.setName('üye').setDescription('Üye').setRequired(true)).addStringOption(o=>o.setName('sebep').setDescription('Sebep')), async i=>{const m=i.options.getMember('üye');const r=i.options.getString('sebep')||'Sebep belirtilmedi.';if(!m||!canActOn(i.guild,m))return i.reply({content:'❌ Bu üyeye işlem uygulayamıyorum. Rol hiyerarşisini kontrol et.',ephemeral:true});await m.ban({reason:r});addCase(i.guild,'BAN',i.user,m,r);await i.reply({content:`🔨 ${m.user.tag} banlandı.`,ephemeral:true});await logAction(i.guild,'🔨 Ban',`${m.user} → ${r}`,0xE74C3C);});
addCommand(new SlashCommandBuilder().setName('kick').setDescription('Üyeyi sunucudan atar').addUserOption(o=>o.setName('üye').setDescription('Üye').setRequired(true)).addStringOption(o=>o.setName('sebep').setDescription('Sebep')), async i=>{const m=i.options.getMember('üye');const r=i.options.getString('sebep')||'Sebep belirtilmedi.';if(!m||!canActOn(i.guild,m))return i.reply({content:'❌ Bu üyeye işlem uygulayamıyorum.',ephemeral:true});await m.kick(r);addCase(i.guild,'KICK',i.user,m,r);await i.reply({content:`👢 ${m.user.tag} atıldı.`,ephemeral:true});await logAction(i.guild,'👢 Kick',`${m.user} → ${r}`,0xE67E22);});
addCommand(new SlashCommandBuilder().setName('timeout').setDescription('Üyeyi geçici susturur').addUserOption(o=>o.setName('üye').setDescription('Üye').setRequired(true)).addStringOption(o=>o.setName('süre').setDescription('Örn: 30m, 2h, 1d').setRequired(true)).addStringOption(o=>o.setName('sebep').setDescription('Sebep')), async i=>{const m=i.options.getMember('üye');const d=parseDuration(i.options.getString('süre'));const r=i.options.getString('sebep')||'Sebep belirtilmedi.';if(!m||!d||d>2419200000||!canActOn(i.guild,m))return i.reply({content:'❌ Süre geçersiz (örn. 30m/2h/1d) veya üye üzerinde işlem yapılamıyor.',ephemeral:true});await m.timeout(d,r);addCase(i.guild,'TIMEOUT',i.user,m,r);await i.reply({content:`⏱️ ${m.user.tag} ${i.options.getString('süre')} timeoutlandı.`,ephemeral:true});await logAction(i.guild,'⏱️ Timeout',`${m.user} → ${i.options.getString('süre')} → ${r}`,0xF1C40F);});
addCommand(new SlashCommandBuilder().setName('untimeout').setDescription('Timeout kaldırır').addUserOption(o=>o.setName('üye').setDescription('Üye').setRequired(true)), async i=>{const m=i.options.getMember('üye');if(!m||!canActOn(i.guild,m))return i.reply({content:'❌ Üye üzerinde işlem yapılamıyor.',ephemeral:true});await m.timeout(null,'Timeout kaldırıldı');await i.reply({content:`🔊 ${m.user.tag} timeouttan çıkarıldı.`,ephemeral:true});await logAction(i.guild,'🔊 Timeout kaldırıldı',`${m.user}`);});
addCommand(new SlashCommandBuilder().setName('warn').setDescription('Üyeye uyarı verir').addUserOption(o=>o.setName('üye').setDescription('Üye').setRequired(true)).addStringOption(o=>o.setName('sebep').setDescription('Sebep').setRequired(true)), async i=>{const m=i.options.getMember('üye');const r=i.options.getString('sebep');if(!m)return i.reply({content:'❌ Üye bulunamadı.',ephemeral:true});const u=userData(i.guild.id,m.id);u.warnings.push({moderatorId:i.user.id,reason:r,at:Date.now()});saveDB();addCase(i.guild,'WARN',i.user,m,r);await i.reply({content:`⚠️ ${m.user.tag} uyarıldı. Toplam: ${u.warnings.length}`,ephemeral:true});await logAction(i.guild,'⚠️ Uyarı',`${m.user} → ${r}`,0xF1C40F);});
addCommand(new SlashCommandBuilder().setName('uyarilar').setDescription('Üyenin uyarı geçmişini gösterir').addUserOption(o=>o.setName('üye').setDescription('Üye').setRequired(true)), async i=>{const m=i.options.getMember('üye');const u=userData(i.guild.id,m?.id);await i.reply({embeds:[embed(`⚠️ ${m?.user.tag||'Üye'} Uyarıları`,u.warnings.length?u.warnings.slice(-10).reverse().map((x,n)=>`**${n+1}.** <t:${Math.floor(x.at/1000)}:R> — ${safeText(x.reason,150)} — <@${x.moderatorId}>`).join('\n'):'Uyarı yok.')],ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('uyaritemizle').setDescription('Üyenin uyarılarını siler').addUserOption(o=>o.setName('üye').setDescription('Üye').setRequired(true)), async i=>{const m=i.options.getMember('üye');userData(i.guild.id,m.id).warnings=[];saveDB();await i.reply({content:'✅ Uyarılar temizlendi.',ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('purge').setDescription('Kanaldaki son mesajları siler').addIntegerOption(o=>o.setName('miktar').setDescription('1-100').setMinValue(1).setMaxValue(100).setRequired(true)), async i=>{const n=i.options.getInteger('miktar');const deleted=await i.channel.bulkDelete(n,true);await i.reply({content:`🧹 ${deleted.size} mesaj silindi.`,ephemeral:true});await logAction(i.guild,'🧹 Purge',`${i.user} ${deleted.size} mesaj sildi.`);});
addCommand(new SlashCommandBuilder().setName('kilit').setDescription('Mevcut kanalı kilitler'), async i=>{await i.channel.permissionOverwrites.edit(i.guild.roles.everyone,{SendMessages:false});await i.reply({content:'🔒 Kanal kilitlendi.',ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('kilitac').setDescription('Mevcut kanalın kilidini açar'), async i=>{await i.channel.permissionOverwrites.edit(i.guild.roles.everyone,{SendMessages:null});await i.reply({content:'🔓 Kanal açıldı.',ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('slowmode').setDescription('Kanal yavaş modunu ayarlar').addIntegerOption(o=>o.setName('saniye').setDescription('0-21600').setMinValue(0).setMaxValue(21600).setRequired(true)), async i=>{const s=i.options.getInteger('saniye');await i.channel.setRateLimitPerUser(s);await i.reply({content:`🐢 Slowmode: ${s} saniye`,ephemeral:true});});

// Roles / channels
addCommand(new SlashCommandBuilder().setName('rolver').setDescription('Üyeye rol verir').addUserOption(o=>o.setName('üye').setDescription('Üye').setRequired(true)).addRoleOption(o=>o.setName('rol').setDescription('Rol').setRequired(true)), async i=>{const m=i.options.getMember('üye'),r=i.options.getRole('rol');if(r.position>=botMember(i.guild).roles.highest.position)return i.reply({content:'❌ Bot bu rolü yönetemiyor.',ephemeral:true});await m.roles.add(r);await i.reply({content:`✅ ${r} rolü ${m} kullanıcısına verildi.`,ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('rolal').setDescription('Üyeden rol alır').addUserOption(o=>o.setName('üye').setDescription('Üye').setRequired(true)).addRoleOption(o=>o.setName('rol').setDescription('Rol').setRequired(true)), async i=>{const m=i.options.getMember('üye'),r=i.options.getRole('rol');if(r.position>=botMember(i.guild).roles.highest.position)return i.reply({content:'❌ Bot bu rolü yönetemiyor.',ephemeral:true});await m.roles.remove(r);await i.reply({content:`✅ ${r} rolü ${m} kullanıcısından alındı.`,ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('takmaad').setDescription('Üyenin takma adını değiştirir').addUserOption(o=>o.setName('üye').setDescription('Üye').setRequired(true)).addStringOption(o=>o.setName('isim').setDescription('Yeni isim').setRequired(true)), async i=>{const m=i.options.getMember('üye'),n=i.options.getString('isim');if(!canActOn(i.guild,m))return i.reply({content:'❌ Bu üyeye işlem uygulanamıyor.',ephemeral:true});await m.setNickname(n);await i.reply({content:'✅ Takma ad değiştirildi.',ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('kanalac').setDescription('Metin kanalı oluşturur').addStringOption(o=>o.setName('isim').setDescription('Kanal adı').setRequired(true)).addChannelOption(o=>o.setName('kategori').setDescription('Kategori').addChannelTypes(ChannelType.GuildCategory)), async i=>{const p=i.options.getChannel('kategori');const c=await i.guild.channels.create({name:i.options.getString('isim'),type:ChannelType.GuildText,parent:p?.id});await i.reply({content:`✅ Kanal oluşturuldu: ${c}`,ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('kanalsil').setDescription('Mevcut kanalı siler'), async i=>{const n=i.channel.name;await i.reply({content:'🗑️ Kanal siliniyor.',ephemeral:true});await i.channel.delete(`KLOZN: ${i.user.tag}`);await logAction(i.guild,'🗑️ Kanal silindi',n);});

// Security
addCommand(new SlashCommandBuilder().setName('automod').setDescription('AutoMod ayarlarını yönetir').addBooleanOption(o=>o.setName('aktif').setDescription('AutoMod açık/kapalı').setRequired(true)).addBooleanOption(o=>o.setName('davet').setDescription('Discord davetlerini engelle')).addBooleanOption(o=>o.setName('link').setDescription('Linkleri engelle')).addBooleanOption(o=>o.setName('caps').setDescription('Caps spam engelle')).addIntegerOption(o=>o.setName('mention').setDescription('Mention limiti').setMinValue(2).setMaxValue(50)), async i=>{const c=guildData(i.guild.id);c.automod.enabled=i.options.getBoolean('aktif');if(i.options.getBoolean('davet')!==null)c.automod.antiInvite=i.options.getBoolean('davet');if(i.options.getBoolean('link')!==null)c.automod.antiLink=i.options.getBoolean('link');if(i.options.getBoolean('caps')!==null)c.automod.antiCaps=i.options.getBoolean('caps');if(i.options.getInteger('mention'))c.automod.mentionLimit=i.options.getInteger('mention');saveDB();await i.reply({content:'✅ AutoMod ayarları güncellendi.',ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('guvenlik').setDescription('Güvenlik durumunu gösterir'), async i=>{const c=guildData(i.guild.id);await i.reply({embeds:[embed('🛡️ Güvenlik',`**AutoMod:** ${c.automod.enabled?'Açık':'Kapalı'}\n**Davet:** ${c.automod.antiInvite?'Engelli':'Serbest'}\n**Link:** ${c.automod.antiLink?'Engelli':'Serbest'}\n**Caps:** ${c.automod.antiCaps?'Engelli':'Serbest'}\n**Mention limiti:** ${c.automod.mentionLimit}`)],ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('karantina').setDescription('Üyeyi karantina rolüne alır').addUserOption(o=>o.setName('üye').setDescription('Üye').setRequired(true)), async i=>{const m=i.options.getMember('üye');let r=i.guild.roles.cache.find(x=>x.name==='☢️ Karantina');if(!r)r=await i.guild.roles.create({name:'☢️ Karantina',color:0x555555});if(!canActOn(i.guild,m))return i.reply({content:'❌ Bu üyeye işlem yapılamıyor.',ephemeral:true});await m.roles.add(r,'KLOZN karantina');await i.reply({content:`☢️ ${m} karantinaya alındı.`,ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('audit').setDescription('Son moderasyon kayıtlarını gösterir'), async i=>{const list=(db.cases[i.guild.id]||[]).slice(-15).reverse();await i.reply({embeds:[embed('📋 Audit',list.length?list.map(x=>`#${x.id} **${x.type}** <@${x.targetId}> — ${safeText(x.reason,100)} — <@${x.moderatorId}>`).join('\n'):'Kayıt yok.')],ephemeral:true});});

// Lockdown
async function setLockdown(guild, active) { const c=guildData(guild.id); const channels=guild.channels.cache.filter(x=>x.isTextBased()&&!x.isThread()&&x.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel)); let changed=0;for(const ch of channels.values()){await ch.permissionOverwrites.edit(guild.roles.everyone,{SendMessages:active?false:null}).catch(()=>{});changed++;}c.lockdown=active;saveDB();return changed; }
addCommand(new SlashCommandBuilder().setName('lockdown').setDescription('Sunucuyu yazmaya kapatır'), async i=>{const n=await setLockdown(i.guild,true);await i.reply({content:`🔒 Lockdown aktif. ${n} kanal güncellendi.`,ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('unlockdown').setDescription('Sunucu lockdown modunu kapatır'), async i=>{const n=await setLockdown(i.guild,false);await i.reply({content:`🔓 Lockdown kapatıldı. ${n} kanal güncellendi.`,ephemeral:true});});

// Tickets / suggestions / polls / giveaways
addCommand(new SlashCommandBuilder().setName('ticket-panel').setDescription('Ticket paneli gönderir'), async i=>{const c=guildData(i.guild.id);await i.channel.send({embeds:[embed('🎫 Destek Merkezi','Sorun veya yardım için ticket aç.',0x2ECC71)],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_open').setLabel('Ticket Aç').setEmoji('🎫').setStyle(ButtonStyle.Success))]});c.ticketCategoryId=i.channel.parentId;saveDB();await i.reply({content:'✅ Ticket paneli gönderildi.',ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('ticket-kapat').setDescription('İçinde olduğun ticketı kapatır'), async i=>{if(!i.channel.name.startsWith('ticket-'))return i.reply({content:'❌ Bu kanal bir ticket değil.',ephemeral:true});await i.reply({content:'🔒 Ticket kapatılıyor...',ephemeral:true});await logAction(i.guild,'🎫 Ticket kapatıldı',`${i.channel.name} → ${i.user}`);setTimeout(()=>i.channel.delete().catch(()=>{}),1500);});
addCommand(new SlashCommandBuilder().setName('oneri-panel').setDescription('Öneri kanalına panel gönderir'), async i=>{guildData(i.guild.id).suggestionChannelId=i.channel.id;saveDB();await i.channel.send({embeds:[embed('💡 Öneri Sistemi','Önerilerini bu kanala mesaj olarak bırak. Yönetim değerlendirecektir.')]});await i.reply({content:'✅ Öneri sistemi ayarlandı.',ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('anket').setDescription('Basit anket başlatır').addStringOption(o=>o.setName('soru').setDescription('Soru').setRequired(true)).addStringOption(o=>o.setName('secenek1').setDescription('Seçenek 1').setRequired(true)).addStringOption(o=>o.setName('secenek2').setDescription('Seçenek 2').setRequired(true)), async i=>{const e=embed('📊 Anket',`**${i.options.getString('soru')}**\n\n1️⃣ ${i.options.getString('secenek1')}\n2️⃣ ${i.options.getString('secenek2')}`);const m=await i.channel.send({embeds:[e]});await m.react('1️⃣');await m.react('2️⃣');await i.reply({content:'✅ Anket oluşturuldu.',ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('cekilis-baslat').setDescription('Çekiliş başlatır').addIntegerOption(o=>o.setName('dakika').setDescription('Süre').setMinValue(1).setMaxValue(10080).setRequired(true)).addIntegerOption(o=>o.setName('kazanan').setDescription('Kazanan sayısı').setMinValue(1).setMaxValue(20).setRequired(true)).addStringOption(o=>o.setName('odul').setDescription('Ödül').setRequired(true)), async i=>{const mins=i.options.getInteger('dakika'), winners=i.options.getInteger('kazanan'), prize=i.options.getString('odul');const id=`${i.guild.id}-${Date.now()}`;const end=Date.now()+mins*60000;const m=await i.channel.send({embeds:[embed('🎉 ÇEKİLİŞ',`**Ödül:** ${prize}\n**Kazanan:** ${winners}\n**Bitiş:** <t:${Math.floor(end/1000)}:R>\nKatılmak için 🎉 tepkisine bas!`,0x9B59B6)]});await m.react('🎉');db.giveaways[id]={guildId:i.guild.id,channelId:i.channel.id,messageId:m.id,end,winners,prize,ended:false};saveDB();await i.reply({content:'✅ Çekiliş başlatıldı.',ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('cekilis-bitir').setDescription('Çekilişi hemen bitirir').addStringOption(o=>o.setName('mesajid').setDescription('Çekiliş mesaj ID').setRequired(true)), async i=>{await finishGiveaway(i.options.getString('mesajid'),i.guild);await i.reply({content:'🏁 Çekiliş bitirildi.',ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('cekilis-yenile').setDescription('Çekiliş kazananını yeniden seçer').addStringOption(o=>o.setName('mesajid').setDescription('Mesaj ID').setRequired(true)), async i=>{const g=Object.values(db.giveaways).find(x=>x.guildId===i.guild.id&&x.messageId===i.options.getString('mesajid'));if(!g)return i.reply({content:'❌ Çekiliş bulunamadı.',ephemeral:true});const ch=i.guild.channels.cache.get(g.channelId);const m=await ch?.messages.fetch(g.messageId).catch(()=>null);if(!m)return i.reply({content:'❌ Mesaj bulunamadı.',ephemeral:true});const users=(await m.reactions.cache.get('🎉')?.users.fetch())?.filter(u=>!u.bot);const arr=[...(users?.values()||[])];if(!arr.length)return i.reply({content:'❌ Katılımcı yok.',ephemeral:true});const w=arr[Math.floor(Math.random()*arr.length)];await i.reply(`🔁 Yeni kazanan: ${w}`);});

// Info / levels
addCommand(new SlashCommandBuilder().setName('kullanici').setDescription('Kullanıcı bilgisi').addUserOption(o=>o.setName('üye').setDescription('Üye').setRequired(true)), async i=>{const u=i.options.getMember('üye');await i.reply({embeds:[embed(`👤 ${u.user.tag}`,`**ID:** ${u.id}\n**Katılım:** <t:${Math.floor(u.joinedTimestamp/1000)}:F>\n**Roller:** ${u.roles.cache.filter(r=>r.id!==i.guild.id).map(r=>r).join(' ')||'Yok'}\n**Durum:** ${u.presence?.status||'offline'}`)]});});
addCommand(new SlashCommandBuilder().setName('rolbilgi').setDescription('Rol bilgisi').addRoleOption(o=>o.setName('rol').setDescription('Rol').setRequired(true)), async i=>{const r=i.options.getRole('rol');await i.reply({embeds:[embed(`🎭 ${r.name}`,`**ID:** ${r.id}\n**Pozisyon:** ${r.position}\n**Üye:** ${r.members.size}\n**Mentionable:** ${r.mentionable?'Evet':'Hayır'}`)]});});
addCommand(new SlashCommandBuilder().setName('kanalbilgi').setDescription('Kanal bilgisi'), async i=>{const c=i.channel;await i.reply({embeds:[embed(`📁 ${c.name}`,`**ID:** ${c.id}\n**Tür:** ${c.type}\n**Kategori:** ${c.parent?.name||'Yok'}\n**Slowmode:** ${c.rateLimitPerUser||0}s`)]});});
addCommand(new SlashCommandBuilder().setName('istatistik').setDescription('Bot istatistiklerini gösterir'), async i=>{const s=db.stats[i.guild.id]||{};await i.reply({embeds:[embed('📈 İstatistik',`**Mesaj:** ${s.messages||0}\n**AutoMod engeli:** ${s.automod||0}\n**Komut:** ${s.commands||0}\n**Moderasyon vakası:** ${(db.cases[i.guild.id]||[]).length}`)],ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('leaderboard').setDescription('XP sıralamasını gösterir'), async i=>{const users=Object.entries(db.users[i.guild.id]||{}).sort((a,b)=>b[1].xp-a[1].xp).slice(0,10);await i.reply({embeds:[embed('🏆 XP Liderlik',users.length?users.map(([id,u],n)=>`**${n+1}.** <@${id}> — ${u.xp} XP • Lv.${u.level}`).join('\n'):'Veri yok.')],ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('xp-sifirla').setDescription('Bir kullanıcının XP sini sıfırlar').addUserOption(o=>o.setName('üye').setDescription('Üye').setRequired(true)), async i=>{const u=i.options.getUser('üye');db.users[i.guild.id] ||= {};db.users[i.guild.id][u.id]={xp:0,level:0,warnings:[],messages:0};saveDB();await i.reply({content:`✅ ${u} XP'si sıfırlandı.`,ephemeral:true});});

// Welcome / leave / status
addCommand(new SlashCommandBuilder().setName('hosgeldin-ayarla').setDescription('Hoş geldin kanalını ayarlar').addChannelOption(o=>o.setName('kanal').setDescription('Kanal').addChannelTypes(ChannelType.GuildText).setRequired(true)).addStringOption(o=>o.setName('mesaj').setDescription('{user} ve {server} kullanılabilir')), async i=>{const c=guildData(i.guild.id);c.welcomeChannelId=i.options.getChannel('kanal').id;c.welcomeMessage=i.options.getString('mesaj')||c.welcomeMessage;saveDB();await i.reply({content:'✅ Hoş geldin sistemi ayarlandı.',ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('ayrilis-ayarla').setDescription('Ayrılış kanalını ayarlar').addChannelOption(o=>o.setName('kanal').setDescription('Kanal').addChannelTypes(ChannelType.GuildText).setRequired(true)).addStringOption(o=>o.setName('mesaj').setDescription('{user} kullanılabilir')), async i=>{const c=guildData(i.guild.id);c.leaveChannelId=i.options.getChannel('kanal').id;c.leaveMessage=i.options.getString('mesaj')||c.leaveMessage;saveDB();await i.reply({content:'✅ Ayrılış sistemi ayarlandı.',ephemeral:true});});
addCommand(new SlashCommandBuilder().setName('durum-ayarla').setDescription('Bot durumunu değiştirir').addStringOption(o=>o.setName('metin').setDescription('Durum').setRequired(true)), async i=>{client.user.setPresence({status:'online',activities:[{name:i.options.getString('metin'),type:ActivityType.Watching}]});await i.reply({content:'✅ Bot durumu değiştirildi.',ephemeral:true});});

// Giveaway helper
async function finishGiveaway(messageId, guild) {
  const g=Object.values(db.giveaways).find(x=>x.guildId===guild.id&&x.messageId===messageId&&!x.ended); if(!g)return false;
  const ch=guild.channels.cache.get(g.channelId);const m=await ch?.messages.fetch(g.messageId).catch(()=>null);if(!m)return false;
  const users=await m.reactions.cache.get('🎉')?.users.fetch().catch(()=>null);const arr=[...(users?.filter(u=>!u.bot).values()||[])];if(!arr.length){await ch.send('🎉 Çekiliş sona erdi fakat katılımcı bulunamadı.');g.ended=true;saveDB();return true;}
  const winners=[];const pool=[...arr];while(winners.length<Math.min(g.winners,pool.length))winners.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  await ch.send({content:`🎉 **ÇEKİLİŞ BİTTİ!**\n**Ödül:** ${g.prize}\n**Kazanan:** ${winners.map(x=>x.toString()).join(', ')}`});g.ended=true;saveDB();return true;
}
setInterval(async()=>{for(const g of Object.values(db.giveaways)){if(!g.ended&&Date.now()>=g.end){const guild=client.guilds.cache.get(g.guildId);if(guild)await finishGiveaway(g.messageId,guild).catch(e=>console.error('[GIVEAWAY]',e.message));}}},15000);

// ---------- INTERACTIONS ----------
client.on(Events.InteractionCreate, async i => {
  try {
    if (i.isChatInputCommand()) {
      if (!(await adminOnly(i))) return;
      db.stats[i.guild.id] ||= {}; db.stats[i.guild.id].commands=(db.stats[i.guild.id].commands||0)+1; saveDB();
      const handler=handlers.get(i.commandName); if(handler) await handler(i); else await i.reply({content:'❌ Komut bulunamadı.',ephemeral:true});
    }
    if (i.isButton()) {
      if (!i.guild) return;
      if (i.customId === 'ticket_open') {
        const existing=i.guild.channels.cache.find(c=>c.name===`ticket-${i.user.id}`);if(existing)return i.reply({content:`🎫 Zaten açık ticketın var: ${existing}`,ephemeral:true});
        const cfg=guildData(i.guild.id);const ch=await i.guild.channels.create({name:`ticket-${i.user.id}`,type:ChannelType.GuildText,parent:cfg.ticketCategoryId||undefined,permissionOverwrites:[{id:i.guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},{id:i.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]},{id:client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]}]});
        await ch.send({content:`${i.user}`,embeds:[embed('🎫 Ticket Açıldı','Destek ekibin burada yardımcı olacak.',0x2ECC71)],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_close').setLabel('Ticket Kapat').setEmoji('🔒').setStyle(ButtonStyle.Danger))]});
        await i.reply({content:`✅ Ticket oluşturuldu: ${ch}`,ephemeral:true}); await logAction(i.guild,'🎫 Ticket açıldı',`${i.user} → ${ch}`);
      }
      if (i.customId === 'ticket_close') {
        if (!i.channel.name.startsWith('ticket-') && !isAdmin(i)) return i.reply({content:'❌ Bu ticket değil.',ephemeral:true});
        await i.reply({content:'🔒 Ticket kapatılıyor...',ephemeral:true});await logAction(i.guild,'🎫 Ticket kapatıldı',`${i.channel.name} → ${i.user}`);setTimeout(()=>i.channel.delete().catch(()=>{}),1200);
      }
    }
  } catch(e) { console.error('[INTERACTION]',e); if(i.isRepliable()&&!i.replied&&!i.deferred) await i.reply({content:'❌ İşlem sırasında beklenmeyen bir hata oluştu.',ephemeral:true}).catch(()=>{}); }
});

// ---------- MESSAGE SYSTEMS ----------
client.on(Events.MessageCreate, async msg => {
  if (!msg.guild || msg.author.bot) return;
  const cfg=guildData(msg.guild.id); const u=userData(msg.guild.id,msg.author.id); u.messages++; db.stats[msg.guild.id] ||= {}; db.stats[msg.guild.id].messages=(db.stats[msg.guild.id].messages||0)+1;
  if (cfg.levels.enabled) {
    const key=`${msg.guild.id}:${msg.author.id}`;const last=cooldowns.get(key)||0;if(Date.now()-last>=cfg.levels.cooldownMs){cooldowns.set(key,Date.now());u.xp+=Math.floor(Math.random()*(cfg.levels.xpMax-cfg.levels.xpMin+1))+cfg.levels.xpMin;const next=Math.max(100,(u.level+1)*100);if(u.xp>=next){u.level++;const ch=cfg.welcomeChannelId?msg.guild.channels.cache.get(cfg.welcomeChannelId):msg.channel;await ch?.send(`🎉 ${msg.author}, **Level ${u.level}** oldun!`).catch(()=>{});}}}
  if (!cfg.automod.enabled) { saveDB(); return; }
  const trusted=msg.member.permissions.has(PermissionFlagsBits.Administrator)||msg.member.permissions.has(PermissionFlagsBits.ManageMessages);if(trusted){saveDB();return;}
  let reason=null;const content=msg.content.toLowerCase();if(cfg.automod.antiInvite&&/discord(?:\.gg|\.com\/invite)\//i.test(content))reason='Discord daveti';else if(cfg.automod.antiLink&&/https?:\/\/\S+/i.test(content))reason='Link';else if(cfg.automod.antiCaps&&content.replace(/[^a-zçğıöşü]/gi,'').length>10){const letters=content.replace(/[^a-zçğıöşü]/gi,'');const upper=letters.replace(/[^A-ZÇĞİÖŞÜ]/g,'').length;if(upper/letters.length>=0.75)reason='Aşırı caps';}
  const mentions=msg.mentions.users.size+msg.mentions.roles.size;if(!reason&&cfg.automod.antiMentionSpam&&mentions>=cfg.automod.mentionLimit)reason='Mention spam';
  const skey=`${msg.guild.id}:${msg.author.id}`;const arr=spamTracker.get(skey)||[];arr.push(Date.now());spamTracker.set(skey,arr.filter(t=>Date.now()-t<5000));if(!reason&&spamTracker.get(skey).length>=cfg.automod.spamLimit)reason='Spam';
  if(reason){await msg.delete().catch(()=>{});db.stats[msg.guild.id].automod=(db.stats[msg.guild.id].automod||0)+1;await logAction(msg.guild,'🚨 AutoMod',`${msg.author} engellendi. **Sebep:** ${reason}`,0xE74C3C);if(reason==='Spam')await msg.member.timeout(30000,'KLOZN AutoMod spam').catch(()=>{});}saveDB();
});
client.on(Events.GuildMemberAdd, async m=>{const c=guildData(m.guild.id);if(c.welcomeChannelId){const ch=m.guild.channels.cache.get(c.welcomeChannelId);await ch?.send({embeds:[embed('👋 Hoş Geldin',c.welcomeMessage.replaceAll('{user}',`${m}`).replaceAll('{server}',m.guild.name),0x2ECC71)]}).catch(()=>{});}await logAction(m.guild,'👋 Üye katıldı',`${m.user} (${m.id})`);});
client.on(Events.GuildMemberRemove, async m=>{const c=guildData(m.guild.id);if(c.leaveChannelId){const ch=m.guild.channels.cache.get(c.leaveChannelId);await ch?.send({embeds:[embed('👋 Üye Ayrıldı',c.leaveMessage.replaceAll('{user}',m.user.toString()),0xE74C3C)]}).catch(()=>{});}await logAction(m.guild,'👋 Üye ayrıldı',`${m.user} (${m.id})`);});

// ---------- COMMAND REGISTRATION ----------
async function registerCommands() {
  const rest=new REST({version:'10'}).setToken(TOKEN);
  const unique=[...new Map(commands.map(c=>[c.name,c])).values()];
  if(GUILD_ID){
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID),{body:unique});
    await rest.put(Routes.applicationCommands(CLIENT_ID),{body:[]});
    console.log(`✅ ${unique.length} benzersiz ADMIN slash komutu GUILD'e kaydedildi: ${GUILD_ID}`);
  } else {
    await rest.put(Routes.applicationCommands(CLIENT_ID),{body:unique});
    console.log(`⚠️ GUILD_ID yok; ${unique.length} global ADMIN slash komutu kaydedildi.`);
  }
}

// ---------- RENDER / UPTIMEROBOT ----------
const startedAt=Date.now();
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(url.pathname==='/health'){res.writeHead(200);return res.end(JSON.stringify({ok:true,status:'healthy',version:VERSION,uptime:process.uptime()}));}
  if(url.pathname==='/status'){const ready=client.isReady();res.writeHead(ready?200:503);return res.end(JSON.stringify({ok:ready,discordReady:ready,guilds:client.guilds.cache.size,wsStatus:client.ws.status,ping:client.ws.ping,version:VERSION,uptime:process.uptime(),startedAt:new Date(startedAt).toISOString()}));}
  if(url.pathname==='/'){res.writeHead(200);return res.end(JSON.stringify({service:'KLOZN Discord Bot',version:VERSION,health:'/health',status:'/status'}));}
  res.writeHead(404);res.end(JSON.stringify({ok:false,error:'Not Found'}));
});
server.listen(PORT,'0.0.0.0',()=>console.log(`🌐 HTTP sağlık sunucusu: 0.0.0.0:${PORT}`));

client.once(Events.ClientReady, async readyClient=>{
  console.log(`🚀 KLOZN V${VERSION} RENDER BUILD`);
  console.log(`🟢 ${readyClient.user.tag} aktif | guilds=${readyClient.guilds.cache.size} | ws=${readyClient.ws.status}`);
  readyClient.user.setPresence({status:'online',activities:[{name:`KLOZN • ${readyClient.guilds.cache.size} sunucu`,type:ActivityType.Watching}]});
  try { await registerCommands(); } catch(e) { console.error('[COMMAND REGISTER]',e); }
  if(GUILD_ID){const g=readyClient.guilds.cache.get(GUILD_ID);if(g) guildData(g.id);}
});
client.on(Events.Error,e=>console.error('[DISCORD CLIENT ERROR]',e));
client.on(Events.Warn,w=>console.warn('[DISCORD CLIENT WARN]',w));
process.on('unhandledRejection',e=>console.error('[UNHANDLED REJECTION]',e));
process.on('uncaughtException',e=>console.error('[UNCAUGHT EXCEPTION]',e));
async function shutdown(signal){console.log(`[SHUTDOWN] ${signal}`);try{server.close();await client.destroy();}finally{process.exit(0);}}
process.on('SIGTERM',()=>shutdown('SIGTERM'));process.on('SIGINT',()=>shutdown('SIGINT'));
client.login(TOKEN).catch(e=>{console.error('[DISCORD LOGIN ERROR]',e);process.exit(1);});
