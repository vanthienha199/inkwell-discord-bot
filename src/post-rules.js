// Posts the server rules as an embed in #rules. Run once after /setup: node src/post-rules.js
const { REST, Routes } = require('discord.js');
const config = require('./config');
const store = require('./lib/store');
const theme = require('./lib/theme');

const RULES = [
  ['Be kind', 'Critique the work, never the person. No harassment, slurs or pile ons.'],
  ['Credit the artist', 'Only share work you made, or link the original creator.'],
  ['No spam or self promo', 'Links to shops and socials go in #showcase, once a week.'],
  ['Keep it safe for work', 'No adult or graphic content anywhere in the server.'],
  ['Use the right channel', 'Questions for the team go through a ticket in #help-desk.'],
];

(async () => {
  const guildId = config.guildId();
  const { rulesId } = store.config(guildId);
  if (!rulesId) throw new Error('Run /setup first.');
  const embed = theme
    .base()
    .setTitle('Server rules')
    .setDescription('Short version: be the kind of member you would want to meet. Moderators may warn or time out anyone who breaks these.')
    .addFields(RULES.map(([name, value], i) => ({ name: `${i + 1}. ${name}`, value })));
  const rest = new REST().setToken(config.token());
  await rest.post(Routes.channelMessages(rulesId), { body: { embeds: [embed.toJSON()] } });
  console.log('Rules posted.');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
