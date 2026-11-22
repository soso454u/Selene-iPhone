const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseReply, filterPlayerComments } = require('../src/api.cjs');
const { phonePrompt, DEFAULT_PRESET, PLATFORM_RULES, postCounts, SOCIAL_COMMON_PROMPT, cleanPlatformPrompts, SOCIAL_TIME_RULE, LEGACY_SOCIAL_DEFAULTS } = require('../src/phone-preset.cjs');
const { CardStyles, STYLE_FIELD, styleValues, boundStyle } = require('../src/card-style.cjs');
const { Resources } = require('../src/resources.cjs');
const { ImageService } = require('../src/image-service.cjs');
const { Photos } = require('../src/photos.cjs');
const { PLAYER } = require('../src/domain.cjs');
const { phoneSettings } = require('../src/context.cjs');
const ledger = () => { const values = new Map(); return { values, readMeta: async key => values.get(key), saveMeta: async (key, value) => values.set(key, structuredClone(value)), write: async (_, rows) => rows.forEach(row => values.set(row.key, structuredClone(row.value))) }; };

test('a generated player comment is removed without discarding valid posts or other comments', () => {
    const result = parseReply(JSON.stringify({ posts: [
        { text: '顾砚卿发布的近况', payload: { comments: [{ id: 'user', nickname: '沈令仪', text: '模型不应替玩家写这句' }, { id: 'friend', nickname: '熟人甲', text: '正常评论' }] } },
        { text: '第二条动态', payload: { comments: [{ id: 'reader', nickname: ' 沈令仪 ', text: '也应过滤' }, { id: '{{USER}}', nickname: '其他称呼', text: '伪装玩家 ID' }] } },
    ] }), 'post', 3);
    const posts = result.posts.map(post => ({ ...post, payload: { ...post.payload, comments: filterPlayerComments(post.payload.comments, ['沈令仪']) } }));
    assert.equal(posts.length, 2);
    assert.equal(posts[0].text, '顾砚卿发布的近况');
    assert.deepEqual(posts[0].payload.comments.map(row => row.nickname), ['熟人甲']);
    assert.deepEqual(posts[1].payload.comments, []);
});

test('one batch protocol preserves each post payload and rejects extra or malformed posts', () => {
    const posts = Array.from({ length: 5 }, (_, i) => ({ text: `动态${i}`, payload: { title: `标题${i}`, media: Array.from({ length: [0, 1, 3, 2, 9][i] }, (_, image) => ({ type: 's-image', text: `画面${i}-${image}` })) } }));
    assert.deepEqual(parseReply(JSON.stringify({ posts }), 'post', 5).posts.map(row => row.payload.title), posts.map(row => row.payload.title));
    assert.deepEqual(parseReply(JSON.stringify({ posts }), 'post', 5).posts.map(row => row.payload.media.length), [0, 1, 3, 2, 9]);
    assert.deepEqual(parseReply(JSON.stringify({ messages: [posts[2].text], payload: posts[2].payload }), 'post').payload.media, posts[2].payload.media);
    assert.throws(() => parseReply(JSON.stringify({ posts }), 'post', 3), /批量动态格式/);
    assert.throws(() => parseReply('{"posts":[{"text":null}]}', 'post', 5), /批量动态格式/);
    assert.equal(parseReply('{"posts":[]}', 'post', 5).posts.length, 0);
    assert.deepEqual(parseReply('{"messages":["原单条"]}', 'post').messages, ['原单条']);
    const prompt = phonePrompt(DEFAULT_PRESET, { enabled: true, post: true, platform: 'X', postCount: 5 }).text;
    assert.match(prompt, /只在这一次请求/); assert.match(prompt, /"posts"/);
    assert.match(prompt, /由发言角色.*自行决定/);
    assert.match(phonePrompt('', { enabled: false, post: true, platform: '小红书' }).text, /动态条数与每条配图张数彼此独立/);
});

test('social generation selects the current platform rules and preserves seven X posts with independent media counts', () => {
    for (const [platform, rule] of Object.entries(PLATFORM_RULES)) {
        const text = phonePrompt(DEFAULT_PRESET, { enabled: true, post: true, platform, postCount: platform === 'X' ? 7 : 3 }).text;
        assert.ok(text.includes(rule.text));
        for (const [other, foreign] of Object.entries(PLATFORM_RULES)) if (other !== platform) assert.ok(!text.includes(foreign.text));
        assert.match(text, /配几张（0–9 张）/);
    }
    assert.deepEqual(postCounts('X'), [5, 6, 7]);
    assert.deepEqual(postCounts('小红书'), [1, 3, 5]);
    const prompt = phonePrompt(DEFAULT_PRESET, { enabled: true, post: true, platform: 'X', postCount: 7 }).text;
    assert.match(prompt, /生成 5–7 条/);
    assert.match(prompt, /每条通常 1—2 句/);
    const chat = phonePrompt(DEFAULT_PRESET, { enabled: true, post: false }).text;
    for (const rule of Object.values(PLATFORM_RULES)) assert.ok(!chat.includes(rule.text));
    const posts = Array.from({ length: 7 }, (_, i) => ({ text: `短帖${i}`, payload: { handle: '@night_notes', media: Array.from({ length: i % 4 }, (_, j) => ({ type: 's-image', text: `配图${j}` })) } }));
    const parsed = parseReply(JSON.stringify({ posts }), 'post', 7).posts;
    assert.equal(parsed.length, 7);
    assert.deepEqual(parsed.map(post => post.payload.media.length), [0, 1, 2, 3, 0, 1, 2]);
    assert.ok(parsed.every(post => post.payload.handle === '@night_notes'));
});

