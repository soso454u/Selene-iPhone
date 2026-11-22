const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PLAYER, screenPeople, parseStory, lineage, makeEvent, active, threadKey, handoffs } = require('../src/domain.cjs');
const { phoneSettings, buildContext } = require('../src/context.cjs');
const { phoneContents, parsePhoneContents, characterMessages, phoneDisclosure, disclosureEvents } = require('../src/character-phone.cjs');
const { Ledger, conversationMemory } = require('../src/storage.cjs');
const { Sync, pendingSyncEvents, reconcileStories } = require('../src/sync.cjs');
const player = { id: PLAYER, name: '林遥' };
const actor = { id: 'card:shen.png', name: '沈令仪', current: true };
const settings = phoneSettings({ lore: false, dynamic: false, autoCloud: false });
const row = mes => ({ name: actor.name, is_user: false, mes });
function fixture() {
    const records = new Map(), meta = new Map();
    return { records, readMeta: async key => meta.get(key), get: async (_, id) => records.get(id),
        async write(rows, entries = [], insertOnly = false) { for (const item of rows) if (!insertOnly || !records.has(item.id)) records.set(item.id, item); for (const item of entries) meta.set(item.key, item.value); },
        async query(scope, { thread, origin, accept = () => true } = {}) { return { rows: [...records.values()].filter(item => item.scope === scope && (!thread || item.thread === thread) && (!origin || item.origin === origin) && accept(item)).sort((a, b) => b.stamp - a.stamp), next: null }; } };
}

test('NPC-to-character messages retain both directions and media; NPC-to-user messages are separate', async () => {
    const chat = [row('<chat owner="char" peer="npc" name="周晚晚"><im sender="char" name="沈令仪" time="19:44">十五块。</im><im sender="npc" name="周晚晚" time="19:44">？？？</im><im sender="npc" name="周晚晚"><sticker name="小狗得志"/></im></chat><chat owner="char" peer="npc" name="Louis"><im sender="npc" name="Louis" time="19:47">不知道。</im></chat><im sender="npc" name="周晚晚" time="19:50">林遥，晚上见。</im>')];
    const people = screenPeople(chat, [player, actor, { id: 'lore:ming', name: '明玉' }], settings);
    assert.equal(people.filter(person => person.name === '周晚晚').length, 1);
    assert.ok(!people.some(person => person.name === 'Louis'));
    const items = parseStory(chat[0], people, settings);
    assert.equal(items.length, 5);
    const privateItems = items.filter(item => !item.audience.includes(PLAYER));
    assert.equal(privateItems.length, 4);
    assert.equal(privateItems[0].speakerId, actor.id);
    assert.equal(privateItems[1].speakerId, people.find(person => person.name === '周晚晚').id);
    assert.equal(privateItems[2].payload.components[0].type, 'sticker');
    assert.equal(privateItems[3].speakerId, 'lore:ming');
    assert.equal(items.filter(item => item.audience.includes(PLAYER))[0].text, '林遥，晚上见。');
    const ledger = fixture(), trail = lineage(chat);
    const input = { ledger, scope: 'scope', chat, trail, people, groups: [], settings, valid: () => true };
    await reconcileStories(input); await reconcileStories(input);
    assert.equal(ledger.records.size, 5);
    assert.equal((await ledger.query('another-chat')).rows.length, 0);
    const old = [...ledger.records.values()];
    chat[0] = { ...row('切换后的正文没有这些消息。'), swipe_id: 1 };
    assert.ok(old.every(item => !active(item, lineage(chat))));
});

