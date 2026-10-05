const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const store = require('./lib/store');
const theme = require('./lib/theme');

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'member';

const INTEREST_ROLES = ['Brush lettering', 'Calligraphy', 'Pen and ink', 'Sign painting', 'Meetups'];

const definitions = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Create the channels and roles the bot needs, and post the welcome and ticket panels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('welcome-preview').setDescription('See the welcome message new members get'),
  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member and log it')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('member').setDescription('Who to warn').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Why').setRequired(true).setMaxLength(400)),
  new SlashCommandBuilder()
    .setName('warnings')
    .setDescription("Show a member's warnings")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('member').setDescription('Whose warnings').setRequired(true)),
  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Mute a member for a while')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('member').setDescription('Who').setRequired(true))
    .addIntegerOption((o) =>
      o
        .setName('minutes')
        .setDescription('How long')
        .setRequired(true)
        .addChoices({ name: '10 minutes', value: 10 }, { name: '1 hour', value: 60 }, { name: '1 day', value: 1440 }, { name: '1 week', value: 10080 })
    )
    .addStringOption((o) => o.setName('reason').setDescription('Why').setRequired(true).setMaxLength(400)),
  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete recent messages in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((o) => o.setName('count').setDescription('How many, 1 to 100').setRequired(true).setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Show info about a member')
    .addUserOption((o) => o.setName('member').setDescription('Who').setRequired(false)),
];

function rolesMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('roles:pick')
      .setPlaceholder('Pick the topics you care about')
      .setMinValues(0)
      .setMaxValues(INTEREST_ROLES.length)
      .addOptions(INTEREST_ROLES.map((r) => ({ label: r, value: r })))
  );
}

function ticketButtons() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticket:topic')
      .setPlaceholder('Choose a topic to open a ticket')
      .addOptions(Object.entries(theme.TOPICS).map(([value, t]) => ({ label: t.label, value })))
  );
}

function ticketControls(claimed) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:claim').setLabel(claimed ? 'Claimed' : 'Claim').setStyle(ButtonStyle.Secondary).setDisabled(Boolean(claimed)),
    new ButtonBuilder().setCustomId('ticket:close').setLabel('Close ticket').setStyle(ButtonStyle.Danger)
  );
}

async function ensureChannel(guild, name, opts = {}) {
  return guild.channels.cache.find((c) => c.name === name && c.type === (opts.type ?? ChannelType.GuildText)) || guild.channels.create({ name, type: ChannelType.GuildText, ...opts });
}

async function ensureRole(guild, name, opts = {}) {
  return guild.roles.cache.find((r) => r.name === name) || guild.roles.create({ name, ...opts });
}

const ticketLabel = (t) => `#${String(t.number).padStart(4, '0')} ${theme.TOPICS[t.topic].label}`;

// Plain text transcript with names instead of raw mention ids, skipping Discord's system notices.
function transcriptText(guild, t, messages) {
  const name = (id) => guild.members.cache.get(id)?.displayName || guild.client.users.cache.get(id)?.username || 'unknown member';
  const readable = (s) =>
    (s || '')
      .replace(/<@!?(\d+)>/g, (_, id) => '@' + name(id))
      .replace(/<@&(\d+)>/g, (_, id) => '@' + (guild.roles.cache.get(id)?.name || 'role'));
  const header = [`Ticket ${ticketLabel(t)}`, `Opened by ${name(t.userId)} on ${new Date(t.openedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC`, ''];
  const lines = [...messages.values()]
    .reverse()
    .filter((m) => !m.system && (m.content || m.embeds.length))
    .map((m) => {
      const e = m.embeds[0];
      const body = m.content && !/^(<@[!&]?\d+>\s*)+$/.test(m.content) ? m.content : [e?.title, e?.description].filter(Boolean).join(' | ');
      return `[${new Date(m.createdTimestamp).toISOString().slice(11, 16)}] ${m.member?.displayName || m.author.username}: ${readable(body)}`;
    });
  return header.concat(lines).join('\n').replace(/\u00b7/g, '-');
}

async function logTo(guild, embed, files) {
  const id = store.config(guild.id).modLogId;
  const ch = id && (await guild.channels.fetch(id).catch(() => null));
  if (ch) await ch.send({ embeds: [embed], files });
}