test('editable common and per-platform prompts persist, replace built-ins, stay out of chat, and restore defaults', () => {
    const saved = phoneSettings({ socialCommonPrompt: '所有帖子像真人，自然简体中文', platformPrompts: { redbook: '自定义小红书：朴素记录', x: '自定义 X：冷幽默', unrelated: '不应保留' } });
    const reloaded = phoneSettings(JSON.parse(JSON.stringify(saved)));
    assert.deepEqual(reloaded.platformPrompts, { redbook: '自定义小红书：朴素记录', x: '自定义 X：冷幽默' });
    for (const [platform, key] of [['小红书', 'redbook'], ['X', 'x']]) {
        const text = phonePrompt(DEFAULT_PRESET, { enabled: true, post: true, platform, commonPrompt: reloaded.socialCommonPrompt, platformPrompts: reloaded.platformPrompts }).text;
        assert.ok(text.includes(reloaded.socialCommonPrompt)); assert.ok(text.includes(reloaded.platformPrompts[key]));
        assert.ok(!text.includes(PLATFORM_RULES[platform].text));
    }
    const chat = phonePrompt(DEFAULT_PRESET, { enabled: true, post: false, commonPrompt: reloaded.socialCommonPrompt, platformPrompts: reloaded.platformPrompts }).text;
    assert.ok(!chat.includes(reloaded.socialCommonPrompt)); assert.ok(!chat.includes(reloaded.platformPrompts.x));
    assert.deepEqual(cleanPlatformPrompts({ x: PLATFORM_RULES.X.text, redbook: '  ' }), {});
    assert.equal(phoneSettings({ socialCommonPrompt: '' }).socialCommonPrompt, SOCIAL_COMMON_PROMPT);
    assert.throws(() => cleanPlatformPrompts({ x: 'x'.repeat(16001) }, true), /提示词/);
    assert.throws(() => cleanPlatformPrompts({ forum: 'bad\0text' }, true), /提示词/);
});

test('single and batch social replies preserve validated simulated comments instead of dropping the comment section', () => {
    const comments = Array.from({ length: 15 }, (_, i) => ({ id: `visitor_${i}`, nickname: `路过${i}`, text: `评论${i}`, quote: i ? '上一条观点' : '' }));
    const payload = { title: '帖子', comments };
    assert.deepEqual(parseReply(JSON.stringify({ messages: ['正文'], payload }), 'post').payload.comments, comments);
    assert.deepEqual(parseReply(JSON.stringify({ posts: [{ text: '正文', payload }] }), 'post', 3).posts[0].payload.comments, comments);
    assert.deepEqual(parseReply(JSON.stringify({ messages: ['正文'], comments }), 'post').payload.comments, comments);
    assert.deepEqual(parseReply(JSON.stringify({ posts: [{ text: '正文', comments }] }), 'post', 3).posts[0].payload.comments, comments);
    assert.deepEqual(parseReply(JSON.stringify({ comments }), 'comments').comments, comments);
    assert.throws(() => parseReply('{"comments":[]}', 'comments'), /未返回评论/);
    const commentPrompt = phonePrompt(DEFAULT_PRESET, { enabled: true, post: true, commentsOnly: true, platform: '微博' }).text;
    assert.match(commentPrompt, /仅为指定原帖生成/);
    assert.match(commentPrompt, /"comments"/);
    for (const invalid of [[{ nickname: '', text: '无昵称' }], [{ nickname: '路人', text: 'x'.repeat(501) }], Array(41).fill(comments[0])]) {
        assert.throws(() => parseReply(JSON.stringify({ messages: ['正文'], payload: { comments: invalid } }), 'post'), /评论/);
    }
});

test('historical social timestamps survive parsing independently for posts and comments without affecting chat rules', () => {
    const payload = { title: '旧记录', postedAt: '一年前', comments: [{ id: 'visitor', nickname: '路人', text: '后来怎么样了', postedAt: '昨天' }] };
    const single = parseReply(JSON.stringify({ messages: ['旧帖'], payload }), 'post');
    assert.equal(single.payload.postedAt, '一年前');
    assert.equal(single.payload.comments[0].postedAt, '昨天');
    const posts = parseReply(JSON.stringify({ posts: [{ text: '旧帖', payload }, { text: '新帖', payload: { postedAt: '今天' } }] }), 'post', 3).posts;
    assert.deepEqual(posts.map(post => post.payload.postedAt), ['一年前', '今天']);
    for (const postedAt of [123, 'x'.repeat(81)]) assert.throws(() => parseReply(JSON.stringify({ messages: ['旧帖'], payload: { postedAt } }), 'post'), /发布时间/);
    for (const platform of Object.keys(PLATFORM_RULES)) {
        const prompt = phonePrompt(DEFAULT_PRESET, { enabled: true, post: true, platform }).text;
        assert.ok(prompt.includes(SOCIAL_TIME_RULE));
        assert.match(prompt, /甚至一年前/);
    }
    assert.ok(!phonePrompt(DEFAULT_PRESET, { enabled: true, post: false }).text.includes(SOCIAL_TIME_RULE));
});

