const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PLAYER, lineage, active, makeEvent, parseStory, screenPeople, serializeHandoff } = require('../src/domain.cjs');
const { DEFAULTS } = require('../src/context.cjs');
const { Ledger } = require('../src/storage.cjs');
const { mergeEvents } = require('../src/cloud.cjs');
const { reconcileStories, pendingSyncEvents } = require('../src/sync.cjs');
const { contactDeleted, conversationDeleted, conversationGroups } = require('../src/conversations.cjs');
const { mergeBackupData, PREF_KEYS } = require('../src/portable.cjs');

const people = [{ id: PLAYER, name: '小林' }, { id: 'card:actor', name: '小顾', current: true }, { id: 'screen:friend', name: '小宋' }];
const settings = { ...DEFAULTS, lore: false, dynamic: false };
const reply = mes => ({ name: '小顾', mes, is_user: false, send_date: '2026-11-20T10:00:00Z' });
function fixture(rows = []) {
    const records = new Map(rows.map(row => [row.id, row])), meta = new Map();
    return { records, meta,
        get: async (scope, id) => records.get(id)?.scope === scope ? records.get(id) : undefined,
        readMeta: async key => meta.get(key),
        query: async (scope, { thread, origin, accept = () => true } = {}) => ({ rows: [...records.values()].filter(row => row.scope === scope && (!thread || row.thread === thread) && (!origin || row.origin === origin) && accept(row)) }),
        write: async (items, changes = [], insertOnly = false) => { for (const row of items) if (!insertOnly || !records.has(row.id)) records.set(row.id, row); for (const row of changes) meta.set(row.key, row.value); },
    };
}

test('cloud merges serialization defaults and derived status without making new bubbles, retaining true edits', () => {
    const event = makeEvent('scope', lineage([reply('前情')]), { speakerId: PLAYER, participants: [PLAYER, people[1].id], text: '一起吃饭吧' }, people, { id: 'one' });
    const clean = new Ledger({}).cleanEvents([event], 'scope')[0];
    const local = { ...event, stamp: event.stamp + 7, participation: { source: 'observed' }, echoOf: 'source' };
    assert.equal(mergeEvents([local], [clean]).length, 1);
    assert.deepEqual(mergeEvents([local], [clean])[0].participation, local.participation);
    const oldConflict = { ...clean, id: 'conflict:old', conflictOf: event.id, sync: false, participation: { source: 'old' } };
    const repaired = mergeEvents([local], [clean, oldConflict]);
    assert.equal(repaired.find(row => row.id === oldConflict.id).echoOf, event.id);
    assert.equal(mergeEvents(repaired, repaired).length, 2);
    const realConflict = { ...oldConflict, id: 'conflict:edited', text: '不同的实际消息' };
    assert.equal(mergeEvents([], [clean, realConflict]).find(row => row.id === realConflict.id).echoOf, undefined);
    assert.equal(mergeEvents([{ ...event, text: '本地改写' }], [event]).length, 2);
});

test('upgrade repairs old cloud aliases and a rewritten photo bracketed by the original messages', async () => {
    const scope = 'repair', chat = [reply('前情')];
    const originals = ['第一条', '照片：窗边的一束花', '最后一条'].map((text, index) => makeEvent(scope, lineage(chat), { speakerId: PLAYER, participants: [PLAYER, people[1].id], text, rpTime: '15:31', ...(index === 1 ? { payload: { components: [{ type: 'photo', text: '窗边的一束花', fields: { prompt: 'flowers' } }] } } : {}) }, people, { id: `original:${index}`, stamp: 100 + index }));
    const ledger = fixture([...originals, ...originals.map(row => ({ ...row, id: `conflict:${row.id}`, conflictOf: row.id, sync: false, participation: {} }))]);
    chat.push({ name: '小林', is_user: true, mes: `继续\n${serializeHandoff(originals, 12000).block}` });
    chat.push(reply('<chat owner="char" peer="user" name="小林"><im sender="user" time="15:31">第一条</im><im sender="user" time="15:31"><photo>窗边花瓶里的几枝鲜花，窗外阳光落在花瓣上。</photo></im><im sender="user" time="15:31">最后一条</im><im sender="char" time="15:34">收到了</im></chat>'));
    const trail = lineage(chat), input = { ledger, scope, chat, trail, people, groups: [], settings, valid: () => true };
    const parser = await reconcileStories(input);
    const visible = [...ledger.records.values()].filter(row => active(row, trail) && !row.echoOf && (row.origin === 'phone' || row.parser === parser));
    assert.deepEqual(visible.map(row => row.text), [...originals.map(row => row.text), '收到了']);
    assert.equal(ledger.records.size, 7);
    await reconcileStories(input);
    assert.equal(ledger.records.size, 7);
});