test('multi-NPC cards discover explicit named senders, respect aliases only when bound, and ignore plain mentions', () => {
    const base = [player, { ...actor, name: '多人故事' }];
    const chat = [row('提到了张三。<im sender="char" name="沈令仪">消息一</im><im sender="npc" name="周晚晚">消息二</im><im sender="npc" name="Louis">消息三</im><phone_event from="赵岑" to="user">消息四</phone_event><phone_log>[{"from":"陈舟","to":"user","text":"消息五"}]</phone_log>')];
    const people = screenPeople(chat, base, settings), items = parseStory(chat[0], people, settings);
    assert.equal(items.length, 5);
    assert.deepEqual(items.map(item => people.find(person => person.id === item.speakerId).name).sort(), ['Louis', '周晚晚', '沈令仪', '赵岑', '陈舟'].sort());
    assert.ok(items.every(item => item.audience.includes(PLAYER)));
    assert.ok(!people.some(person => ['张三', '明玉'].includes(person.name)));
    assert.equal(new Set(items.map(item => threadKey(item.participants))).size, 5);
    assert.deepEqual(screenPeople(chat, base, { ...settings, reverse: false }), base);
    const disabled = screenPeople([row('<im sender="npc" name="陌生人">你好</im>')], base, { ...settings, imessage: false });
    assert.equal(disabled.length, base.length);
    const wrapped = [row('<chat owner="user" peer="char"><im sender="char" name="沈令仪">来自沈令仪</im><im sender="user">收到</im></chat><chat owner="char" peer="npc" name="周晚晚"><im sender="char" name="沈令仪">你在哪</im><im sender="npc" name="周晚晚">在家</im></chat>')];
    const identities = screenPeople(wrapped, base, settings);
    const wrappedItems = parseStory(wrapped[0], identities, settings);
    assert.equal(wrappedItems.length, 4);
    const shen = identities.find(person => person.name === '沈令仪').id;
    assert.ok(wrappedItems.every(item => item.participants.includes(shen)));
    assert.ok(wrappedItems.every(item => !item.participants.includes(actor.id)));
});

test('saved phone contents validate atomically, remain private, survive backup cleaning and follow branches', async () => {
    const data = { messages: [], notes: [{ title: '礼物', content: '<script>只是文字</script>' }], history: [{ title: '附近花店', site: '地图' }], cart: [{ name: '花瓶', price: '¥59', quantity: 2 }] };
    const clean = parsePhoneContents(JSON.stringify(data));
    assert.equal(clean.cart[0].quantity, 2);
    assert.throws(() => parsePhoneContents('{"messages":[],"notes":[],"history":[],"cart":[{"name":"花","quantity":0}]}'), /数量/);
    assert.throws(() => parsePhoneContents('{"notes":[]}'), /栏目缺失/);
    assert.throws(() => parsePhoneContents('{"notes":[{"title":"标题"}]}', 'notes'), /缺少内容/);
    const chat = [row('当前剧情。')], trail = lineage(chat), people = [player, actor];
    const records = Object.entries(clean).map(([section, items], index) => makeEvent('scope', trail, { kind: 'phoneSnapshot', speakerId: actor.id, participants: [actor.id], audience: [actor.id], thread: `character-phone:${actor.id}`, text: section, payload: { section, items } }, people, { stamp: index + 1, sync: false }));
    const restored = new Ledger({}).cleanEvents(JSON.parse(JSON.stringify(records)), 'scope');
    assert.deepEqual(phoneContents(restored, actor.id, trail).notes.items, clean.notes);
    const empty = { ...records[1], id: 'newer', stamp: 20, payload: { section: 'notes', items: [] } };
    assert.deepEqual(phoneContents([...restored, empty], actor.id, trail).notes.items, []);
    assert.deepEqual(phoneContents(restored, 'other-owner', trail), {});
    const ledger = fixture(); await ledger.write(records);
    assert.deepEqual(await pendingSyncEvents(ledger, 'scope', trail), []);
    // Even an imported snapshot with an erroneous sync flag must not be handed off.
    await ledger.write([{ ...records[0], sync: true }]);
    assert.deepEqual(await pendingSyncEvents(ledger, 'scope', trail), []);
    const memory = await conversationMemory(ledger, 'scope', trail, records[0].thread, actor.id, [PLAYER, actor.id], () => true);
    assert.deepEqual(memory.recent, []);
    chat[0] = { ...row('另一条分支。'), swipe_id: 1 };
    assert.deepEqual(phoneContents(restored, actor.id, lineage(chat)), {});
});

