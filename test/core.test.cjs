const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PLAYER, active, before, eventStatus, handoffs, lineage, makeEvent, parseStory } = require('../src/domain.cjs');
const { Sync, reconcileStories } = require('../src/sync.cjs');
const { conversationMemory } = require('../src/storage.cjs');
const { DEFAULTS, basePeople, buildContext, phoneSettings } = require('../src/context.cjs');
const { DEFAULT_PRESET, LEGACY_DEFAULT_PRESET, PRESET_LIMIT, validatePreset } = require('../src/phone-preset.cjs');
const { Transport, connection, parseReply } = require('../src/api.cjs');

const actor = { id: 'card:gu.png', name: '顾砚卿', current: true };
const player = { id: PLAYER, name: '林遥' };
const witness = { id: 'card:yue.png', name: '宋悦' };
const people = [player, actor];
const setting = { ...DEFAULTS, lore: false, dynamic: false };
const user = mes => ({ name: player.name, is_user: true, mes });
const reply = mes => ({ name: actor.name, is_user: false, mes });
const message = (scope, chat, extra = {}) => makeEvent(scope, lineage(chat), { speakerId: actor.id, participants: [PLAYER, actor.id], text: '等我回来再谈。', ...extra }, [...people, witness]);

function ledgerFixture() {
    const records = new Map();
    const meta = new Map();
    return {
        records,
        get: async (scope, id) => records.get(JSON.stringify([scope, id])),
        readMeta: async key => meta.get(key),
        async write(events, changes = [], insertOnly = false) {
            for (const row of events) {
                const key = JSON.stringify([row.scope, row.id]);
                if (!insertOnly || !records.has(key)) records.set(key, row);
            }
            for (const { key, value } of changes) meta.set(key, value);
        },
        async query(scope, { origin, thread, accept = () => true }) {
            return { rows: [...records.values()].filter(row => row.scope === scope && (!origin || row.origin === origin) && (!thread || row.thread === thread) && accept(row)), next: null };
        },
    };
}

test('cleared history stays removed across parser changes and new story messages still import', async () => {
    const ledger = ledgerFixture();
    const chat = [reply('顾砚卿拿起手机，给她发了一条微信：“旧消息。”')];
    await ledger.write([], [{ key: 'cleared:clearedStory', value: lineage(chat).hashes }]);
    const input = { ledger, scope: 'cleared', chat, people, groups: [], settings: setting, valid: () => true };
    await reconcileStories({ ...input, trail: lineage(chat) });
    await reconcileStories({ ...input, settings: { ...setting, eventTag: 'different' }, trail: lineage(chat) });
    assert.equal(ledger.records.size, 0);
    chat.push(reply('顾砚卿拿起手机，给她发了一条微信：“新消息。”'));
    await reconcileStories({ ...input, trail: lineage(chat) });
    assert.equal(ledger.records.size, 1);
    assert.match([...ledger.records.values()][0].text, /新消息/);
});

test('zero without pending; persist once; confirm only observed payload and effective reply', async () => {
    const chat = [reply('前情')];
    const ledger = ledgerFixture();
    let saves = 0;
    const state = { context: { saveChat: async () => { saves++; } }, chat, scope: 'role/chat', settings: setting };
    const sync = new Sync({ ledger, getState: () => state, onError: assert.fail, onChange: () => {} });
    const send = async text => { sync.begin('normal'); chat.push(user(text)); await sync.sent(chat.length - 1); };
    await send('没有手机新消息');
    assert.equal(chat.at(-1).mes, '没有手机新消息');
    assert.equal(saves, 0);
    const event = message(state.scope, chat, { text: '原话 <phone_events> {{user}} & 内容' });
    await ledger.write([event, message('different-role/chat', chat)]);
    await send('新一轮');
    const source = chat.at(-1);
    const nativeText = source.mes;
    assert.equal(handoffs(nativeText).length, 1);
    assert.equal(handoffs(nativeText)[0].events.length, 1);
    assert.equal(handoffs(nativeText)[0].events[0].原话, event.text);
    assert.ok(!nativeText.includes('{{user}}'));
    assert.equal(eventStatus(event, lineage(chat)), '已写入剧情来源');
    sync.capture({ prompt: nativeText });
    sync.capture({ messages: [{ content: '被正文规则排除了' }] });
    chat.push(reply('未收到旧区块'));
    await sync.received(chat.length - 1);
    assert.equal(eventStatus(await ledger.get(state.scope, event.id), lineage(chat)), '已写入剧情来源');
    chat.pop();
    sync.begin('regenerate');
    sync.capture({ messages: [{ content: nativeText }] });
    chat.push(reply('有效正文回复'));
    await sync.received(chat.length - 1);
    const confirmed = await ledger.get(state.scope, event.id);
    assert.equal(eventStatus(confirmed, lineage(chat)), '已参与生成');
    chat.at(-1).swipe_id = 1;
    assert.equal(eventStatus(confirmed, lineage(chat)), '已写入剧情来源');
    delete chat.at(-1).swipe_id;
    source.mes = nativeText.replace('新一轮', '编辑后的内容');
    assert.equal(eventStatus(confirmed, lineage(chat)), '已写入剧情来源');
    await send('下一轮');
    assert.equal(chat.at(-1).mes, '下一轮');
    assert.equal(saves, 1);
    chat.splice(2);
    assert.equal(eventStatus(confirmed, lineage(chat)), '待同步');
});