test('new social defaults retain the selected batch limits and at least fifteen total comments while migrating only unchanged prompts', async () => {
    const restored = phoneSettings({ socialCommonPrompt: LEGACY_SOCIAL_DEFAULTS.common, platformPrompts: { x: LEGACY_SOCIAL_DEFAULTS.platforms.X, redbook: '我的小红书规则' } });
    assert.equal(restored.socialCommonPrompt, SOCIAL_COMMON_PROMPT);
    assert.deepEqual(restored.platformPrompts, { redbook: '我的小红书规则' });
    const edited = phoneSettings({ socialCommonPrompt: LEGACY_SOCIAL_DEFAULTS.common + '\n我的补充' });
    assert.ok(edited.socialCommonPrompt.includes('我的补充'));
    for (const [platform, rule] of Object.entries(PLATFORM_RULES)) {
        const prompt = phonePrompt(DEFAULT_PRESET, { enabled: true, post: true, platform, postCount: platform === 'X' ? 6 : 3 }).text;
        assert.equal(prompt.split('[SOCIAL_COMMON]').length - 1, 1);
        assert.equal(prompt.split(rule.text).length - 1, 1);
        assert.match(prompt, /评论合计至少 15 条/);
        assert.ok(!prompt.includes(LEGACY_SOCIAL_DEFAULTS.common));
        for (const [other, foreign] of Object.entries(PLATFORM_RULES)) if (other !== platform) assert.ok(!prompt.includes(foreign.text));
        assert.match(prompt, platform === 'X' ? /生成 0–6 条/ : /生成 0–3 条/);
    }
    assert.deepEqual(postCounts('X'), [5, 6, 7]);
    assert.deepEqual(postCounts('小红书'), [1, 3, 5]);
    const { fingerprint } = require('../src/resources.cjs');
    const { styleValues } = require('../src/card-style.cjs');
    const old = { ...styleValues(), socialCommonPrompt: LEGACY_SOCIAL_DEFAULTS.common };
    const card = { avatar: 'legacy.png', data: { extensions: { [STYLE_FIELD]: { format: 'tavern-pocket-style', version: 1, settings: old } } } };
    const store = ledger();
    store.values.set('card-style:migration:legacy.png', { stamp: fingerprint(old), values: { ...old, wallpaper: 'peach', platformPrompts: { x: '我自己的 X 规则' } } });
    const styles = new CardStyles(store, 'migration'); await styles.load(card);
    assert.equal(styles.values(card).wallpaper, 'peach');
    assert.equal(styles.values(card).socialCommonPrompt, SOCIAL_COMMON_PROMPT);
    assert.equal(styles.values(card).platformPrompts.x, '我自己的 X 规则');
});

test('card binding embeds local backgrounds and round-trips only portable styling, preserving unrelated extensions', async () => {
    const store = ledger(); store.values.set('background:wall', { data: 'data:image/png;base64,YQ==' });
    const card = { avatar: 'a.png', name: '角色甲', data: { extensions: { regex_scripts: ['original'], unrelated: 'keep' } } };
    let server = structuredClone(card);
    const resources = { context: { characters: [card], characterId: 0 }, host: { document: {} }, request: async (path, body) => {
        if (path === 'characters/get') return structuredClone(server);
        assert.equal(path, 'characters/merge-attributes');
        assert.deepEqual(Object.keys(body.data.extensions), [STYLE_FIELD]);
        Object.assign(server.data.extensions, body.data.extensions);
    } };
    const styles = new CardStyles(store, 'account');
    await styles.load(card);
    await styles.bind(resources, card, { theme: 'dark', platformPrompts: { forum: '角色绑定的论坛规则' }, socialCommonPrompt: '角色绑定的通用规则', pageBackgrounds: { chat: { preset: 'image', image: 'asset:wall' } }, customStickers: [{ name: '表情', url: 'https://example.test/sticker.png' }], secret: 'KEY', apiProfiles: [{ id: 'key', name: 'private', values: { base: 'https://private.test' } }], userAvatar: 'private-avatar' });
    const packed = server.data.extensions[STYLE_FIELD];
    assert.equal(packed.settings.platformPrompts.forum, '角色绑定的论坛规则');
    assert.equal(packed.settings.socialCommonPrompt, '角色绑定的通用规则');
    assert.equal(packed.settings.pageBackgrounds.chat.image, 'data:image/png;base64,YQ==');
    assert.doesNotMatch(JSON.stringify(packed), /KEY|private-avatar|private\.test|apiProfiles/);
    assert.deepEqual(server.data.extensions.regex_scripts, ['original']);
    assert.equal(server.data.extensions.unrelated, 'keep');
    const reload = new CardStyles(store, 'account'); await reload.load(card);
    assert.equal(reload.values(card).theme, 'dark');
    assert.equal(reload.values({ avatar: 'b.png', data: {} }), null);
    await reload.saveLocal(card, styleValues()); assert.equal(reload.values(card).theme, 'auto');
});

test('card binding reads through JSON export when the get route returns HTML and stops if the character switches', async () => {
    const stored = { name: '角色甲', data: { extensions: { unrelated: 'keep' } } };
    const card = { ...structuredClone(stored), avatar: 'a.png', json_data: '<!DOCTYPE html>' };
    const context = { characters: [card, { avatar: 'b.png' }], characterId: 0, getRequestHeaders: () => ({}) };
    const calls = [];
    let switchOnRead = false;
    const resources = new Resources({
        location: { href: 'https://tavern.test/chat' }, document: { baseURI: 'https://static.test/phone/' },
        fetch: async (url, options) => {
            assert.equal(url.origin, 'https://tavern.test');
            const route = url.pathname.split('/').at(-1);
            calls.push(route);
            const body = JSON.parse(options.body);
            assert.equal(body.avatar_url ?? body.avatar, card.avatar);
            if (route === 'get') return new Response('<!DOCTYPE html><title>Unavailable</title>');
            if (route === 'export') {
                assert.equal(body.format, 'json');
                if (switchOnRead) context.characterId = 1;
                return Response.json(stored);
            }
            Object.assign(stored.data.extensions, body.data.extensions);
            return new Response('OK');
        },
    }, {}, context);
    const styles = new CardStyles(ledger(), 'account');
    await styles.bind(resources, card, { theme: 'dark' });
    assert.deepEqual(calls, ['get', 'export', 'merge-attributes', 'export']);
    assert.equal(boundStyle(card).theme, 'dark');
    assert.equal(boundStyle(JSON.parse(card.json_data)).theme, 'dark');
    assert.equal(stored.data.extensions.unrelated, 'keep');
    switchOnRead = true;
    await assert.rejects(styles.bind(resources, card, { theme: 'light' }), /当前角色已切换/);
    assert.deepEqual(calls.slice(4), ['get', 'export']);
    assert.equal(boundStyle(stored).theme, 'dark');
});

