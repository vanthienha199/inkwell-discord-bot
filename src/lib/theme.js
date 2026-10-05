const { EmbedBuilder } = require('discord.js');

const COLORS = {
  brand: 0x7ce0b0,
  ok: 0x7ce0b0,
  warn: 0xe8c47a,
  danger: 0xf0707a,
  muted: 0x5a5466,
};

const FOOTER = 'Inkwell Helper';

function base(color = COLORS.brand) {
  return new EmbedBuilder().setColor(color).setFooter({ text: FOOTER }).setTimestamp();
}

function welcomeEmbed(member, { rulesId: rulesChannelId, ticketChannelId, memberCount }) {
  return base()
    .setAuthor({ name: `Welcome to ${member.guild.name}`, iconURL: member.guild.iconURL() || undefined })
    .setTitle(`Hi ${member.displayName}, glad you are here.`)
    .setDescription(
      [
        `You are member **#${memberCount.toLocaleString('en-US')}**. Three quick things to get started:`,
        '',
        `**1.** Read the rules in ${rulesChannelId ? `<#${rulesChannelId}>` : '#rules'}. It takes a minute.`,
        `**2.** Pick what you want to see with the menu below.`,
        `**3.** Stuck on anything? Open a ticket in ${ticketChannelId ? `<#${ticketChannelId}>` : '#help-desk'} and a moderator will reply.`,
      ].join('\n')
    )
    .setThumbnail(member.guild.iconURL({ size: 256 }) || member.displayAvatarURL({ size: 256 }));
}

function ticketPanelEmbed() {
  return base()
    .setTitle('Need a hand? Open a private ticket.')
    .setDescription(
      'Pick a topic and a private thread opens that only you and the moderators can see. We usually reply within a few hours.\n\n' +
        '**Account and roles** for access, roles and profile problems\n' +
        '**Report a member** for anything that breaks the rules\n' +
        '**Partnerships** for collabs, events and sponsorships\n' +
        '**Something else** for everything that does not fit above'
    );
}

const TOPICS = {
  account: { label: 'Account and roles' },
  report: { label: 'Report a member' },
  partner: { label: 'Partnerships' },
  other: { label: 'Something else' },
};

function ticketOpenedEmbed(ticket, user) {
  const topic = TOPICS[ticket.topic] || TOPICS.other;
  return base()
    .setTitle(`Ticket #${String(ticket.number).padStart(4, '0')}  ·  ${topic.label}`)
    .setDescription(`Thanks ${user}, a moderator will be with you soon. Add any screenshots or links that help explain the problem.`)
    .addFields(
      { name: 'Opened by', value: `${user}`, inline: true },
      { name: 'Status', value: 'Waiting for staff', inline: true },
      { name: 'Details', value: ticket.details ? ticket.details.slice(0, 1000) : 'No details given' }
    );
}

function modActionEmbed({ action, target, moderator, reason, extra = [] }) {
  const color = { Warn: COLORS.warn, Timeout: COLORS.danger, Purge: COLORS.muted, 'Link blocked': COLORS.warn, 'Ticket closed': COLORS.ok, 'Ticket claimed': COLORS.brand }[action] || COLORS.brand;
  const e = base(color).setTitle(action);
  const fields = [];
  if (target) fields.push({ name: 'Member', value: `${target} \`${target.id}\``, inline: true });
  if (moderator) fields.push({ name: 'By', value: `${moderator}`, inline: true });
  if (reason) fields.push({ name: 'Reason', value: reason.slice(0, 1000) });
  return e.addFields(...fields, ...extra);
}

function userInfoEmbed(member, warnings) {
  const roles = member.roles.cache.filter((r) => r.id !== member.guild.id).map((r) => `${r}`);
  return base()
    .setAuthor({ name: member.user.tag, iconURL: member.displayAvatarURL() })
    .setThumbnail(member.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'Joined server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
      { name: 'Account created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Warnings', value: String(warnings.length), inline: true },
      { name: `Roles (${roles.length})`, value: roles.length ? roles.join(' ') : 'None' }
    );
}

module.exports = { COLORS, base, welcomeEmbed, ticketPanelEmbed, ticketOpenedEmbed, modActionEmbed, userInfoEmbed, TOPICS };