test('manual arming, cancellation and rollback on rejected save', async () => {
    const chat = [reply('开局')];
    const ledger = ledgerFixture();
    const state = { context: { saveChat: async () => { throw new Error('disk'); } }, chat, scope: 'scope', settings: { ...setting, sync: 'manual' } };
    await ledger.write([message(state.scope, chat)]);
    const sync = new Sync({ ledger, getState: () => state, onError: assert.fail, onChange: () => {} });
    sync.begin('normal'); chat.push(user('未安排')); await sync.sent(1);
    assert.equal(chat.at(-1).mes, '未安排');
    sync.arm(state.scope);
    const controller = new AbortController();
    sync.begin('normal', { signal: controller.signal }); controller.abort(); chat.push(user('已取消')); await sync.sent(2);
    assert.equal(chat.at(-1).mes, '已取消');
    sync.begin('normal'); chat.push(user('写入失败'));
    await assert.rejects(sync.sent(3), /disk/);
    assert.equal(chat.at(-1).mes, '写入失败');
    assert.ok(sync.armed.has(state.scope));
});

test('reverse parsers preserve source and exclude superseded branch without duplicating records', async () => {
    const sentence = '顾砚卿拿起手机，给她发了一条微信：“下班了吗？我在楼下等你。”';
    assert.equal(parseStory(reply(sentence), people, setting)[0].text, '下班了吗？我在楼下等你。');
    assert.deepEqual(parseStory(reply(sentence), [...people, witness], setting), []);
    assert.deepEqual(parseStory(reply('顾砚卿给林遥发了一条微信。'), people, setting), []);
    const xml = '<phone_event type="message" from="char" to="user">到家了。</phone_event>';
    const imessage = '<chat owner="user" peer="char"><im sender="char"><reply quote="早餐">带来了</reply></im></chat>';
    const json = '<phone_log>[{"type":"call","from":"char","to":["user"],"text":"通话约定"}]</phone_log>';
    const chat = [reply(`${xml}\n${imessage}\n${json}`)];
    const ledger = ledgerFixture();
    const input = { ledger, scope: 'scope', chat, people, groups: [], settings: setting, valid: () => true };
    await reconcileStories({ ...input, trail: lineage(chat) });
    await reconcileStories({ ...input, trail: lineage(chat) });
    const old = [...ledger.records.values()];
    assert.deepEqual(old.map(row => [row.kind, row.text, row.quote, row.sync]), [['call', '通话约定', '', false], ['message', '到家了。', '', false], ['message', '带来了', '早餐', false]]);
    chat[0] = { ...reply(sentence), swipe_id: 1 };
    const alternate = lineage(chat);
    await reconcileStories({ ...input, trail: alternate });
    assert.equal(old.filter(row => active(row, alternate)).length, 0);
    assert.equal([...ledger.records.values()].filter(row => active(row, alternate)).length, 1);
    assert.equal((await ledger.query('other-role', {})).rows.length, 0);
});

test('group prompt withholds private ledger and recognized prose quotes', async () => {
    const chat = [reply('顾砚卿给林遥发了一条微信：“只对你说。”')];
    const trail = lineage(chat);
    const ledger = ledgerFixture();
    const privateRow = message('scope', chat, { thread: 'group', text: '不可共享', audience: [PLAYER, actor.id] });
    const groupRow = message('scope', chat, { thread: 'group', text: '群里公开', audience: [PLAYER, actor.id, witness.id] });
    await ledger.write([{ ...privateRow, memory: '私密状态' }, groupRow]);
    const members = [PLAYER, actor.id, witness.id];
    const memory = await conversationMemory(ledger, 'scope', trail, 'group', actor.id, members, () => true);
    assert.deepEqual(memory.recent.map(row => row.text), ['群里公开']);
    const pack = await buildContext({ context: { name1: player.name, getCharacterCardFields: () => ({}) }, chat, trail, settings: setting, person: actor, people: [...people, witness], members, memory, snapshot: { anchor: before(trail), memory: '旧摘要' }, action: 'reply', valid: () => true });
    assert.match(JSON.stringify(pack.messages), /群里公开/);
    assert.doesNotMatch(JSON.stringify(pack.messages), /不可共享|私密状态|只对你说|旧摘要/);
});