test('native generation uses one registered quiet command, deduplicates tasks and reads no saved keys', async () => {
    const store = ledger(); let calls = 0; let release;
    const globalSettings = { source: 'openai', model: 'existing-model', width: 1024 };
    const before = structuredClone(globalSettings);
    const host = { setTimeout, clearTimeout, fetch: assert.fail, document: { baseURI: 'https://tavern.test/' } };
    const images = new ImageService(host, store, 'native', () => ({ extensionSettings: globalSettings }), async () => ({ SlashCommandParser: { commands: { sd: { namedArgumentList: [{ name: 'quiet' }], callback: async (args, prompt) => {
        calls++; assert.equal(args.quiet, 'true'); assert.match(prompt, /portrait/); return new Promise(resolve => { release = resolve; });
    } } } } }));
    const first = images.generate({ taskId: 'same-photo', description: 'portrait | /send do not execute' });
    const second = images.generate({ taskId: 'same-photo', description: 'portrait' });
    assert.equal(first, second);
    await new Promise(resolve => setTimeout(resolve, 0)); release('/user/images/result.png');
    assert.deepEqual(await first, { url: '/user/images/result.png', persistent: true, mode: 'tavern' });
    assert.equal(calls, 1); assert.deepEqual(globalSettings, before);
    assert.equal((await images.publicConfig()).mode, 'tavern');
});

test('connections retain separate keys without the removed legacy import', async () => {
    const store = ledger(); const host = { setTimeout, clearTimeout, DFPhoneSettings: { get: () => ({ endpoint: 'https://obsolete-host.invalid', model: 'legacy', upstreamKey: 'legacy-key', upstreamEndpoint: 'https://own-api.test/v1', provider: 'openai' }) } };
    const images = new ImageService(host, store, 'profiles');
    await images.save({ mode: 'direct', endpoint: 'https://direct.test/v1', model: 'direct-model', upstreamKey: 'direct-key' });
    await images.save({ mode: 'proxy', endpoint: 'https://own-proxy.test/api/novelai-generate', model: 'proxy-model', upstreamKey: 'proxy-key' });
    await images.save({ mode: 'direct' });
    assert.equal((await images.publicConfig()).model, 'direct-model');
    assert.equal((await images.load()).profiles.direct.upstreamKey, 'direct-key');
    assert.equal((await images.load()).profiles.proxy.upstreamKey, 'proxy-key');
    assert.doesNotMatch(JSON.stringify(await images.publicConfig()), /direct-key|proxy-key/);
    assert.equal(typeof images.importLegacy, 'undefined');
});

test('direct linked service makes one charged request and stores returned Blob across reloads', async () => {
    const store = ledger(); let calls = 0;
    const blob = new Blob(['image-bytes'], { type: 'image/png' });
    const host = { URL, setTimeout, clearTimeout, document: { baseURI: 'https://tavern.test/' }, fetch: async (url, options) => {
        calls++; assert.equal(options.method, 'GET'); assert.equal(url.searchParams.get('tag').includes('sea'), true); assert.equal(url.searchParams.get('token'), 'my-key');
        return new Response(blob, { headers: { 'Content-Type': 'image/png' } });
    } };
    const images = new ImageService(host, store, 'direct');
    await images.save({ mode: 'direct', format: 'link', endpoint: 'https://own-api.test', upstreamKey: 'my-key' });
    const result = await images.generate({ description: 'sea' }); assert.equal(calls, 1); assert.ok(result.blob);
    const photos = new Photos(store, host); const image = await photos.save('scope', { ...result, ownerId: PLAYER });
    const meta = (await photos.list('scope'))[0]; assert.ok(meta.asset); assert.equal(meta.url, undefined);
    assert.ok((await store.readMeta(`photo:${meta.asset}`)).blob instanceof Blob);
    photos.close(); const reloaded = new Photos(store, host);
    assert.match((await reloaded.resolve(await reloaded.list('scope')))[0].url, /^blob:/);
    assert.equal(calls, 1); assert.equal((await photos.list('other')).length, 0); reloaded.close();
});

test('CORS failure does not retry generation or fall back to an image-tag request', async () => {
    let calls = 0; const images = new ImageService({ setTimeout, clearTimeout, fetch: async () => { calls++; throw new TypeError('Failed to fetch'); } }, ledger(), 'cors');
    await images.save({ mode: 'direct', format: 'link', endpoint: 'https://own-api.test', upstreamKey: 'my-key' });
    await assert.rejects(images.generate({ description: 'sea' }), /跨域/); assert.equal(calls, 1);
});

