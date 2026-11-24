const { before, active, clip, digest, dialogue, handoffs, lineage, makeEvent, parseStory, serializeHandoff, threadKey } = require('./domain.cjs');
const { cacheMemoryBlocks } = require('./story-sources.cjs');
const { STICKERS, xSideStory } = require('./media.cjs');
const { collapseEventConflicts } = require('./event-merge.cjs');
const { conversationDeleted } = require('./conversations.cjs');

const echoText = value => String(value || '').replace(/\r\n/g, '\n').trim();
function messageEchoKey(row, settings) {
    if (row.kind !== 'message') return '';
    let parts = row.payload?.components || [];
    let text = parts.length ? echoText(row.payload.caption) : echoText(row.text);
    if (parts.length === 1 && parts[0].type === 'reply') { text = echoText(parts[0].text); parts = []; }
    const components = parts.map(part => {
        const fields = { ...part.fields };
        if (part.type === 'sticker') {
            const name = echoText(fields.name || part.text);
            fields.name = name;
            fields.src = fields.src || settings.customStickers?.find(row => row.name === name)?.url || STICKERS[name] || '';
            return { type: part.type, text: name, fields: Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)) };
        }
        return { type: part.type, text: echoText(part.text), fields: Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)) };
    });
    return JSON.stringify([row.speakerId, row.thread, [...row.participants].sort(), [...row.audience].sort(), echoText(row.quote), text, components]);
}
function differentMessageTime(left, right) {
    const clock = value => echoText(value).match(/\b(\d{1,2}:\d{2})(?::\d{2})?\b/)?.[1];
    const date = value => echoText(value).match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/)?.slice(1).map(Number).join('-');
    return !!((clock(left) && clock(right) && clock(left) !== clock(right)) || (date(left) && date(right) && date(left) !== date(right)));
}

function matchHandoffEchoes(events, originals, settings) {
    const remaining = originals.map((row, index) => ({ ...row, index }));
    const matches = new Map();
    for (const [index, event] of events.entries()) {
        const key = messageEchoKey(event, settings);
        const found = remaining.findIndex(source => key && source.key === key && !differentMessageTime(source.event.rpTime, event.rpTime));
        if (found >= 0) matches.set(index, remaining.splice(found, 1)[0]);
    }
    const mediaKey = row => {
        const parts = row.payload?.components;
        if (!parts?.length || parts.some(part => !['photo', 'video'].includes(part.type))) return '';
        return messageEchoKey({ ...row, text: '', payload: { components: parts.map(part => ({ type: part.type, text: '', fields: {} })) } }, settings);
    };
    for (const [index, event] of events.entries()) {
        if (matches.has(index)) continue;
        const key = mediaKey(event), previous = matches.get(index - 1), next = matches.get(index + 1);
        // A rewritten media description is the same send only when exact
        // neighbouring echoes bracket one unique original attachment.
        if (!key || !previous || !next) continue;
        const candidates = remaining.filter(source => source.index > previous.index && source.index < next.index && mediaKey(source.event) === key && !differentMessageTime(source.event.rpTime, event.rpTime));
        if (candidates.length === 1) {
            matches.set(index, candidates[0]); remaining.splice(remaining.indexOf(candidates[0]), 1);
        }
    }
    return matches;
}

async function handedOffMessages({ ledger, scope, chat, trail, floor, settings }) {
    if (chat[floor].is_user) return [];
    let prior = floor - 1;
    while (prior >= 0 && !dialogue(chat[prior])) prior--;
    if (prior < 0 || !chat[prior].is_user) return [];
    const entries = handoffs(chat[prior].mes).flatMap(block => block.events);
    const originals = await Promise.all(entries.map(async item => {
        if (typeof item?.id !== 'string' || trail.byEvent.get(item.id)?.floor !== prior) return null;
        const event = await ledger.get(scope, item.id);
        return event?.origin === 'phone' && event.kind === 'message' && active(event, trail) && event.text === item.原话 ? { event, key: messageEchoKey(event, settings) } : null;
    }));
    return originals.filter(Boolean);
}

