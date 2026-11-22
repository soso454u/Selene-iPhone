const { VERSION, PLAYER, KINDS, active, clip, digest } = require('./domain.cjs');
const { cleanBackgroundMap, imageSource } = require('./backgrounds.cjs');
const { photoSource, dataImageBlob, validImageBlob } = require('./photos.cjs');
const { PREF_KEYS, pick, portablePhone } = require('./portable.cjs');

function resultOf(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onabort = () => reject(transaction.error || new Error('本地存储事务已取消'));
    });
}

class Ledger {
    constructor(host) {
        this.host = host;
    }

    async open() {
        if (this.closed) throw new Error('账本已关闭');
        this.ready ??= this.connect().catch(error => { this.ready = null; throw error; });
        return this.ready;
    }

    async connect() {
        const request = this.host.indexedDB.open('tavern-pocket-ledger', VERSION);
        request.onupgradeneeded = () => {
            const database = request.result;
            const events = database.createObjectStore('events', { keyPath: ['scope', 'id'] });
            events.createIndex('time', ['scope', 'stamp', 'id']);
            events.createIndex('thread', ['scope', 'thread', 'stamp', 'id']);
            events.createIndex('origin', ['scope', 'origin', 'stamp', 'id']);
            database.createObjectStore('meta', { keyPath: 'key' });
        };
        const database = await resultOf(request);
        if (this.closed) { database.close(); throw new Error('账本已关闭'); }
        database.onversionchange = () => { database.close(); this.ready = null; };
        // Retire the removed web app's isolated bookmarks/history, preserving
        // phone events, chat preferences, photos and all other meta namespaces.
        const cleanup = database.transaction('meta', 'readwrite');
        const cleaned = transactionDone(cleanup);
        const obsolete = cleanup.objectStore('meta').openCursor(this.host.IDBKeyRange.bound('browser:v1:', 'browser:v1:\uffff'));
        obsolete.onsuccess = () => { const cursor = obsolete.result; if (cursor) { cursor.delete(); cursor.continue(); } };
        await cleaned;
        if (this.closed) { database.close(); throw new Error('账本已关闭'); }
        this.database = database;
        return database;
    }

    async readMeta(key) {
        const database = await this.open();
        return (await resultOf(database.transaction('meta').objectStore('meta').get(key)))?.value;
    }

    async saveMeta(key, value) {
        return this.write([], [{ key, value }]);
    }

    async write(events, meta = [], insertOnly = false) {
        if (!events.length && !meta.length) return;
        const database = await this.open();
        const transaction = database.transaction(['events', 'meta'], 'readwrite');
        const done = transactionDone(transaction);
        const eventStore = transaction.objectStore('events');
        for (const row of events) {
            if (insertOnly) {
                const request = eventStore.getKey([row.scope, row.id]);
                request.onsuccess = () => { if (request.result === undefined) eventStore.add(row); };
            } else eventStore.put(row);
        }
        for (const row of meta) transaction.objectStore('meta').put(row);
        await done;
        this.onWrite?.(events, meta);
    }

    async get(scope, id) {
        const database = await this.open();
        return resultOf(database.transaction('events').objectStore('events').get([scope, id]));
    }

