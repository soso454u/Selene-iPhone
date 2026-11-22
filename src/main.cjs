const { RequestQueue } = require('./request-queue.cjs');
const { PLAYER, active, before, clip, digest, dialogue, eventStatus, lineage, makeEvent, newId, threadKey, unique, socialAliases, socialNickname, screenPeople } = require('./domain.cjs');
const { PHONE_SECTIONS, phoneSections, parsePhoneContents, phoneContents, characterMessages, phoneDisclosure, disclosureEvents } = require('./character-phone.cjs');
const { DEFAULTS, phoneSettings, normalizeOutput, basePeople, scanPeople, buildContext, loadModule } = require('./context.cjs');
const { DEFAULT_PRESET, PRESET_LIMIT, validatePreset, postCounts, SOCIAL_COMMON_PROMPT, cleanPlatformPrompts } = require('./phone-preset.cjs');
const { Ledger, conversationMemory, checkpoint } = require('./storage.cjs');
const { Sync, reconcileStories, postSyncEnabled } = require('./sync.cjs');
const { Transport, parseReply, filterPlayerComments } = require('./api.cjs');
const { Phone } = require('./ui.cjs');
const { Resources } = require('./resources.cjs');
const { Cloud } = require('./cloud.cjs');
const { portablePhone, portableSettings } = require('./portable.cjs');
const { Photos, photoSource, photoSources } = require('./photos.cjs');
const { ImageService, namedReferences } = require('./image-service.cjs');
const { CardStyles, STYLE_KEYS, styleValues, boundStyle } = require('./card-style.cjs');
const { PLATFORMS, platformId, safeUrl } = require('./media.cjs');
const { profileValues, saveProfile, cleanCredentials, generationConnection } = require('./api-profiles.cjs');
const { PAGES, cleanBackground, selectBackground, backgroundStyle } = require('./backgrounds.cjs');
const { resolveRpTime } = require('./story-time.cjs');

const KEY = 'tavern-pocket:v1';

