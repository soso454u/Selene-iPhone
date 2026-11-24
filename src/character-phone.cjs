const { PLAYER, active, before, clip, digest, makeEvent, socialAliases, socialNickname, threadKey, unique, storyDisclosure } = require('./domain.cjs');

const PHONE_SECTIONS = { messages: ['聊天记录', 'messages'], notes: ['备忘录', 'edit'], history: ['浏览记录', 'search'], cart: ['购物车', 'cart'] };
const PHONE_CONTENT_PROTOCOL = `本轮只准备指定角色手机里的私人生活记录，供玩家以作者视角查看，不实际发送消息，不推进正文或 RP 时间。
一次请求返回所有选中栏目，不要求追加请求。按人物设定与有效剧情写简体中文内容，不捏造重大既往事实，不让其他角色自动知情。
仅输出 JSON 对象，按本轮指定栏目返回：
{"messages":[{"peer":"其他NPC的姓名","messages":[{"from":"owner","text":"手机主人发出的原话","time":"已知剧情时间或留空"},{"from":"peer","text":"对方的原话","time":""}]}],"notes":[{"title":"标题","content":"备忘内容","time":""}],"history":[{"title":"浏览标题或搜索词","site":"网站或应用名","summary":"浏览内容摘要","time":""}],"cart":[{"name":"商品名","price":"模拟价格或留空","quantity":1,"reason":"规格或加入购物车的缘由"}]}
messages 是手机主人与其他 NPC 的已存聊天记录，from 仅用 owner / peer；不得生成 user 的发言，也不得把玩家作为新聊天的对方。已有正文与聊天原话保留，不重复改写；模拟记录不代表此刻新发消息，不应覆盖已发生事实。
默认精简：聊天 1–3 段会话，每段 2–6 句；其他选中栏目各 2–4 条即可，不为凑数扩写。上限为 6 段会话、每段 12 句、共 36 句，其余每栏 12 条。没有合理记录可用空数组，未选栏目省略。
购物车不代表已购买或付款；浏览记录不提供虚构 URL，不访问真实网站。时间未知留空，不借用设备日期。只返回数据，不输出 HTML、脚本、分析或 Markdown。`;