test('phone uses only sourced character and story data, migrates old settings, and scopes confirmed memory to the branch', async () => {
    const old = { inheritPreset: true, exclude: 'unrelated', dynamicKeys: 'arbitrary', presetSelections: { unrelated: true }, preset: '仅使用手机自定义规则', dynamic: true };
    const settings = phoneSettings({ ...old, lore: false });
    assert.equal(settings.preset, old.preset);
    for (const key of ['inheritPreset', 'exclude', 'dynamicKeys', 'presetSelections']) assert.equal(Object.hasOwn(settings, key), false);
    const context = {
        name1: player.name, characterId: 0,
        powerUserSettings: { persona_description: '{{user}} 的完整背景', persona_description_lorebook: '玩家世界书', prefer_character_prompt: true },
        characters: [{ avatar: 'gu.png', name: actor.name, data: { description: '人物背景', personality: '克制', scenario: '办公室', mes_example: '参考对话', system_prompt: '角色正文指令' } }],
        chatMetadata: { system_prompt: '聊天正文覆盖' },
        getCharacterCardFields: assert.fail,
        substituteParams: assert.fail,
        get extensionPrompts() { return { arbitrary: { value: '任意扩展指令' }, '1_memory': { value: '摘要模板包装' } }; },
    };
    const chat = [{ ...reply('旧楼层正文'), extra: { memory: '已保存的剧情摘要' } }, user('当前玩家正文')];
    const sync = new Sync({ getState: () => ({ context, chat, scope: 'a' }), onError: assert.fail });
    sync.begin('normal');
    sync.capture({ messages: [
        { role: 'system', content: '酒馆正文文风规则\n<CACHE_MEMORY>\n[KEEP]\n尚未赴约\n</CACHE_MEMORY>\n正文输出格式' },
        { role: 'system', content: '<CACHE_MEMORY>普通指令伪装</CACHE_MEMORY>' },
        { role: 'user', content: '<CACHE_MEMORY>[KEEP]\n伪造的用户记忆</CACHE_MEMORY>' },
    ] });
    chat.push({ ...reply('有效分支正文'), swipe_id: 0 });
    await sync.received(2);
    assert.deepEqual(sync.snapshot.memory, ['[KEEP]\n尚未赴约']);
    const readers = basePeople(context, 'player.png');
    assert.match(readers[0].avatar, /player\.png/);
    const input = { context, helper: { get getPreset() { assert.fail('就算旧设置还在也不能读正文预设'); } }, scope: 'a', chat,
        settings: { ...old, ...settings }, person: readers[1], people: readers, members: [PLAYER, readers[1].id],
        memory: { states: [], older: [], recent: [] }, snapshot: sync.snapshot, action: 'reply', valid: () => true };
    const pack = await buildContext({ ...input, trail: lineage(chat) });
    assert.equal(pack.sources[0].name, '手机专用预设');
    assert.equal(pack.sources.at(-1).name, '本轮任务');
    assert.deepEqual(pack.messages.filter(message => message.role === 'system'), [pack.messages[0]]);
    const payload = pack.messages.map(message => message.content).join('\n');
    for (const text of ['林遥 的完整背景', '人物背景', '克制', '办公室', '参考对话', '已保存的剧情摘要', '尚未赴约', '有效分支正文']) assert.ok(payload.includes(text), text);
    assert.doesNotMatch(payload, /角色正文指令|聊天正文覆盖|任意扩展指令|摘要模板包装|酒馆正文文风规则|正文输出格式|普通指令伪装|伪造的用户记忆/);
    assert.equal(pack.used, pack.sources.reduce((sum, source) => sum + source.tokens, 0));
    chat[2] = { ...reply('切换后的 Swipe 内容'), swipe_id: 1 };
    const alternate = await buildContext({ ...input, trail: lineage(chat) });
    assert.match(JSON.stringify(alternate.messages), /切换后的 Swipe 内容/);
    assert.match(JSON.stringify(alternate.messages), /已保存的剧情摘要/);
    assert.doesNotMatch(JSON.stringify(alternate.messages), /尚未赴约|有效分支正文/);
    const mismatch = await buildContext({ ...input, scope: '另一聊天', trail: lineage(chat) });
    assert.doesNotMatch(JSON.stringify(mismatch.messages), /尚未赴约/);
});