function postSyncEnabled(post, settings, prefs = {}) {
    if (xSideStory(post)) return false;
    for (const key of [post.id, post.reference].filter(Boolean)) if (typeof prefs.postSync?.[key] === 'boolean') return prefs.postSync[key];
    return post.origin === 'phone' ? post.sync !== false : settings.socialSync?.[post.thread] === true;
}

async function blockedPostSync(ledger, scope, trail) {
    const prefs = await ledger.readMeta(`${scope}:prefs`) || {};
    const blocked = new Set(Object.entries(prefs.postSync || {}).filter(([, enabled]) => enabled === false).map(([id]) => id));
    if (blocked.size) {
        const posts = await ledger.query(scope, { limit: Infinity, accept: row => row.kind === 'post' && active(row, trail) && (blocked.has(row.id) || blocked.has(row.reference)) });
        for (const post of posts.rows) { blocked.add(post.id); if (post.reference) blocked.add(post.reference); }
    }
    blocked.prefs = prefs;
    return blocked;
}
const allowedSync = (row, blocked) => !row.echoOf && !conversationDeleted(row, blocked.prefs) && row.kind !== 'phoneSnapshot' && !xSideStory(row) && row.sync !== false && (row.kind === 'post' ? !blocked.has(row.id) && !blocked.has(row.reference) : !blocked.has(row.target));

async function pendingSyncEvents(ledger, scope, trail, limit = 35, onlyReveals = false) {
    const blocked = await blockedPostSync(ledger, scope, trail);
    const reveals = await ledger.query(scope, { origin: 'phone', newest: false, limit: Infinity, accept: event => event.kind === 'phoneReveal' && active(event, trail) && allowedSync(event, blocked) && !trail.byEvent.has(event.id) });
    const pending = onlyReveals ? { rows: [] } : await ledger.query(scope, { origin: 'phone', newest: false, limit, accept: event => event.kind !== 'phoneReveal' && active(event, trail) && allowedSync(event, blocked) && !trail.byEvent.has(event.id) });
    // A switch may change while IndexedDB is reading the pending records.
    const latest = await blockedPostSync(ledger, scope, trail);
    const freshReveals = await Promise.all(reveals.rows.map(row => ledger.get(scope, row.id)));
    return [...freshReveals.filter(row => row && active(row, trail) && allowedSync(row, latest) && !trail.byEvent.has(row.id)), ...pending.rows.filter(row => allowedSync(row, latest))];
}

function payloadParts(payload) {
    const messages = Array.isArray(payload) ? payload : payload?.messages ?? payload?.chat;
    if (Array.isArray(messages) && messages.length) return messages.flatMap(message => {
        if (typeof message?.content === 'string') return [{ role: message.role, text: message.content }];
        return Array.isArray(message?.content) ? message.content.filter(part => part?.type === 'text' && typeof part.text === 'string').map(part => ({ role: message.role, text: part.text })) : [];
    });
    const flat = typeof payload?.prompt === 'string' ? payload.prompt : typeof messages === 'string' ? messages : '';
    return flat ? [{ role: 'completion', text: flat }] : [];
}

function parserRevision(settings, people) {
    const identities = people.map(person => [person.id, person.name]).sort((left, right) => left[0].localeCompare(right[0]));
    return digest(JSON.stringify([6, settings.socialAliases, settings.eventTag, settings.jsonTag, settings.imessage, settings.prose, identities]));
}