test('new or unanchored images are not collapsed solely because their type or time matches', async () => {
    const scope = 'new-photo', chat = [reply('前情')];
    const original = makeEvent(scope, lineage(chat), { speakerId: PLAYER, participants: [PLAYER, people[1].id], text: '照片：原图', payload: { components: [{ type: 'photo', text: '原图' }] } }, people);
    const ledger = fixture([original]);
    chat.push({ name: '小林', is_user: true, mes: serializeHandoff([original], 10000).block });
    chat.push(reply('<im sender="user"><photo>另一张图</photo></im>'));
    const trail = lineage(chat);
    await reconcileStories({ ledger, scope, chat, trail, people, groups: [], settings, valid: () => true });
    assert.equal([...ledger.records.values()].filter(row => !row.echoOf).length, 2);
});

test('explicit group names, full membership and NPC speakers import into separate named conversations', async () => {
    const body = '<im sender="char" name="小顾" time="18:01">下班了</im><im sender="npc" name="小宋" time="18:02">我也到了</im>';
    const chat = [reply(`<chat owner="user" peer="group" id="work" name="下班群" members="user,char,小宋">${body}</chat><group_chat name="朋友群" members="user,char,小宋">${body}</group_chat>`)];
    const parsed = parseStory(chat[0], people, settings);
    assert.equal(parsed.length, 4);
    assert.notEqual(parsed[0].thread, parsed[2].thread);
    assert.equal(parsed[0].thread, parsed[1].thread);
    assert.equal(parsed[1].speakerId, people[2].id);
    assert.deepEqual(new Set(parsed[1].participants), new Set(people.map(person => person.id)));
    const ledger = fixture(), trail = lineage(chat);
    await reconcileStories({ ledger, scope: 'group', chat, trail, people, groups: [], settings, valid: () => true });
    const groups = conversationGroups([], [...ledger.records.values()], trail);
    assert.deepEqual(groups.map(group => group.name), ['下班群', '朋友群']);
    assert.equal(conversationGroups([], [...ledger.records.values()], lineage([reply('另一分支')])).length, 0);
    const discovered = screenPeople(chat, people.slice(0, 2), settings);
    assert.ok(discovered.some(person => person.name === '小宋'));
    assert.ok(!discovered.some(person => ['下班群', '朋友群', 'group'].includes(person.name)));
    for (const source of ['<chat peer="group" name="不猜成员">' + body + '</chat>', '<group_chat members="user,char,不存在">' + body + '</group_chat>']) assert.equal(parseStory(reply(source), people, settings).length, 0);
    assert.equal(parseStory(reply(`<think><group_chat members="user,char,小宋">${body}</group_chat></think>`), people, settings).length, 0);
});

test('group NPC messages hand off with group identity; deletions block new handoffs and restore without erasing history', async () => {
    const scope = 'deleted', trail = lineage([reply('前情')]);
    const privateMessage = makeEvent(scope, trail, { speakerId: PLAYER, participants: [PLAYER, people[1].id], text: '私聊' }, people);
    const groupMessage = makeEvent(scope, trail, { speakerId: people[2].id, participants: people.map(person => person.id), text: 'NPC 群消息', thread: 'group:work', payload: { group: { name: '下班群' } } }, people);
    const ledger = fixture([privateMessage, groupMessage]);
    const handoff = JSON.parse(serializeHandoff([groupMessage], 10000).block.split('\n')[1]).events[0];
    assert.equal(handoff.群聊.名称, '下班群');
    assert.equal(handoff.发送者, people[2].name);
    assert.equal(handoff.知情范围.length, 3);
    const prefs = { deletedContacts: { [people[1].id]: people[1].name }, deletedThreads: { [groupMessage.thread]: true } };
    ledger.meta.set(`${scope}:prefs`, prefs);
    assert.equal(contactDeleted(people[1], prefs), true);
    assert.equal(conversationDeleted(privateMessage, prefs), true);
    assert.equal((await pendingSyncEvents(ledger, scope, trail)).length, 0);
    ledger.meta.set(`${scope}:prefs`, { ...prefs, deletedThreads: { [groupMessage.thread]: false } });
    assert.deepEqual((await pendingSyncEvents(ledger, scope, trail)).map(row => row.id), [groupMessage.id]);
    ledger.meta.set(`${scope}:prefs`, { deletedContacts: { [people[1].id]: '' }, deletedThreads: { [groupMessage.thread]: false } });
    assert.equal((await pendingSyncEvents(ledger, scope, trail)).length, 2);
    assert.equal(ledger.records.size, 2);
    assert.ok(PREF_KEYS.includes('deletedContacts') && PREF_KEYS.includes('deletedThreads'));
    const merged = mergeBackupData({ events: [], prefs, people: [], threads: [] }, { prefs: { deletedContacts: {}, deletedThreads: {} } });
    assert.equal(merged.prefs.deletedThreads[groupMessage.thread], true);
});