test('saved Cache Memory is accepted only for matching active source fingerprints', async () => {
    const chat = [reply('开局'), { ...reply('角色交还钥匙'), swipe_id: 0 }];
    const context = { name1: player.name, chatMetadata: { cache_memory: { summaries: {
        record: { messageIndex: 1, messageId: 'message-7xfscg', sourceFingerprint: '1ptbvp', status: 'frozen', event: '钥匙已归还给玩家' },
    } } } };
    const input = { context, scope: 'a', chat, settings: { ...setting, dynamic: true }, person: actor, people, members: [PLAYER, actor.id],
        memory: { states: [], older: [], recent: [] }, action: 'reply', valid: () => true };
    const pack = await buildContext({ ...input, trail: lineage(chat) });
    assert.ok(pack.sources.some(source => source.name.includes('分支已核验摘要') && source.content.includes('钥匙已归还给玩家')));
    chat[1].swipe_id = 1;
    const alternate = await buildContext({ ...input, trail: lineage(chat) });
    assert.doesNotMatch(JSON.stringify(alternate.messages), /钥匙已归还给玩家/);
});

test('worldbook uses observed plus direct matches without native scanning or incompatible markup', async () => {
    const chat = [reply('窗外是图书馆。')];
    const context = { name1: player.name, powerUserSettings: { persona_description_lorebook: '玩家书' } };
    const entries = [
        { uid: 1, world: '玩家书', constant: true, content: '玩家携带通行证。' },
        { uid: 2, world: '地图', key: ['图书馆'], content: '地图上有南门。' },
        { uid: 3, world: '地图', key: ['市场'], content: '未激活地图' },
        { uid: 4, world: '图书馆', comment: '剧情摘要', key: ['图书馆'], content: '早前取得线索。' },
        { uid: 5, world: '图书馆', constant: true, disable: true, content: '禁用资料' },
        { uid: 6, world: '图书馆', key: ['市场'], content: '原生递归已命中', group: 'branch' },
        { uid: 7, world: '地图', constant: true, content: '地图上有南门。' },
        ...Object.values(require('../iMessage世界书.json').entries).map(entry => ({ ...entry, world: 'iMessage' })),
    ];
    const loadLore = async () => ({ getSortedEntries: async () => entries, checkWorldInfo: assert.fail });
    const trail = lineage(chat);
    const input = { context, scope: 'a', chat, trail, settings: { ...DEFAULTS, preset: '仅使用手机自定义规则' }, person: actor, people, members: [PLAYER, actor.id],
        memory: { states: [], older: [], recent: [] }, loreSnapshot: { scope: 'a', anchor: before(trail), entries: [entries[5]] }, loadLore, valid: () => true };
    const replyPack = await buildContext({ ...input, action: 'reply' });
    assert.ok(replyPack.books.includes('Persona：玩家书'));
    for (const text of ['玩家携带通行证', '地图上有南门', '原生递归已命中', '早前取得线索', '聊天符合角色本人']) assert.ok(replyPack.sources.some(source => source.content.includes(text)), text);
    assert.equal(replyPack.sources.filter(source => source.content.includes('地图上有南门')).length, 1);
    assert.doesNotMatch(JSON.stringify(replyPack.messages), /未激活地图|禁用资料|im sender|表情名称|线上丨社交美化/);
    const social = await buildContext({ ...input, action: 'post' });
    assert.match(JSON.stringify(social.messages), /不编造作者/);
    assert.doesNotMatch(JSON.stringify(social.messages), /<social|聊天符合角色本人|小狗得志/);
    const stickers = await buildContext({ ...input, action: 'reply', hint: '发个表情包' });
    assert.match(JSON.stringify(stickers.messages), /小狗得志/);
    const builtInChat = await buildContext({ ...input, settings: DEFAULTS, action: 'reply', hint: '发个表情包' });
    assert.match(JSON.stringify(builtInChat.messages), /小狗得志/);
    assert.doesNotMatch(JSON.stringify(builtInChat.messages), /聊天符合角色本人/);
    const builtInSocial = await buildContext({ ...input, settings: DEFAULTS, action: 'post' });
    assert.match(JSON.stringify(builtInSocial.messages), /不编造作者/);
    assert.doesNotMatch(JSON.stringify(builtInSocial.messages), /仅写屏幕内容/);
});