async function reconcileStories({ ledger, scope, chat, trail, people, groups, settings, valid }) {
    // Old cloud backups may contain copies caused solely by derived state.
    // Mark those aliases locally; retain the records and real edit conflicts.
    const repairKey = `${scope}:story:conflicts-v1`;
    if (!await ledger.readMeta(repairKey)) {
        const saved = await ledger.query(scope, { limit: Infinity });
        const repaired = collapseEventConflicts(saved.rows).filter((row, index) => row.echoOf !== saved.rows[index].echoOf);
        if (valid()) await ledger.write(repaired, [{ key: repairKey, value: true }]);
    }
    if (!settings.reverse) return '';
    const parser = parserRevision(settings, people);
    // Rescan once for echo matching without changing source IDs or image links.
    const metaKey = `${scope}:story:${parser}:echo-v3`;
    const previous = await ledger.readMeta(metaKey) || [];
    const cleared = await ledger.readMeta(`${scope}:clearedStory`) || [];
    const records = [];
    const echoUpdates = [];
    const posts = new Map();
    const now = Date.now();
    let first = 0;
    while (first < chat.length && previous[first + 1] === trail.hashes[first + 1]) first++;
    for (let floor = first; floor < chat.length; floor++) {
        if (cleared[floor + 1] === trail.hashes[floor + 1]) continue;
        const row = chat[floor];
        if (!dialogue(row)) continue;
        const seen = new Set();
        const anchor = before(trail, floor + 1);
        const stamp = Date.parse(row.gen_finished || row.send_date) || now - (chat.length - floor) * 100;
        const items = parseStory(row, people, settings);
        const echoes = items.some(item => item.kind === 'message') ? await handedOffMessages({ ledger, scope, chat, trail, floor, settings }) : [];
        const threadFor = item => {
            const candidates = groups.filter(group => threadKey(group.members) === threadKey(item.participants));
            return ['post', 'comment', 'like', 'collect', 'repost', 'follow'].includes(item.kind) ? item.thread || 'moments' : item.thread || (candidates.length === 1 ? candidates[0].id : undefined);
        };
        const matchedEchoes = matchHandoffEchoes(items.map(item => makeEvent(scope, trail, { ...item, thread: threadFor(item) }, people)), echoes, settings);
        for (const [index, item] of items.entries()) {
            const signature = digest(JSON.stringify(item));
            if (seen.has(signature)) continue;
            seen.add(signature);
            if ((item.kind === 'comment' || item.kind === 'like') && item.target) {
                if (!posts.has(item.target)) {
                    const post = await ledger.query(scope, { thread: item.thread || 'moments', limit: 1, accept: event => event.kind === 'post' && (event.id === item.target || event.reference === item.target) && active(event, trail) && (event.origin !== 'tavern' || (event.parser === parser && event.floor <= floor)) });
                    posts.set(item.target, post.rows[0]);
                }
                const target = posts.get(item.target);
                if (target) {
                    if (!target.audience.includes(item.speakerId)) continue;
                    item.audience = item.audience.filter(id => target.audience.includes(id));
                }
            }
            const thread = threadFor(item);
            const event = makeEvent(scope, trail, { ...item, thread }, people, {
                id: `st:${parser}:${anchor.key}:${signature}`, origin: 'tavern', floor, anchor, stamp: stamp + index,
                parser, sync: false, reference: clip(item.reference, 120),
            });
            if (matchedEchoes.has(index)) {
                const source = matchedEchoes.get(index).event;
                const previous = await ledger.get(scope, event.id);
                if (previous?.origin === 'tavern' && previous.echoOf !== source.id) echoUpdates.push({ ...previous, echoOf: source.id, revision: previous.revision + 1 });
                // Keep the sourced picture description while showing only the
                // original send. It remains a hidden, branch-scoped reference.
                if (!previous && event.payload?.components?.some(part => part.type === 'photo')) records.push({ ...event, echoOf: source.id });
                continue;
            }
            if (event.kind === 'post' && event.reference) posts.set(event.reference, event);
            records.push(event);
        }
    }
    if (valid() && (first !== chat.length || previous.length !== trail.hashes.length)) {
        if (echoUpdates.length) await ledger.write(echoUpdates);
        if (valid()) await ledger.write(records, [{ key: metaKey, value: trail.hashes }], true);
    }
    return parser;
}

class Sync {
    constructor({ ledger, getState, onError, onChange, onSourcesChanged }) {
        Object.assign(this, { ledger, getState, onError, onChange, onSourcesChanged });
        this.listeners = [];
        this.armed = new Set();
    }

