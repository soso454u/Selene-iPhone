const { PLAYER, active, before, clip, digest, makeEvent, socialAliases, socialNickname, threadKey, unique, storyDisclosure } = require('./domain.cjs');
const { contactDeleted, characterConversation } = require('./conversations.cjs');
const { chatTimeline, historicalTime } = require('./chat-time.cjs');

const PHONE_SECTIONS = { messages: ['聊天记录', 'messages'], notes: ['备忘录', 'edit'], history: ['浏览记录', 'search'], cart: ['购物车', 'cart'] };
const PHONE_CONTENT_PROTOCOL = `本轮只准备指定角色手机里的私人生活记录，供玩家以作者视角查看，不实际发送消息，不推进正文或 RP 时间。
一次请求返回所有选中栏目，不要求追加请求。按人物设定与有效剧情写简体中文内容，不捏造重大既往事实，不让其他角色自动知情。
仅输出 JSON 对象，按本轮指定栏目返回：
{"messages":[{"peer":"其他NPC的姓名","messages":[{"from":"owner","text":"手机主人发出的原话","time":"已知剧情时间或留空"},{"from":"peer","text":"对方的原话","time":""}]}],"notes":[{"title":"标题","content":"备忘内容","time":""}],"history":[{"title":"浏览标题或搜索词","site":"网站或应用名","summary":"浏览内容摘要","time":""}],"cart":[{"name":"商品名","price":"模拟价格或留空","quantity":1,"reason":"规格或加入购物车的缘由","time":""}]}
messages 是手机主人与其他 NPC 的已存聊天记录，from 仅用 owner / peer；不得生成 user 的发言，也不得把玩家作为新聊天的对方。同一联系人的不同会话及会话内消息按时间先后排列。已有正文与聊天原话保留，不重复改写；模拟记录不代表此刻新发消息，不应覆盖已发生事实。
按本轮生成计划的数量准备：默认聊天 6 段会话，每段 4–10 句，备忘录、浏览记录和购物车各 10 条。会话可以是同一联系人在不同时期的聊天。上限为 12 段会话、每段 20 句、聊天共 120 句，其余每栏 30 条；没有合理记录时可少于目标或用空数组，未选栏目省略。
历史范围不限于当前剧情：结合人物年龄、经历、关系和已知时间线，呈现最近几天、几个月前乃至几年前的普通生活痕迹，不把所有记录都写成当前事件的延伸。不得把刚认识的人写成多年好友，也不编造重大过往。已知年月日用明确日期，只有相对时间依据时可写“三天前”“半个月前”“几年前”；时间锚点是本轮 RP 日期，无法确定就留空，不借用现实日期。
购物车不代表已购买或付款；浏览记录不提供虚构 URL，不访问真实网站。时间未知留空，不借用设备日期。只返回数据，不输出 HTML、脚本、分析或 Markdown。`;

function phoneSections(input = 'all') {
    const keys = input === 'all' ? Object.keys(PHONE_SECTIONS) : Array.isArray(input) ? unique(input) : [input];
    if (!keys.length || keys.some(key => !Object.hasOwn(PHONE_SECTIONS, key))) throw new Error('请至少选择一个有效的手机栏目。');
    return keys;
}

function phoneGenerationPlan(input = {}) {
    const count = (value, fallback, max) => {
        if (value == null) return fallback;
        if (!Number.isInteger(value) || value < 1 || value > max) throw new Error('生成数量无效，请在允许范围内选择。');
        return value;
    };
    return { 聊天会话数: count(input.conversations, 6, 12), 每段聊天句数: '4–10，最多20句，全部聊天最多120句', 每个生活栏目条数: count(input.items, 10, 30), 历史范围: '按人物经历跨时期，包括几天前、几个月前或几年前；时间以RP日期为准，不捏造重大经历。' };
}

