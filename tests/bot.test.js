const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.STORE_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bot-store-')), 'store.json');
const { definitions, handlers, components } = require('../src/commands');
const theme = require('../src/lib/theme');
const store = require('../src/lib/store');

test('every slash command is valid and has a handler', () => {
  const names = definitions.map((d) => d.toJSON().name);
  assert.deepEqual(new Set(names).size, names.length);
  for (const d of definitions) {
    const json = d.toJSON();
    assert.match(json.name, /^[a-z-]{1,32}$/);
    assert.ok(json.description.length <= 100, json.name);
    assert.equal(typeof handlers[json.name], 'function', json.name);
  }
});

test('moderation commands are hidden from regular members', () => {
  const byName = Object.fromEntries(definitions.map((d) => [d.toJSON().name, d.toJSON()]));
  for (const name of ['setup', 'warn', 'warnings', 'timeout', 'purge']) assert.ok(byName[name].default_member_permissions, name);
  assert.equal(byName.userinfo.default_member_permissions ?? null, null);
});

test('component ids route to handlers', () => {
  for (const id of ['roles:pick', 'ticket:topic', 'ticket:details', 'ticket:claim', 'ticket:close']) assert.equal(typeof components[id], 'function', id);
});

const fakeMember = {
  displayName: 'Maya Okafor',
  id: '111',
  displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/1.png',
  guild: { name: 'Fieldnote Studio', iconURL: () => 'https://cdn.discordapp.com/icons/1/a.png' },
  toString: () => '<@111>',
};

test('welcome embed links the right channels and stays within Discord limits', () => {
  const e = theme.welcomeEmbed(fakeMember, { rulesId: '1', ticketChannelId: '2', memberCount: 1284 }).toJSON();
  assert.equal(e.color, theme.COLORS.brand);
  assert.match(e.title, /Maya Okafor/);
  assert.match(e.description, /#1,284/);
  assert.match(e.description, /<#1>/);
  assert.match(e.description, /<#2>/);
  assert.ok(e.description.length < 4096);
});

test('ticket and moderation embeds', () => {
  const t = theme.ticketOpenedEmbed({ number: 7, topic: 'report', details: 'Someone keeps posting invite links in #showcase.' }, fakeMember).toJSON();
  assert.equal(t.title, 'Ticket #0007  ·  Report a member');
  assert.equal(t.fields.length, 3);
  const m = theme.modActionEmbed({ action: 'Timeout', target: fakeMember, moderator: { toString: () => '<@9>' }, reason: 'Spam' }).toJSON();
  assert.equal(m.color, theme.COLORS.danger);
  assert.equal(m.fields[0].value, '<@111> `111`');
});

test('store numbers tickets per server and tracks warnings', () => {
  store._reset();
  const a = store.openTicket('g1', { threadId: 't1', userId: 'u1', topic: 'account' });
  const b = store.openTicket('g1', { threadId: 't2', userId: 'u2', topic: 'other' });
  const c = store.openTicket('g2', { threadId: 't3', userId: 'u1', topic: 'other' });
  assert.deepEqual([a.number, b.number, c.number], [1, 2, 1]);
  assert.equal(store.openTicketFor('g1', 'u1').threadId, 't1');
  store.updateTicket('g1', 't1', { status: 'closed' });
  assert.equal(store.openTicketFor('g1', 'u1'), undefined);
  store.addWarning('g1', 'u9', { reason: 'Spam', by: 'm1' });
  assert.equal(store.addWarning('g1', 'u9', { reason: 'Again', by: 'm1' }).length, 2);
  assert.equal(store.warnings('g2', 'u9').length, 0);
  assert.ok(fs.existsSync(process.env.STORE_FILE));
});