test('OpenAI and proxy generation use the configured endpoint once and accept base64', async () => {
    const requests = []; const host = { setTimeout, clearTimeout, document: { baseURI: 'https://tavern.test/' }, fetch: async (url, options) => {
        requests.push({ url: String(url), options, body: JSON.parse(options.body) }); return Response.json({ data: [{ b64_json: 'YQ==' }] });
    } };
    const images = new ImageService(host, ledger(), 'http');
    await images.save({ mode: 'direct', endpoint: 'https://api.example.test/v1', upstreamKey: 'own-key', model: 'image-model', openaiQuality: 'none' });
    assert.ok((await images.generate({ description: 'sea' })).blob);
    assert.equal(requests[0].url, 'https://api.example.test/v1/images/generations'); assert.equal(requests[0].body.n, 1); assert.equal(requests[0].options.headers.Authorization, 'Bearer own-key');
    await images.save({ mode: 'proxy', endpoint: 'https://my-backend.test/api/novelai-generate', provider: 'novelai', token: 'nai-own' });
    assert.ok((await images.generate({ description: 'sea' })).blob);
    assert.equal(requests.length, 2); assert.equal(requests[1].body.token, 'nai-own'); assert.equal(requests[1].body.openaiN, '1');
});

test('reaction counters respect cancellations and private collections retain their audience', () => {
    const { reactions } = require('../src/media.cjs');
    const { serializeHandoff } = require('../src/domain.cjs');
    const post = { id: 'post', speakerId: 'actor' };
    const rows = [
        { id: 'like', kind: 'like', target: 'post', speakerId: PLAYER, stamp: 1 },
        { id: 'unlike', kind: 'like', target: 'post', speakerId: PLAYER, stamp: 2, payload: { reactionActive: false } },
        { id: 'other', kind: 'like', target: 'post', speakerId: 'actor', stamp: 3 },
    ];
    assert.deepEqual(reactions(rows, post, 'like').map(row => row.id), ['other']);
    rows[1].deleted = true;
    assert.equal(reactions(rows, post, 'like').length, 2);
    const text = serializeHandoff([{ id: 'collect', kind: 'collect', text: '收藏了这条内容', speaker: '玩家', audienceNames: ['玩家'], names: ['玩家', '角色'] }], 2000).block;
    assert.match(text, /"知情范围":\["玩家"\]/);
});

test('automatic cloud save defaults on once and preserves a later explicit opt-out', () => {
    assert.equal(phoneSettings().autoCloud, true);
    const upgraded = phoneSettings({ autoCloud: false });
    assert.equal(upgraded.autoCloud, true);
    assert.equal(upgraded.autoCloudDefaultVersion, 1);
    const disabled = phoneSettings({ ...upgraded, autoCloud: false });
    assert.equal(disabled.autoCloud, false);
    assert.equal(phoneSettings(JSON.parse(JSON.stringify(disabled))).autoCloud, false);
});


test('social media protocol stays independent of custom social text and exact legacy cleanup', () => {
    const { SINGLE_IMAGE_RULE, cleanSocialCommonPrompt } = require('../src/phone-preset.cjs');
    const { promptFor } = require('../src/image-service.cjs');
    for (const platform of ['朋友圈', '小红书', '抖音', '微博', '论坛', 'X']) {
        const pack = phonePrompt(DEFAULT_PRESET, { enabled: true, post: true, platform, commonPrompt: '我的自定义规则' });
        assert.ok(!pack.text.includes(SINGLE_IMAGE_RULE)); assert.ok(pack.text.includes('我的自定义规则'));
        assert.match(pack.text, /fields.prompt/); assert.match(pack.text, /同一画面/);
    }
    const clean = cleanSocialCommonPrompt('自定义');
    assert.equal(cleanSocialCommonPrompt(clean), clean);
    assert.equal(cleanSocialCommonPrompt(`自定义\n${SINGLE_IMAGE_RULE}`), '自定义');
    assert.equal(cleanSocialCommonPrompt('【单张配图规则】我的自定义要求'), '【单张配图规则】我的自定义要求');
    assert.equal(promptFor({}, { prompt: 'wide shot, watercolor', description: '海边' }), 'wide shot, watercolor');
});

test('generated post images stay as source assets until explicitly saved to an album', async () => {
    const store = ledger(); const photos = new Photos(store, { URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} } });
    const asset = await photos.save('test', { ownerId: PLAYER, sourceId: 'post:1', index: 0, generated: true, inAlbum: false, url: '/image.png', persistent: true });
    assert.equal((await photos.list('test'))[0].inAlbum, false);
    const saved = await photos.save('test', { ...asset, inAlbum: true });
    assert.equal(saved.id, asset.id); assert.equal(saved.inAlbum, true); assert.equal((await photos.list('test')).length, 1);
});


test('character reference cards preserve multiline appearances and only match the pictured characters', () => {
    const { characterReferenceRows, promptFor } = require('../src/image-service.cjs');
    const rows = [{ name: '明玉', prompt: '棕色卷发\n眉心红痣' }, { name: '沈令仪', prompt: '黑发，白色外套' }];
    const encoded = JSON.stringify(rows);
    assert.deepEqual(characterReferenceRows(encoded), rows);
    const prompt = promptFor({ characterProfiles: encoded }, { character: '明玉', description: '理发店自拍' });
    assert.match(prompt, /棕色卷发\n眉心红痣/); assert.doesNotMatch(prompt, /白色外套/);
    assert.deepEqual(characterReferenceRows('明玉：棕色卷发\n眉心红痣\n沈令仪：黑发'), [{ name: '明玉', prompt: '棕色卷发\n眉心红痣' }, { name: '沈令仪', prompt: '黑发' }]);
});


test('regenerating a source replaces its unsaved cached version but keeps explicitly saved pictures', async () => {
    const photos = new Photos(ledger(), { URL: { createObjectURL() {}, revokeObjectURL() {} } });
    const input = { sourceId: 'post', ownerId: PLAYER, index: 0, generated: true, persistent: true };
    const saved = await photos.save('test', { ...input, url: '/saved.png', inAlbum: true });
    await photos.save('test', { ...input, url: '/old.png', inAlbum: false });
    const fresh = await photos.save('test', { ...input, url: '/new.png', inAlbum: false, replaceSource: true });
    const rows = await photos.list('test');
    assert.deepEqual(rows.map(row => row.id), [fresh.id, saved.id]);
});