    attach(context) {
        const source = context.eventSource;
        const types = context.eventTypes;
        if (!source?.on || !types) throw new Error('当前酒馆缺少正文事件接口');
        const on = (name, handler) => {
            if (!types[name]) return;
            const run = (...args) => {
                try { return Promise.resolve(handler(...args)).catch(error => { if (!this.closed) this.onError(error); }); }
                catch (error) { if (!this.closed) this.onError(error); }
            };
            source.on(types[name], run);
            this.listeners.push(() => source.removeListener(types[name], run));
        };
        on('GENERATION_AFTER_COMMANDS', (type, options, dryRun) => this.begin(type, options, dryRun));
        on('MESSAGE_SENT', floor => this.sent(floor));
        on('GENERATE_AFTER_DATA', (payload, dryRun) => this.capture(payload, dryRun));
        on('CHAT_COMPLETION_SETTINGS_READY', payload => this.capture(payload));
        on('WORLD_INFO_ACTIVATED', entries => {
            const state = this.getState();
            if (this.round && state?.scope === this.round.scope && Array.isArray(entries)) {
                this.round.lore = entries.filter(entry => typeof entry?.content === 'string' && !entry.disable).map(({ content, world, comment, uid, outletName }) => ({ content, world, comment, uid, outletName }));
            }
        });
        on('GENERATION_STOPPED', () => { this.round = null; this.stopped = true; });
        on('MESSAGE_RECEIVED', async (floor, type) => {
            if (type === 'first_message') return;
            this.onChange(false, await this.received(floor) ? floor : null);
        });
        on('CHARACTER_MESSAGE_RENDERED', () => this.onChange());
        for (const name of ['MESSAGE_EDITED', 'MESSAGE_UPDATED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED']) on(name, () => this.onChange());
        on('CHAT_CHANGED', () => { this.round = null; this.snapshot = null; this.loreSnapshot = null; this.stopped = false; this.armed.clear(); this.onChange(true); });
        for (const name of ['WORLDINFO_UPDATED', 'WORLDINFO_SETTINGS_UPDATED', 'PERSONA_CHANGED']) {
            on(name, () => { this.loreSnapshot = null; if (this.round) this.round.lore = null; this.onSourcesChanged?.(); });
        }
    }

    arm(scope) { this.armed.add(scope); }

    begin(type, options, dryRun) {
        if (dryRun || this.closed || ![undefined, 'normal', 'regenerate', 'swipe', 'continue'].includes(type) || options?.quiet_prompt || options?.quietToLoud) return;
        const state = this.getState();
        this.stopped = false;
        if (!state) { this.round = null; return; }
        this.round = { scope: state.scope, length: state.chat.length, targetFloor: ['swipe', 'continue'].includes(type) ? Math.max(0, state.chat.length - 1) : undefined, allowWrite: [undefined, 'normal'].includes(type) && !options?.automatic_trigger, started: Date.now(), signal: options?.signal };
    }

    async sent(floor) {
        const round = this.round;
        const state = this.getState();
        if (this.closed || !round?.allowWrite || round.signal?.aborted || Date.now() - round.started > 60000
            || !state || round.scope !== state.scope || floor !== state.chat.length - 1 || floor !== round.length) return;
        round.allowWrite = false;
        const { context, chat, scope, settings } = state;
        const row = chat[floor];
        if (!row?.is_user || !dialogue(row) || !clip(row.mes) || handoffs(row.mes).length) return;
        const original = row.mes;
        const trail = lineage(chat);
        const automatic = settings.sync === 'auto' || settings.sync === 'manual' && this.armed.has(scope);
        let pending = await pendingSyncEvents(this.ledger, scope, trail, 35, !automatic);
        const current = this.getState();
        if (this.closed || this.round !== round || round.signal?.aborted || current?.scope !== scope || current.chat !== chat || chat[floor] !== row || row.mes !== original || lineage(chat).tail !== trail.tail) return;
        const stillAutomatic = current.settings.sync === 'auto' || current.settings.sync === 'manual' && this.armed.has(scope);
        if (!stillAutomatic) pending = pending.filter(row => row.kind === 'phoneReveal');
        // Explicitly chosen phone records are complete and one-shot. Reserve their
        // actual encoded size, retaining the normal budget for other phone events.
        const reveals = pending.filter(row => row.kind === 'phoneReveal');
        const extra = reveals.length ? serializeHandoff(reveals, Infinity).block.length : 0;
        const handoff = serializeHandoff(pending, current.settings.syncChars + extra);
        if (!handoff.block) {
            if (pending.length) this.onError(new Error('最早的待同步事件超过交接预算；请调高设置中的交接字数。'));
            return;
        }
        const combined = `${original}\n\n${handoff.block}`;
        row.mes = combined;
        try { await context.saveChat(); }
        catch (error) { if (row.mes === combined) row.mes = original; throw error; }
        this.armed.delete(scope);
        this.onChange();
    }

