const { Client, GatewayIntentBits, Partials, Events, MessageFlags } = require('discord.js');
const config = require('./config');
const store = require('./lib/store');
const theme = require('./lib/theme');
const { handlers, components, rolesMenu, logTo } = require('./commands');

const LINK = /(https?:\/\/|discord\.gg\/|www\.)\S+/i;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.GuildMember],
});

client.once(Events.ClientReady, (c) => console.log(`Logged in as ${c.user.tag} in ${c.guilds.cache.size} server(s)`));

client.on(Events.GuildMemberAdd, async (member) => {
  const cfg = store.config(member.guild.id);
  const channel = cfg.welcomeId && (await member.guild.channels.fetch(cfg.welcomeId).catch(() => null));
  if (!channel) return;
  await channel.send({
    content: `${member}`,
    embeds: [theme.welcomeEmbed(member, { ...cfg, memberCount: member.guild.memberCount })],
    components: [rolesMenu()],
  });
});

// New members can not post links for their first few minutes, which stops most join and spam bots.
client.on(Events.MessageCreate, async (message) => {
  if (!message.guild || message.author.bot || !LINK.test(message.content)) return;
  const member = message.member;
  if (!member || member.permissions.has('ManageMessages')) return;
  const minutesIn = (Date.now() - member.joinedTimestamp) / 60000;
  if (minutesIn >= config.newAccountMinutes) return;
  await message.delete().catch(() => {});
  const notice = await message.channel.send(`${member}, new members can post links after ${config.newAccountMinutes} minutes. Your message was removed.`);
  setTimeout(() => notice.delete().catch(() => {}), 15000);
  await logTo(
    message.guild,
    theme.modActionEmbed({
      action: 'Link blocked',
      target: member,
      reason: `Joined ${Math.max(1, Math.round(minutesIn))} min ago and posted a link in ${message.channel}`,
      extra: [{ name: 'Message', value: '```' + message.content.slice(0, 500).replace(/`/g, "'") + '```' }],
    })
  );
});

client.on(Events.InteractionCreate, async (i) => {
  if (process.env.DEBUG) console.log('interaction', i.type, i.customId || i.commandName);
  try {
    if (i.isChatInputCommand()) return await handlers[i.commandName]?.(i);
    if (i.isMessageComponent() || i.isModalSubmit()) {
      const [scope, action, arg] = i.customId.split(':');
      const fn = components[`${scope}:${action}`];
      if (fn) return await fn(i, arg);
    }
  } catch (err) {
    console.error(err);
    const msg = { content: 'Something went wrong on my side. A moderator can check the bot logs.', flags: MessageFlags.Ephemeral };
    if (i.deferred || i.replied) await i.followUp(msg).catch(() => {});
    else if (i.isRepliable()) await i.reply(msg).catch(() => {});
  }
});

client.login(config.token());