test('built-in and edited phone presets assemble only the requested modules', async () => {
    assert.equal(phoneSettings({ preset: LEGACY_DEFAULT_PRESET, presetEnabled: false }).preset, DEFAULT_PRESET);
    assert.equal(phoneSettings({ preset: LEGACY_DEFAULT_PRESET, presetEnabled: false }).presetEnabled, false);
    assert.equal(validatePreset(`\ufeff${DEFAULT_PRESET}\n`), DEFAULT_PRESET);
    for (const invalid of ['', 'a\0b', 'x'.repeat(PRESET_LIMIT + 1)]) assert.throws(() => validatePreset(invalid), /有效的纯文本预设/);

    const chat = [reply('已经约定在南门见面。')];
    const input = { context: { name1: player.name }, scope: 'a', chat, trail: lineage(chat), settings: setting, person: actor, people: [...people, witness],
        members: [PLAYER, actor.id], memory: { states: [], older: [], recent: [] }, valid: () => true };
    const privatePack = await buildContext({ ...input, action: 'reply' });
    const groupPack = await buildContext({ ...input, action: 'initiative', members: [PLAYER, actor.id, witness.id] });
    const momentsPack = await buildContext({ ...input, action: 'post', members: [PLAYER, actor.id, witness.id] });
    const modules = pack => [...pack.messages[0].content.matchAll(/^【([A-Z]+)】/gm)].map(match => match[1]);
    assert.deepEqual(modules(privatePack), ['CORE', 'CHAT', 'OUTPUT']);
    assert.deepEqual(modules(groupPack), ['CORE', 'CHAT', 'GROUP', 'OUTPUT']);
    assert.deepEqual(modules(momentsPack), ['CORE', 'SOCIAL', 'OUTPUT']);
    assert.match(privatePack.messages[0].content, /小手机与酒馆正文共享同一世界/);
    assert.match(groupPack.messages[0].content, /不要求所有成员轮流发言/);
    assert.match(momentsPack.messages[0].content, /朋友圈：messages 包含 0 或 1 条/);
    assert.doesNotMatch(privatePack.messages[0].content, /不同人物拥有不同的平台偏好|不要求所有成员轮流发言/);

    const custom = { ...setting, preset: '<PHONE_PRESET>\r\n[CORE]\r\n通用补充\r\n[CHAT]\r\n聊天补充\r\n[SOCIAL]\r\n社交补充\r\n</PHONE_PRESET>' };
    const edited = await buildContext({ ...input, settings: custom, action: 'reply' });
    assert.match(edited.messages[0].content, /通用补充[\s\S]+聊天补充/);
    assert.doesNotMatch(edited.messages[0].content, /社交补充|<\/?PHONE_PRESET>/);
    const disabled = await buildContext({ ...input, settings: { ...custom, presetEnabled: false }, action: 'reply' });
    assert.equal(disabled.sources[0].name, '手机输出协议');
    assert.deepEqual(modules(disabled), ['OUTPUT']);
    assert.match(disabled.messages[0].content, /只输出 JSON/);
    assert.doesNotMatch(disabled.messages[0].content, /通用补充|聊天补充/);
    assert.ok(disabled.sources.some(source => source.group === 'story' && source.content.includes('已经约定')));
});

test('social history requests allow earlier publication dates while keeping the configured RP time unchanged', async () => {
    const chat = [reply('今天回到家。')];
    const settings = { ...setting, rpTime: '2030-06-15 18:00' };
    const input = { context: { name1: player.name }, scope: 'a', chat, trail: lineage(chat), settings, person: actor, people,
        members: [PLAYER, actor.id], memory: { states: [], older: [], recent: [] }, valid: () => true };
    const pack = await buildContext({ ...input, action: 'post', platform: '小红书' });
    const task = pack.sources.find(source => source.group === 'task').content;
    assert.match(task, /可包含历史动态/);
    assert.match(task, /当前 RP 时间：2030-06-15 18:00/);
    assert.equal(settings.rpTime, '2030-06-15 18:00');
    const chatPack = await buildContext({ ...input, action: 'reply' });
    assert.doesNotMatch(chatPack.sources.find(source => source.group === 'task').content, /动态可以发表于当前或过去/);
});

test('independent proxy keeps bearer in transport headers only and supports cancellation', async () => {
    assert.throws(() => connection({ base: 'http://example.test' }, 'secret'), /HTTPS/);
    assert.equal(connection({ base: 'https://example.test/v1/chat/completions' }, '').custom_url, 'https://example.test/v1');
    assert.throws(() => parseReply('无法解析', 'reply'), /JSON/);
    let request;
    const transport = new Transport({ document: { baseURI: 'https://tavern.test/' }, fetch: (url, options) => {
        request = { url, options };
        return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
    } });
    transport.token = 'test-secret';
    const pending = transport.execute({ ...setting, apiMode: 'custom', base: 'https://example.test/v1', model: 'test' }, { getRequestHeaders: () => ({}) }, [{ role: 'user', content: '只发送正文内容' }]);
    const body = JSON.parse(request.options.body);
    assert.equal(request.url.hostname, 'tavern.test');
    assert.doesNotMatch(JSON.stringify(body.messages), /test-secret/);
    assert.equal(JSON.parse(body.custom_include_headers).Authorization, 'Bearer test-secret');
    transport.cancel();
    await assert.rejects(pending, /已取消/);
    assert.equal(transport.job, null);
});