function phoneSections(input = 'all') {
    const keys = input === 'all' ? Object.keys(PHONE_SECTIONS) : Array.isArray(input) ? unique(input) : [input];
    if (!keys.length || keys.some(key => !Object.hasOwn(PHONE_SECTIONS, key))) throw new Error('请至少选择一个有效的手机栏目。');
    return keys;
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
        if (!Array.isArray(rows) || rows.length > (key === 'messages' ? 6 : 12)) throw new Error('角色手机栏目缺失或超过条数上限，未保存。');
        return [key, rows.map(item => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('角色手机条目无效，未保存。');
            if (key === 'messages') {
                const peer = text(item, 'peer', 60, true);
                if (/[<>\[\]{}\r\n]/.test(peer) || /^(?:owner|peer|user|player|char|npc|\$player|玩家|用户|我|你)$/i.test(peer) || [owner?.name, ...playerNames].filter(Boolean).includes(peer)) throw new Error('聊天对方必须是其他 NPC，不能替玩家生成发言。');
                if (!Array.isArray(item.messages) || !item.messages.length || item.messages.length > 12) throw new Error('生成的聊天记录格式无效，未保存。');
                messageCount += item.messages.length;
                if (messageCount > 36) throw new Error('生成聊天超过 36 句，未保存。');
                return { peer, messages: item.messages.map(message => {
                    if (!['owner', 'peer'].includes(message?.from)) throw new Error('聊天记录发送者必须是 owner 或 peer，未保存。');
                    return { from: message.from, text: text(message, 'text', 2000, true), time: text(message, 'time', 80) };
                }) };
            }
            if (key === 'notes') return { title: text(item, 'title', 100, true), content: text(item, 'content', 2000, true), time: text(item, 'time', 80) };
            if (key === 'history') return { title: text(item, 'title', 200, true), site: text(item, 'site', 100), summary: text(item, 'summary', 1000), time: text(item, 'time', 80) };
            const quantity = item.quantity ?? 1;
            if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new Error('购物车商品数量无效，未保存。');
            return { name: text(item, 'name', 150, true), price: text(item, 'price', 100), quantity, reason: text(item, 'reason', 500) };
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
                generated.push({ ...source, id: `${source.id}:${index}:${offset}`, sourceId: source.id, generatedPhone: true, kind: 'message', stamp: source.stamp + offset / 100,
                    speakerId: from.id, speaker: from.name, participants: [id, peer.id], audience: [id, peer.id], names: [author.name, peer.name], audienceNames: [author.name, peer.name],
                    thread: threadKey([id, peer.id]), text: message.text, rpTime: message.time, payload: undefined, quote: '' });
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
            ...(row.payload?.components?.length ? { attachments: row.payload.components.map(part => ({ type: part.type, text: part.text, fields: Object.fromEntries(Object.entries(part.fields || {}).filter(([key]) => !['src', 'url'].includes(key))) })) } : {}) })) : contents[section]?.items || [];
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
    reset() { this.owner = ''; this.app = 'home'; this.thread = ''; this.scope = ''; }
    back() {
        if (this.thread) this.thread = '';
        else if (this.app !== 'home') this.app = 'home';
        else { this.phone.navigate('home'); return; }
        this.phone.render(this.phone.state);
    }
    get title() { return this.thread ? this.chatName || '聊天记录' : this.app === 'home' ? '角色手机' : PHONE_SECTIONS[this.app]?.[0] || '角色手机'; }
    home() { this.app = 'home'; this.thread = ''; this.phone.render(this.phone.state); }
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
        choose.onchange = () => { this.owner = choose.value; this.app = 'home'; this.thread = ''; p.render(p.state); };
        const identity = el('div', 'character-phone-owner', p.avatar(owner), el('div', 'list-info', choose, el('small', '', 'PRIVATE PHONE · 角色视角')));
        const generate = p.button('', () => this.editor(owner, this.app === 'home' ? 'all' : this.app), 'character-phone-generate', '生成手机内容');
        const generating = this.pending.has(`${state.scope}:${owner.id}`);
        generate.append(p.icon('spark'), el('span', '', generating ? '生成中' : '生成')); generate.disabled = generating;
        const sync = p.button('', () => this.syncEditor(state, owner), 'character-phone-sync', '同步剧情');
        sync.append(p.icon('sync'), el('span', '', '同步剧情'));
        const top = el('div', 'character-phone-top', identity, el('div', 'character-phone-tools', generate, sync));
        const changeApp = app => { this.app = app; this.thread = ''; p.render(p.state); };
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
            const entries = contents[this.app]?.items || [];
            body = el('div', `character-phone-records character-records-${this.app}`, ...entries.map((item, index) => {
                if (this.app === 'notes') return el('article', 'character-note', el('small', 'character-note-number', `NOTE ${String(index + 1).padStart(2, '0')}`), el('h3', '', item.title), el('p', '', item.content), item.time ? el('small', '', item.time) : null);
                if (this.app === 'history') return el('article', 'character-history', el('span', 'character-record-icon', p.icon('search')), el('div', '', el('h3', '', item.title), el('p', '', item.summary), el('small', '', [item.site, item.time].filter(Boolean).join(' · '))));
                return el('article', 'character-cart-item', el('span', 'character-cart-art', p.icon('gift')), el('div', '', el('h3', '', item.name), el('p', '', item.reason), el('div', 'character-cart-price', el('strong', '', item.price || '价格未知'), el('small', '', `× ${item.quantity}`))));
            }));
            if (!entries.length) body.append(el('div', 'character-phone-empty', p.icon(PHONE_SECTIONS[this.app][1]), el('h3', '', `暂无${PHONE_SECTIONS[this.app][0]}`), el('p', '', '点右上角生成，或一次准备多个栏目。')));
            body.append(el('p', 'character-phone-footnote', contents[this.app] ? '私人记录 · 可在「同步剧情」中选择注入' : ''));
        }
        return el('div', `character-phone character-phone-app character-app-${this.app}`, top, body);
    }
    messages(state, owner, rows) {
        const p = this.phone, el = p.el.bind(p), groups = new Map();
        for (const row of rows) { if (!groups.has(row.thread)) groups.set(row.thread, []); groups.get(row.thread).push(row); }
        const info = messages => {
            const row = messages[0], ids = row.participants.filter(id => id !== owner.id);
            const names = ids.map(id => socialNickname(state.people.find(person => person.id === id), state.settings) || row.names[row.participants.indexOf(id)] || id);
            const group = state.groups.find(group => group.id === row.thread);
            return { name: group?.name || names.join('、') || '聊天记录', person: ids.length === 1 ? state.people.find(person => person.id === ids[0]) || { name: names[0] } : { name: group?.name || '群' } };
        };
        if (this.thread && !groups.has(this.thread)) this.thread = '';
        if (this.thread) {
            const messages = groups.get(this.thread); this.chatName = info(messages).name;
            const bubbles = el('div', 'character-phone-bubbles', ...[...messages].reverse().map(row => {
                const parts = (row.payload?.components || []).map((part, index) => p.messageComponent(part, { sourceId: row.id, index, ownerId: row.speakerId, readOnly: true }));
                const caption = parts.length ? row.payload.caption : row.text;
                return el('div', `character-message ${row.speakerId === owner.id ? 'own' : ''}`, el('small', 'character-message-meta', `${row.speaker}${row.rpTime ? ` · ${row.rpTime}` : ''}${row.generatedPhone ? ' · 模拟记录' : ''}`),
                    el('div', 'character-message-bubble', row.quote ? el('blockquote', '', row.quote) : null, caption ? el('p', '', caption) : null, ...parts));
            }));
            return el('div', 'character-phone-conversation', el('div', 'character-chat-heading', el('strong', '', this.chatName), el('small', '', `${owner.name}的聊天记录`)), bubbles, el('p', 'character-phone-footnote', '查看不发送消息 · 可同步当前会话到剧情'));
        }
        const list = el('div', 'list character-phone-inbox', ...[...groups].map(([id, messages]) => {
            const { name, person } = info(messages), latest = messages[0];
            const button = p.button('', () => { this.thread = id; this.chatName = name; p.render(p.state); }, 'list-row');
            button.append(p.avatar(person), el('span', 'list-info', el('strong', '', name), el('small', '', `${latest.speaker}：${latest.text}`)), p.icon('right')); return button;
        }));
        if (!groups.size) list.append(el('div', 'character-phone-empty', p.icon('messages'), el('h3', '', '还没有聊天记录'), el('p', '', '已有正文消息会自动收录，也可点右上角生成角色与 NPC 的聊天。')));
        return list;
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
        const hint = p.el('textarea'); hint.rows = 3; hint.maxLength = 1500; hint.placeholder = '例如：和朋友的日常聊天、还没送出的礼物、最近的搜索……'; hint.setAttribute('aria-label', '角色手机内容要求');
        const submit = p.button('一次生成并保存', async () => {
            if (submit.disabled || this.pending.has(key)) return;
            const sections = choices.values(); if (!sections.length) return;
            submit.disabled = true; this.pending.add(key);
            const data = { actor: owner.id, sections, hint: hint.value };
            p.closeDialog(); p.render(p.state);
            try { await p.action('generateCharacterPhone', data); }
            finally { this.pending.delete(key); if (p.state?.scope === scope && p.view === 'characterPhone') p.render(p.state); }
        }, 'primary');
        const update = () => { submit.disabled = !choices.values().length; };
        choices.inputs.forEach(({ input }) => { input.onchange = update; }); update();
        p.dialog(`${owner.name} · 生成手机内容`, p.el('div', 'form character-phone-editor', p.el('span', 'character-request-badge', p.icon('spark'), '所选内容只发送 1 次请求'), choices.node,
            p.small('聊天和生活记录合并生成，失败不自动重试。重新生成替换所选栏目的模拟记录，正文原始聊天保留。'), hint, submit));
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

module.exports = { CharacterPhone, PHONE_SECTIONS, PHONE_CONTENT_PROTOCOL, phoneSections, parsePhoneContents, phoneContents, characterMessages, phoneDisclosure, disclosureEvents };
