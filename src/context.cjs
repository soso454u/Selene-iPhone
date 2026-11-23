const { imageRules: resolveImageRules, IMAGE_DRAFT_PROTOCOL } = require('./image-rules.cjs');
const { PHONE_CONTENT_PROTOCOL } = require('./character-phone.cjs');
const { PLAYER, clip, dialogue, digest, parseStory, stripHandoff, unique } = require('./domain.cjs');
const { cacheMemoryBlocks, savedSummary, cacheSummaries, loreType, loreContent, readOnlyLore, withoutArtwork, memoryText } = require('./story-sources.cjs');

const { DEFAULT_PRESET, LEGACY_DEFAULT_PRESET, phonePrompt, SOCIAL_COMMON_PROMPT, cleanPlatformPrompts, cleanSocialCommonPrompt } = require('./phone-preset.cjs');
const { loadModule } = require('./host.cjs');
const { cleanProfiles } = require('./api-profiles.cjs');
const { safeUrl } = require('./media.cjs');
const { cleanBackgroundMap, imageSource } = require('./backgrounds.cjs');
const { WALLPAPERS, wallpaperImage, cleanWallpaperLibrary } = require('./wallpapers.cjs');

const DEFAULTS = Object.freeze({
    apiMode: 'tavern', base: '', model: '', temperature: 0.85, output: 0, outputLimitVersion: 1, streaming: true, apiProfiles: [], activeApiProfile: '', platformApis: {}, budget: 12000, storyLimit: 20,
    sync: 'auto', syncChars: 5200, reverse: true, imessage: true, prose: true, eventTag: 'phone_event', jsonTag: 'phone_log', socialAliases: 'Louis=明玉',
    socialCommonPrompt: SOCIAL_COMMON_PROMPT, platformPrompts: {}, musicIsland: true,
    preset: DEFAULT_PRESET, presetEnabled: true, lore: true, dynamic: true, autoCloud: true, autoCloudDefaultVersion: 1,
    socialSync: { moments: true, redbook: false, douyin: false, weibo: false, forum: false, x: false },
    theme: 'auto', showLauncher: true, launcherPosition: null, userAvatar: '', customStickers: [], wallpaper: 'dusk', wallpaperImage: '', wallpaperLibrary: [], wallpaperShade: 30, pageBackgrounds: {}, clockMode: 'device', scale: 100, rpTime: '', rpTimeAuto: true, auto: 'off', every: 8,
});