test('social screen imports named platform accounts, media and NPC replies without contacts', async () => {
    for (const platform of ['朋友圈', '小红书', '抖音', '微博']) {
        const mes = `<social platform="${platform}" name="Louis"><s-text>修好 &lt;新发型&gt; &amp; 休息</s-text><s-gallery><s-image>理发店门口</s-image><s-image src="https://example.com/photo.jpg">自拍</s-image></s-gallery><s-avatar src="https://example.com/avatar.jpg"></s-avatar><s-location>回屿巷</s-location><s-stats><s-count kind="点赞">1.2万+</s-count></s-stats><s-comments count="18"><s-comment name="苏窈">谁剪的！</s-comment><s-comment name="Louis" reply="苏窈">有人监工</s-comment></s-comments></social>`;
        const chat = [reply(mes)];
        const ledger = ledgerFixture();
        const args = { ledger, scope: 'social-screen', chat, trail: lineage(chat), people, groups: [], settings: setting, valid: () => true };
        await reconcileStories(args);
        const records = [...ledger.records.values()];
        const post = records.find(row => row.kind === 'post');
        assert.equal(post.speaker, 'Louis');
        assert.equal(post.text, '修好 <新发型> & 休息');
        assert.equal(post.payload.media.length, 2);
        assert.equal(post.payload.avatar, 'https://example.com/avatar.jpg');
        assert.equal(post.payload.commentCount, '18');
        assert.equal(post.payload.counts[0].text, '1.2万+');
        const comments = records.filter(row => row.kind === 'comment');
        assert.deepEqual(comments.map(row => row.speaker), ['苏窈', 'Louis']);
        assert.equal(comments[1].quote, '苏窈');
        assert.equal(comments[0].target, post.reference);
        assert.ok(post.audience.includes(comments[0].speakerId));
        await reconcileStories(args);
        assert.equal(ledger.records.size, 3);
        assert.equal(people.length, 2);
    }
});

test('social screen keeps unknown totals absent and accepts count-only interactions and known reposts', () => {
    const [post] = parseStory(reply('<social platform="微博" name="陌生账号"><s-repost name="原作者">已知原文</s-repost><s-stats><s-count kind="评论">2万</s-count></s-stats></social>'), people, setting);
    assert.equal(post.payload.repostName, '原作者');
    assert.equal(post.payload.commentCount, undefined);
    assert.deepEqual(post.payload.comments, []);
    assert.equal(post.text, '已知原文');
    assert.equal(parseStory(reply('<social platform="朋友圈" name="Louis"><s-text>修好</s-text><s-comments><s-comment name="路人" reply="不存在">好看</s-comment></s-comments></social>'), people, setting)[1].quote, '');
});

test('social screen ignores platform mentions, missing authors and unsupported platforms', () => {
    for (const mes of ['Louis刷着朋友圈，提了一句微博。', '<social platform="朋友圈"><s-text>未知作者</s-text></social>', '<social platform="未知平台" name="Louis"><s-text>不分流</s-text></social>']) {
        assert.deepEqual(parseStory(reply(mes), people, setting), []);
    }
});

test('social nickname binds Louis to 明玉 while preserving screen names and private identity', async () => {
    const { socialNickname } = require('../src/domain.cjs');
    const identities = [{ id: PLAYER, name: '明玉', avatar: 'persona.jpg' }, actor];
    const config = phoneSettings({ socialAliases: 'Louis=明玉\nVivian=顾砚卿' });
    const row = reply('<social platform="朋友圈" name="Louis"><s-text>修好</s-text><s-comments><s-comment name="Vivian">好看</s-comment><s-comment name="Louis" reply="Vivian">谢谢</s-comment></s-comments></social>');
    const items = parseStory(row, identities, config);
    assert.equal(items[0].speakerId, PLAYER);
    assert.equal(items[0].speaker, 'Louis');
    assert.equal(items[1].speakerId, actor.id);
    assert.equal(items[2].speakerId, PLAYER);
    assert.equal(socialNickname(identities[0], config), 'Louis');
    assert.equal(socialNickname(actor, config), 'Vivian');
    assert.equal(socialNickname(actor, phoneSettings({ socialAliases: '' })), actor.name);
    const ledger = ledgerFixture();
    const chat = [row];
    const args = { ledger, scope: 'alias-test', chat, trail: lineage(chat), people: identities, groups: [], settings: { ...config, socialAliases: '' }, valid: () => true };
    const beforeParser = await reconcileStories(args);
    const afterParser = await reconcileStories({ ...args, settings: config });
    assert.notEqual(afterParser, beforeParser);
    assert.equal([...ledger.records.values()].find(item => item.parser === afterParser && item.kind === 'post').speakerId, PLAYER);
});