function start(frame) {
    let host = frame;
    try { if (frame.parent.document.body) host = frame.parent; } catch { host = frame; }
    const getContext = () => (host.SillyTavern || frame.SillyTavern)?.getContext?.();
    const context = getContext();
    if (!context?.accountStorage || !context?.eventSource || !host.indexedDB) {
        host.toastr?.error('Selene手机无法启动：缺少 SillyTavern 上下文、账号存储或 IndexedDB。');
        return;
    }
    const slot = Symbol.for('tavern-pocket.v1.dispose');
    host[slot]?.();
    let account = context.accountStorage.getItem(`${KEY}:account`);
    if (!account) { account = newId(); context.accountStorage.setItem(`${KEY}:account`, account); }
    let settings = phoneSettings();
    try {
        const saved = JSON.parse(context.accountStorage.getItem(`${KEY}:settings`) || '{}');
        settings = phoneSettings(saved);
        if (Object.keys(saved ?? {}).some(key => !Object.hasOwn(DEFAULTS, key)) || saved?.outputLimitVersion !== 1 || saved?.autoCloudDefaultVersion !== 1 || saved?.socialCommonPrompt !== settings.socialCommonPrompt || JSON.stringify(saved?.platformPrompts || {}) !== JSON.stringify(settings.platformPrompts) || (Object.hasOwn(saved ?? {}, 'preset') && settings.preset !== saved.preset)) context.accountStorage.setItem(`${KEY}:settings`, JSON.stringify(settings));
    } catch {}
    let accountSettings = settings;
    const helper = host.TavernHelper || frame.TavernHelper;
    const ledger = new Ledger(host);
    const styles = new CardStyles(ledger, account);
    const photos = new Photos(ledger, host);
    const images = new ImageService(host, ledger, account, getContext);
    const transport = new Transport(host);
    let credentials = cleanCredentials();
    try { credentials = cleanCredentials(JSON.parse(context.accountStorage.getItem(`${KEY}:credentials`) || '{}')); } catch {}
    transport.token = credentials.current;
    const resources = new Resources(host, helper, context);
    let mutationSerial = 0;
    const cloud = new Cloud(host, ledger, {
        revision: () => mutationSerial,
        retry: session => queueCloud(session),
        capture: async session => ({ settings: accountSettings, image: await images.load(), style: !session.context.groupId ? styles.values(session.context.characters?.[session.context.characterId]) : null }),
        apply: async (input, session) => {
            const data = portablePhone(input);
            if (!session.valid()) return;
            if (data.image) {
                const root = structuredClone(await images.load());
                for (const [mode, values] of Object.entries(data.image.profiles)) root.profiles[mode] = { ...root.profiles[mode], ...values };
                Object.assign(root, Object.fromEntries(Object.entries(data.image).filter(([key]) => key !== 'profiles')));
                await ledger.saveMeta(images.key, root); images.config = root;
            }
            if (data.settings) {
                accountSettings = phoneSettings({ ...accountSettings, ...portableSettings(data.settings) });
                session.context.accountStorage.setItem(`${KEY}:settings`, JSON.stringify(accountSettings));
            }
            const card = !session.context.groupId && session.context.characters?.[session.context.characterId];
            if (data.style && card) await styles.saveLocal(card, { ...settings, ...data.style });
            getState(); phone.appearance(settings); prepared = null; scan = null;
        },
    });
    ledger.onWrite = (events, meta) => {
        if (cloud.applying || disposed || clearing) return;
        mutationSerial++;
        const state = getState();
        if (!state) return;
        const prefix = `${state.scope}:`;
        if (events.some(row => row.scope === state.scope) || meta.some(row => row.key === images.key || row.key.startsWith('card-style:') || row.key.startsWith('background:') || row.key === `photos:${state.scope}` || row.key.startsWith(prefix) && !/:(?:story:|cloud-state|auto:|checkpoint:)/.test(row.key.slice(state.scope.length)))) queueCloud(state);
    };
    let cloudTimer;
    function queueCloud(session = getState()) {
        if (!settings.autoCloud || !session || disposed || clearing) return;
        host.clearTimeout(cloudTimer);
        cloudTimer = host.setTimeout(async () => {
            if (disposed || clearing || !settings.autoCloud) return;
            if (cloud.busy) { queueCloud(session); return; }
            try {
                const fresh = await loadSession();
                if (fresh?.scope === session.scope && fresh.valid()) {
                    await cloud.sync(fresh); phone.updateCloudStatus(cloud.status);
                    if (phone.view !== 'settings' && !phone.pop && !phone.textInput(phone.shadow.activeElement)) await refresh();
                }
            } catch (error) { fail(error); }
        }, 1800);
    }

    let hideInstalling = false;
    async function installHiding() {
        if (hideInstalling || disposed) return;
        const fresh = getContext();
        const card = fresh?.characters?.[fresh.characterId];
        if (!card?.avatar || fresh.groupId) return;
        hideInstalling = true;
        try {
            resources.context = fresh;
            const target = await resources.inspect();
            await resources.run(target, 'hide', 'install');
        } catch (error) { host.toastr?.warning(`手机交接隐藏正则未安装：${error.message}`); }
        finally { hideInstalling = false; }
    }
    let disposed = false;
    let timer;
    let lastTavernFloor = null;
    let scan;
    let generation;
    let prepared;
    let models = [];
    let imageModels = [];
    let current;
    let lastRequest;
    let resultMessage = '';
    let running = '';
    const requests = new RequestQueue(count => { if (!disposed) phone.activity(running, count); });
    let refreshNumber = 0;
    let clearing = false;
    let dataRevision = 0;
    const downloads = new Set();

    const getState = () => {
        if (disposed) return null;
        const fresh = getContext();
        if (!fresh || fresh.accountStorage.getItem(`${KEY}:account`) !== account) return null;
        const chatId = fresh.getCurrentChatId?.();
        const card = fresh.characters?.[fresh.characterId];
        settings = phoneSettings({ ...accountSettings, ...(!fresh.groupId ? styles.values(card) : null) });
        const identity = fresh.groupId ? `group:${fresh.groupId}` : card?.avatar ? `card:${card.avatar}` : null;
        return identity && chatId && Array.isArray(fresh.chat) ? { context: fresh, scope: JSON.stringify([account, identity, String(chatId)]), chat: fresh.chat, settings, rpTime: resolveRpTime(fresh.chat, settings) } : null;
    };

    const setNotice = (message, error = false) => {
        if (disposed) return;
        resultMessage = clip(message, 250);
        phone.notice(resultMessage, error);
    };
    const fail = error => {
        let message = error?.message || '操作失败';
        for (const token of [transport.token, ...Object.values(credentials.profiles)].filter(Boolean)) message = message.split(token).join('[密钥已隐藏]');
        setNotice(message, true);
    };
    const schedule = (changed = false, floor = null) => {
        if (changed) {
            scan = null; prepared = null; current = null; models = []; lastRequest = null; lastTavernFloor = null;
            requests.clear('酒馆聊天已切换，已撤销待执行请求'); generation?.cancel(); transport.cancel(); images.cancel(); phone.reset();
        }
        if (!phone.visible || disposed) return;
        if (Number.isInteger(floor)) lastTavernFloor = floor;
        if (!changed && phone.view === 'settings') return;
        host.clearTimeout(timer);
        timer = host.setTimeout(() => refresh().then(maybeInitiate).catch(fail), 110);
    };
    const sync = new Sync({ ledger, getState: () => clearing ? null : getState(), onError: fail, onChange: schedule, onSourcesChanged: () => { scan = null; prepared = null; } });
    const accepts = (session, event) => !event.echoOf && (event.origin === 'phone' || (settings.reverse && !!session.parser && event.parser === session.parser));

    async function loadSession(forceScan = false) {
        const fresh = getContext();
        if (!fresh?.groupId) await styles.load(fresh?.characters?.[fresh.characterId]);
        if (clearing) return null;
        const state = getState();
        if (!state) return null;
        const { scope, context: st, chat } = state;
        const trail = lineage(chat);
        const revision = dataRevision;
        const valid = () => {
            const fresh = getState();
            return revision === dataRevision && fresh?.scope === scope && fresh.chat === chat && lineage(chat).tail === trail.tail;
        };
        const [manual, groups, prefs] = await Promise.all(['contacts', 'groups', 'prefs'].map(key => ledger.readMeta(`${scope}:${key}`)));
        const avatar = await loadModule(host, 'scripts/personas.js').then(module => module.user_avatar, () => undefined);
        let people = basePeople(st, avatar, settings.userAvatar);
        if (forceScan || scan?.scope !== scope) {
            try { scan = { scope, people: await scanPeople(host, st, people) }; }
            catch { scan = { scope, people, failed: true }; }
        }
        people = [...people, ...(scan?.scope === scope ? scan.people.filter(person => !people.some(base => base.id === person.id)) : []), ...(manual || [])];
        people = screenPeople(chat, people, settings);
        if (!valid()) return null;
        const parser = await reconcileStories({ ledger, scope, chat, trail, people, groups: groups || [], settings, valid });
        if (!valid()) return null;
        const card = st.characters?.[st.characterId];
        const cardScoped = !st.groupId && styles.scoped(card);
        return { ...state, cardScoped, cardBound: !st.groupId && !!boundStyle(card), cardName: card?.name || '', trail, people, groups: groups || [], prefs: cardScoped ? { ...prefs, chatBackgrounds: {} } : prefs || {}, manual: manual || [], parser, valid, scanFailed: scan?.failed };
    }

    function resolveThreads(session, rows) {
        const { people, groups, prefs } = session;
        const contacts = people.filter(person => person.id !== PLAYER && (person.source !== '正文手机' || rows.some(row => ['message', 'call'].includes(row.kind) && row.participants.includes(person.id) && row.participants.includes(PLAYER)))).map(person => ({ id: threadKey([PLAYER, person.id]), members: [PLAYER, person.id], name: socialNickname(person, settings), avatar: person.avatar, source: person.source || '手动联系人' }));
        const threads = new Map([...contacts, ...groups].map(thread => [thread.id, thread]));
        for (const row of rows) {
            if (row.kind !== 'message' && row.kind !== 'call') continue;
            if (!threads.has(row.thread)) threads.set(row.thread, { id: row.thread, name: row.names.filter(name => name !== session.context.name1).join('、') || row.speaker, members: row.participants, source: '正文同步' });
            const thread = threads.get(row.thread);
            thread.muted = prefs.muted?.includes(thread.id) === true;
            thread.latest ??= row;
            thread.unread = (thread.unread || 0) + Number(!thread.muted && row.speakerId !== PLAYER && !(prefs.seen?.[thread.id] >= row.stamp));
        }
        return [...threads.values()].sort((left, right) => Number(!!prefs.pins?.includes(right.id)) - Number(!!prefs.pins?.includes(left.id)) || (right.latest?.stamp || 0) - (left.latest?.stamp || 0));
    }

    async function refresh({ older = false, rescan = false } = {}) {
        const sequence = ++refreshNumber;
        if (!phone.visible || disposed || clearing) return;
        const session = await loadSession(rescan);
        if (sequence !== refreshNumber || !phone.visible || disposed) return;
        if (!session) { current = null; phone.render(null); return; }
        const { scope, trail } = session;
        const accept = row => active(row, trail) && accepts(session, row) && row.audience.includes(PLAYER) && !session.prefs.hiddenSocial?.some(id => id === row.id || id === row.reference || id === row.target) && (!['message', 'call'].includes(row.kind) || row.stamp > (session.prefs.hiddenBefore?.[row.thread] || 0));
        const tab = phone.view;
        const limit = tab === 'album' ? 180 : tab === 'chat' ? 35 : PLATFORMS[tab] ? 80 : 80;
        const previous = older && current?.scope === scope && current?.trail.tail === trail.tail && current?.view === tab ? current : null;
        const search = tab === 'messages' ? phone.search.trim().toLowerCase() : '';
        const exact = tab === 'chat' ? phone.thread : null;
        const rowsQuery = ledger.query(scope, { thread: exact || (PLATFORMS[tab] ? tab : undefined), limit, cursor: previous?.next, accept: row => accept(row) && (!PLATFORMS[tab] || row.kind === 'post') && (!search || `${row.text} ${row.names.join(' ')}`.toLowerCase().includes(search)) });
        const summaryQuery = ['chat', 'messages'].includes(tab) ? ledger.query(scope, { limit: Infinity, accept: row => accept(row) && ['message', 'call'].includes(row.kind) }) : Promise.resolve(null);
        const characterQuery = tab === 'characterPhone' ? ledger.query(scope, { limit: Infinity, accept: row => active(row, trail) && accepts(session, row) && ['message', 'call', 'phoneSnapshot', 'phoneReveal'].includes(row.kind) }) : Promise.resolve(null);
        const pendingQuery = tab === 'debug' ? ledger.query(scope, { origin: 'phone', limit: 45, accept: row => active(row, trail) && !trail.byEvent.has(row.id) && row.sync !== false }) : Promise.resolve(null);
        const [page, overview, pending, characterRecords] = await Promise.all([rowsQuery, summaryQuery, pendingQuery, characterQuery]);
        let resourceTarget; let resourceError;
        if (tab === 'settings') { try { resources.context = session.context; resourceTarget = await resources.inspect(); } catch (error) { resourceError = error.message; } }
        if (sequence !== refreshNumber || !session.valid() || !phone.visible || phone.view !== tab) return;
        let rows = previous ? [...previous.rows, ...page.rows] : page.rows;
        if (PLATFORMS[tab]) {
            const targets = new Set(rows.filter(row => row.kind === 'post').flatMap(row => [row.id, row.reference].filter(Boolean)));
            const related = await ledger.query(scope, { thread: tab, limit: Infinity, accept: row => row.kind !== 'post' && targets.has(row.target) && accept(row) });
            rows = [...new Map([...rows, ...related.rows].map(row => [row.id, row])).values()].sort((a, b) => b.stamp - a.stamp);
        }
        rows = await photos.withPrompts(scope, rows);
        const threads = resolveThreads(session, overview?.rows ?? rows);
        const thread = threads.find(item => item.id === exact) || (exact && rows.length ? { id: exact, name: rows[0].names.join('、'), members: rows[0].participants } : null);
        const background = selectBackground(settings, session.prefs, tab, exact);
        const asset = background.image?.startsWith('asset:') ? await ledger.readMeta(`background:${background.image.slice(6)}`) : null;
        if (sequence !== refreshNumber || !session.valid() || phone.view !== tab) return;
        const photoRecords = await photos.list(scope);
        const sourceIds = new Set(rows.map(row => row.id));
        const albumRows = await photos.resolve(photoRecords.filter(row => !row.sourceId || sourceIds.has(row.sourceId) || row.ownerId === PLAYER));
        const imageConfig = await images.publicConfig();
        if (sequence !== refreshNumber || !session.valid() || phone.view !== tab) return;
        const applicable = item => item?.scope === scope && trail.hashes[item.anchor.length] === item.anchor.key ? item : null;
        current = { ...session, rows, threads, thread, view: tab, characterPhoneRows: characterRecords?.rows, next: page.next, pending: pending?.rows, lastRequest: applicable(lastRequest), prepared: applicable(prepared), models, settings, armed: sync.armed.has(scope), running, notice: resultMessage, cloudStatus: cloud.status, resourceTarget, resourceError, background: backgroundStyle(background, asset?.data), albumRows, photoSources: photoSources(rows).map(photo => { const saved = albumRows.find(row => row.id === photo.photoId || row.sourceId === photo.sourceId && row.index === photo.index && row.generated); return { ...photo, url: saved?.url || photo.url, prompt: photo.prompt || saved?.prompt || '' }; }), imageConfig, imageModels, imageGenerating: !!images.job || generation?.kind === 'images' };
        phone.appearance(settings);
        phone.render(current);
        if (thread && rows.length && (session.prefs.seen?.[thread.id] || 0) < rows[0].stamp) {
            await savePrefs(session, { seen: { ...session.prefs.seen, [thread.id]: rows[0].stamp } });
        }
    }

    async function savePrefs(session, patch) {
        if (!session.valid()) return;
        const prefs = await ledger.readMeta(`${session.scope}:prefs`) || {};
        if (session.valid()) await ledger.saveMeta(`${session.scope}:prefs`, { ...prefs, ...patch });
    }

    async function saveSettings(input, notice = '设置已保存，密钥会在刷新和更新脚本后保留。', quiet = false) {
        const read = (key, min, max, fallback) => { const value = Number(input[key]); return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback; };
        const patch = Object.fromEntries(Object.keys(DEFAULTS).filter(key => Object.hasOwn(input, key)).map(key => [key, input[key]]));
        for (const [key, min, max] of [['temperature', 0, 2], ['budget', 1500, 64000], ['storyLimit', 4, 100], ['syncChars', 4000, 18000], ['scale', 50, 150], ['every', 4, 120]]) if (Object.hasOwn(patch, key)) patch[key] = read(key, min, max, DEFAULTS[key]);
        if (Object.hasOwn(patch, 'output')) patch.output = normalizeOutput(patch.output);
        for (const key of ['eventTag', 'jsonTag']) if (patch[key] && !/^[a-z][\w:-]{0,40}$/i.test(patch[key])) throw new Error('结构化标签名称不合法');
        if (Object.hasOwn(patch, 'socialCommonPrompt')) patch.socialCommonPrompt = patch.socialCommonPrompt?.trim() ? validatePreset(patch.socialCommonPrompt) : SOCIAL_COMMON_PROMPT;
        if (Object.hasOwn(patch, 'platformPrompts')) patch.platformPrompts = cleanPlatformPrompts(patch.platformPrompts, true);
        if (Object.hasOwn(patch, 'preset')) patch.preset = validatePreset(patch.preset);
        if (Object.hasOwn(patch, 'wallpaperImage') && patch.wallpaperImage && !safeUrl(patch.wallpaperImage) && !/^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(patch.wallpaperImage)) throw new Error('壁纸请使用有效 HTTP(S) 图片地址或上传图片。');
        if (Object.hasOwn(patch, 'userAvatar') && patch.userAvatar && (!phoneSettings({ userAvatar: patch.userAvatar }).userAvatar)) throw new Error('头像请使用有效 HTTP(S) 图片地址或上传 2 MiB 以内的图片。');
        const changedService = (Object.hasOwn(patch, 'base') && patch.base !== settings.base) || (Object.hasOwn(patch, 'apiMode') && patch.apiMode !== settings.apiMode);
        const next = phoneSettings({ ...settings, ...patch });
        if (Object.hasOwn(input, 'secret')) credentials.current = clip(input.secret, 4000);
        else if (changedService) credentials.current = '';
        if (Object.hasOwn(input, 'secret') && next.activeApiProfile && !changedService) credentials.profiles[next.activeApiProfile] = credentials.current;
        if (changedService && !Object.hasOwn(patch, 'activeApiProfile')) { next.activeApiProfile = ''; patch.activeApiProfile = ''; }
        const st = getContext();
        const card = !st.groupId && st.characters?.[st.characterId];
        const scoped = card && styles.scoped(card);
        if (scoped && STYLE_KEYS.some(key => Object.hasOwn(patch, key))) await styles.saveLocal(card, next);
        accountSettings = phoneSettings({ ...accountSettings, ...Object.fromEntries(Object.entries(patch).filter(([key]) => !scoped || !STYLE_KEYS.includes(key))) });
        getContext().accountStorage.setItem(`${KEY}:credentials`, JSON.stringify(credentials));
        transport.token = credentials.current;
        phone.hasApiKey = Boolean(transport.token);
        settings = next;
        getContext().accountStorage.setItem(`${KEY}:settings`, JSON.stringify(accountSettings));
        prepared = null;
        mutationSerial++; queueCloud();
        phone.appearance(settings);
        if (current) current.settings = settings;
        if (quiet) return;
        setNotice(notice);
        return refresh();
    }

    function download(name, text, type) {
        const url = host.URL.createObjectURL(new host.Blob([text], { type }));
        downloads.add(url);
        const anchor = host.document.createElement('a');
        anchor.href = url;
        anchor.download = name;
        anchor.click();
        host.setTimeout(() => { if (downloads.delete(url)) host.URL.revokeObjectURL(url); }, 10000);
    }

    async function insert(session, inputs, extra = []) {
        if (!session?.valid()) throw new Error('聊天或有效分支已变化，未保存');
        const existing = await ledger.query(session.scope, { limit: 1 });
        if (!session.valid()) throw new Error('聊天或有效分支已变化，未保存');
        const prefs = await ledger.readMeta(`${session.scope}:prefs`) || {};
        if (!session.valid()) throw new Error('聊天或有效分支已变化，未保存');
        const stamp = Math.max(Date.now(), (existing.rows[0]?.stamp || 0) + 1);
        const rows = inputs.map((input, index) => makeEvent(session.scope, session.trail, { rpTime: session.rpTime, ...input }, session.people, { stamp: stamp + index,
            ...(['post', 'comment'].includes(input.kind) ? { speaker: socialNickname(session.people.find(person => person.id === input.speakerId), settings) || input.speaker } : {}),
            ...input.extra, sync: settings.sync !== 'off' && (['comment', 'like', 'collect', 'repost', 'follow'].includes(input.kind) && typeof prefs.postSync?.[input.target] === 'boolean' ? prefs.postSync[input.target] : typeof input.extra?.sync === 'boolean' ? input.extra.sync : ['message', 'call'].includes(input.kind || 'message') || settings.socialSync[input.thread || 'moments'] === true) }));
        if (rows.some(row => !row.text)) throw new Error('请输入消息内容');
        await ledger.write([...rows, ...extra]);
        queueCloud(session);
        return rows;
    }

    function commentInputs(session, post, comments, extra = {}) {
        return filterPlayerComments(comments, [session.context.name1, ...session.people.filter(person => person.id === PLAYER).map(person => person.name)]).map(comment => {
            const known = session.people.find(person => person.id !== PLAYER && (person.id === comment.id || person.name === comment.nickname));
            const identity = known?.id || `network:${post.thread}:${digest(comment.id)}`;
            return { kind: 'comment', speakerId: identity, participants: unique([identity, post.speakerId]), audience: post.audience, thread: post.thread, rpTime: comment.postedAt || '', text: comment.text, target: post.id, quote: comment.quote,
                payload: { simulated: true, networkId: comment.id }, extra: { speaker: known?.name || comment.nickname, names: unique([known?.name || comment.nickname, post.speaker]), ...extra } };
        });
    }

    async function compose(session, thread, actor, mode, hint, recall, replace, postCount = 1, targetPost) {
        if (!actor || !thread.members.includes(actor.id) || (actor.id === PLAYER && !['post', 'comments'].includes(mode))) throw new Error('请先选择一位会话内的发言人');
        const memory = await conversationMemory(ledger, session.scope, session.trail, thread.id, actor.id, thread.members, row => accepts(session, row) && (!replace || (row.id !== replace.id && (!replace.bubbleGroup || row.bubbleGroup !== replace.bubbleGroup))), recall);
        return buildContext({ host, helper, ...session, settings: { ...session.settings, rpTime: session.rpTime }, person: actor, members: thread.members, memory, snapshot: sync.snapshot, loreSnapshot: sync.loreSnapshot, action: mode, platform: PLATFORMS[thread.id], hint, postCount, targetPost, imageRules: mode === 'post' ? (await images.load()).imageRules : undefined });
    }

    async function generate({ session, thread, actor, mode = 'reply', hint = '', replace, recall = false, preview = false, inject, count = 1, targetPost }) {
        if (generation || transport.job || images.job) throw new Error('请先等待或取消正在进行的手机请求');
        const maxPosts = postCounts(PLATFORMS[thread.id]).at(-1);
        if (!Number.isInteger(count) || count < 1 || count > maxPosts || (mode !== 'post' && count !== 1)) throw new Error(`本平台每次最多生成 ${maxPosts} 条动态`);
        const connection = generationConnection(settings, credentials, ['post', 'comments'].includes(mode) ? thread.id : '');
        const job = { cancelled: false, cancel() { this.cancelled = true; transport.cancel(); } };
        generation = job;
        running = preview ? '正在重建上下文…' : '正在等待回复…';
        phone.activity(running);
        try {
            const pack = await compose(session, thread, actor, mode, hint, recall, replace, count, targetPost);
            if (!session.valid() || job.cancelled) throw new Error('聊天已变化或请求已取消');
            prepared = { ...pack, scope: session.scope, anchor: before(session.trail) };
            if (preview) { setNotice('已组装预览，未调用模型。'); return; }
            lastRequest = prepared;
            const response = await transport.execute(connection.settings, session.context, pack.messages, { token: connection.token, onProgress: progress => {
                if (disposed || job.cancelled || generation !== job || !session.valid()) return;
                running = progress.characters ? `正在接收${count > 1 ? `${count} 条动态（单次请求）` : '模型内容'} · ${progress.characters} 字符` : '已建立流式连接，等待模型正文…';
                phone.activity(running);
            } });
            if (!session.valid() || job.cancelled) throw new Error('聊天已变化或请求已取消，未写入回复');
            const result = parseReply(response, mode, count);
            if (mode === 'comments') {
                const post = await ledger.get(session.scope, targetPost.id);
                if (!post || !active(post, session.trail) || !post.audience.includes(PLAYER) || session.prefs.hiddenSocial?.some(id => id === post.id || id === post.reference)) throw new Error('原帖已删除或不再可见，未保存评论。');
                const existing = await ledger.query(session.scope, { thread: thread.id, limit: Infinity, accept: row => row.kind === 'comment' && active(row, session.trail) && (row.target === post.id || post.reference && row.target === post.reference) });
                const signatures = new Set(existing.rows.map(row => `${row.speaker}\n${row.text}`));
                const inputs = commentInputs(session, post, result.comments, { sync: inject === true });
                const fresh = inputs.filter(row => { const key = `${row.extra.speaker}\n${row.text}`; if (signatures.has(key)) return false; signatures.add(key); return true; });
                if (fresh.length) await insert(session, fresh);
                setNotice(`已补充 ${fresh.length} 条模拟评论，原帖保留。`); return;
            }
            const outputs = result.posts || result.messages.map((text, index) => ({ text, payload: index === 0 ? result.payload : undefined, memory: index === 0 ? result.memory : '' }));
            if (!outputs.length) { setNotice(`${actor.name} 暂未${mode === 'post' ? '发布动态' : '发消息'}。`); return; }
            const bubbleGroup = newId();
            const originals = replace ? (await ledger.query(session.scope, { thread: thread.id, limit: 8, accept: row => active(row, session.trail) && (row.bubbleGroup ? row.bubbleGroup === replace.bubbleGroup : row.id === replace.id) })).rows : [];
            if (originals.some(row => session.trail.byEvent.has(row.id))) throw new Error('该回复已交接到正文，不能重写旧事实。');
            const inputs = outputs.flatMap(({ text, payload, memory }) => {
                const id = newId();
                const sync = mode === 'post' && typeof inject === 'boolean' ? { sync: inject } : {};
                const comments = mode === 'post' ? payload?.comments || [] : [];
                const postPayload = mode === 'post' && payload ? Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'comments')) : payload;
                return [{ kind: mode === 'post' ? 'post' : 'message', speakerId: actor.id, participants: mode === 'post' ? [actor.id] : thread.members, audience: thread.members, thread: thread.id, rpTime: mode === 'post' ? payload?.postedAt || '' : session.rpTime, text, payload: postPayload, extra: { id, bubbleGroup, ...sync, suggestedMemory: memory } },
                    ...commentInputs(session, { id, thread: thread.id, speakerId: actor.id, speaker: actor.name, audience: thread.members }, comments, { bubbleGroup, ...sync })];
            });
            const savedRows = await insert(session, inputs, originals.map(row => ({ ...row, deleted: true, revision: row.revision + 1 })));
            if ((await images.load()).autoGenerate) job.autoCandidate = photoSources(savedRows).find(item => !item.url);
            if (mode !== 'post') {
                try { await checkpoint(ledger, session, thread.id, row => accepts(session, row)); }
                catch { setNotice('回复已保存，本地阶段整理未完成。', true); return; }
            }
            setNotice(mode === 'post' ? `已发布 ${outputs.length} 条动态${outputs.length < count ? '，其余未生成可发布内容' : ''}` : '手机回复已保存');
        } finally {
            if (generation === job) generation = null;
            running = '';
            if (!disposed) { phone.activity(''); await refresh(); }
            if (!disposed && job.autoCandidate) host.setTimeout(() => { if (session.valid()) action('generateImage', { ...job.autoCandidate, taskId: `${session.scope}:${job.autoCandidate.sourceId}:${job.autoCandidate.index}`, inAlbum: false, automatic: true }).catch(fail); }, 0);
        }
    }

    function chosen(session, thread, selected, text = '') {
        const members = session.people.filter(person => thread.members.includes(person.id) && person.id !== PLAYER);
        const mentioned = members.filter(person => text.includes(`@${person.name}`)).sort((left, right) => right.name.length - left.name.length);
        return mentioned[0] || members.find(person => person.id === selected) || members[(session.rows.filter(row => row.speakerId !== PLAYER).length || 0) % members.length];
    }

    async function maybeInitiate() {
        const floor = lastTavernFloor;
        lastTavernFloor = null;
        const session = current;
        if (!session || !phone.visible || !Number.isInteger(floor) || settings.auto === 'off' || requests.busy || generation || transport.job || !session.valid()) return;
        const candidates = await ledger.query(session.scope, { limit: 8, accept: row => row.origin === 'tavern' && row.floor === floor && row.kind === 'message' && row.audience.includes(PLAYER) && row.speakerId !== PLAYER && active(row, session.trail) && accepts(session, row) });
        const candidate = candidates.rows[0];
        if (!candidate || !session.valid()) return;
        const key = `${session.scope}:auto`;
        const prior = await ledger.readMeta(key);
        if (prior && (floor - prior.floor < settings.every || Date.now() - prior.stamp < 300000)) return;
        const actor = session.people.find(person => person.id === candidate.speakerId);
        if (!actor) return;
        const thread = settings.auto === 'post' ? { id: 'moments', members: session.people.map(person => person.id) } : { id: candidate.thread, members: candidate.participants };
        await ledger.saveMeta(key, { floor, stamp: Date.now() });
        await requests.enqueue(() => generate({ session, actor, thread, mode: settings.auto === 'post' ? 'post' : 'initiative', hint: '仅判断是否确有必要另发一条新内容；不重发正文已有的消息。' }), { valid: session.valid });
    }

    const queuedActions = new Set(['reply', 'initiative', 'preview', 'postActor', 'generateComments', 'generateCharacterPhone', 'draftImagePrompt', 'generateAttachmentImage', 'generateImage', 'retry', 'models', 'test', 'imageModels']);
    function action(name, data = {}) {
        if (!queuedActions.has(name)) return performAction(name, data);
        const state = getState();
        if (!state || disposed || clearing) return Promise.reject(new Error('请打开一个有效酒馆聊天，再提交请求'));
        const revision = dataRevision;
        const tail = lineage(state.chat).tail;
        const threadId = phone.view === 'chat' ? phone.thread : current?.thread?.id;
        const valid = () => {
            const fresh = getState();
            return !disposed && revision === dataRevision && fresh?.scope === state.scope && fresh.chat === state.chat && lineage(fresh.chat).tail === tail;
        };
        const input = structuredClone(data);
        return requests.enqueue(async () => {
            if (!running) { running = '正在处理请求…'; phone.activity(running); }
            try { return await performAction(name, input, { valid, threadId }); }
            finally { if (!generation && !transport.job && !images.job) { running = ''; if (!disposed) phone.activity(''); } }
        }, {
            valid, key: name === 'generateCharacterPhone' ? `${state.scope}:character-phone:${input.actor}` : name === 'generateImage' && input.taskId ? `${state.scope}:image:${input.taskId}` : undefined,
        });
    }

    async function requestSession(request) {
        const fresh = await loadSession();
        if (!fresh || !request.valid() || !fresh.valid()) throw new Error('聊天或正文已变化，未执行排队请求');
        const page = await ledger.query(fresh.scope, { thread: request.threadId, limit: 35, accept: row => active(row, fresh.trail) && accepts(fresh, row) && row.audience.includes(PLAYER) && !fresh.prefs.hiddenSocial?.some(id => id === row.id || id === row.reference || id === row.target) && row.stamp > (fresh.prefs.hiddenBefore?.[row.thread] || 0) });
        const thread = resolveThreads(fresh, page.rows).find(item => item.id === request.threadId);
        return { ...fresh, rows: page.rows, thread };
    }

    async function performAction(name, data = {}, request = null) {
        if (disposed) return;
        if (clearing) throw new Error('正在清空数据，请稍候。');
        if (name === 'open' || name === 'refresh') return refresh();
        if (name === 'more') return refresh({ older: true });
        if (name === 'scan') { scan = null; return refresh({ rescan: true }); }
        if (name === 'clearRequestQueue') { requests.clear(); setNotice('已清空待执行请求。'); return; }
        if (name === 'cancel') { generation?.cancel(); transport.cancel(); images.cancel(); if (images.job?.mode === 'tavern') setNotice('已取消保存本次生图；酒馆任务结束前不会再发起请求，可在原生生图面板停止任务。'); return; }
        if (name === 'settings') return saveSettings(data);
        if (name === 'settingsAuto') return saveSettings(data, '', true);
        if (name === 'saveSocialPrompts') return saveSettings({ socialCommonPrompt: data.socialCommonPrompt, platformPrompts: data.platformPrompts }, '平台提示词已保存，刷新后保留；下次生成使用新规则。');
        if (name === 'launcherPosition') return saveSettings({ launcherPosition: data.position }, '');
        if (name === 'imageMode') {
            if (images.job) throw new Error('请等待或取消当前生图任务。');
            await images.save(data.values || {}); await images.save({ mode: data.mode }); imageModels = []; await refresh(); phone.imageSettingsPanel(true); return;
        }
        if (name === 'imageModels') {
            if (images.job) throw new Error('请等待生图结束。');
            imageModels = await images.models(); await refresh(); phone.imageSettingsPanel(true); return;
        }
        if (['saveImagePromptPreset', 'applyImagePromptPreset', 'deleteImagePromptPreset'].includes(name)) {
            if (images.job) throw new Error('请等待当前生图结束后再修改提示词方案。');
            if (name === 'saveImagePromptPreset') await images.savePromptPreset(data.name, data.values);
            else if (name === 'applyImagePromptPreset') await images.applyPromptPreset(data.id);
            else await images.deletePromptPreset(data.id);
            setNotice(name === 'deleteImagePromptPreset' ? '提示词方案已删除。' : '提示词方案已保存并应用。');
            return refresh();
        }
        if (name === 'imageSettings' || name === 'imageSettingsAuto') {
            if (images.job) throw new Error('请等待或取消当前生图请求。');
            await images.save(data);
            if (name === 'imageSettingsAuto') { if (current) current.imageConfig = await images.publicConfig(); return; }
            setNotice('生图设置已保存，各连接方式独立保留；使用自己的服务和额度。'); await refresh(); return;
        }
        if (name === 'bindCharacter' || name === 'resetPhoneDefaults') {
            if (generation || transport.job || images.job) throw new Error('请先等待或取消当前请求。');
            const session = current;
            const st = getContext();
            const card = st.characters?.[st.characterId];
            if (name === 'bindCharacter' && (!session?.valid() || st.groupId || !card?.avatar)) throw new Error('请先打开要绑定的单个角色聊天。');
            resources.context = st;
            if (name === 'bindCharacter') {
                const values = styleValues(settings);
                const ownThread = threadKey([PLAYER, `card:${card.avatar}`]);
                const ownBackground = session.prefs.chatBackgrounds?.[ownThread];
                if (ownBackground) values.pageBackgrounds = { ...values.pageBackgrounds, chat: ownBackground };
                await styles.bind(resources, card, values);
            } else if (card?.avatar && !st.groupId) {
                if (boundStyle(card)) await styles.bind(resources, card, styleValues());
                else await styles.saveLocal(card, styleValues());
            }
            accountSettings = phoneSettings({ ...accountSettings, ...styleValues(), ...(name === 'resetPhoneDefaults' ? { showLauncher: true, musicIsland: true, launcherPosition: null, userAvatar: '' } : {}) });
            st.accountStorage.setItem(`${KEY}:settings`, JSON.stringify(accountSettings));
            getState(); phone.appearance(settings);
            mutationSerial++; queueCloud();
            setNotice(name === 'bindCharacter' ? '已绑定当前角色。导出角色卡即可携带背景、表情包和手机预设；API 密钥不随卡分享。' : '已恢复默认手机外观、表情包和预设；API 连接及密钥、聊天记录保留。');
            return refresh();
        }
        if (name === 'background') {
            const session = current;
            const chat = data.target?.type === 'chat';
            if (chat && (!session?.valid() || data.target.scope !== session.scope || data.target.thread !== session.thread?.id)) throw new Error('会话已切换，请在目标会话重新设置背景。');
            if (!chat && !Object.hasOwn(PAGES, data.target?.page)) throw new Error('请选择有效的页面。');
            let image = data.config?.image || '';
            if (data.file) {
                if (data.file.size > 2 * 1024 * 1024 || !/^image\/(png|jpeg|webp|gif)$/.test(data.file.type)) throw new Error('请选择 2 MiB 以内的 PNG/JPEG/WebP/GIF 图片。');
                const value = await new Promise((resolve, reject) => { const reader = new host.FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(data.file); });
                if (chat && !session.valid()) throw new Error('会话已切换，未保存背景。');
                const id = newId();
                await ledger.saveMeta(`background:${id}`, { data: value }); image = `asset:${id}`;
            }
            const config = cleanBackground({ ...data.config, image });
            if (chat && session.cardScoped) return saveSettings({ pageBackgrounds: { ...settings.pageBackgrounds, chat: config } }, '当前角色的聊天背景已保存；可在角色绑定中更新到角色卡。');
            if (chat) {
                const prefs = await ledger.readMeta(`${session.scope}:prefs`) || {};
                await savePrefs(session, { chatBackgrounds: { ...prefs.chatBackgrounds, [data.target.thread]: config } });
                queueCloud(session); setNotice('会话背景已保存。'); return refresh();
            }
            return saveSettings({ pageBackgrounds: { ...settings.pageBackgrounds, [data.target.page]: config } }, '页面背景已保存。');
        }
        if (['saveApiProfile', 'applyApiProfile', 'deleteApiProfile'].includes(name)) {
            if (generation || transport.job || images.job) throw new Error('请先等待或取消当前请求，再操作 API 方案。');
            if (name === 'saveApiProfile') {
                const values = { ...settings, ...profileValues(data.values || {}) };
                values.output = normalizeOutput(values.output);
                const saved = saveProfile(settings.apiProfiles, data.name, values);
                const sameService = values.base === settings.base && values.apiMode === settings.apiMode;
                const secret = data.values?.secret || (sameService ? credentials.current : credentials.profiles[saved.id] || '');
                credentials.profiles[saved.id] = secret;
                return saveSettings({ ...profileValues(values), secret, apiProfiles: saved.profiles, activeApiProfile: saved.id }, 'API 方案和对应密钥已保存，可分别分配给各个平台。');
            }
            const profile = settings.apiProfiles.find(row => row.id === data.id);
            if (!profile) throw new Error('所选 API 方案不存在，请重新选择。');
            if (name === 'deleteApiProfile') { delete credentials.profiles[data.id]; return saveSettings({ apiProfiles: settings.apiProfiles.filter(row => row.id !== data.id), activeApiProfile: settings.activeApiProfile === data.id ? '' : settings.activeApiProfile }, '已删除 API 方案，当前连接参数保持不变。'); }
            models = [];
            return saveSettings({ ...profile.values, activeApiProfile: profile.id, secret: credentials.profiles[profile.id] || '' }, `已应用「${profile.name}」及其保存的密钥。`);
        }
        if (name === 'resources') { resources.context = getContext(); return phone.resourcePanel(await resources.inspect(data.book), resources); }
        if (name === 'wallpaperFile' || name === 'avatarFile') {
            if (!data.file || data.file.size > 2 * 1024 * 1024 || !/^image\/(png|jpeg|webp|gif)$/.test(data.file.type)) throw new Error('请选择 2 MiB 以内的 PNG/JPEG/WebP/GIF 图片。');
            const value = await new Promise((resolve, reject) => { const reader = new host.FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(data.file); });
            return name === 'avatarFile' ? saveSettings({ userAvatar: value }, '头像已保存，聊天与动态中的个人头像已更新。') : saveSettings({ wallpaperImage: value });
        }
        if (name === 'resetPreset') return saveSettings({ preset: DEFAULT_PRESET }, '已恢复内置手机预设，启用状态不变。');
        if (name === 'importPreset') {
            if (!data.file || data.file.size > PRESET_LIMIT * 4 + 3) throw new Error('请选择合适大小的 UTF-8 文本预设。');
            const preset = await data.file.text();
            if (!disposed) return saveSettings({ preset }, '已导入手机预设，启用状态不变。');
            return;
        }
        if (name === 'exportPreset') return download('PHONE_PRESET.txt', validatePreset(data.text ?? settings.preset), 'text/plain;charset=utf-8');
        if (name === 'models' || name === 'test') {
            if (generation || transport.job || images.job) throw new Error('请先等待当前手机生成结束');
            running = '正在检查连接…'; phone.activity(running);
            try {
                const st = getContext();
                const response = await transport.execute(settings, st, [{ role: 'user', content: 'Reply with OK only.' }], { models: name === 'models', test: true });
                if (name === 'models') { models = response; setNotice(`已读取 ${models.length} 个模型`); }
                else setNotice('连接测试成功；未发送任何剧情。');
            } finally { running = ''; phone.activity(''); await refresh(); }
            return;
        }
        const session = request ? await requestSession(request) : ['syncCharacterPhone', 'cancelCharacterPhoneSync'].includes(name) ? await loadSession() : current;
        if (!session?.valid()) throw new Error('请打开一个有效酒馆聊天，再从手机操作');
        const { scope, trail, thread } = session;
        if (['syncCharacterPhone', 'cancelCharacterPhoneSync'].includes(name)) {
            if (data.scope !== scope || data.tail && data.tail !== trail.tail) throw new Error('聊天或正文已变化，请重新选择同步内容。');
            const actor = session.people.find(person => person.id === data.actor && person.id !== PLAYER);
            if (!actor) throw new Error('请选择有效的角色手机。');
            const known = await ledger.query(scope, { limit: Infinity, accept: row => active(row, trail) && accepts(session, row) && ['message', 'call', 'phoneSnapshot', 'phoneReveal'].includes(row.kind) });
            const previous = known.rows.filter(row => row.kind === 'phoneReveal' && row.speakerId === actor.id && row.sync !== false && !trail.byEvent.has(row.id));
            let records = [];
            if (name === 'syncCharacterPhone') {
                const entries = phoneDisclosure(known.rows, actor, trail, session.people, settings, data.sections, data.thread || '');
                records = disclosureEvents(session, actor, entries);
            }
            if (!session.valid()) throw new Error('正文已变化，未修改待同步内容。');
            await ledger.write([...previous.map(row => ({ ...row, sync: false, revision: row.revision + 1 })), ...records]);
            setNotice(records.length ? `已安排 ${records.length} 个栏目，随下一条正常正文消息完整注入；请在正文中输入查看手机的行动。` : '已取消这部角色手机的待注入内容，历史正文保留。');
            return refresh();
        }
        if (name === 'generateCharacterPhone') {
            if (generation || transport.job || images.job) throw new Error('请先等待或取消当前请求。');
            const actor = session.people.find(person => person.id === data.actor && person.id !== PLAYER);
            const sections = phoneSections(data.sections || data.section || 'all');
            if (!actor) throw new Error('请选择有效的角色与手机栏目。');
            const job = { kind: 'character-phone', cancelled: false, cancel() { this.cancelled = true; transport.cancel(); } };
            generation = job;
            running = `正在准备${actor.name}的手机内容…`; phone.activity(running);
            try {
                const known = await ledger.query(scope, { limit: Infinity, accept: row => active(row, trail) && accepts(session, row) && ['message', 'call', 'phoneSnapshot'].includes(row.kind) });
                const chats = characterMessages(known.rows, actor.id, trail, session.people, settings).slice(0, 16).reverse();
                const saved = phoneContents(known.rows, actor.id, trail);
                const summaries = Object.fromEntries(Object.entries(saved).filter(([key]) => sections.includes(key)).map(([key, value]) => [key, value.items.slice(0, 3).map(item => key === 'messages'
                    ? { peer: item.peer, messages: item.messages.slice(-2).map(message => ({ ...message, text: clip(message.text, 180) })) }
                    : Object.fromEntries(Object.entries(item).map(([field, value]) => [field, typeof value === 'string' ? clip(value, 180) : value]))) ]));
                const pack = await buildContext({ host, helper, ...session, settings: { ...session.settings, rpTime: session.rpTime }, person: actor, members: [actor.id], memory: { recent: chats, states: [], older: [] }, snapshot: sync.snapshot, loreSnapshot: sync.loreSnapshot,
                    action: 'characterPhone', hint: JSON.stringify({ 栏目: sections, 已有私人记录摘要: summaries, 用户要求: clip(data.hint, 1500) }) });
                if (!session.valid() || job.cancelled) throw new Error('聊天已变化或请求已取消。');
                const connection = generationConnection(settings, credentials);
                const raw = await transport.execute(connection.settings, session.context, pack.messages, { token: connection.token, onProgress: progress => { if (!disposed && generation === job && !job.cancelled && session.valid()) phone.activity(`正在接收角色手机内容 · ${progress.characters || 0} 字符`); } });
                if (!session.valid() || job.cancelled) throw new Error('聊天已变化或请求已取消，未保存手机内容。');
                const privateIdentities = new Set([PLAYER, session.context.name1, actor.id, actor.name, ...session.people.filter(person => person.id === PLAYER).map(person => person.name)]);
                const blockedAliases = [...socialAliases(settings)].filter(([, target]) => privateIdentities.has(target)).map(([name]) => name);
                const contents = parsePhoneContents(raw, sections, { owner: actor, playerNames: unique([PLAYER, session.context.name1, ...blockedAliases, ...session.people.filter(person => person.id === PLAYER).map(person => person.name)]) });
                const newest = await ledger.query(scope, { limit: 1 });
                if (!session.valid() || job.cancelled) throw new Error('聊天已变化或请求已取消，未保存手机内容。');
                const stamp = Math.max(Date.now(), (newest.rows[0]?.stamp || 0) + 1);
                const records = Object.entries(contents).map(([key, items], index) => makeEvent(scope, trail, { kind: 'phoneSnapshot', speakerId: actor.id, participants: [actor.id], audience: [actor.id], thread: `character-phone:${actor.id}`, rpTime: session.rpTime, text: `${actor.name}的${PHONE_SECTIONS[key][0]}`, payload: { section: key, items } }, session.people, { stamp: stamp + index, sync: false }));
                await ledger.write(records);
                setNotice(`${actor.name}的手机内容已保存。`);
                await refresh();
            } finally { if (generation === job) generation = null; running = ''; phone.activity(''); }
            return;
        }
        if (name === 'draftImagePrompt') {
            if (generation || transport.job || images.job) throw new Error('请先等待或取消当前请求。');
            let source; let part;
            if (data.sourceId) {
                source = await ledger.get(scope, data.sourceId);
                part = (source?.payload?.media || source?.payload?.components || [])[Number(data.index || 0)];
                if (!source || !part || !['photo', 's-image'].includes(part.type) || !active(source, trail) || !source.audience.includes(PLAYER) || session.prefs.hiddenSocial?.some(id => id === source.id || id === source.reference)) throw new Error('图片来源已不在当前可见分支。');
            }
            const description = clip(data.description ?? part?.text, 2000);
            const existingPrompt = clip(data.prompt ?? part?.fields?.prompt, 6000);
            const nonEnglish = value => /[^\p{Script=Latin}\P{Letter}]/u.test(value);
            const taskThread = source ? { id: source.thread, members: unique([PLAYER, source.speakerId, ...source.audience]) } : thread || { id: 'imagegen', members: session.people.map(person => person.id) };
            const actor = session.people.find(person => person.id === (source?.speakerId || data.actor)) || session.people.find(person => person.id === PLAYER);
            const root = await images.load();
            const memory = await conversationMemory(ledger, scope, trail, taskThread.id, actor.id, taskThread.members, row => accepts(session, row), false);
            const refs = namedReferences(root.profiles[root.mode].characterProfiles, { description, prompt: existingPrompt, characterProfile: clip(data.characterProfile, 4000) });
            const pack = await buildContext({ host, helper, ...session, settings: { ...session.settings, rpTime: session.rpTime }, person: actor, members: taskThread.members, memory, snapshot: sync.snapshot, loreSnapshot: sync.loreSnapshot,
                action: 'imagePrompt', imageRules: root.imageRules, hint: JSON.stringify({ description, prompt: existingPrompt, appearanceReferences: refs }), platform: PLATFORMS[source?.thread] });
            const job = { kind: 'image-prompt', cancelled: false, cancel() { this.cancelled = true; transport.cancel(); } }; generation = job;
            running = '正在准备图片说明与英文提示词…'; phone.activity(running);
            try {
                const connection = generationConnection(settings, credentials);
                const raw = await transport.execute(connection.settings, session.context, pack.messages, { token: connection.token });
                if (!session.valid() || job.cancelled) throw new Error('聊天已变化或请求已取消，未保存提示词。');
                let result; try { result = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); } catch { throw new Error('文本模型未返回有效图片说明与提示词。'); }
                if (typeof result?.prompt !== 'string' || !result.prompt.trim() || result.prompt.length > 6000 || nonEnglish(result.prompt) || (!description && (typeof result.description !== 'string' || !result.description.trim() || result.description.length > 2000))) throw new Error('图片说明或英文提示词无效，未发送生图请求。');
                const draft = { description: description || result.description.trim(), prompt: result.prompt.trim() };
                if ((!source || description === clip(part.text)) && (source || data.id)) await photos.savePrompt(scope, { ...data, ...draft, replacePrompt: true, sourcePrompt: part?.fields?.prompt || '' });
                await refresh();
                return draft;
            } finally { if (generation === job) generation = null; running = ''; phone.activity(''); }
        }
        if (name === 'generateAttachmentImage') {
            if (generation || transport.job || images.job) throw new Error('请先等待或取消当前请求。');
            const description = clip(data.description || data.prompt, 2000);
            if (!description) throw new Error('请先填写画面说明或生成提示词。');
            const job = { kind: 'images', cancelled: false, cancel() { this.cancelled = true; images.cancel(); } }; generation = job;
            try {
                running = '正在生成待发送照片…'; phone.activity(running);
                const result = await images.generate({ description, prompt: clip(data.prompt, 6000), taskId: newId() });
                if (!session.valid() || job.cancelled) throw new Error('聊天已变化或任务已取消，未保存图片。');
                const saved = await photos.save(scope, { ...result, ownerId: PLAYER, description, prompt: data.prompt, generated: true, inAlbum: true, title: '聊天拍摄' });
                await refresh(); return saved;
            } finally { if (generation === job) generation = null; running = ''; phone.activity(''); }
        }
        if (name === 'generateComments') {
            const post = await ledger.get(scope, data.id);
            if (!post || post.kind !== 'post' || !PLATFORMS[post.thread] || !active(post, trail) || !post.audience.includes(PLAYER) || session.prefs.hiddenSocial?.some(id => id === post.id || id === post.reference)) throw new Error('原帖已删除或不在当前可见范围。');
            const actor = session.people.find(person => person.id === post.speakerId) || { id: post.speakerId, name: post.speaker };
            const existing = await ledger.query(scope, { thread: post.thread, limit: Infinity, accept: row => row.kind === 'comment' && active(row, trail) && row.audience.includes(PLAYER) && (row.target === post.id || post.reference && row.target === post.reference) });
            const target = { id: post.id, author: post.speaker, text: post.text, postedAt: post.rpTime, payload: post.payload, existingComments: existing.rows.map(row => ({ nickname: row.speaker, text: row.text })) };
            await generate({ session, thread: { id: post.thread, members: unique([actor.id, ...post.audience]) }, actor, mode: 'comments', targetPost: target, inject: session.prefs.postSync?.[post.id] ?? (post.origin === 'phone' ? post.sync !== false : settings.socialSync?.[post.thread] === true) });
            return;
        }
        if (name === 'clearData') {
            if (data.scope !== scope) throw new Error('聊天已切换，请重新打开清空数据确认。');
            if (requests.busy || running || generation || images.job || cloud.busy) throw new Error('请等待当前生成或同步任务结束后再清空数据。');
            clearing = true; dataRevision++; refreshNumber++;
            host.clearTimeout(cloudTimer); host.clearTimeout(timer);
            sync.round = null; sync.armed.delete(scope); sync.snapshot = null; sync.loreSnapshot = null;
            const clearSession = { ...session, valid: () => {
                const fresh = getState();
                return fresh?.scope === scope && fresh.chat === session.chat && lineage(fresh.chat).tail === trail.tail;
            } };
            try {
                await cloud.clear(clearSession);
                if (!clearSession.valid()) throw new Error('聊天已切换，未清空本机数据。');
                await ledger.clearScope(scope, trail);
                photos.close(); prepared = null; lastRequest = null; scan = null;
                phone.clearDraft(); phone.search = '';
                setNotice('已清空当前聊天的手机数据；酒馆正文和手机设置保留。');
            } finally { clearing = false; current = null; await refresh(); }
            return;
        }
        if (name === 'clearNotifications') {
            const latest = await ledger.query(scope, { limit: 1, accept: row => active(row, trail) && accepts(session, row) && row.audience.includes(PLAYER) });
            if (!session.valid()) return;
            await savePrefs(session, { notificationsClearedThrough: Math.max(session.prefs.notificationsClearedThrough || 0, latest.rows[0]?.stamp || 0) });
            setNotice('已清除当前通知。'); return refresh();
        }
        if (['savePhoto', 'deletePhoto', 'generateImage'].includes(name)) {
            if (name === 'deletePhoto') {
                if (!(await photos.list(scope)).some(row => row.id === data.id)) throw new Error('这张图片已删除或不在当前聊天中。');
                await photos.remove(scope, data.id); setNotice('图片已删除。'); return refresh();
            }
            let source;
            if (data.sourceId) {
                source = await ledger.get(scope, data.sourceId);
                if (!source || !active(source, trail) || !source.audience.includes(PLAYER) || !session.valid()) throw new Error('这张图片的来源已不在当前可见分支。');
            }
            if (name === 'savePhoto') {
                let url = photoSource(data.url); let blob;
                if (data.file) {
                    if (data.file.size > 5 * 1024 * 1024 || !/^image\/(png|jpeg|webp|gif)$/.test(data.file.type)) throw new Error('请上传 5 MiB 以内的 PNG/JPEG/WebP/GIF。');
                    blob = data.file;
                }
                if (!session.valid()) throw new Error('聊天已切换，未保存图片。');
                await photos.save(scope, { ...data, url, blob, ownerId: PLAYER, inAlbum: true }); setNotice('已保存到我的相册。'); return refresh();
            }
            if (data.automatic && (await photos.list(scope)).some(row => row.sourceId === data.sourceId && row.index === Number(data.index || 0) && row.generated)) return;
            if (generation || transport.job || images.job) throw new Error('请先等待或取消当前请求。');
            const count = data.automatic ? 1 : Number(data.count ?? 1);
            if (!Number.isInteger(count) || count < 1 || count > 4) throw new Error('每次可生成 1–4 张图片。');
            if ((await photos.list(scope)).length + count > 200) throw new Error('相册剩余空间不足，请减少张数或先移除不需要的图片。');
            if (generation || transport.job || images.job || !session.valid()) throw new Error('当前请求或聊天已变化，请重试。');
            const owner = session.people.find(person => person.id === data.ownerId) || session.people.find(person => person.id === PLAYER);
            const job = { kind: 'images', cancelled: false, cancel() { this.cancelled = true; images.cancel(); } };
            generation = job;
            const completed = [];
            const taskId = data.taskId || `${scope}:${data.sourceId || newId()}:${Number(data.index || 0)}`;
            try {
                for (let index = 0; index < count; index++) {
                    if (!session.valid() || job.cancelled || disposed) throw new Error('聊天已变化或生图已取消。');
                    running = `正在生成图片 · ${index + 1} / ${count}`; phone.activity(running);
                    const pending = images.generate({ taskId: `${taskId}:${index}`, description: clip(data.description, 2000), prompt: clip(data.prompt, 6000), platform: source?.thread, onPromptReady: () => { if (!job.cancelled && !disposed) { running = `正在生成图片 · ${index + 1} / ${count}`; phone.activity(running); } }, character: source ? '' : owner.name, characterProfile: clip(data.characterProfile, 4000) });
                    const result = pending.then(value => ({ value }), error => ({ error }));
                    await refresh();
                    const outcome = await result; if (outcome.error) throw outcome.error;
                    if (!session.valid() || job.cancelled || disposed) throw new Error('聊天已变化或生图已取消，未保存当前图片。');
                    completed.push(await photos.save(scope, { ...outcome.value, ownerId: owner.id, title: data.title || '生成的图片', description: data.description, prompt: data.prompt, generated: true, inAlbum: data.inAlbum !== false, replaceSource: data.inAlbum === false && index === 0, sourceId: source?.id, index: data.index }));
                }
                setNotice(completed.find(image => image.warning)?.warning || `已生成 ${completed.length} 张图片${data.inAlbum === false ? '，已更新当前配图，可另存相册' : '并保存到相册'}。`);
                await refresh();
                if (data.keepNote) {
                    const post = current?.rows.find(row => row.id === source?.id);
                    if (phone.pop?.querySelector('.note-detail, .social-detail') && post) { if (post.thread === 'redbook') phone.noteDetail(current, post, Number(data.index || 0)); else phone.socialDetail(current, post); }
                } else if (!data.automatic) phone.photoViewer(completed[0], completed);
            } catch (error) {
                throw new Error(`${error.message}${completed.length ? ` 已完成的 ${completed.length} 张${data.inAlbum === false ? '配图已保留' : '保留在相册'}，剩余未继续请求。` : ''}`);
            } finally {
                if (generation === job) generation = null;
                running = ''; phone.activity(''); await refresh();
            }

            return;
        }
        if (name === 'searchChat' && thread) {
            const query = clip(data.text, 100).toLowerCase();
            const results = await ledger.query(scope, { thread: thread.id, limit: 100, accept: row => active(row, trail) && accepts(session, row) && row.audience.includes(PLAYER) && row.stamp > (session.prefs.hiddenBefore?.[thread.id] || 0) && `${row.text} ${row.speaker}`.toLowerCase().includes(query) });
            if (session.valid() && current?.thread?.id === thread.id) phone.chatSearchResults(data.text, results.rows);
            return;
        }
        if (name === 'muteChat' && thread) {
            const muted = new Set(session.prefs.muted || []);
            if (data.enabled) muted.add(thread.id); else muted.delete(thread.id);
            await savePrefs(session, { muted: [...muted] });
            queueCloud(session); return refresh();
        }
        if (['clearChatDisplay', 'restoreChatDisplay'].includes(name) && thread) {
            const hiddenBefore = { ...session.prefs.hiddenBefore };
            if (name === 'restoreChatDisplay') delete hiddenBefore[thread.id];
            else {
                const newest = await ledger.query(scope, { thread: thread.id, limit: 1 });
                hiddenBefore[thread.id] = Math.max(Date.now(), newest.rows[0]?.stamp || 0);
            }
            await savePrefs(session, { hiddenBefore });
            setNotice(name === 'restoreChatDisplay' ? '已恢复聊天显示。' : '已清空手机聊天显示，可在聊天详情中恢复。');
            return refresh();
        }
        if (name === 'openSharedPost') {
            const post = await ledger.get(scope, data.id);
            if (!post || post.kind !== 'post' || !session.valid() || !active(post, trail) || !post.audience.includes(PLAYER) || session.prefs.hiddenSocial?.some(id => id === post.id || id === post.reference)) throw new Error('原动态已删除、隐藏或不在当前可见范围。');
            phone.navigate(post.thread, null, false); await refresh();
            if (post.thread === 'redbook') phone.noteDetail(current, post);
            else phone.socialPreview(post);
            return;
        }
        if (name === 'deleteSocial') {
            const row = await ledger.get(scope, data.id);
            if (!row || !['post', 'comment'].includes(row.kind) || !active(row, trail) || !row.audience.includes(PLAYER) || !session.valid()) throw new Error('该内容已不在当前可见范围。');
            if (row.origin === 'phone' && !trail.byEvent.has(row.id)) {
                const related = row.kind === 'post' ? (await ledger.query(scope, { thread: row.thread, limit: Infinity, accept: item => item.origin === 'phone' && active(item, trail) && !trail.byEvent.has(item.id) && (item.target === row.id || row.reference && item.target === row.reference) })).rows : [];
                await ledger.write([row, ...related].map(item => ({ ...item, deleted: true, sync: false, revision: item.revision + 1 })));
            }
            const hiddenSocial = unique([...(session.prefs.hiddenSocial || []), row.id, row.reference]);
            await savePrefs(session, { hiddenSocial }); queueCloud(session); setNotice('已从小手机移除，酒馆正文保留。'); return refresh();
        }
        if (name === 'forward') {
            const row = await ledger.get(scope, data.id);
            const target = session.threads.find(item => item.id === data.thread && item.members.includes(PLAYER));
            if (!row || !active(row, trail) || !row.audience.includes(PLAYER) || !target || !session.valid()) throw new Error('消息或目标会话不可用');
            await insert(session, [{ kind: 'message', speakerId: PLAYER, participants: target.members, thread: target.id, text: clip(`转发 ${row.speaker} 的${PLATFORMS[row.thread] || '消息'}：${row.payload?.title || ''} ${row.text}`), payload: row.kind === 'post' ? { components: [{ type: 'link', text: row.text, fields: { postId: row.id, platform: row.thread, author: row.speaker, title: row.payload?.title || row.text.slice(0, 60), image: photoSource(row.payload?.media?.[0]?.fields?.src) } }] } : row.payload }]);
            setNotice('已转发到所选手机会话。'); return refresh();
        }
        if (name === 'cloudSave' || name === 'cloudRestore') { await cloud.sync(session, name === 'cloudRestore'); setNotice(cloud.status); return refresh(); }
        if (name === 'arm') { sync.arm(scope); setNotice('已安排在下一条正常正文用户消息中交接。'); }
        else if (name === 'addContact') {
            const contact = clip(data.name, 60);
            if (!contact || session.people.some(person => person.name === contact)) throw new Error('联系人姓名为空或已存在');
            await ledger.saveMeta(`${scope}:contacts`, [...session.manual, { id: `local:${newId()}`, name: contact, notes: clip(data.notes) }]);
        } else if (name === 'setSocialNickname') {
            const person = session.people.find(person => person.id === data.person);
            const nickname = clip(data.nickname, 80);
            if (!person || !nickname || /[=＝\r\n<>]/.test(nickname)) throw new Error('请填写有效网名，不含等号、换行或尖括号');
            const aliases = socialAliases(settings);
            aliases.delete(nickname); aliases.set(nickname, person.name);
            return saveSettings({ socialAliases: [...aliases].map(([name, target]) => `${name}=${target}`).join('\n') }, '网名已保存，正文中对应账号会重新识别。');
        } else if (name === 'addGroup') {
            const members = unique([PLAYER, ...(Array.isArray(data.members) ? data.members : []).filter(id => session.people.some(person => person.id === id))]);
            if (members.length < 3) throw new Error('请至少选择两位联系人');
            const id = `group:${newId()}`;
            const names = session.people.filter(person => person.id !== PLAYER && members.includes(person.id)).map(person => person.name);
            await ledger.saveMeta(`${scope}:groups`, [...session.groups, { id, name: '群聊', members, createdNotice: `你邀请${names.join('、')}加入了群聊` }]);
            phone.navigate('chat', id, false);
        } else if (['renameGroup', 'addGroupMembers'].includes(name)) {
            const group = session.groups.find(item => item.id === data.id && item.members.includes(PLAYER));
            if (!group) throw new Error('群聊不存在或已变化');
            let updated;
            if (name === 'renameGroup') {
                const groupName = clip(data.name, 60);
                if (!groupName) throw new Error('请输入群聊名称');
                updated = { ...group, name: groupName };
            } else {
                const added = (Array.isArray(data.members) ? data.members : []).filter(id => session.people.some(person => person.id === id));
                updated = { ...group, members: unique([...group.members, ...added]) };
            }
            await ledger.saveMeta(`${scope}:groups`, session.groups.map(item => item.id === group.id ? updated : item));
        } else if (name === 'pin' && thread) {
            const pins = new Set(session.prefs.pins || []);
            if (pins.has(thread.id)) pins.delete(thread.id); else pins.add(thread.id);
            await savePrefs(session, { pins: [...pins] });
        } else if (['send', 'reply', 'initiative', 'preview', 'call'].includes(name) && thread) {
            if (!thread.members.includes(PLAYER)) throw new Error('玩家不是该会话的参与者');
            const actor = chosen(session, thread, data.actor, data.text);
            if (name === 'send' || name === 'call') {
                if (!clip(data.text)) throw new Error(name === 'call' ? '请说明实际发生的通话内容' : '请先输入一条消息');
                const id = newId(); const payload = data.payload ? structuredClone(data.payload) : undefined;
                for (const [index, part] of (payload?.components || []).entries()) if (part.type === 'photo' && part.fields?.photoId) {
                    const attached = await photos.attach(scope, part.fields.photoId, id, index);
                    part.fields.photoId = attached.id;
                    delete part.fields.src; delete part.fields.url;
                    const persistentSource = photoSource(attached.url);
                    if (persistentSource && !/^(?:blob:|data:)/.test(persistentSource)) part.fields.src = persistentSource;
                }
                await insert(session, [{ kind: name === 'send' ? 'message' : 'call', speakerId: PLAYER, participants: thread.members, thread: thread.id, text: data.text, quote: data.quote, payload, extra: { id } }]);
                phone.clearDraft();
                return refresh();
            }
            return generate({ session, thread, actor, mode: name === 'initiative' ? 'initiative' : 'reply', preview: name === 'preview', recall: data.recall });
        } else if (['edit', 'delete', 'remember', 'retry', 'toggleSync'].includes(name)) {
            const row = await ledger.get(scope, data.id);
            if (!row || !session.valid() || !active(row, trail) || !row.audience.includes(PLAYER)) throw new Error('这条记录不在当前有效分支');
            if (name === 'toggleSync' && row.kind === 'post') {
                const prefs = await ledger.readMeta(`${scope}:prefs`) || {};
                const enabled = typeof data.enabled === 'boolean' ? data.enabled : !postSyncEnabled(row, settings, prefs);
                const postSync = { ...prefs.postSync, [row.id]: enabled, ...(row.reference ? { [row.reference]: enabled } : {}) };
                await savePrefs(session, { postSync });
                const related = await ledger.query(scope, { thread: row.thread, limit: Infinity, accept: item => item.origin === 'phone' && active(item, trail) && !trail.byEvent.has(item.id) && (item.target === row.id || row.reference && item.target === row.reference || item.kind === 'follow' && item.speakerId === PLAYER && item.participants.includes(row.speakerId)) });
                const records = related.rows.map(item => ({ ...item, sync: enabled, revision: item.revision + 1 }));
                if (row.origin === 'phone' && !trail.byEvent.has(row.id)) records.push({ ...row, sync: enabled, revision: row.revision + 1 });
                await ledger.write(records);
                queueCloud(session); setNotice(enabled ? '已开启动态和未交接互动的正文同步；收藏仍仅自己可见。' : '已关闭：本帖及评论不再注入后续正文；已写入的历史内容保留。'); return refresh();
            }
            if (name !== 'remember' && (trail.byEvent.has(row.id) || row.origin !== 'phone')) throw new Error('已交接或来自正文的记录，请在酒馆源楼层进行修正');
            if (name === 'retry') {
                if (!thread || row.speakerId === PLAYER || row.kind !== 'message' || row.id !== session.rows[0]?.id) throw new Error('只能重新生成当前最后一组角色回复');
                return generate({ session, thread, actor: session.people.find(person => person.id === row.speakerId), replace: row });
            }
            const edit = name === 'edit' ? { text: clip(data.text), memory: '', suggestedMemory: '', editHistory: [...(row.editHistory || []), { revision: row.revision, text: row.text }] }
                : name === 'delete' ? { deleted: true } : name === 'toggleSync' ? { sync: row.sync === false } : { memory: clip(data.text, 300) };
            if (name === 'edit' && !edit.text) throw new Error('内容不能为空');
            await ledger.write([{ ...row, ...edit, revision: row.revision + 1 }]);
        } else if (name === 'post') {
            const audience = unique([PLAYER, ...(data.public ? session.people.map(person => person.id) : data.members)]);
            await insert(session, [{ kind: 'post', speakerId: PLAYER, participants: [PLAYER], audience, thread: platformId(data.platform), text: data.text, payload: data.payload, extra: { sync: data.inject === true } }]);
        } else if (name === 'postActor') {
            const actor = session.people.find(person => person.id === data.actor);
            if (!actor || actor.id === PLAYER) throw new Error('请选择一位角色发布动态；AI 不代替玩家发帖。');
            const audience = unique([PLAYER, actor?.id, ...(data.public ? session.people.map(person => person.id) : data.members)]);
            return generate({ session, actor, thread: { id: platformId(data.platform), members: audience }, mode: 'post', inject: data.inject, hint: clip(data.text, 2000), count: Number(data.count || (platformId(data.platform) === 'x' ? 7 : 1)) });
        } else if (['like', 'comment', 'collect', 'repost', 'follow'].includes(name)) {
            const post = await ledger.get(scope, data.id);
            if (!post || post.kind !== 'post' || !session.valid() || !active(post, trail) || !post.audience.includes(PLAYER)) throw new Error('该动态已不在当前可见范围');
            const inject = session.prefs.postSync?.[post.id] ?? (post.origin === 'phone' ? post.sync !== false : settings.socialSync?.[post.thread] === true);
            if (['like', 'collect', 'follow'].includes(name)) {
                const latest = (await ledger.query(scope, { thread: post.thread, limit: 1, accept: row => row.kind === name && row.speakerId === PLAYER && active(row, trail) && (name === 'follow' ? row.participants.includes(post.speakerId) : row.target === post.id || post.reference && row.target === post.reference) })).rows[0];
                if (latest?.origin === 'phone' && !trail.byEvent.has(latest.id)) {
                    await ledger.write([{ ...latest, deleted: true, sync: false, revision: latest.revision + 1 }]);
                    queueCloud(session); return refresh();
                }
                const enabled = !latest || latest.payload?.reactionActive === false;
                const text = enabled ? ({ like: '赞了这条动态', collect: '收藏了这条内容', follow: '关注了作者' })[name] : ({ like: '取消了对这条动态的赞', collect: '取消收藏了这条内容', follow: '取消关注了作者' })[name];
                await insert(session, [{ kind: name, speakerId: PLAYER, participants: [PLAYER, post.speakerId], audience: name === 'collect' ? [PLAYER] : post.audience, thread: post.thread, text, target: post.id, quote: post.text, payload: { reactionActive: enabled }, extra: { sync: inject } }]);
            } else {
                const text = name === 'repost' ? '转发了这条内容' : clip(data.text);
                await insert(session, [{ kind: name, speakerId: PLAYER, participants: [PLAYER, post.speakerId], audience: post.audience, thread: post.thread, text, target: post.id, quote: data.quote || post.text, extra: { sync: inject } }]);
            }
        } else if (name === 'backup') {
            const backup = await cloud.backup(session);
            download(`Tavern-Pocket-${digest(scope)}.json`, JSON.stringify(backup, null, 2), 'application/json');
        } else if (name === 'restore') {
            if (!data.file || data.file.size > 128 * 1024 * 1024) throw new Error('请选择不超过 128 MiB 的备份文件');
            const backup = JSON.parse(await data.file.text());
            if (!session.valid()) throw new Error('聊天已切换，未导入');
            const rows = await cloud.restore(backup, session);
            scan = null;
            setNotice(`已检查 ${rows} 条备份记录；同 ID 保留本地版本。未匹配有效分支的记录不会显示。`);
        } else return;
        queueCloud(session);
        return refresh();
    }

    const phone = new Phone(host, settings, (name, data) => action(name, data).then(result => ['draftImagePrompt', 'generateAttachmentImage'].includes(name) ? result : true, error => { if (!error.queueCancelled) fail(error); return false; }), eventStatus, frame);
    phone.hasApiKey = Boolean(transport.token);
    phone.resourceManager = resources;
    let disposalStarted = false;
    const dispose = async () => {
        if (disposed || disposalStarted) return;
        disposalStarted = true;
        generation?.cancel(); transport.cancel(); images.cancel();
        // Drain pending local edits before closing IndexedDB or disabling actions.
        await phone.flushAutosaves();
        disposed = true;
        host.clearTimeout(timer);
        host.clearTimeout(cloudTimer);
        frame.removeEventListener('pagehide', dispose);
        if (host !== frame) host.removeEventListener('pagehide', dispose);
        requests.close(); generation?.cancel(); transport.close(); images.cancel(); photos.close(); sync.close(); ledger.close(); phone.close();
        if (context.eventTypes?.CHAT_CHANGED) context.eventSource.removeListener(context.eventTypes.CHAT_CHANGED, installHiding);
        for (const url of downloads) host.URL.revokeObjectURL(url);
        if (host[slot] === dispose) delete host[slot];
    };
    host[slot] = dispose;
    frame.addEventListener('pagehide', dispose, { once: true });
    if (host !== frame) host.addEventListener('pagehide', dispose, { once: true });
    try { sync.attach(context); } catch (error) { fail(error); }
    if (context.eventTypes?.CHAT_CHANGED) context.eventSource.on(context.eventTypes.CHAT_CHANGED, installHiding);
    installHiding();
}

module.exports = { start };