    async clearScope(scope, trail) {
        const database = await this.open();
        const transaction = database.transaction(['events', 'meta'], 'readwrite');
        const done = transactionDone(transaction);
        transaction.objectStore('events').delete(this.host.IDBKeyRange.bound([scope, ''], [scope, '\uffff']));
        const meta = transaction.objectStore('meta');
        const photos = meta.get(`photos:${scope}`);
        photos.onsuccess = () => {
            for (const row of photos.result?.value || []) if (row.asset) meta.delete(`photo:${row.asset}`);
            meta.delete(`photos:${scope}`);
        };
        const request = meta.openCursor(this.host.IDBKeyRange.bound(`${scope}:`, `${scope}:\uffff`));
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) { cursor.delete(); cursor.continue(); }
            else meta.put({ key: `${scope}:clearedStory`, value: trail.hashes });
        };
        await done;
    }

    async query(scope, { thread, origin, limit = 40, cursor, newest = true, accept = () => true } = {}) {
        const database = await this.open();
        const indexName = thread ? 'thread' : origin ? 'origin' : 'time';
        const prefix = thread ? [scope, thread] : origin ? [scope, origin] : [scope];
        const lower = [...prefix, -Number.MAX_VALUE, ''];
        const upper = [...prefix, Number.MAX_VALUE, '\uffff'];
        const range = this.host.IDBKeyRange.bound(!newest && cursor ? cursor : lower, newest && cursor ? cursor : upper, !!(!newest && cursor), !!(newest && cursor));
        const index = database.transaction('events').objectStore('events').index(indexName);
        const request = index.openCursor(range, newest ? 'prev' : 'next');
        return new Promise((resolve, reject) => {
            const rows = [];
            let next;
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const item = request.result;
                if (!item) { resolve({ rows, next: null }); return; }
                if (accept(item.value)) {
                    if (rows.length === limit) { resolve({ rows, next }); return; }
                    rows.push(item.value);
                    next = item.key;
                }
                item.continue();
            };
        });
    }

    cleanEvents(rows, scope) {
        return rows.map(row => {
            if (!row || typeof row.id !== 'string' || row.id.length > 120 || !Number.isFinite(row.stamp) || !['phone', 'tavern'].includes(row.origin) || !KINDS.includes(row.kind)
                || !Number.isInteger(row.anchor?.length) || typeof row.anchor?.key !== 'string' || typeof row.thread !== 'string'
                || typeof row.speakerId !== 'string' || typeof row.text !== 'string' || !Array.isArray(row.audience) || !Array.isArray(row.participants) || !Array.isArray(row.names) || !Array.isArray(row.audienceNames)
                || ![...row.audience, ...row.participants, ...row.names, ...row.audienceNames].every(value => typeof value === 'string')) throw new Error('备份中存在无效事件');
            if (row.payload && JSON.stringify(row.payload).length > 256 * 1024) throw new Error('单条消息附件超过备份上限，未截断数据。');
            const { id, stamp, origin, kind, anchor, thread, speakerId, speaker, audience, participants, names, audienceNames, floor, revision, rpTime, quote, target, sync, deleted, parser, memory, reference, bubbleGroup, suggestedMemory, echoOf, participation, conflictOf } = row;
            const editHistory = Array.isArray(row.editHistory) ? row.editHistory.filter(item => Number.isInteger(item?.revision) && typeof item.text === 'string').map(item => ({ revision: item.revision, text: clip(item.text) })) : [];
            return { scope, version: VERSION, id, stamp, origin, kind, anchor, thread, speakerId, speaker: clip(speaker, 100), audience, participants, names, audienceNames, floor, revision: Number.isInteger(revision) ? revision : 1, text: clip(row.text), rpTime: clip(rpTime, 80), quote: clip(quote, 300), target: clip(target, 120), sync: sync !== false, deleted: deleted === true, parser: clip(parser, 100), ...(echoOf ? { echoOf: clip(echoOf, 120) } : {}), ...(conflictOf ? { conflictOf: clip(conflictOf, 120) } : {}), ...(participation && JSON.stringify(participation).length < 4000 ? { participation } : {}), memory: clip(memory, 300), reference: clip(reference, 120), bubbleGroup: clip(bubbleGroup, 120), suggestedMemory: clip(suggestedMemory, 300), ...(row.payload && typeof row.payload === 'object' && JSON.stringify(row.payload).length <= 256 * 1024 ? { payload: row.payload } : {}), editHistory };
        });
    }

    async backup(scope, trail, people, threads, phone = {}) {
        const { rows } = await this.query(scope, { limit: Infinity });
        const prefs = pick(await this.readMeta(`${scope}:prefs`), PREF_KEYS);
        const chatBackgrounds = cleanBackgroundMap(prefs.chatBackgrounds);
        phone = portablePhone(phone);
        const assets = {};
        for (const config of [...Object.values(chatBackgrounds), ...Object.values(phone.settings?.pageBackgrounds || {}), ...Object.values(phone.style?.pageBackgrounds || {})]) {
            if (!config.image.startsWith('asset:')) continue;
            const id = config.image.slice(6); const asset = await this.readMeta(`background:${id}`);
            if (asset) assets[id] = asset;
        }
        const photos = await this.readMeta(`photos:${scope}`) || [];
        const photoAssets = {};
        for (const row of photos) {
            if (!row.asset || photoAssets[row.asset]) continue;
            const asset = await this.readMeta(`photo:${row.asset}`);
            if (asset?.data && validImageBlob(dataImageBlob(asset.data))) photoAssets[row.asset] = { data: asset.data };
            else if (validImageBlob(asset?.blob)) {
                const bytes = new Uint8Array(await asset.blob.arrayBuffer()); const chunks = [];
                for (let start = 0; start < bytes.length; start += 32768) chunks.push(String.fromCharCode(...bytes.subarray(start, start + 32768)));
                photoAssets[row.asset] = { data: `data:${asset.blob.type};base64,${btoa(chunks.join(''))}` };
            } else throw new Error('相册中有图片内容无法读取，未生成不完整备份。');
        }
        return { format: 'tavern-pocket', version: VERSION, chat: JSON.parse(scope).slice(1), tail: trail.tail, people, threads, events: this.cleanEvents(rows, scope),
            phone, prefs, photoPrompts: await this.readMeta(`${scope}:photo-prompts`) || {}, clearedStory: await this.readMeta(`${scope}:clearedStory`),
            photos, photoAssets, deletedPhotos: await this.readMeta(`${scope}:deletedPhotos`) || [], chatBackgrounds, backgroundAssets: assets };
    }

    async restore(backup, scope, people, threads, preferBackup = false) {
        if (backup?.format !== 'tavern-pocket' || backup.version !== VERSION || JSON.stringify(backup.chat) !== JSON.stringify(JSON.parse(scope).slice(1)) || !Array.isArray(backup.events)) {
            throw new Error('备份类型、版本或聊天文件不匹配');
        }
        const importedPeople = Array.isArray(backup.people) ? backup.people.filter(person => typeof person?.id === 'string' && person.id.startsWith('local:') && typeof person.name === 'string').map(person => ({ id: clip(person.id, 100), name: clip(person.name, 60), notes: clip(person.notes) })).slice(0, 500) : [];
        const importedThreads = Array.isArray(backup.threads) ? backup.threads.filter(item => typeof item?.id === 'string' && item.id.startsWith('group:') && typeof item.name === 'string' && Array.isArray(item.members) && item.members.every(id => typeof id === 'string')).map(item => ({ id: clip(item.id, 120), name: clip(item.name, 60), members: item.members.slice(0, 25), ...(item.createdNotice ? { createdNotice: clip(item.createdNotice, 500) } : {}) })).slice(0, 500) : [];
        const records = this.cleanEvents(backup.events, scope);
        const merge = (local, imported) => [...new Map((preferBackup ? [...local, ...imported] : [...imported, ...local]).map(item => [item.id, item])).values()];
        const prefs = await this.readMeta(`${scope}:prefs`) || {};
        const importedPrefs = pick(backup.prefs, PREF_KEYS);
        const importedBackgrounds = cleanBackgroundMap(importedPrefs.chatBackgrounds || backup.chatBackgrounds);
        const phone = portablePhone(backup.phone);
        const assets = [];
        for (const config of [...Object.values(importedBackgrounds), ...Object.values(phone.settings?.pageBackgrounds || {}), ...Object.values(phone.style?.pageBackgrounds || {})]) {
            const id = config.image.startsWith('asset:') ? config.image.slice(6) : '';
            const asset = backup.backgroundAssets?.[id];
            if (id && asset?.data?.length < 3 * 1024 * 1024 && /^data:image\//.test(imageSource(asset.data))) assets.push({ key: `background:${id}`, value: { data: asset.data } });
        }
        const importedPhotos = Array.isArray(backup.photos) ? backup.photos.filter(row => typeof row?.id === 'string' && typeof row.ownerId === 'string' && Number.isFinite(row.stamp)).map(row => ({ ...pick(row, ['id', 'ownerId', 'stamp', 'generated', 'inAlbum', 'asset', 'sourceId', 'index', 'warning']), title: clip(row.title, 100), description: clip(row.description), prompt: clip(row.prompt, 6000), ...(photoSource(row.url) && !row.url.startsWith('blob:') ? { url: photoSource(row.url) } : {}) })) : [];
        for (const row of importedPhotos) {
            if (!row.asset) continue;
            const data = backup.photoAssets?.[row.asset]?.data;
            const existing = data ? null : await this.readMeta(`photo:${row.asset}`);
            const blob = data ? dataImageBlob(data) : existing?.blob || (existing?.data ? dataImageBlob(existing.data) : null);
            if (!validImageBlob(blob)) throw new Error('备份缺少相册图片内容，未恢复不完整数据。');
            // Stable, receiving-scope IDs keep another account's album independent.
            row.asset = `sync:${digest(scope)}:${row.id}`;
            assets.push({ key: `photo:${row.asset}`, value: { blob } });
        }
        const deletedPhotos = [...new Set([...(await this.readMeta(`${scope}:deletedPhotos`) || []), ...(Array.isArray(backup.deletedPhotos) ? backup.deletedPhotos.filter(id => typeof id === 'string') : [])])];
        const prompts = await this.readMeta(`${scope}:photo-prompts`) || {};
        const importedPrompts = Object.fromEntries(Object.entries(backup.photoPrompts || {}).filter(([key, value]) => key.length < 300 && value && typeof value.prompt === 'string').map(([key, value]) => [key, { description: clip(value.description), sourcePrompt: clip(value.sourcePrompt, 6000), prompt: clip(value.prompt, 6000), replacePrompt: value.replacePrompt === true }]));
        const combinedPrefs = preferBackup ? { ...prefs, ...importedPrefs } : { ...importedPrefs, ...prefs };
        await this.write(records, [{ key: `${scope}:contacts`, value: merge(people, importedPeople) }, { key: `${scope}:groups`, value: merge(threads, importedThreads) },
            { key: `${scope}:prefs`, value: { ...combinedPrefs, chatBackgrounds: preferBackup ? { ...prefs.chatBackgrounds, ...importedBackgrounds } : { ...importedBackgrounds, ...prefs.chatBackgrounds } } },
            { key: `photos:${scope}`, value: merge(await this.readMeta(`photos:${scope}`) || [], importedPhotos).filter(row => !deletedPhotos.includes(row.id)) },
            { key: `${scope}:deletedPhotos`, value: deletedPhotos },
            { key: `${scope}:photo-prompts`, value: preferBackup ? { ...prompts, ...importedPrompts } : { ...importedPrompts, ...prompts } },
            ...(Array.isArray(backup.clearedStory) ? [{ key: `${scope}:clearedStory`, value: backup.clearedStory }] : []), ...assets], !preferBackup);
        return records.length;
    }

    close() {
        this.closed = true;
        this.database?.close();
    }
}