    capture(payload, dryRun) {
        const round = this.round;
        if (dryRun || this.closed || !round || round.signal?.aborted || this.stopped) return;
        const state = this.getState();
        if (!state || round.scope !== state.scope) return;
        round.allowWrite = false;
        const trail = lineage(state.chat);
        const parts = payloadParts(payload);
        if (!parts.some(part => part.text)) return;
        round.gotPayload = true;
        const boundary = state.chat.findLastIndex(row => dialogue(row) && !row.is_user);
        round.inputAnchor = before(trail, Math.min(round.targetFloor ?? state.chat.length, state.chat.length));
        round.observed = [...trail.byEvent.entries()].filter(([, source]) => source.floor > boundary && parts.some(part => part.text.includes(source.raw)));
        const cache = state.context.chatMetadata?.cache_memory?.injectionSnapshot?.value;
        const registered = state.context.extensionPrompts?.cache_memory_injection;
        const known = new Set([...cacheMemoryBlocks(cache), ...cacheMemoryBlocks(registered?.position >= 0 ? registered.value : '')]);
        const candidates = [...new Set(parts.flatMap(part => cacheMemoryBlocks(part.text).filter(value => known.has(value)
            || (['system', 'developer', 'completion'].includes(part.role) && /^\[(?:LONG(?:_MEMORY)?(?:_[\w-]+)?|CHECKPOINT(?:_[\w-]+)?|CP_[\w-]+|RECENT_SUMMARY_\d+|KEEP)(?:\s*\|[^\]\r\n]+)?\]/i.test(value)))))];
        round.memory = [];
        if (candidates.length) {
            const historyBlocks = new Set(state.chat.flatMap(row => cacheMemoryBlocks(row?.mes)));
            round.memory = candidates.filter(value => !historyBlocks.has(value)).slice(-4);
        }
    }

    async received(floor) {
        const round = this.round;
        const state = this.getState();
        if (!state || !round || round.scope !== state.scope || round.signal?.aborted || this.stopped) return;
        this.round = null;
        if (!round.gotPayload) return;
        const row = state.chat[floor];
        if (!dialogue(row) || row.is_user || !clip(row.mes)) return;
        const trail = lineage(state.chat);
        if (round.inputAnchor?.key !== trail.hashes[round.inputAnchor?.length]) return;
        const anchor = before(trail, floor + 1);
        if (round.memory.length) this.snapshot = { scope: state.scope, anchor, memory: round.memory };
        else this.snapshot = null;
        this.loreSnapshot = round.lore?.length ? { scope: state.scope, anchor, entries: round.lore } : null;
        if (!round.observed?.length) return true;
        const events = await Promise.all(round.observed.map(async ([id, source]) => {
            const event = await this.ledger.get(state.scope, id);
            return event && active(event, trail) && trail.byEvent.get(id)?.raw === source.raw ? { ...event, participation: { batch: source.batch, source: source.prefix, content: digest(source.raw), reply: before(trail, floor + 1) } } : null;
        }));
        if (!this.closed) await this.ledger.write(events.filter(Boolean));
        return true;
    }

    close() {
        this.closed = true;
        this.listeners.splice(0).forEach(remove => remove());
        this.round = null;
        this.snapshot = null;
        this.loreSnapshot = null;
        this.armed.clear();
    }
}

module.exports = { Sync, reconcileStories, parserRevision, postSyncEnabled, pendingSyncEvents };