test('phone generation uses the existing character context and its own output protocol', async () => {
    const chat = [row('沈令仪正在挑选一份礼物。')];
    const pack = await buildContext({ context: { name1: player.name, characters: [{ avatar: 'shen.png', name: actor.name, description: '沈令仪说话克制。' }], characterId: 0 }, chat, trail: lineage(chat), settings, person: { ...actor, index: 0 }, people: [player, actor], members: [actor.id], valid: () => true, memory: { recent: [], older: [], states: [] }, action: 'characterPhone', hint: '{"栏目":["notes"]}' });
    const text = pack.messages.map(message => message.content).join('\n');
    assert.match(text, /"notes"/); assert.match(text, /手机主人：沈令仪/);
    assert.match(text, /正在挑选一份礼物/); assert.match(text, /沈令仪说话克制/);
    assert.ok(!text.includes('回应当前会话'));
    assert.match(text, /"messages"/);
    assert.match(text, /一次请求返回所有选中栏目/);
});

test('generated chats merge with original records, replace only simulated chats, and never impersonate the player', () => {
    const chat = [row('前情')], trail = lineage(chat), people = [player, actor, { id: 'lore:zhou', name: '周晚晚' }];
    const data = { messages: [{ peer: '周晚晚', messages: [{ from: 'owner', text: '下班一起吃饭？' }, { from: 'peer', text: '好啊。' }] }] };
    const clean = parsePhoneContents(JSON.stringify(data), ['messages'], { owner: actor, playerNames: [player.name] });
    const snapshot = makeEvent('scope', trail, { kind: 'phoneSnapshot', speakerId: actor.id, participants: [actor.id], audience: [actor.id], text: '聊天', payload: { section: 'messages', items: clean.messages } }, people, { stamp: 10, sync: false });
    const original = makeEvent('scope', trail, { speakerId: actor.id, participants: [actor.id, 'lore:zhou'], audience: [actor.id, 'lore:zhou'], text: '正文里的原话' }, people, { stamp: 1, sync: false });
    const rows = characterMessages([original, snapshot], actor.id, trail, people, settings);
    assert.equal(rows.length, 3); assert.equal(rows.filter(row => row.generatedPhone).length, 2);
    assert.equal(characterMessages([original, { ...original, id: 'actual-repeat' }, snapshot], actor.id, trail, people, settings).filter(row => !row.generatedPhone).length, 2);
    assert.equal(rows.find(row => row.text === '好啊。').speakerId, 'lore:zhou');
    assert.equal(characterMessages([original, snapshot], 'lore:zhou', trail, people, settings).length, 3);
    assert.deepEqual(characterMessages([original, snapshot], PLAYER, trail, people, settings), []);
    const replacement = { ...snapshot, id: 'replacement', stamp: 20, payload: { section: 'messages', items: [] } };
    assert.deepEqual(characterMessages([original, snapshot, replacement], actor.id, trail, people, settings).map(row => row.text), ['正文里的原话']);
    assert.throws(() => parsePhoneContents(JSON.stringify({ messages: [{ ...data.messages[0], peer: player.name }] }), 'messages', { owner: actor, playerNames: [player.name] }), /不能替玩家/);
    assert.throws(() => parsePhoneContents(JSON.stringify({ messages: [{ peer: '周晚晚', messages: [{ from: 'user', text: '不要替我写' }] }] }), 'messages'), /发送者/);
    assert.throws(() => parsePhoneContents(JSON.stringify({ notes: [] }), ['messages', 'notes']), /栏目缺失/);
});