function parsePhoneContents(raw, sections = 'all', { owner, playerNames = [] } = {}) {
    const keys = phoneSections(sections);
    let input;
    try { input = JSON.parse(String(raw).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
    catch { throw new Error('角色手机内容不是有效 JSON，未保存，也不会自动重试。'); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('角色手机内容格式无效，未保存。');
    const text = (item, key, max, required = false) => {
        const value = item?.[key];
        if ((value != null && typeof value !== 'string') || (value?.length || 0) > max || (required && !value?.trim())) throw new Error('角色手机条目缺少内容或超出长度，未保存。');
        return clip(value, max);
    };
    let messageCount = 0;
    return Object.fromEntries(keys.map(key => {
        const rows = input[key];
        if (!Array.isArray(rows) || rows.length > (key === 'messages' ? 12 : 30)) throw new Error('角色手机栏目缺失或超过条数上限，未保存。');
        return [key, rows.map(item => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('角色手机条目无效，未保存。');
            if (key === 'messages') {
                const peer = text(item, 'peer', 60, true);
                if (/[<>\[\]{}\r\n]/.test(peer) || /^(?:owner|peer|user|player|char|npc|\$player|玩家|用户|我|你)$/i.test(peer) || [owner?.name, ...playerNames].filter(Boolean).includes(peer)) throw new Error('聊天对方必须是其他 NPC，不能替玩家生成发言。');
                if (!Array.isArray(item.messages) || !item.messages.length || item.messages.length > 20) throw new Error('生成的聊天记录格式无效，未保存。');
                messageCount += item.messages.length;
                if (messageCount > 120) throw new Error('生成聊天超过 120 句，未保存。');
                return { peer, messages: item.messages.map(message => {
                    if (!['owner', 'peer'].includes(message?.from)) throw new Error('聊天记录发送者必须是 owner 或 peer，未保存。');
                    return { from: message.from, text: text(message, 'text', 2000, true), time: text(message, 'time', 80) };
                }) };
            }
            if (key === 'notes') return { title: text(item, 'title', 100, true), content: text(item, 'content', 2000, true), time: text(item, 'time', 80) };
            if (key === 'history') return { title: text(item, 'title', 200, true), site: text(item, 'site', 100), summary: text(item, 'summary', 1000), time: text(item, 'time', 80) };
            const quantity = item.quantity ?? 1;
            if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new Error('购物车商品数量无效，未保存。');
            return { name: text(item, 'name', 150, true), price: text(item, 'price', 100), quantity, reason: text(item, 'reason', 500), time: text(item, 'time', 80) };
        })];
    }));
}

function phoneContents(rows, owner, trail) {
    const result = {};
    for (const row of [...rows].sort((a, b) => b.stamp - a.stamp || b.id.localeCompare(a.id))) {
        const section = row.payload?.section;
        if (row.kind !== 'phoneSnapshot' || row.speakerId !== owner || !active(row, trail) || !Object.hasOwn(PHONE_SECTIONS, section) || Object.hasOwn(result, section)) continue;
        try { result[section] = { items: parsePhoneContents(JSON.stringify({ [section]: row.payload.items }), section)[section], rpTime: row.rpTime, sourceId: row.id }; } catch {}
    }
    return result;
}

function characterMessages(rows, owner, trail, people, settings = {}) {
    const existing = rows.filter(row => active(row, trail) && ['message', 'call'].includes(row.kind) && row.participants.includes(owner) && row.audience.includes(owner));
    const generated = [];
    const aliases = socialAliases(settings);
    const owners = unique(rows.filter(row => row.kind === 'phoneSnapshot' && row.payload?.section === 'messages').map(row => row.speakerId));
    for (const id of owners) {
        const saved = phoneContents(rows, id, trail).messages;
        if (!saved) continue;
        const source = rows.find(row => row.id === saved.sourceId);
        for (const [index, conversation] of saved.items.entries()) {
            const target = aliases.get(conversation.peer) || conversation.peer;
            const peer = people.find(person => person.id === target || person.name === target) || people.find(person => person.name === conversation.peer) || { id: `screen:${digest(conversation.peer)}`, name: conversation.peer };
            if (peer.id === PLAYER || peer.id === id || ![id, peer.id].includes(owner)) continue;
            const author = people.find(person => person.id === id) || { id, name: source.speaker };
            for (const [offset, message] of conversation.messages.entries()) {
                const from = message.from === 'owner' ? author : peer;
                generated.push({ ...source, id: `${source.id}:${index}:${offset}`, sourceId: source.id, generatedPhone: true, kind: 'message', stamp: source.stamp + (index * 20 + offset) / 1000,
                    speakerId: from.id, speaker: from.name, participants: [id, peer.id], audience: [id, peer.id], names: [author.name, peer.name], audienceNames: [author.name, peer.name],
                    thread: threadKey([id, peer.id]), text: message.text, rpTime: historicalTime(message.time, source.rpTime), timeBase: source.rpTime, payload: undefined, quote: '' });
            }
        }
    }
    const signature = row => JSON.stringify([row.thread, row.speakerId, row.text, row.rpTime || '']);
    const originals = new Set(existing.map(signature));
    // Repeated real sends are real messages. Only avoid a generated copy of one.
    return [...existing, ...generated.filter(row => !originals.has(signature(row)))].sort((a, b) => b.stamp - a.stamp || b.id.localeCompare(a.id));
}

function phoneDisclosure(rows, owner, trail, people, settings, sections, thread = '') {
    const contents = phoneContents(rows, owner.id, trail);
    const chats = characterMessages(rows, owner.id, trail, people, settings);
    return phoneSections(sections).map(section => {
        const items = section === 'messages' ? [...chats].reverse().filter(row => !thread || row.thread === thread).map(row => ({ from: row.speaker, participants: row.names, text: row.text, time: row.rpTime || '', ...(row.quote ? { quote: row.quote } : {}),
            ...(row.participants.length >= 3 ? { group: { id: row.thread, name: row.payload?.group?.name || '群聊', members: row.names } } : {}),
            ...(row.payload?.components?.length ? { attachments: row.payload.components.map(part => ({ type: part.type, text: part.text, fields: Object.fromEntries(Object.entries(part.fields || {}).filter(([key]) => !['src', 'url'].includes(key))) })) } : {}) })) : (contents[section]?.items || []).map(item => ({ ...item, time: historicalTime(item.time, contents[section].rpTime) }));
        return storyDisclosure({ section, items });
    });
}

function disclosureEvents(session, owner, entries, stamp = Date.now()) {
    const selected = entries.filter(entry => entry.items.length);
    if (!selected.length) throw new Error('所选栏目还没有记录，请先生成或读取聊天。');
    if (JSON.stringify(selected).length > 24000) throw new Error('所选记录超过 24000 字，请分次选择栏目，或在聊天详情中只同步当前会话。');
    return selected.map(({ section, items }, index) => makeEvent(session.scope, session.trail, { kind: 'phoneReveal', speakerId: owner.id, participants: [owner.id], audience: [owner.id],
        thread: `character-phone:${owner.id}`, text: `${owner.name}的${PHONE_SECTIONS[section][0]}（供本轮剧情查阅）`,
        payload: { phoneDisclosure: { ownerId: owner.id, ownerName: owner.name, section, items } } }, session.people,
        { id: `reveal:${digest(JSON.stringify([owner.id, section, items, before(session.trail)]))}`, stamp: stamp + index, sync: true }));
}

class CharacterPhone {
    constructor(phone) { this.phone = phone; this.pending = new Set(); this.reset(); }
    reset() { this.owner = ''; this.app = 'home'; this.thread = ''; this.scope = ''; this.draft = ''; this.sender = ''; }
    back() {
        if (this.thread) { this.thread = ''; this.draft = ''; this.sender = ''; }
        else if (this.app !== 'home') this.app = 'home';
        else { this.phone.navigate('home'); return; }
        this.phone.render(this.phone.state);
    }
    get title() { return this.thread ? this.chatName || '聊天记录' : this.app === 'home' ? '角色手机' : PHONE_SECTIONS[this.app]?.[0] || '角色手机'; }
    home() { this.app = 'home'; this.thread = ''; this.draft = ''; this.sender = ''; this.phone.render(this.phone.state); }
    render(state) {
        const p = this.phone, el = p.el.bind(p);
        if (this.scope !== state.scope) { this.reset(); this.scope = state.scope; }
        const people = state.people.filter(person => person.id !== PLAYER);
        if (!people.some(person => person.id === this.owner)) this.owner = people.find(person => person.current)?.id || people[0]?.id || '';
        const owner = people.find(person => person.id === this.owner);
        if (!owner) return el('p', 'empty', '当前聊天还没有可查看的角色。');
        const records = state.characterPhoneRows || [];
        const rows = characterMessages(records, owner.id, state.trail, state.people, state.settings);
        const contents = phoneContents(records, owner.id, state.trail);
        const staged = records.filter(row => row.kind === 'phoneReveal' && row.speakerId === owner.id && active(row, state.trail) && row.sync !== false && !state.trail.byEvent.has(row.id));
        const choose = p.select(people.map(person => [person.id, `${person.name}的手机`]), owner.id);
        choose.setAttribute('aria-label', '选择要查看的角色手机');
        choose.onchange = () => { this.owner = choose.value; this.app = 'home'; this.thread = ''; this.draft = ''; this.sender = ''; p.render(p.state); };
        const identity = el('div', 'character-phone-owner', p.avatar(owner), el('div', 'list-info', choose, el('small', '', 'PRIVATE PHONE · 角色视角')));
        const generate = p.button('', () => this.editor(owner, this.app === 'home' ? 'all' : this.app), 'character-phone-generate', '生成手机内容');
        const generating = this.pending.has(`${state.scope}:${owner.id}`);
        generate.append(p.icon('spark'), el('span', '', generating ? '生成中' : '生成')); generate.disabled = generating;
        const sync = p.button('', () => this.syncEditor(state, owner), 'character-phone-sync', '同步剧情');
        sync.append(p.icon('sync'), el('span', '', '同步剧情'));
        const top = el('div', 'character-phone-top', identity, el('div', 'character-phone-tools', generate, sync));
        const changeApp = app => { this.app = app; this.thread = ''; this.draft = ''; this.sender = ''; p.render(p.state); };
        if (this.app === 'home') {
            const grid = el('div', 'character-phone-grid', ...Object.entries(PHONE_SECTIONS).map(([key, [title, icon]]) => {
                const count = key === 'messages' ? rows.length : contents[key]?.items.length || 0;
                const latest = key === 'messages' ? rows[0]?.text : key === 'notes' ? contents[key]?.items[0]?.title : key === 'history' ? contents[key]?.items[0]?.title : contents[key]?.items[0]?.name;
                const button = p.button('', () => changeApp(key), 'app character-phone-tile', `查看角色${title}`);
                button.dataset.characterApp = key;
                button.append(el('span', `app-icon ${key === 'messages' ? 'app-messages' : `character-icon-${key}`}`, p.appIcon(icon)), el('span', 'app-label', title), el('small', '', `${count} 条记录`), el('span', 'character-tile-preview', latest || '留下一点生活的痕迹'), p.icon('right'));
                return button;
            }));
            const time = p.clock.textContent === 'RP' ? '—:—' : p.clock.textContent;
            return el('div', 'character-phone character-phone-home', top,
                el('div', 'character-phone-widget', el('small', '', 'A GLIMPSE OF THEIR DAY'), el('strong', '', time), el('span', '', `${owner.name}的私人日常`), el('span', 'character-widget-orbit')),
                el('div', 'character-phone-section-label', el('span', '', '手机里的生活'), el('small', '', '查看或按需生成')), grid,
                el('div', 'character-phone-home-bottom', p.button(staged.length ? `${staged.length} 个栏目待注入 · 查看` : '选择记录，再同步到剧情', () => this.syncEditor(state, owner), 'character-phone-sync-status'), p.button('返回我的手机', () => p.navigate('home'), 'character-phone-exit')));
        }
        let body;
        if (this.app === 'messages') body = this.messages(state, owner, rows);
        else {
            const entries = (contents[this.app]?.items || []).map(item => ({ ...item, time: historicalTime(item.time, contents[this.app].rpTime) }));
            body = el('div', `character-phone-records character-records-${this.app}`, ...entries.map((item, index) => {
                if (this.app === 'notes') return el('article', 'character-note', el('small', 'character-note-number', `NOTE ${String(index + 1).padStart(2, '0')}`), el('h3', '', item.title), el('p', '', item.content), item.time ? el('small', '', item.time) : null);
                if (this.app === 'history') return el('article', 'character-history', el('span', 'character-record-icon', p.icon('search')), el('div', '', el('h3', '', item.title), el('p', '', item.summary), el('small', '', [item.site, item.time].filter(Boolean).join(' · '))));
                return el('article', 'character-cart-item', el('span', 'character-cart-art', p.icon('gift')), el('div', '', el('h3', '', item.name), el('p', '', item.reason), item.time ? el('small', '', item.time) : null, el('div', 'character-cart-price', el('strong', '', item.price || '价格未知'), el('small', '', `× ${item.quantity}`))));
            }));
            if (!entries.length) body.append(el('div', 'character-phone-empty', p.icon(PHONE_SECTIONS[this.app][1]), el('h3', '', `暂无${PHONE_SECTIONS[this.app][0]}`), el('p', '', '点右上角生成，或一次准备多个栏目。')));
            body.append(el('p', 'character-phone-footnote', contents[this.app] ? '私人记录 · 可在「同步剧情」中选择注入' : ''));
        }
        return el('div', `character-phone character-phone-app character-app-${this.app}${this.app === 'messages' && this.thread ? ' character-phone-chat-app' : ''}`, top, body);
    }
    messages(state, owner, rows) {
        const p = this.phone, el = p.el.bind(p), groups = new Map();
        for (const row of rows) { if (!groups.has(row.thread)) groups.set(row.thread, []); groups.get(row.thread).push(row); }
        for (const group of state.groups) if (group.members.includes(owner.id) && !state.prefs.deletedThreads?.[group.id] && !groups.has(group.id)) groups.set(group.id, []);
        const info = (messages, thread) => {
            const row = messages[0], group = state.groups.find(group => group.id === thread);
            const emptyPeer = !row && state.people.find(person => person.id !== owner.id && threadKey([owner.id, person.id]) === thread);
            const ids = (group?.members || row?.participants || [emptyPeer?.id]).filter(id => id && id !== owner.id);
            const names = ids.map(id => socialNickname(state.people.find(person => person.id === id), state.settings) || row?.names[row.participants.indexOf(id)] || id);
            return { name: group?.name || names.join('、') || '聊天记录', person: ids.length === 1 ? state.people.find(person => person.id === ids[0]) || { name: names[0] } : { name: group?.name || '群' } };
        };
        const peer = this.thread && state.people.find(person => person.id !== owner.id && person.id !== PLAYER && !contactDeleted(person, state.prefs) && threadKey([owner.id, person.id]) === this.thread);
        const group = this.thread && state.groups.find(group => group.id === this.thread && group.members.includes(owner.id) && !state.prefs.deletedThreads?.[group.id]);
        if (this.thread && !groups.has(this.thread) && peer) groups.set(this.thread, []);
        if (this.thread && !groups.has(this.thread)) { this.thread = ''; this.draft = ''; this.sender = ''; }
        if (this.thread) {
            const messages = groups.get(this.thread); this.chatName = info(messages, this.thread).name;
            const bubbles = el('div', 'character-phone-bubbles', ...chatTimeline([...messages].reverse(), state.rpTime, state.chat).flatMap(({ row, text, raw }) => {
                const parts = (row.payload?.components || []).map((part, index) => p.messageComponent(part, { sourceId: row.id, index, ownerId: row.speakerId, viewer: owner.id, readOnly: true }));
                const caption = parts.length ? row.payload.caption : row.text;
                const media = parts.length === 1 && !caption && ['photo', 'sticker'].includes(row.payload.components[0].type);
                const timestamp = text ? el('small', 'character-chat-time', text) : null;
                if (timestamp) timestamp.title = raw;
                return [timestamp, el('div', `character-message ${row.speakerId === owner.id ? 'own' : ''}`, el('small', 'character-message-meta', row.speaker),
                    el('div', `character-message-bubble${media ? ' character-media-bubble' : ''}`, row.quote ? el('blockquote', '', row.quote) : null, caption ? el('p', '', caption) : null, ...parts))];
            }));
            if (!messages.length) bubbles.append(el('p', 'empty', group ? `群聊已创建，${group.members.length} 位成员。` : `开始${owner.name}与${peer.name}的聊天。`));
            return el('div', 'character-phone-conversation', el('div', 'character-chat-heading', el('strong', '', this.chatName), el('small', '', `${owner.name}的聊天记录`)), bubbles,
                (peer || group) && !contactDeleted(owner, state.prefs) ? this.composer(state, owner, peer, group)
                    : messages[0]?.participants.length === 2 && !messages[0].participants.includes(PLAYER) && !state.people.some(person => person.id === messages[0].participants.find(id => id !== owner.id))
                        ? p.button(`添加${this.chatName}为联系人并发消息`, () => p.contactEditor(owner.id, { name: this.chatName }), 'outline')
                        : el('p', 'character-phone-footnote', '可在「同步剧情」中选择当前会话'));
        }
        const list = el('div', 'list character-phone-inbox', ...[...groups].map(([id, messages]) => {
            const { name, person } = info(messages, id), latest = messages[0];
            const button = p.button('', () => { this.thread = id; this.chatName = name; this.draft = ''; this.sender = ''; p.render(p.state); }, 'list-row');
            button.append(p.avatar(person), el('span', 'list-info', el('strong', '', name), el('small', '', latest ? `${latest.speaker}：${latest.text}` : '群聊已创建')), p.icon('right')); return button;
        }));
        if (!groups.size) list.append(el('div', 'character-phone-empty', p.icon('messages'), el('h3', '', '还没有聊天记录'), el('p', '', '点「发消息」选择联系人，或先添加一位联系人。')));
        return el('div', 'character-phone-inbox-wrap', el('div', 'character-chat-actions', p.button('发消息', () => this.chatPicker(state, owner), 'outline'), p.button('新建群聊', () => this.groupEditor(state, owner), 'outline'), p.button('添加联系人', () => p.contactEditor(owner.id), 'outline')), list);
    }
    openChat(owner, peer) {
        const p = this.phone, state = p.state;
        if (!state) return;
        let target;
        try { target = characterConversation(state.people, state.prefs, owner, peer); }
        catch (error) { p.notice(error.message, true); return; }
        this.scope = state.scope; this.owner = owner; this.app = 'messages'; this.thread = target.thread.id; this.chatName = target.peer.name; this.draft = ''; this.sender = '';
        p.navigate('characterPhone');
    }
    openGroup(owner, group, notify = true) {
        const p = this.phone;
        this.scope = p.state.scope; this.owner = owner; this.app = 'messages'; this.thread = group.id; this.chatName = group.name; this.draft = ''; this.sender = '';
        p.navigate('characterPhone', null, notify);
    }
    groupEditor(state, owner) {
        const p = this.phone, name = p.input('text', '', '群聊名称（可选）'); name.maxLength = 60; name.setAttribute('aria-label', '角色群聊名称');
        const members = state.people.filter(person => person.id !== PLAYER && person.id !== owner.id && !contactDeleted(person, state.prefs)).map(person => ({ person, input: p.input('checkbox', false) }));
        const submit = p.button('创建群聊', async () => {
            if (submit.disabled || p.state?.scope !== state.scope) return;
            submit.disabled = true;
            if (!await p.action('createCharacterGroup', { owner: owner.id, members: members.filter(item => item.input.checked).map(item => item.person.id), name: name.value, scope: state.scope })) update();
        }, 'primary');
        const update = () => { const count = members.filter(item => item.input.checked).length; submit.disabled = count < 2 || count > 24; submit.textContent = `创建群聊（${count + 1} 人）`; };
        const list = p.el('div', 'group-contact-list', ...members.map(({ person, input }) => { input.setAttribute('aria-label', `群成员${person.name}`); input.onchange = update; return p.el('label', 'group-contact-row', input, p.avatar(person), p.el('span', '', person.name)); }));
        update();
        p.dialog('新建角色群聊', p.el('div', 'form', name, p.small(`${owner.name}已加入，再选择至少两位 NPC。`), list, submit));
    }
    chatPicker(state, fixedOwner) {
        const p = this.phone, people = state.people.filter(person => person.id !== PLAYER && !contactDeleted(person, state.prefs));
        const owner = p.select(people.map(person => [person.id, person.name]), fixedOwner?.id || this.owner || people.find(person => person.current)?.id || people[0]?.id);
        owner.setAttribute('aria-label', '发送消息的角色'); owner.disabled = !!fixedOwner;
        const peer = p.select([], ''); peer.setAttribute('aria-label', '角色聊天联系人');
        const start = p.button('开始聊天', () => { if (p.state?.scope === state.scope) this.openChat(owner.value, peer.value); }, 'primary');
        const update = () => {
            const previous = peer.value;
            peer.replaceChildren(...people.filter(person => person.id !== owner.value).map(person => { const option = p.el('option', '', person.name); option.value = person.id; return option; }));
            if ([...peer.options].some(option => option.value === previous)) peer.value = previous;
            start.disabled = !owner.value || !peer.value;
        };
        owner.onchange = update; update();
        p.dialog('角色与 NPC 聊天', p.el('div', 'form', p.el('label', 'field', '手机主人', owner), p.el('label', 'field', '聊天对方', peer),
            p.small('以所选角色的身份发消息。私聊仅两人知情，玩家不在会话中。'), start,
            p.button('添加联系人', () => p.contactEditor(owner.value), 'outline')));
    }
    composer(state, owner, peer, group) {
        const p = this.phone, actors = group ? state.people.filter(person => person.id !== PLAYER && group.members.includes(person.id)) : [owner];
        const writer = actors.find(person => person.id === this.sender) || owner;
        const data = { owner: owner.id, ...(group ? { group: group.id, actor: writer.id } : { peer: peer.id }), scope: state.scope };
        const identity = group ? p.select(actors.map(person => [person.id, `以${person.name}发送`]), writer.id) : p.el('span', '', `以${owner.name}发送`);
        if (group) { identity.setAttribute('aria-label', '群聊发送身份'); identity.onchange = () => { this.sender = identity.value; p.render(p.state); }; }
        const input = p.el('textarea', 'character-chat-input'); input.rows = 1; input.maxLength = 2000; input.value = this.draft; input.placeholder = '发消息';
        input.setAttribute('aria-label', `以${writer.name}发送到${group?.name || peer.name}`); input.dataset.keep = 'character-composer';
        const resize = () => { input.style.height = 'auto'; input.style.height = `${Math.max(36, Math.min(96, input.scrollHeight))}px`; };
        input.oninput = () => { this.draft = input.value; send.disabled = !input.value.trim(); resize(); };
        const send = p.button('发送', async () => {
            if (!input.value.trim() || send.disabled) return;
            send.disabled = true;
            if (!await p.action('sendCharacterMessage', { ...data, text: input.value })) send.disabled = !input.value.trim();
        }, 'primary');
        send.disabled = !input.value.trim();
        input.onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); send.click(); } };
        return p.el('div', 'character-chat-compose', p.el('div', 'character-chat-identity', identity, p.small(group ? '仅群成员知情' : '角色私聊')),
            p.el('div', 'character-chat-input-row', p.iconButton('spark', '角色发言操作', () => this.replyMenu(state, owner, peer, group, data)), input, send));
    }
    replyMenu(state, owner, peer, group, data) {
        const p = this.phone;
        const run = (name, values) => { p.closeDialog(); p.action(name, values); };
        if (!group) {
            p.dialog('角色发言', p.el('div', 'form', p.button(`让${owner.name}主动发消息`, () => run('initiateCharacterMessage', data), 'outline'), p.button(`请求${peer.name}回复`, () => run('replyCharacterMessage', data), 'outline')));
            return;
        }
        const actor = p.select(state.people.filter(person => person.id !== PLAYER && group.members.includes(person.id)).map(person => [person.id, person.name]), data.actor);
        actor.setAttribute('aria-label', '群聊发言成员');
        p.dialog(group.name, p.el('div', 'form', p.el('label', 'field', '选择发言成员', actor),
            p.button('请求所选成员发言', () => run('replyCharacterMessage', { ...data, actor: actor.value }), 'primary'),
            p.button('群聊设置', () => this.groupSettings(state, owner, group), 'outline')));
    }
    groupSettings(state, owner, group) {
        const p = this.phone, name = p.input('text', group.name, '群聊名称'); name.maxLength = 60; name.setAttribute('aria-label', '修改角色群聊名称');
        p.dialog('群聊设置', p.el('div', 'form', name, p.small(group.members.map(id => state.people.find(person => person.id === id)?.name || id).join('、')),
            p.button('保存名称', async () => { if (await p.action('renameGroup', { id: group.id, owner: owner.id, name: name.value })) p.closeDialog(); }, 'primary'),
            p.button('删除群聊', () => p.dialog('删除群聊？', p.el('div', 'form', p.small('移除角色手机中的群聊，停止未交接消息的后续注入；可在通讯录 → 已删除恢复。'),
                p.button('确认删除', () => p.action('deleteGroup', { id: group.id, owner: owner.id }), 'outline danger'))), 'outline danger')));
    }
    choices(selected, counts = null) {
        const p = this.phone;
        const inputs = Object.entries(PHONE_SECTIONS).map(([key, [title, icon]]) => {
            const input = p.input('checkbox', selected.includes(key)); input.setAttribute('aria-label', title);
            const label = p.el('label', 'character-choice', input, p.el('span', 'character-choice-icon', p.icon(icon)), p.el('span', '', title), counts ? p.el('small', '', `${counts[key]} 条`) : null);
            if (counts && !counts[key]) { input.disabled = true; input.checked = false; }
            return { key, input, label };
        });
        return { inputs, node: p.el('div', 'character-choices', ...inputs.map(item => item.label)), values: () => inputs.filter(item => item.input.checked && !item.input.disabled).map(item => item.key) };
    }
    editor(owner, section) {
        const p = this.phone, scope = p.state.scope, key = `${scope}:${owner.id}`;
        if (this.pending.has(key)) return;
        const choices = this.choices(phoneSections(section));
        const conversations = p.input('number', 6), items = p.input('number', 10);
        conversations.min = items.min = '1'; conversations.max = '12'; items.max = '30'; conversations.step = items.step = '1';
        conversations.setAttribute('aria-label', '聊天会话数量'); items.setAttribute('aria-label', '每个生活栏目条数');
        const counts = p.el('div', 'character-generation-counts', p.el('label', 'field', '聊天会话（1–12）', conversations), p.el('label', 'field', '每个生活栏目（1–30）', items));
        const hint = p.el('textarea'); hint.rows = 3; hint.maxLength = 1500; hint.placeholder = '例如：几年前和老朋友的聊天、上周的备忘、几天前的搜索……'; hint.setAttribute('aria-label', '角色手机内容要求');
        const submit = p.button('一次生成并保存', async () => {
            if (submit.disabled || this.pending.has(key)) return;
            const sections = choices.values(); if (!sections.length) return;
            submit.disabled = true; this.pending.add(key);
            const data = { actor: owner.id, sections, hint: hint.value, conversations: conversations.disabled ? 6 : Number(conversations.value), items: items.disabled ? 10 : Number(items.value) };
            p.closeDialog(); p.render(p.state);
            try { await p.action('generateCharacterPhone', data); }
            finally { this.pending.delete(key); if (p.state?.scope === scope && p.view === 'characterPhone') p.render(p.state); }
        }, 'primary');
        const update = () => { const keys = choices.values(); conversations.disabled = !keys.includes('messages'); items.disabled = !keys.some(key => key !== 'messages'); submit.disabled = !keys.length || !conversations.checkValidity() || !items.checkValidity(); };
        conversations.oninput = items.oninput = update;
        choices.inputs.forEach(({ input }) => { input.onchange = update; }); update();
        p.dialog(`${owner.name} · 生成手机内容`, p.el('div', 'form character-phone-editor', p.el('span', 'character-request-badge', p.icon('spark'), '所选内容只发送 1 次请求'), choices.node, counts,
            p.small('可包含几天前、几年前的日常记录，以人物经历和 RP 时间为准。所有选中栏目只请求一次，失败不自动重试；重新生成替换所选栏目，正文原始聊天保留。'), hint, submit));
    }
    syncEditor(state, owner) {
        const p = this.phone, records = state.characterPhoneRows || [], thread = this.app === 'messages' ? this.thread : '';
        const entries = phoneDisclosure(records, owner, state.trail, state.people, state.settings, 'all', thread);
        const counts = Object.fromEntries(entries.map(entry => [entry.section, entry.items.length]));
        const staged = records.filter(row => row.kind === 'phoneReveal' && row.speakerId === owner.id && active(row, state.trail) && row.sync !== false && !state.trail.byEvent.has(row.id));
        const defaults = staged.length ? staged.map(row => row.payload.phoneDisclosure.section) : this.app === 'home' ? [] : [this.app];
        const choices = this.choices(defaults, counts), preview = p.el('pre', 'character-sync-preview'), size = p.el('p', 'small');
        const submit = p.button('安排下一条正文注入', async () => {
            if (submit.disabled) return;
            submit.disabled = true;
            if (await p.action('syncCharacterPhone', { actor: owner.id, sections: choices.values(), thread, scope: state.scope, tail: state.trail.tail })) p.closeDialog();
            else submit.disabled = false;
        }, 'primary');
        const update = () => {
            const selected = entries.filter(entry => choices.values().includes(entry.section) && entry.items.length);
            preview.textContent = selected.map(({ section, items }) => `${PHONE_SECTIONS[section][0]}\n\n${items.map(item => {
                if (section === 'messages') return `${item.time ? `${item.time} · ` : ''}${item.from} → ${item.participants.filter(name => name !== item.from).join('、')}\n${item.text}${item.quote ? `\n引用：${item.quote}` : ''}${item.attachments?.length ? `\n${item.attachments.map(part => part.text || part.type).join('\n')}` : ''}`;
                if (section === 'notes') return `${item.title}${item.time ? ` · ${item.time}` : ''}\n${item.content}`;
                if (section === 'history') return `${[item.title, item.site, item.time].filter(Boolean).join(' · ')}${item.summary ? `\n${item.summary}` : ''}`;
                return `${item.name} × ${item.quantity}${item.price ? ` · ${item.price}` : ''}${item.reason ? `\n${item.reason}` : ''}`;
            }).join('\n\n')}`).join('\n\n────────\n\n');
            const length = JSON.stringify(selected).length;
            size.textContent = selected.length ? `${selected.length} 个栏目 · 约 ${length} 字符 · 不额外调用模型` : '勾选要让本轮正文读取的内容';
            submit.disabled = !selected.length || length > 24000;
            if (length > 24000) size.textContent = '所选记录过多，请分次选择栏目或只同步当前聊天会话。';
        };
        choices.inputs.forEach(({ input }) => { input.onchange = update; }); update();
        const details = p.el('details', 'character-sync-details', p.el('summary', '', '预览将注入的内容'), preview);
        p.dialog(`${owner.name} · 同步剧情`, p.el('div', 'form character-phone-editor', p.small(thread ? '聊天记录仅包含当前会话；其他栏目可一起勾选。' : '按栏目选择手机资料，仅本次安排的内容会随下一条正文注入。'), choices.node, size, details,
            p.el('div', 'character-sync-tip', '接下来在酒馆输入你的行动，例如：“我查看了她的手机，翻到她和朋友的聊天。” 同步只提供资料，不自动替 user 写行动或认定谁已经看见。'), submit,
            staged.length ? p.button('取消待注入内容', async () => { if (await p.action('cancelCharacterPhoneSync', { actor: owner.id, scope: state.scope })) p.closeDialog(); }, 'outline') : null));
    }
}

module.exports = { CharacterPhone, PHONE_SECTIONS, PHONE_CONTENT_PROTOCOL, phoneSections, phoneGenerationPlan, parsePhoneContents, phoneContents, characterMessages, phoneDisclosure, disclosureEvents };