async function conversationMemory(ledger, scope, trail, thread, speaker, audience, accepts, recall = false) {
    const acceptsVisible = row => active(row, trail) && accepts(row) && row.audience.includes(speaker) && row.audience.includes(PLAYER) && audience.every(id => row.audience.includes(id));
    const recent = await ledger.query(scope, { thread, limit: 24, accept: acceptsVisible });
    const IDs = new Set(recent.rows.map(row => row.id));
    const states = await ledger.query(scope, { limit: 12, accept: row => !IDs.has(row.id) && row.thread !== thread && acceptsVisible(row) && !!row.memory });
    let older = [];
    if (recent.next) {
        older = (await ledger.query(scope, { thread, cursor: recent.next, limit: recall ? 30 : 12, accept: row => acceptsVisible(row) && (recall || !!row.memory) })).rows;
        if (!recall) {
            const saved = await ledger.readMeta(`${scope}:checkpoint:${thread}`) || [];
            const included = new Set([...IDs, ...older.map(row => row.id)]);
            for (const item of saved.slice(-12)) {
                if (included.has(item.id)) continue;
                const row = await ledger.get(scope, item.id);
                if (row?.revision === item.revision && acceptsVisible(row)) older.push({ ...row, text: item.extract });
            }
        }
    }
    return { recent: recent.rows.reverse(), older: older.sort((left, right) => left.stamp - right.stamp), states: states.rows.reverse() };
}

async function checkpoint(ledger, session, thread, accepts) {
    const { scope, trail } = session;
    const key = `${scope}:checkpoint:${thread}`;
    const live = row => active(row, trail) && accepts(row);
    const page = await ledger.query(scope, { thread, limit: 44, accept: live });
    if (page.rows.length < 44 || !session.valid()) return;
    const existing = await ledger.readMeta(key) || [];
    const mark = new Map(existing.map(item => [item.id, item]));
    const candidates = page.rows.slice(24).reverse().filter(row => mark.get(row.id)?.revision !== row.revision);
    if (candidates.length < 10 || !session.valid()) return;
    for (const row of candidates) {
        if (!row.memory && (row.kind === 'like' || /^(?:嗯+|哈+|哦+|好[的吧]?|收到)[。！!\s]*$/.test(row.text))) continue;
        const extract = row.memory || (row.text.length > 140 ? `${row.text.slice(0, 140)}…` : row.text);
        mark.set(row.id, { id: row.id, revision: row.revision, extract });
    }
    await ledger.saveMeta(key, [...mark.values()].slice(-120));
}

module.exports = { Ledger, conversationMemory, checkpoint };