test('previously saved, selected columns inject completely once with the player action, even when automatic sync is off', async () => {
    for (const mode of ['auto', 'manual', 'off']) {
        const chat = [row('前情')], trail = lineage(chat), people = [player, actor], ledger = fixture();
        const snapshot = makeEvent('scope', trail, { kind: 'phoneSnapshot', speakerId: actor.id, participants: [actor.id], audience: [actor.id], text: '备忘录', payload: { section: 'notes', items: [{ title: '不能被截断的备忘录', content: '关于礼物的完整记录。'.repeat(100) }] } }, people, { sync: false });
        const history = { ...snapshot, id: 'history', payload: { section: 'history', items: [{ title: '未选择的搜索记录', site: '地图' }] } };
        const entries = phoneDisclosure([snapshot, history], actor, trail, people, settings, ['notes']);
        assert.equal(entries.length, 1);
        const reveals = disclosureEvents({ scope: 'scope', trail, people }, actor, entries);
        const duplicate = disclosureEvents({ scope: 'scope', trail, people }, actor, entries);
        assert.equal(duplicate[0].id, reveals[0].id);
        const restored = new Ledger({}).cleanEvents(JSON.parse(JSON.stringify(reveals)), 'scope');
        await ledger.write([snapshot, history, ...restored, ...duplicate]);
        assert.equal((await pendingSyncEvents(ledger, 'scope', trail)).length, 1);
        const state = { scope: 'scope', chat, settings: { ...settings, sync: mode, syncChars: 400 }, context: { saveChat: async () => {} } };
        // No arm call: explicit saved disclosure also survives a script reload.
        const sync = new Sync({ ledger, getState: () => state, onError: assert.fail, onChange() {} });
        const action = '我查看了她的手机，打开备忘录。';
        sync.begin('normal'); chat.push({ name: player.name, is_user: true, mes: action }); await sync.sent(1);
        assert.ok(chat[1].mes.startsWith(action));
        const block = handoffs(chat[1].mes)[0];
        assert.equal(block.events.length, 1);
        assert.equal(block.events[0].角色手机资料.section, 'notes');
        assert.equal(block.events[0].角色手机资料.items[0].content, entries[0].items[0].content);
        assert.match(block.events[0].使用说明, /不替玩家行动/);
        assert.ok(!chat[1].mes.includes('未选择的搜索记录'));
        sync.begin('normal'); chat.push({ name: player.name, is_user: true, mes: '然后继续说话。' }); await sync.sent(2);
        assert.equal(chat[2].mes, '然后继续说话。');
    }
});

test('cancelled or other-branch disclosures do not inject, and current-chat sync excludes other conversations', async () => {
    const chat = [row('前情')], trail = lineage(chat), people = [player, actor, { id: 'zhou', name: '周晚晚' }, { id: 'chen', name: '陈舟' }], ledger = fixture();
    const messages = ['zhou', 'chen'].map(id => makeEvent('scope', trail, { speakerId: id, participants: [actor.id, id], text: `来自${id}的消息` }, people, { sync: false }));
    const entries = phoneDisclosure(messages, actor, trail, people, settings, ['messages'], messages[0].thread);
    assert.equal(entries[0].items.length, 1); assert.equal(entries[0].items[0].from, '周晚晚');
    const reveals = disclosureEvents({ scope: 'scope', trail, people }, actor, entries);
    await ledger.write(reveals.map(row => ({ ...row, sync: false })));
    assert.deepEqual(await pendingSyncEvents(ledger, 'scope', trail), []);
    await ledger.write(reveals);
    const alternate = lineage([{ ...row('改写后的前情'), swipe_id: 1 }]);
    assert.deepEqual(await pendingSyncEvents(ledger, 'scope', alternate), []);
    assert.deepEqual((await ledger.query('other-scope')).rows, []);
    assert.throws(() => disclosureEvents({ scope: 'scope', trail, people }, actor, [{ section: 'notes', items: [{ content: '字'.repeat(25000) }] }]), /24000/);
});
