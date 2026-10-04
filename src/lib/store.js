// Small JSON file store: per server settings, ticket counter, open tickets and warnings.
const fs = require('fs');
const path = require('path');

const FILE = process.env.STORE_FILE || path.join(__dirname, '..', '..', 'data', 'store.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return { guilds: {} };
  }
}

let state = load();

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, FILE);
}

function guild(id) {
  state.guilds[id] ||= { config: {}, ticketCounter: 0, tickets: {}, warnings: {} };
  return state.guilds[id];
}

module.exports = {
  config: (gid) => guild(gid).config,
  setConfig(gid, patch) {
    Object.assign(guild(gid).config, patch);
    save();
  },
  openTicket(gid, ticket) {
    const g = guild(gid);
    g.ticketCounter += 1;
    const t = { ...ticket, number: g.ticketCounter, status: 'open', openedAt: Date.now() };
    g.tickets[ticket.threadId] = t;
    save();
    return t;
  },
  ticket: (gid, threadId) => guild(gid).tickets[threadId],
  updateTicket(gid, threadId, patch) {
    Object.assign(guild(gid).tickets[threadId], patch);
    save();
    return guild(gid).tickets[threadId];
  },
  openTicketFor: (gid, userId) => Object.values(guild(gid).tickets).find((t) => t.userId === userId && t.status === 'open'),
  addWarning(gid, userId, warning) {
    const g = guild(gid);
    (g.warnings[userId] ||= []).push({ ...warning, at: Date.now() });
    save();
    return g.warnings[userId];
  },
  warnings: (gid, userId) => guild(gid).warnings[userId] || [],
  _reset() {
    state = { guilds: {} };
  },
};