const handlers = {
  async setup(i) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const g = i.guild;
    const staff = await ensureRole(g, 'Moderator', { colors: { primaryColor: 0x7ce0b0 }, hoist: true });
    for (const r of INTEREST_ROLES) await ensureRole(g, r);
    const rules = await ensureChannel(g, 'rules');
    const welcome = await ensureChannel(g, 'welcome');
    const help = await ensureChannel(g, 'help-desk');
    // The bot joins the staff role it manages, so private staff channels never lock it out.
    if (!g.members.me.roles.cache.has(staff.id)) await g.members.me.roles.add(staff);
    const modLogAccess = [
      { id: g.roles.everyone.id, deny: ['ViewChannel'] },
      { id: staff.id, allow: ['ViewChannel', 'ReadMessageHistory'] },
      { id: g.members.me.id, allow: ['ViewChannel', 'SendMessages', 'EmbedLinks', 'AttachFiles', 'ReadMessageHistory'] },
    ];
    const modLog = await ensureChannel(g, 'mod-log', { permissionOverwrites: modLogAccess });
    await modLog.permissionOverwrites.set(modLogAccess);
    const previous = store.config(g.id).panelMessageId;
    const hasPanel = previous && (await help.messages.fetch(previous).catch(() => null));
    const panel = hasPanel || (await help.send({ embeds: [theme.ticketPanelEmbed()], components: [ticketButtons()] }));
    store.setConfig(g.id, { rulesId: rules.id, welcomeId: welcome.id, ticketChannelId: help.id, modLogId: modLog.id, staffRoleId: staff.id, panelMessageId: panel.id });
    await i.editReply(`Ready. Welcome messages go to ${welcome}, tickets open from ${help}, and moderation is logged in ${modLog}.`);
  },

  async 'welcome-preview'(i) {
    const cfg = store.config(i.guild.id);
    await i.reply({ embeds: [theme.welcomeEmbed(i.member, { ...cfg, memberCount: i.guild.memberCount })], components: [rolesMenu()], flags: MessageFlags.Ephemeral });
  },

  async warn(i) {
    const target = i.options.getMember('member');
    const reason = i.options.getString('reason');
    if (!target) return i.reply({ content: 'That person is not in this server.', flags: MessageFlags.Ephemeral });
    const list = store.addWarning(i.guild.id, target.id, { reason, by: i.user.id });
    const embed = theme.modActionEmbed({ action: 'Warn', target, moderator: i.user, reason, extra: [{ name: 'Total warnings', value: String(list.length), inline: true }] });
    await target.send({ embeds: [theme.base(theme.COLORS.warn).setTitle(`You got a warning in ${i.guild.name}`).setDescription(reason)] }).catch(() => {});
    await logTo(i.guild, embed);
    await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },

  async warnings(i) {
    const user = i.options.getUser('member');
    const list = store.warnings(i.guild.id, user.id);
    const embed = theme
      .base(list.length ? theme.COLORS.warn : theme.COLORS.ok)
      .setTitle(`Warnings for ${i.options.getMember("member")?.displayName || user.username}`)
      .setDescription(list.length ? list.map((w, n) => `**${n + 1}.** ${w.reason}  ·  <@${w.by}>  ·  <t:${Math.floor(w.at / 1000)}:d>`).join('\n') : 'No warnings. Clean record.');
    await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },

  async timeout(i) {
    const target = i.options.getMember('member');
    const minutes = i.options.getInteger('minutes');
    const reason = i.options.getString('reason');
    if (!target?.moderatable) return i.reply({ content: 'I can not time out that member. Check that my role is above theirs.', flags: MessageFlags.Ephemeral });
    await target.timeout(minutes * 60000, reason);
    const embed = theme.modActionEmbed({ action: 'Timeout', target, moderator: i.user, reason, extra: [{ name: 'Until', value: `<t:${Math.floor((Date.now() + minutes * 60000) / 1000)}:f>`, inline: true }] });
    await logTo(i.guild, embed);
    await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },

  async purge(i) {
    const count = i.options.getInteger('count');
    const deleted = await i.channel.bulkDelete(count, true);
    const embed = theme.modActionEmbed({ action: 'Purge', moderator: i.user, extra: [{ name: 'Channel', value: `${i.channel}`, inline: true }, { name: 'Deleted', value: String(deleted.size), inline: true }] });
    await logTo(i.guild, embed);
    await i.reply({ content: `Deleted ${deleted.size} messages. Messages older than 14 days can not be bulk deleted.`, flags: MessageFlags.Ephemeral });
  },

  async userinfo(i) {
    const member = i.options.getMember('member') || i.member;
    await i.reply({ embeds: [theme.userInfoEmbed(member, store.warnings(i.guild.id, member.id))], flags: MessageFlags.Ephemeral });
  },
};