test('native image requests use supplied prompts and references without a text-model conversion', async () => {
    const requests = [];
    const images = new ImageService({ setTimeout, clearTimeout }, ledger(), 'no-auto-translation', () => ({}), async () => ({ SlashCommandParser: { commands: { sd: { namedArgumentList: [{ name: 'quiet' }], callback: async (args, prompt) => {
        requests.push({ args, prompt }); return '/image.png';
    } } } } }));
    await images.save({ mode: 'tavern', characterProfiles: '沈令仪：棕色卷发', negativePrompt: '模糊' });
    images.translate = async () => assert.fail('Generating an image must never call a text translator');
    await images.generate({ prompt: 'back of head, brown curly hair, partial view', character: '沈令仪' });
    assert.ok(requests[0].prompt.startsWith('back of head, brown curly hair, partial view'));
    assert.match(requests[0].prompt, /沈令仪: 棕色卷发/);
    assert.equal(requests[0].args.negative, '模糊'); assert.equal(requests[0].args.quiet, 'true');
    await images.generate({ description: '窗边花束' });
    assert.equal(requests[1].prompt, '窗边花束'); assert.equal(requests.length, 2);
});

test('multiple named image prompt presets persist and switch only prompt fields', async () => {
    const store = ledger(); const images = new ImageService({}, store, 'prompt-presets');
    await images.save({ mode: 'direct', endpoint: 'https://image.test/v1', model: 'model', upstreamKey: 'private-key', characterProfiles: '角色：外貌', niniSteps: '40' });
    await images.savePromptPreset('动漫', { style: 'custom', customStyle: 'anime illustration', extraPrompt: 'best quality', negativePrompt: 'horror', upstreamKey: 'must-not-save' });
    await images.savePromptPreset('写实', { style: 'cinematic', extraPrompt: 'soft portrait', negativePrompt: 'painting' });
    const reloaded = new ImageService({}, store, 'prompt-presets');
    const config = await reloaded.publicConfig(); assert.equal(config.promptPresets.length, 2);
    assert.doesNotMatch(JSON.stringify(config.promptPresets), /private-key|must-not-save|https:/);
    const first = config.promptPresets.find(row => row.name === '动漫');
    await reloaded.applyPromptPreset(first.id);
    const after = (await reloaded.load()).profiles.direct;
    assert.equal(after.customStyle, 'anime illustration'); assert.equal(after.extraPrompt, 'best quality'); assert.equal(after.negativePrompt, 'horror');
    assert.equal(after.endpoint, 'https://image.test/v1'); assert.equal(after.model, 'model'); assert.equal(after.upstreamKey, 'private-key');
    assert.equal(after.characterProfiles, '角色：外貌'); assert.equal(after.niniSteps, '40');
    await reloaded.savePromptPreset('动漫', { style: 'soft', extraPrompt: 'updated' });
    assert.equal((await reloaded.publicConfig()).promptPresets.length, 2);
    await reloaded.deletePromptPreset(first.id);
    assert.equal((await reloaded.publicConfig()).promptPresets.length, 1);
    assert.equal((await reloaded.load()).profiles.direct.extraPrompt, 'updated');
    const fresh = await new ImageService({}, store, 'prompt-presets').publicConfig();
    assert.equal(fresh.promptPresets.some(row => row.id === first.id), false);
    assert.equal(fresh.activePromptPreset, '');
});

test('deleting an unsaved generated image removes only the selected stored version', async () => {
    const store = ledger(); const photos = new Photos(store, { URL: { createObjectURL() {}, revokeObjectURL() {} } });
    const first = await photos.save('test', { sourceId: 'post', generated: true, inAlbum: false, url: '/bad.png', persistent: true });
    const other = await photos.save('test', { sourceId: 'post', generated: true, inAlbum: false, url: '/keep.png', persistent: true });
    const saved = await photos.save('test', { url: '/saved.png', persistent: true });
    await photos.remove('test', first.id);
    assert.deepEqual((await photos.list('test')).map(row => row.id), [saved.id, other.id]);
    assert.deepEqual(await photos.list('other-chat'), []);
});


test('global image rules persist independently of connection modes, presets and defaults', async () => {
    const { DEFAULT_IMAGE_RULES } = require('../src/image-rules.cjs');
    const store = ledger(); const images = new ImageService({}, store, 'rules');
    assert.equal((await images.publicConfig()).imageRules, DEFAULT_IMAGE_RULES);
    const { LEGACY_IMAGE_RULES, LEGACY_PROMPT_WRITING_RULES } = require('../src/image-rules.cjs');
    const { configuration } = require('../src/image-service.cjs');
    assert.match(DEFAULT_IMAGE_RULES, /^<IMAGE_GENERATION_RULES>/);
    assert.ok(DEFAULT_IMAGE_RULES.endsWith('</IMAGE_GENERATION_RULES>'));
    assert.equal(configuration({ imageRules: LEGACY_PROMPT_WRITING_RULES }).imageRules, DEFAULT_IMAGE_RULES);
    assert.equal(configuration({ imageRules: LEGACY_PROMPT_WRITING_RULES + '\n我的自定义补充' }).imageRules, LEGACY_PROMPT_WRITING_RULES + '\n我的自定义补充');
    assert.equal(configuration({ imageRules: LEGACY_IMAGE_RULES }).imageRules, DEFAULT_IMAGE_RULES);
    assert.equal(configuration({ imageRules: LEGACY_IMAGE_RULES + '\n我的自定义补充' }).imageRules, LEGACY_IMAGE_RULES + '\n我的自定义补充');

    const rules = '用户画面规则\n' + 'long content '.repeat(1000);
    await images.save({ imageRules: rules, mode: 'direct', upstreamKey: 'private', characterProfiles: '明玉：brown hair' });
    await images.savePromptPreset('test', { extraPrompt: 'watercolor', imageRules: 'must not override' });
    await images.save({ mode: 'proxy' });
    await images.applyPromptPreset((await images.publicConfig()).promptPresets[0].id);
    const reload = new ImageService({}, store, 'rules');
    assert.equal((await reload.publicConfig()).imageRules, rules);
    assert.equal((await reload.load()).profiles.direct.upstreamKey, 'private');
    await reload.save({ imageRules: DEFAULT_IMAGE_RULES });
    assert.equal((await new ImageService({}, store, 'rules').publicConfig()).imageRules, DEFAULT_IMAGE_RULES);
});

