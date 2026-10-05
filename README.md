# Inkwell Helper, a Discord bot for a lettering club (sample)

Inkwell Helper runs the busy work in a community server: it greets new members with a welcome card and a topic picker, opens a private ticket thread for each request, lets moderators claim and close tickets, saves a readable transcript, and logs every moderation action in a private #mod-log. It also has /warn, /warnings, /timeout, /purge and /userinfo, and blocks links from members who joined less than ten minutes ago. Built with discord.js v14 and slash commands.

To run it, create an application and bot in the Discord Developer Portal, turn on the Server Members and Message Content intents, and invite the bot with the Manage Roles, Manage Channels, Moderate Members, Manage Messages, Manage Threads and Create Private Threads permissions. Copy `.env.example` to `.env`, fill in the token, application id and server id, then run `npm install`, `node src/deploy.js` to register the commands and `node src/index.js` to start the bot. Run `/setup` once in your server, and optionally `node src/post-rules.js` to post the rules.

`npm test` runs the offline checks on the command definitions, embeds and ticket store. Settings and tickets live in a small JSON file under `data/`, which is easy to swap for a database.

Fictional business, invented data. The screenshots come from a private test server called Inkwell & Nib.

![Ticket thread](hero.png)
