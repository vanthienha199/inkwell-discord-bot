// Registers the slash commands. With DISCORD_GUILD_ID set they appear instantly in that server.
const { REST, Routes } = require('discord.js');
const config = require('./config');
const { definitions } = require('./commands');

(async () => {
  const rest = new REST().setToken(config.token());
  const body = definitions.map((d) => d.toJSON());
  const route = config.guildId() ? Routes.applicationGuildCommands(config.appId(), config.guildId()) : Routes.applicationCommands(config.appId());
  const saved = await rest.put(route, { body });
  console.log(`Registered ${saved.length} commands ${config.guildId() ? 'in the test server' : 'globally'}: ${saved.map((c) => '/' + c.name).join(', ')}`);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