function phoneSettings(input) {
    const settings = { ...DEFAULTS, ...Object.fromEntries(Object.keys(DEFAULTS).filter(key => Object.hasOwn(input ?? {}, key)).map(key => [key, input[key]])) };
    settings.output = input && input.outputLimitVersion !== 1 ? 0 : normalizeOutput(settings.output);
    settings.outputLimitVersion = 1;
    settings.autoCloud = input?.autoCloudDefaultVersion === 1 ? input.autoCloud !== false : true;
    settings.autoCloudDefaultVersion = 1;
    settings.showLauncher = settings.showLauncher !== false;
    settings.socialAliases = typeof settings.socialAliases === 'string' ? settings.socialAliases.slice(0, 12000) : DEFAULTS.socialAliases;
    settings.musicIsland = settings.musicIsland !== false;
    settings.rpTimeAuto = settings.rpTimeAuto !== false;
    settings.scale = Number.isFinite(Number(settings.scale)) ? Math.min(150, Math.max(50, Number(settings.scale))) : 100;
    const position = settings.launcherPosition;
    settings.launcherPosition = position && Number.isFinite(position.x) && Number.isFinite(position.y) ? { x: Math.min(1, Math.max(0, position.x)), y: Math.min(1, Math.max(0, position.y)) } : null;
    settings.apiProfiles = cleanProfiles(settings.apiProfiles);
    settings.platformApis = Object.fromEntries(['moments', 'redbook', 'douyin', 'weibo', 'forum', 'x'].map(key => [key, settings.apiProfiles.some(profile => profile.id === settings.platformApis?.[key]) ? settings.platformApis[key] : '']));
    settings.platformPrompts = cleanPlatformPrompts(settings.platformPrompts);
    settings.socialCommonPrompt = cleanSocialCommonPrompt(settings.socialCommonPrompt);
    settings.pageBackgrounds = cleanBackgroundMap(settings.pageBackgrounds, true);
    settings.wallpaperLibrary = cleanWallpaperLibrary(settings.wallpaperLibrary);
    settings.wallpaperImage = wallpaperImage(settings.wallpaperImage);
    if (!Object.hasOwn(WALLPAPERS, settings.wallpaper) && !settings.wallpaperLibrary.some(item => `saved:${item.id}` === settings.wallpaper)) settings.wallpaper = 'dusk';
    settings.wallpaperShade = Math.min(85, Math.max(0, Number(settings.wallpaperShade) || 0));
    settings.customStickers = Array.isArray(settings.customStickers) ? settings.customStickers.filter(item => typeof item?.name === 'string' && safeUrl(item.url)).slice(0, 100).map(item => ({ name: clip(item.name, 40), url: safeUrl(item.url) })).filter(item => item.name) : [];
    const userAvatar = imageSource(settings.userAvatar);
    settings.userAvatar = userAvatar.startsWith('asset:') || userAvatar.length > 3 * 1024 * 1024 ? '' : userAvatar;
    if (typeof settings.preset !== 'string' || !settings.preset.trim() || settings.preset.trim() === LEGACY_DEFAULT_PRESET) settings.preset = DEFAULT_PRESET;
    settings.socialSync = Object.fromEntries(Object.entries(DEFAULTS.socialSync).map(([key, value]) => [key, typeof input?.socialSync?.[key] === 'boolean' ? input.socialSync[key] : value]));
    return settings;
}

function normalizeOutput(value) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 0) throw new Error('输出 Token 请输入非负整数；0 表示不额外限制。');
    return number;
}

function basePeople(context, avatar, customAvatar = '') {
    const group = context.groups?.find(entry => String(entry.id) === String(context.groupId));
    const current = context.characters?.[context.characterId];
    const playerAvatar = avatar ? context.getThumbnailUrl?.('persona', avatar) || `User Avatars/${encodeURIComponent(avatar)}` : undefined;
    const people = [{ id: PLAYER, name: context.name1 || '玩家', avatar: customAvatar || playerAvatar }];
    for (const [index, card] of Object.entries(context.characters ?? {})) {
        if (!card?.avatar || (group ? !group.members?.includes(card.avatar) : card !== current)) continue;
        people.push({ id: `card:${card.avatar}`, index: Number(index), current: !group && card === current, name: card.name || card.data?.name || '未命名角色', avatar: context.getThumbnailUrl?.('avatar', card.avatar), source: '角色卡' });
    }
    return people;
}