test('disabled posts and reference-linked comments never enter a new handoff even with stale sync flags', async () => {
    const chat = [reply('前情')]; const ledger = ledgerFixture();
    const scope = 'sync-disabled';
    const post = message(scope, chat, { kind: 'post', thread: 'redbook', text: '误开启的帖子' }); post.reference = 'source-post';
    const comment = message(scope, chat, { kind: 'comment', thread: 'redbook', target: post.reference, text: '此前排队的评论' });
    const other = message(scope, chat, { text: '仍需同步的私聊' });
    await ledger.write([post, comment, other], [{ key: `${scope}:prefs`, value: { postSync: { [post.id]: false } } }]);
    const state = { context: { saveChat: async () => {} }, scope, chat, settings: setting };
    const sync = new Sync({ ledger, getState: () => state, onError: assert.fail, onChange() {} });
    sync.begin('normal'); chat.push(user('继续')); await sync.sent(chat.length - 1);
    assert.deepEqual(handoffs(chat.at(-1).mes)[0].events.map(event => event.id), [other.id]);
});

test('a post disabled during the pending read is rechecked before writing the native user message', async () => {
    const chat = [reply('前情')]; const ledger = ledgerFixture(); const scope = 'sync-race';
    const post = message(scope, chat, { kind: 'post', thread: 'redbook', text: '刚刚关闭' });
    await ledger.write([post]);
    const query = ledger.query; let changed = false;
    ledger.query = async (...args) => {
        const result = await query(...args);
        if (!changed && args[1].origin === 'phone') {
            changed = true;
            await ledger.write([], [{ key: `${scope}:prefs`, value: { postSync: { [post.id]: false } } }]);
        }
        return result;
    };
    let saves = 0;
    const state = { context: { saveChat: async () => { saves++; } }, scope, chat, settings: setting };
    const sync = new Sync({ ledger, getState: () => state, onError: assert.fail, onChange() {} });
    sync.begin('normal'); chat.push(user('这一轮不带帖子')); await sync.sent(chat.length - 1);
    assert.equal(chat.at(-1).mes, '这一轮不带帖子'); assert.equal(saves, 0);
});

test('turning a post off preserves existing history and blocks late generated comments in subsequent rounds', async () => {
    const chat = [reply('前情')]; const ledger = ledgerFixture(); const scope = 'sync-history';
    const post = message(scope, chat, { kind: 'post', thread: 'redbook', text: '已经写入过的帖子' });
    await ledger.write([post]);
    const state = { context: { saveChat: async () => {} }, scope, chat, settings: setting };
    const sync = new Sync({ ledger, getState: () => state, onError: assert.fail, onChange() {} });
    sync.begin('normal'); chat.push(user('首次交接')); await sync.sent(chat.length - 1);
    const historical = chat.at(-1).mes;
    await ledger.write([message(scope, chat, { kind: 'comment', thread: 'redbook', target: post.id, text: '关闭后才返回的评论' })], [{ key: `${scope}:prefs`, value: { postSync: { [post.id]: false } } }]);
    sync.begin('normal'); chat.push(user('关闭后的新一轮')); await sync.sent(chat.length - 1);
    assert.equal(chat.at(-2).mes, historical); assert.equal(chat.at(-1).mes, '关闭后的新一轮');
});