test('scene rules reach social text generation but not comments or chat requests', async () => {
    const { buildContext } = require('../src/context.cjs');
    const { lineage } = require('../src/domain.cjs');
    const actor = { id: 'actor', name: '明玉' }; const player = { id: PLAYER, name: '玩家' };
    const input = { context: { name1: '玩家' }, scope: 'rules', chat: [], trail: lineage([]), settings: { ...phoneSettings(), lore: false, dynamic: false }, person: actor, people: [player, actor], members: [PLAYER, actor.id], memory: { states: [], older: [], recent: [] }, valid: () => true, imageRules: 'CUSTOM_SCENE_RULE', platform: '小红书' };
    const post = await buildContext({ ...input, action: 'post' });
    assert.ok(post.messages.some(row => row.role === 'system' && row.content.includes('CUSTOM_SCENE_RULE')));
    assert.ok(post.messages.some(row => row.content.includes('fields.prompt')));
    const draft = await buildContext({ ...input, action: 'imagePrompt' });
    assert.ok(draft.messages.some(row => row.content.includes('CUSTOM_SCENE_RULE')));
    assert.ok(draft.messages.some(row => row.content.includes('只为用户准备一张图片的文字草稿')));
    assert.equal(draft.messages.some(row => row.content.includes('回应当前会话')), false);
    for (const action of ['comments', 'reply']) {
        const pack = await buildContext({ ...input, action });
        assert.equal(pack.messages.some(row => row.content.includes('CUSTOM_SCENE_RULE')), false);
    }
});

test('English prompts stay unchanged with Chinese negatives and references match whole identities', async () => {
    const { promptFor } = require('../src/image-service.cjs');
    const refs = JSON.stringify([{ name: 'Ann', prompt: 'red hair' }, { name: 'Anna', prompt: 'black hair' }, { name: '玉', prompt: 'green eyes' }]);
    const matched = promptFor({ characterProfiles: refs }, { description: 'Anna walking', character: '玉' });
    assert.match(matched, /black hair/); assert.match(matched, /green eyes/); assert.doesNotMatch(matched, /red hair/);
    assert.doesNotMatch(promptFor({ characterProfiles: refs }, { description: '玉兰花' }), /green eyes/);
    assert.doesNotMatch(promptFor({ characterProfiles: refs }, { description: 'zAnnz, Joanna' }), /red hair|black hair/);
    const pair = promptFor({ characterProfiles: refs }, { description: 'Ann and Anna face each other' });
    assert.match(pair, /Ann: red hair/); assert.match(pair, /Anna: black hair/);
    let finalPrompt;
    const images = new ImageService({ setTimeout, clearTimeout }, ledger(), 'fragments', () => ({}), async () => ({ SlashCommandParser: { commands: { sd: { namedArgumentList: [{ name: 'quiet' }], callback: async (args, prompt) => { finalPrompt = prompt; assert.equal(args.negative, '模糊'); return '/image.png'; } } } } }));
    await images.save({ imageRules: '自定义规则', negativePrompt: '模糊' });
    images.translate = async () => assert.fail('No automatic text-model requests');
    await images.generate({ description: '两个人的侧面', prompt: '2people, side view, watercolor' });
    assert.equal(finalPrompt, '2people, side view, watercolor');
    assert.equal((await images.load()).profiles.tavern.negativePrompt, '模糊');
});


test('source prompt supplements preserve original media and match each unchanged image independently', async () => {
    const store = ledger(); const photos = new Photos(store);
    const rows = [{ id: 'native', payload: { media: [{ type: 's-image', text: '窗边的花', fields: { src: '/a.png' } }, { type: 's-image', text: '海边', fields: {} }] } }];
    const original = structuredClone(rows);
    await photos.savePrompt('chat', { sourceId: 'native', index: 1, description: '海边', prompt: 'sea, wide shot' });
    const fresh = new Photos(store); const patched = await fresh.withPrompts('chat', rows);
    assert.deepEqual(rows, original);
    assert.equal(patched[0].payload.media[0].fields.src, '/a.png');
    assert.equal(patched[0].payload.media[0].fields.prompt, undefined);
    assert.equal(patched[0].payload.media[1].fields.prompt, 'sea, wide shot');
    rows[0].payload.media[0].fields.prompt = '花束特写';
    await photos.savePrompt('chat', { sourceId: 'native', index: 0, description: '窗边的花', sourcePrompt: '花束特写', prompt: 'flowers, close-up' });
    assert.equal((await fresh.withPrompts('chat', rows))[0].payload.media[0].fields.prompt, 'flowers, close-up');
    rows[0].payload.media[0].fields.prompt = '用户修改后的中文词';
    assert.equal((await fresh.withPrompts('chat', rows))[0].payload.media[0].fields.prompt, '用户修改后的中文词');
    rows[0].payload.media[0].fields.prompt = 'user English prompt';
    assert.equal((await fresh.withPrompts('chat', rows))[0].payload.media[0].fields.prompt, 'user English prompt');
    await photos.savePrompt('chat', { sourceId: 'native', index: 0, description: '窗边的花', sourcePrompt: 'user English prompt', prompt: 'new flowers, side view', replacePrompt: true });
    assert.equal((await fresh.withPrompts('chat', rows))[0].payload.media[0].fields.prompt, 'new flowers, side view');
    assert.equal(rows[0].payload.media[0].fields.prompt, 'user English prompt');
    rows[0].payload.media[0].fields.prompt = 'user edited again';
    assert.equal((await fresh.withPrompts('chat', rows))[0].payload.media[0].fields.prompt, 'user edited again');
    rows[0].payload.media[1].text = '新的画面';
    assert.equal((await fresh.withPrompts('chat', rows))[0].payload.media[1].fields.prompt, undefined);
    assert.equal((await fresh.withPrompts('other-chat', original))[0].payload.media[1].fields.prompt, undefined);
});