function profile(text, title = '') {
    const body = clip(text, 14000);
    const name = body.match(/(?:^|\n|[;,；{])\s*(?:[-*]\s*)?["']?(?:姓名|角色名|人物名|全名|name)["']?\s*[:：]\s*["']?([^\n，,;；}"'（(]{1,40})/i)?.[1];
    const fields = [...body.matchAll(/(?:^|\n)\s*(?:[-*]\s*)?(身份|年龄|外貌|性格|背景|职业|语言习惯|角色定位|经历)\s*[:：]/g)];
    const heading = /(?:人物|角色)(?:设定|档案|资料|卡)/.test(title);
    if (!name && !(heading && fields.length >= 2)) return null;
    const clean = clip(name || title.replace(/(?:人物|角色)(?:设定|档案|资料|卡)/g, '').replace(/^[\s:：|·【】—-]+|[\s:：|·【】—-]+$/g, ''), 40);
    if (!clean || /^(?:玩家|用户|角色|人物|他们|我|你|他|她|系统|关系|记忆|身份|状态|剧情|NPC|unknown)$/i.test(clean) || /[<>\[\]{}\/\r\n]/.test(clean)) return null;
    return { name: clean, notes: clip(body, 3600), id: `lore:${digest(clean.toLowerCase())}` };
}

async function scanPeople(host, context, people) {
    const result = new Map(people.map(person => [person.name, person]));
    const merge = (text, title, source) => {
        const candidate = profile(text, title);
        if (candidate && !result.has(candidate.name)) result.set(candidate.name, { ...candidate, source });
    };
    for (const person of people.filter(item => Number.isInteger(item.index))) {
        const description = context.characters?.[person.index]?.data?.description || context.characters?.[person.index]?.description || '';
        const sections = String(description).split(/\n(?=\s*(?:[-*]\s*)?(?:姓名|角色名|人物名|全名)\s*[:：])/);
        for (const section of sections) merge(section, '', '角色卡档案');
    }
    const lore = await loadModule(host, 'scripts/world-info.js');
    for (const entry of await lore.getSortedEntries()) {
        if (!entry.disable) merge(entry.content, entry.comment || '', `世界书 · ${entry.world || '已绑定'}`);
    }
    return [...result.values()].slice(0, 200);
}

function bookNames(helper, context) {
    const bindings = new Map();
    const add = (source, names) => { for (const name of names.filter(Boolean)) bindings.set(name, unique([...(bindings.get(name) ?? []), source])); };
    add('Persona', [context.powerUserSettings?.persona_description_lorebook]);
    if (helper?.getChatWorldbookName) add('聊天', [helper.getChatWorldbookName('current')]);
    if (helper?.getGlobalWorldbookNames) add('全局', helper.getGlobalWorldbookNames());
    for (const person of basePeople(context).filter(item => Number.isInteger(item.index))) {
        const books = helper?.getCharWorldbookNames?.(context.characters[person.index].avatar);
        add('角色', [books?.primary || context.characters[person.index].data?.extensions?.world, ...(books?.additional ?? [])]);
    }
    return [...bindings].map(([name, sources]) => `${sources.join('/')}：${name}`);
}

function estimate(text) {
    const content = String(text);
    const wide = (content.match(/[^\x00-\x7f]/g) || []).length;
    return Math.ceil(wide * 1.25 + (content.length - wide) / 3.5) + 5;
}

function proseContext(text, settings) {
    let cleaned = stripHandoff(text).replace(/<(chat|im|social)\b[^>]*>[^]*?<\/\1>/gi, '[手机内容按知情范围另行读取]')
        .replace(/<(?:think|thinking|analysis|reasoning|CACHE_MEMORY)\b[^>]*>[^]*?<\/(?:think|thinking|analysis|reasoning|CACHE_MEMORY)>/gi, '');
    for (const tag of unique(['phone_event', 'phone_log', settings.eventTag, settings.jsonTag]).filter(value => /^[a-z][\w:-]*$/i.test(value))) {
        cleaned = cleaned.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), '[手机内容按知情范围另行读取]');
    }
    return withoutArtwork(cleaned).trim();
}

async function buildContext({ host, helper, context, scope, chat, trail, settings, person, people, members, memory, snapshot, loreSnapshot, action, imageRules, platform = '朋友圈', hint = '', postCount = 1, targetPost, valid, loadLore = () => loadModule(host, 'scripts/world-info.js') }) {
    const entries = [];
    const warnings = [];
    const variables = new Map();
    const seen = new Set();
    const playerName = context.name1 || '玩家';
    const render = (value, character = person.name) => String(value ?? '')
        .replace(/\{\{(user|char)\}\}/gi, (_, key) => key.toLowerCase() === 'user' ? playerName : character)
        .replace(/\{\{outlet::([^{}]+)\}\}/gi, (_, name) => variables.get(name.trim()) ?? '');
    const add = (name, text, { required = false, role = 'user', group = 'profiles', data = true, dedupe = false } = {}) => {
        const value = clip(text, 40000);
        if (!value) return;
        if (dedupe) {
            const key = value.replace(/\s+/g, ' ');
            if (seen.has(key)) return;
            seen.add(key);
        }
        const content = data ? `【资料 · ${name}】\n${value}` : value;
        entries.push({ name, content, required, role, group, tokens: estimate(content) });
    };
    const persona = context.powerUserSettings?.persona_description;
    const chatCard = context.characters?.[context.characterId];
    const currentCards = basePeople(context).filter(item => Number.isInteger(item.index));
    const profiles = [...new Map([...currentCards, ...people.filter(item => members.includes(item.id) && item.id !== PLAYER), person].map(item => [item.id, item])).values()];
    const cardFields = entry => {
        const card = context.characters?.[entry.index];
        if (!card) return null;
        return {
            description: card.data?.description || card.description,
            personality: card.data?.personality || card.personality,
            scenario: (card === chatCard && context.chatMetadata?.scenario) || card.data?.scenario || card.scenario,
            mesExamples: (card === chatCard && context.chatMetadata?.mes_example) || card.data?.mes_example || card.mes_example,
            creatorNotes: card.data?.creator_notes,
        };
    };
    const visibleProse = row => {
        let text = proseContext(row.mes, settings);
        for (const item of parseStory({ ...row, mes: text }, people, { ...settings, prose: true })) {
            if (!members.every(id => item.audience.includes(id))) text = text.replaceAll(item.text, '[手机原话不在本会话知情范围]');
        }
        return text;
    };
    const dialogueRows = chat.flatMap((row, floor) => dialogue(row) && row.mes ? [{ row, floor }] : []);
    const commentsOnly = action === 'comments';
    const imageOnly = action === 'imagePrompt';
    const characterPhone = action === 'characterPhone';
    const post = action === 'post' || commentsOnly;
    const groupChat = !post && members.length > 2;
    const presetEnabled = settings.presetEnabled !== false;
    const prompt = characterPhone ? { text: PHONE_CONTENT_PROTOCOL } : imageOnly ? { text: IMAGE_DRAFT_PROTOCOL } : phonePrompt(settings.preset || DEFAULT_PRESET, { enabled: presetEnabled, post, commentsOnly, group: groupChat, platform, postCount, commonPrompt: settings.socialCommonPrompt, platformPrompts: settings.platformPrompts });
    const triggerText = [hint, ...memory.recent.slice(-3).map(event => event.text)].filter(Boolean).join('\n');
    const sticker = /表情包|贴纸|sticker|发.{0,3}表情/i.test(triggerText);
    let books = [];
    let activated = [];
    if (settings.lore) {
        try { books = bookNames(helper, context); } catch { warnings.push('部分世界书绑定名称未能读取。'); }
        try {
            const lore = await loadLore();
            if (!valid()) throw new Error('stale');
            const worldSettings = lore.getWorldInfoSettings?.() ?? {};
            const rows = dialogueRows.slice(-250).map(({ row }) => worldSettings.world_info_include_names ? `${row.name}: ${visibleProse(row)}` : visibleProse(row)).reverse();
            const fields = cardFields(person) ?? cardFields(currentCards[0] ?? {}) ?? {};
            const observed = loreSnapshot?.scope === scope && loreSnapshot?.anchor?.key === trail.tail ? loreSnapshot.entries : [];
            activated = readOnlyLore(await lore.getSortedEntries(), worldSettings, {
                context, rows, render, parseRegex: lore.parseRegexFromString, observed,
                taskText: { regular: triggerText, im: post ? '' : `线上聊天 iMessage\n${triggerText}`, social: post ? `发朋友圈\n${triggerText}` : '', stickers: sticker ? triggerText : '' },
                scanFields: { matchPersonaDescription: render(persona), matchCharacterDescription: render(fields.description),
                    matchCharacterPersonality: render(fields.personality), matchScenario: render(fields.scenario), matchCreatorNotes: render(fields.creatorNotes) },
            });
            if (!observed.length) warnings.push('无当前分支的原生激活记录；仅以只读方式匹配常驻及直接关键词条目。');
        } catch { if (valid()) warnings.push('世界书读取不可用；未把未验证条目当作生效内容。'); }
    }
    if (!valid()) throw new Error('聊天或有效分支已变化，请重试');
    const loreRows = activated.map(entry => {
        const type = loreType(entry);
        return { entry, type, text: withoutArtwork(loreContent(entry, type, { post, sticker, coversChat: prompt.coversChat, coversSocial: prompt.coversSocial })) };
    }).filter(({ type, text }) => text.trim() && (type !== 'summary' || settings.dynamic));
    for (const { entry, type, text } of loreRows) {
        if (!entry.outletName || type !== 'lore') continue;
        const value = render(text, chatCard?.name || person.name);
        variables.set(entry.outletName, [variables.get(entry.outletName), value].filter(Boolean).join('\n'));
    }
    add(presetEnabled ? '手机专用预设' : '手机输出协议', render(prompt.text), { required: true, role: 'system', data: false, group: 'preset' });
    if ((post && !commentsOnly) || imageOnly) add('生图规则提示词', render(resolveImageRules(imageRules)), { required: true, role: 'system', data: false, group: 'preset' });
    add('User Persona', [`姓名：${playerName}`, render(persona, chatCard?.name || person.name)].filter(Boolean).join('\n'), { required: true, group: 'persona' });
    for (const profile of profiles) {
        const fields = cardFields(profile);
        const name = `${profile.current ? 'Char' : 'Char / NPC'} · ${profile.name}`;
        add(name, [fields?.description, fields?.personality && `性格：${fields.personality}`, fields?.scenario && `场景：${fields.scenario}`, !fields && profile.notes]
            .filter(Boolean).map(value => render(value, profile.name)).join('\n'), { required: profile.current || profile.id === person.id, dedupe: true });
        add(`${name} · 示例对话`, render(fields?.mesExamples, profile.name), { dedupe: true });
        add(`${name} · 作者备注`, render(fields?.creatorNotes, profile.name), { dedupe: true });
    }
    const loreName = entry => [entry.world, entry.comment || `#${entry.uid ?? '?'}`].filter(Boolean).join(' / ');
    for (const { entry, text } of loreRows.filter(row => row.type !== 'summary')) {
        add(`世界书 · ${loreName(entry)}`, render(text, chatCard?.name || person.name), { group: 'lore', dedupe: true });
    }
    if (settings.dynamic) {
        const group = { group: 'storyMemory', dedupe: true };
        const summary = savedSummary(chat);
        if (summary) add(`酒馆历史摘要 · #${summary.floor}`, memoryText(summary.text), group);
        const cache = snapshot?.scope === scope && snapshot?.anchor?.key && trail.hashes[snapshot.anchor.length] === snapshot.anchor.key ? snapshot.memory : [];
        for (const value of cache ?? []) add('Cache Memory · 已观测注入', memoryText(value), group);
        if (!cache?.length) {
            for (const item of cacheSummaries(context, chat)) add(`Cache Memory · 分支已核验摘要 #${item.floor}`, memoryText(item.text), group);
        }
        for (const { entry, text } of loreRows.filter(row => row.type === 'summary')) {
            const values = cacheMemoryBlocks(text);
            for (const value of values.length ? values : [text]) add(`世界书剧情摘要 · ${loreName(entry)}`, render(value), group);
        }
    }
    for (const { row, floor } of dialogueRows.slice(-settings.storyLimit)) {
        const text = visibleProse(row);
        if (text) add('有效正文 · 作者视角', JSON.stringify({ 楼层: floor, Swipe: row.swipe_id ?? 0, 身份: row.is_user ? '玩家' : '角色', 发言: row.name, 内容: text }), { group: 'story' });
    }
    const stateTexts = new Set();
    for (const event of [...memory.states, ...memory.older]) {
        const fact = event.memory || event.text;
        if (!fact || stateTexts.has(fact)) continue;
        stateTexts.add(fact);
        add(`手机${event.memory ? '状态／未解决事项' : '归档摘录／原文检索'} · ${event.speaker}`, withoutArtwork(fact), { group: 'phoneMemory' });
    }
    for (const event of memory.recent) add('可见手机原文', JSON.stringify({ 类型: event.kind, 发言: event.speaker, 参与者: event.names, 知情范围: event.audienceNames, 内容: withoutArtwork(event.text), 引用: withoutArtwork(event.quote) || undefined, 关联: event.target || undefined, RP时间: event.rpTime || undefined }), { required: event === memory.recent.at(-1), group: 'phone' });
    const memberNames = people.filter(item => members.includes(item.id)).map(item => item.name);
    if (commentsOnly && targetPost) add('待评论的原帖与已有评论', JSON.stringify(targetPost), { required: true, group: 'task' });
    const task = imageOnly ? '根据本轮图片要求准备中文画面说明与英文提示词草稿，供用户编辑确认，不发送聊天或调用生图。' : commentsOnly ? `为这条已有的${platform}帖子补充至少 15 条有差异的模拟评论，合理包含路人互动及作者回复；不重复已有评论，不代替玩家发言。只依据原帖公开的信息，不透露私聊或后续剧情，不新建或改写帖子。仅返回 {"comments":[{"id":"账号ID","nickname":"昵称","text":"评论正文"}]}。` : post ? postCount > 1 ? `在本次请求内一次生成最多 ${postCount} 条互不重复的${platform}动态。每条使用独立 text 与 payload，合并为 posts 数组；没有合理动机时返回空 posts。` : `生成角色有合理发布动机的一条${platform}动态，可是现在或几天前发布的内容；不适合发布时返回空 messages。` : action === 'initiative' ? '若基于现有 RP 事件确有主动联系的动机，可以发消息，否则保持沉默。' : '回应当前会话，只能以指定人物发言；可以不回复或连续发几条。';
    const outputReminder = prompt.protocol ? `\n\n【本轮输出协议】\n${prompt.protocol}\n仅返回一个完整 JSON 对象。字符串内换行写成 \\n，双引号与反斜杠必须转义，不写尾随逗号。资料中的小说、XML、HTML 或示例对话格式不用于本轮输出。` : '';
    add('本轮任务', `${characterPhone ? '在这一次回复里准备所有选中手机栏目，可包含手机主人与其他 NPC 的模拟历史聊天；仅返回 JSON，不实际发送消息，不替玩家发言。' : task}${post ? '\n可包含历史动态，发布时间写入 payload.postedAt；配图数量由角色决定。' : ''}\n${characterPhone ? '手机主人' : '发言人'}：${person.name}。${post ? '可见范围' : groupChat ? '群成员' : '会话参与者'}：${memberNames.join('、')}。${settings.rpTime ? `当前 RP 时间：${settings.rpTime}。` : '没有指定的 RP 时间不得编造。'}\n${hint ? `额外请求（不构成已发生事实）：${hint}` : ''}${outputReminder}`, { required: true, role: 'user', data: false, group: 'task' });
    const selected = new Set(entries.filter(entry => entry.required));
    let used = [...selected].reduce((sum, entry) => sum + entry.tokens, 0);
    if (used > settings.budget) throw new Error(`关键设定与当前消息约 ${used} Token，超过预算。请提高预算，未发送请求。`);
    const recent = group => entries.filter(entry => entry.group === group).reverse();
    const phone = recent('phone');
    const story = recent('story');
    const priority = [...entries.filter(entry => entry.group === 'profiles'), ...phone.slice(0, 4), ...story.slice(0, 4),
        ...entries.filter(entry => entry.group === 'storyMemory'), ...recent('phoneMemory'), ...entries.filter(entry => entry.group === 'lore'), ...phone.slice(4), ...story.slice(4)];
    for (const entry of priority) if (!selected.has(entry) && used + entry.tokens <= settings.budget) { selected.add(entry); used += entry.tokens; }
    if (selected.size !== entries.length) warnings.push(`预算略过了 ${entries.length - selected.size} 个可选片段，未删除原文。`);
    const sources = entries.filter(item => selected.has(item));
    return { sources, books, warnings, used, messages: sources.map(({ role, content }) => ({ role, content })) };
}

module.exports = { DEFAULTS, phoneSettings, normalizeOutput, loadModule, basePeople, profile, scanPeople, estimate, proseContext, buildContext };