test('handoff echoes keep the original sticker and messages while suppressing existing imported copies', async () => {
    const { serializeHandoff, digest, clip } = require('../src/domain.cjs');
    const { parserRevision } = require('../src/sync.cjs');
    const { STICKERS } = require('../src/media.cjs');
    const ledger = ledgerFixture(); const scope = 'message-echo'; const chat = [reply('前情')];
    const originals = [
        message(scope, chat, { speakerId: PLAYER, text: '小狗得志', rpTime: '2026年11月28日 19:46', payload: { components: [{ type: 'sticker', text: '小狗得志', fields: { name: '小狗得志', src: STICKERS['小狗得志'] } }] } }),
        message(scope, chat, { speakerId: PLAYER, text: '偷情吗，美女', rpTime: '2026年11月28日 19:46' }),
        message(scope, chat, { speakerId: PLAYER, text: '今晚老婆不在家', rpTime: '2026年11月28日 19:46' }),
    ];
    await ledger.write(originals);
    chat.push(user('继续\n' + serializeHandoff(originals, 12000, 'echo-batch').block));
    chat.push(reply('<chat owner="user" peer="char"><im sender="user" time="19:46"><sticker name="小狗得志"/></im><im sender="user" time="19:46">偷情吗，美女</im><im sender="user" time="19:46">今晚老婆不在家</im><im sender="char" time="19:47">你又来闹我。</im></chat>'));
    const raw = chat.at(-1).mes; const trail = lineage(chat); const parser = parserRevision(setting, people);
    // Seed the cache produced by the previous importer to verify upgrade repair.
    const oldCopies = parseStory(chat.at(-1), people, setting).filter(item => item.speakerId === PLAYER).map(item => makeEvent(scope, trail, item, people, { id: `st:${parser}:${before(trail).key}:${digest(JSON.stringify(item))}`, origin: 'tavern', floor: 2, anchor: before(trail), parser, sync: false, reference: clip(item.reference, 120) }));
    await ledger.write(oldCopies);
    const input = { ledger, scope, chat, trail, people, groups: [], settings: setting, valid: () => true };
    assert.equal(await reconcileStories(input), parser);
    const visible = [...ledger.records.values()].filter(row => active(row, trail) && !row.echoOf);
    assert.equal(visible.length, 4); assert.equal(visible.filter(row => row.origin === 'phone').length, 3);
    assert.equal(visible.filter(row => row.origin === 'tavern')[0].text, '你又来闹我。');
    for (const source of originals) assert.equal(await ledger.get(scope, source.id), source);
    for (const copy of oldCopies) assert.ok((await ledger.get(scope, copy.id)).echoOf);
    assert.equal(chat.at(-1).mes, raw);
    await reconcileStories(input);
    assert.equal([...ledger.records.values()].filter(row => active(row, trail) && !row.echoOf).length, 4);
});

test('echo matching preserves actual repeated sends, new replies and messages in a later narrative turn', async () => {
    const { serializeHandoff } = require('../src/domain.cjs');
    const ledger = ledgerFixture(); const scope = 'repeat-not-echo'; const chat = [reply('前情')];
    const originals = [message(scope, chat, { speakerId: PLAYER, text: '在吗' }), message(scope, chat, { speakerId: PLAYER, text: '在吗' })];
    await ledger.write(originals);
    chat.push(user('继续\n' + serializeHandoff(originals, 12000, 'repeat-batch').block));
    chat.push(reply('<chat owner="user" peer="char"><im sender="user">在吗</im><im sender="char">在吗</im></chat>'));
    chat.push(user('后来又发了一条'));
    chat.push(reply('<chat owner="user" peer="char"><im sender="user">在吗</im></chat>'));
    const trail = lineage(chat);
    await reconcileStories({ ledger, scope, chat, trail, people, groups: [], settings: setting, valid: () => true });
    const visible = [...ledger.records.values()].filter(row => active(row, trail) && !row.echoOf);
    assert.equal(visible.filter(row => row.origin === 'phone').length, 2);
    assert.equal(visible.filter(row => row.origin === 'tavern' && row.speakerId === actor.id).length, 1);
    assert.equal(visible.filter(row => row.origin === 'tavern' && row.speakerId === PLAYER).length, 1);
});

test('the same text at another explicit time, for another recipient or in another scope is not suppressed', async () => {
    const { serializeHandoff } = require('../src/domain.cjs');
    const ledger = ledgerFixture(); const scope = 'echo-boundaries'; const chat = [reply('前情')];
    const original = message(scope, chat, { speakerId: PLAYER, text: '在吗', rpTime: '19:46' });
    await ledger.write([original]);
    chat.push(user('继续\n' + serializeHandoff([original], 12000, 'boundary-batch').block));
    chat.push(reply('<chat owner="user" peer="char"><im sender="user" time="20:00">在吗</im><im sender="user" time="19:46">在吗</im></chat><chat owner="user" peer="宋悦"><im sender="user" time="19:46">在吗</im></chat>'));
    const allPeople = [...people, witness]; const trail = lineage(chat);
    await reconcileStories({ ledger, scope, chat, trail, people: allPeople, groups: [], settings: setting, valid: () => true });
    assert.equal([...ledger.records.values()].filter(row => row.origin === 'tavern' && row.scope === scope && !row.echoOf).length, 2);
    await reconcileStories({ ledger, scope: 'other-scope', chat, trail, people: allPeople, groups: [], settings: setting, valid: () => true });
    assert.equal([...ledger.records.values()].filter(row => row.scope === 'other-scope' && !row.echoOf).length, 3);
});