const components = {
  async 'roles:pick'(i) {
    const picked = new Set(i.values);
    const roles = i.guild.roles.cache.filter((r) => INTEREST_ROLES.includes(r.name));
    await i.member.roles.add(roles.filter((r) => picked.has(r.name)));
    await i.member.roles.remove(roles.filter((r) => !picked.has(r.name)));
    await i.reply({ content: picked.size ? `Done. You now follow ${[...picked].join(', ')}.` : 'Done. You will only see the general channels.', flags: MessageFlags.Ephemeral });
  },

  async 'ticket:topic'(i) {
    const existing = store.openTicketFor(i.guild.id, i.user.id);
    if (existing) return i.reply({ content: `You already have an open ticket: <#${existing.threadId}>`, flags: MessageFlags.Ephemeral });
    const modal = new ModalBuilder()
      .setCustomId(`ticket:details:${i.values[0]}`)
      .setTitle(theme.TOPICS[i.values[0]].label)
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('details').setLabel('What do you need help with?').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true)
        )
      );
    await i.showModal(modal);
  },

  async 'ticket:details'(i, topic) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const details = i.fields.getTextInputValue('details');
    const cfg = store.config(i.guild.id);
    const thread = await i.channel.threads.create({
      name: `ticket-${slug(i.member.displayName)}`.slice(0, 90),
      type: ChannelType.PrivateThread,
      invitable: false,
      reason: `Ticket opened by ${i.user.tag}`,
    });
    const ticket = store.openTicket(i.guild.id, { threadId: thread.id, userId: i.user.id, topic, details });
    await thread.setName(`ticket-${String(ticket.number).padStart(4, '0')}-${slug(i.member.displayName)}`.slice(0, 90));
    await thread.members.add(i.user.id);
    await thread.send({
      content: `${i.user}${cfg.staffRoleId ? ` <@&${cfg.staffRoleId}>` : ''}`,
      embeds: [theme.ticketOpenedEmbed(ticket, i.user)],
      components: [ticketControls(false)],
      allowedMentions: { users: [i.user.id], roles: cfg.staffRoleId ? [cfg.staffRoleId] : [] },
    });
    await i.editReply(`Your ticket is open: ${thread}`);
  },

  async 'ticket:claim'(i) {
    const t = store.ticket(i.guild.id, i.channel.id);
    if (!t) return i.reply({ content: 'This is not a ticket thread.', flags: MessageFlags.Ephemeral });
    if (!i.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return i.reply({ content: 'Only moderators can claim tickets.', flags: MessageFlags.Ephemeral });
    await i.deferUpdate();
    store.updateTicket(i.guild.id, i.channel.id, { claimedBy: i.user.id });
    const opened = EmbedBuilder.from(i.message.embeds[0]).spliceFields(1, 1, { name: 'Status', value: `Claimed by ${i.user}`, inline: true });
    await i.editReply({ embeds: [opened], components: [ticketControls(true)] });
    await i.channel.send({ embeds: [theme.base(theme.COLORS.brand).setDescription(`${i.user} is handling this ticket.`)] });
    await logTo(i.guild, theme.modActionEmbed({ action: 'Ticket claimed', moderator: i.user, extra: [{ name: 'Ticket', value: ticketLabel(t), inline: true }] }));
  },

  async 'ticket:close'(i) {
    const t = store.ticket(i.guild.id, i.channel.id);
    if (!t) return i.reply({ content: 'This is not a ticket thread.', flags: MessageFlags.Ephemeral });
    await i.deferUpdate();
    const disabled = ActionRowBuilder.from(i.message.components[0]);
    disabled.components.forEach((c) => c.setDisabled(true));
    await i.editReply({ components: [disabled] });
    const messages = await i.channel.messages.fetch({ limit: 100 });
    const transcript = new AttachmentBuilder(Buffer.from(transcriptText(i.guild, t, messages), 'utf8'), { name: `ticket-${String(t.number).padStart(4, '0')}.txt` });
    const minutes = Math.max(1, Math.round((Date.now() - t.openedAt) / 60000));
    store.updateTicket(i.guild.id, i.channel.id, { status: 'closed', closedBy: i.user.id, closedAt: Date.now() });
    await i.channel.send({ embeds: [theme.base(theme.COLORS.ok).setTitle('Ticket closed').setDescription(`Closed by ${i.user}. A transcript was saved for the moderators.`)] });
    await logTo(
      i.guild,
      theme.modActionEmbed({
        action: 'Ticket closed',
        target: await i.guild.members.fetch(t.userId).catch(() => null),
        moderator: i.user,
        extra: [
          { name: 'Ticket', value: ticketLabel(t), inline: true },
          { name: 'Open for', value: minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 6) / 10} h`, inline: true },
        ],
      }),
      [transcript]
    );
    await i.channel.setLocked(true).catch(() => {});
    await i.channel.setArchived(true).catch(() => {});
  },
};

module.exports = { definitions, handlers, components, rolesMenu, logTo, INTEREST_ROLES };