test('sending an album image retains an independent persistent source after removing its album entry', async () => {
    const store = ledger(); const photos = new Photos(store, { URL: { createObjectURL: () => 'blob:album', revokeObjectURL() {} } });
    const album = await photos.save('chat', { ownerId: PLAYER, blob: new Blob(['image'], { type: 'image/png' }), description: '花束', prompt: 'flowers', inAlbum: true });
    const attached = await photos.attach('chat', album.id, 'sent-message', 1);
    assert.notEqual(attached.id, album.id); assert.equal(attached.asset, album.asset); assert.equal(attached.inAlbum, false);
    await photos.remove('chat', album.id);
    const reload = new Photos(store, { URL: { createObjectURL: () => 'blob:reloaded', revokeObjectURL() {} } });
    const saved = await reload.resolve(await reload.list('chat'));
    assert.equal(saved.length, 1); assert.equal(saved[0].sourceId, 'sent-message'); assert.equal(saved[0].index, 1);
    assert.equal(saved[0].url, 'blob:reloaded'); assert.equal(saved[0].prompt, 'flowers');
});


test('direct and proxy image protocols keep raw prompts and negatives without text-model calls', async () => {
    const prompt = 'back of head, brown curly hair, partial view';
    for (const [mode, format] of [['direct', 'openai'], ['direct', 'json'], ['direct', 'link'], ['proxy', 'openai']]) {
        const requests = [];
        const images = new ImageService({ setTimeout, clearTimeout, fetch: async (url, options) => {
            requests.push({ url: new URL(url), body: options.body ? JSON.parse(options.body) : null });
            return new Response(new Blob(['image'], { type: 'image/png' }), { headers: { 'Content-Type': 'image/png' } });
        } }, ledger(), mode + format);
        await images.save({ mode, format, endpoint: 'https://image.test', characterProfiles: '沈令仪：brown curly hair', negativePrompt: '模糊' });
        images.translate = async () => assert.fail('Image generation must not invoke a text model');
        assert.ok((await images.generate({ prompt, description: '后脑勺特写', character: '沈令仪' })).blob);
        assert.equal(requests.length, 1);
        const request = requests[0];
        const positive = format === 'link' ? request.url.searchParams.get('tag') : request.body.prompt;
        assert.ok(positive.startsWith(prompt)); assert.match(positive, /沈令仪: brown curly hair/);
        if (mode === 'proxy') { assert.equal(request.body.negativePrompt, '模糊'); assert.equal(request.body.translatePhotoDescription, false); }
        else if (format === 'openai') assert.match(positive, /Avoid: 模糊/);
        else if (format === 'json') assert.equal(request.body.negative_prompt, '模糊');
        else assert.equal(request.url.searchParams.get('negative'), '模糊');
    }
});


test('delivered bundles match current sources and generate directly without the old translation path', async () => {
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const { runInNewContext } = require('node:vm');
    const root = join(__dirname, '..');
    const bundles = ['Selene手机.js', '外置小手机.js'].map(name => readFileSync(join(root, 'dist', name), 'utf8'));
    assert.equal(bundles[0], bundles[1], 'The two distributed entry points must be identical');
    for (const bundle of bundles) {
        for (const name of ['image-service', 'image-rules', 'main', 'ui']) assert.ok(bundle.includes(readFileSync(join(root, 'src', `${name}.cjs`), 'utf8')), `${name} in dist must match current source`);
        assert.ok(!bundle.includes('正在转换英文生图提示词'));
        const context = { URL, AbortController, structuredClone, crypto: require('node:crypto').webcrypto };
        const entry = "load('./main.cjs').start(window);";
        assert.ok(bundle.includes(entry));
        runInNewContext(bundle.replace(entry, "globalThis.ImageService = load('./image-service.cjs').ImageService;"), context);
        const calls = [];
        const images = new context.ImageService({ setTimeout, clearTimeout }, ledger(), 'dist', () => ({}), async () => ({ SlashCommandParser: { commands: { sd: { namedArgumentList: [{ name: 'quiet' }], callback: async (args, prompt) => { calls.push({ args, prompt }); return '/dist-check.png'; } } } } }));
        images.translate = () => assert.fail('The distributed script must not request text translation');
        await images.save({ characterProfiles: '沈令仪：brown curly hair', negativePrompt: '模糊' });
        await images.generate({ description: '后脑勺特写', prompt: 'back of head, partial view', character: '沈令仪' });
        assert.equal(calls.length, 1); assert.ok(calls[0].prompt.startsWith('back of head, partial view'));
        assert.equal(calls[0].args.negative, '模糊'); assert.match(calls[0].prompt, /沈令仪: brown curly hair/);
    }
});
