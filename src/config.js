// Reads settings from environment variables, or from a local .env file if one exists.
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
  return v;
}

module.exports = {
  token: () => required('DISCORD_TOKEN'),
  appId: () => required('DISCORD_APP_ID'),
  guildId: () => process.env.DISCORD_GUILD_ID || null,
  newAccountMinutes: Number(process.env.NEW_MEMBER_LINK_MINUTES || 10),
};
