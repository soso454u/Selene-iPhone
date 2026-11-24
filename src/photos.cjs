const { clip, newId, PLAYER, active } = require('./domain.cjs');
const { safeUrl } = require('./media.cjs');
const { isEnglishPrompt } = require('./image-rules.cjs');
const validImageBlob = blob => !!blob && typeof blob.arrayBuffer === 'function' && blob.size > 0 && blob.size <= 20 * 1024 * 1024 && /^image\/(png|jpeg|webp|gif|avif)$/.test(blob.type);
const photoSource = value => {
    if (typeof value !== 'string') return '';
    const source = value.trim();
    return safeUrl(source) || (/^\/(?!\/)[^\r\n]*$/.test(source) || /^blob:[^\r\n]+$/.test(source) || (source.length <= 28 * 1024 * 1024 && /^data:image\/(png|jpeg|webp|gif|avif);base64,[a-zA-Z0-9+/=]+$/.test(source)) ? source : '');
};
function dataImageBlob(value) {
    const match = String(value).match(/^data:(image\/(?:png|jpeg|webp|gif|avif));base64,([a-zA-Z0-9+/=]+)$/);
    if (!match) throw new Error('图片 Base64 格式无效。');
    let raw; try { raw = atob(match[2]); } catch { throw new Error('图片 Base64 无法解码。'); }
    const blob = new Blob([Uint8Array.from(raw, c => c.charCodeAt(0))], { type: match[1] });
    if (!validImageBlob(blob)) throw new Error('图片为空或超过 20 MiB。');
    return blob;
}
function photoSources(rows) {
    return rows.flatMap(row => (row.payload?.components || row.payload?.media || []).flatMap((part, index) => ['photo', 's-image'].includes(part.type) ? [{ id: `source:${row.id}:${index}`, sourceId: row.id, index, ownerId: row.speakerId, title: row.payload?.title || '聊天与动态中的图片', description: clip(part.displayText || part.text), prompt: clip(part.fields?.prompt, 6000), photoId: clip(part.fields?.photoId, 120), url: photoSource(part.fields?.src || part.fields?.url), stamp: row.stamp, source: true }] : []));
}
class Photos {
    constructor(ledger, host = globalThis) { Object.assign(this, { ledger, host, objects: new Map() }); }
    async list(scope) { return await this.ledger.readMeta(`photos:${scope}`) || []; }
    async savePrompt(scope, input) {
        if (input.sourceId) {
            const key = `${scope}:photo-prompts`;
            const entries = Object.entries(await this.ledger.readMeta(key) || {}).filter(([id]) => id !== JSON.stringify([input.sourceId, input.index || 0]));
            entries.push([JSON.stringify([input.sourceId, input.index || 0]), { description: clip(input.description), sourcePrompt: clip(input.sourcePrompt, 6000), prompt: clip(input.prompt, 6000), replacePrompt: input.replacePrompt === true }]);
            await this.ledger.saveMeta(key, Object.fromEntries(entries.slice(-500)));
        } else if (input.id) {
            const rows = await this.list(scope);
            await this.ledger.saveMeta(`photos:${scope}`, rows.map(row => row.id === input.id && row.description === input.description ? { ...row, prompt: clip(input.prompt, 6000) } : row));
        }
    }
    async withPrompts(scope, rows) {
        const prompts = await this.ledger.readMeta(`${scope}:photo-prompts`) || {};
        return rows.map(row => {
            const key = row.payload?.media ? 'media' : 'components';
            if (!row.payload?.[key]) return row;
            const parts = row.payload[key].map((part, index) => {
                const saved = prompts[JSON.stringify([row.id, index])];
                return ['photo', 's-image'].includes(part.type) && (saved?.replacePrompt || !isEnglishPrompt(part.fields?.prompt)) && saved?.description === clip(part.text) && clip(part.fields?.prompt, 6000) === (saved.sourcePrompt || '') ? { ...part, fields: { ...part.fields, prompt: saved.prompt } } : part;
            });
            return { ...row, payload: { ...row.payload, [key]: parts } };
        });
    }
    async withDescriptions(scope, rows, trail, parser) {
        const sources = new Map(rows.filter(row => row.origin === 'phone' && row.payload?.components?.some(part => part.type === 'photo')).map(row => [row.id, row]));
        if (!sources.size || !parser) return rows;
        const members = ids => JSON.stringify([...ids].sort());
        const { rows: references } = await this.ledger.query(scope, { origin: 'tavern', limit: Infinity, accept: row => {
            const source = sources.get(row.echoOf);
            return source && row.parser === parser && active(row, trail) && active(source, trail) && row.speakerId === source.speakerId && row.thread === source.thread
                && members(row.participants) === members(source.participants) && members(row.audience) === members(source.audience);
        } });
        const details = new Map();
        for (const row of references.sort((a, b) => a.floor - b.floor || a.stamp - b.stamp)) {
            const original = sources.get(row.echoOf).payload.components, parts = row.payload?.components;
            if (!parts || parts.length !== original.length || parts.some((part, index) => part.type !== original[index].type)) continue;
            parts.forEach((part, index) => {
                if (part.type === 'photo' && clip(part.text).length > clip(original[index].text).length) details.set(JSON.stringify([row.echoOf, index]), clip(part.text));
            });
        }
        return rows.map(row => sources.has(row.id) ? { ...row, payload: { ...row.payload, components: row.payload.components.map((part, index) => {
            const displayText = details.get(JSON.stringify([row.id, index]));
            return displayText ? { ...part, displayText } : part;
        }) } } : row);
    }
    async attach(scope, photoId, sourceId, index) {
        const rows = await this.list(scope); const original = rows.find(row => row.id === photoId && row.inAlbum !== false);
        if (!original) throw new Error('所选相册图片已不存在，请重新选择。');
        if (rows.length >= 200) throw new Error('相册存储空间不足，请先移除不需要的图片。');
        // Keep an independent source record sharing the Blob; deleting the album entry
        // must not invalidate an image that has already been sent in chat.
        const copy = { ...original, id: newId(), ownerId: PLAYER, sourceId, index, inAlbum: false, stamp: Date.now() };
        await this.ledger.saveMeta(`photos:${scope}`, [copy, ...rows]);
        return copy;
    }
    display(asset, blob) {
        if (!this.objects.has(asset)) this.objects.set(asset, { blob, url: this.host.URL.createObjectURL(blob) });
        return this.objects.get(asset).url;
    }
    async resolve(rows) {
        return Promise.all(rows.map(async row => {
            if (!row.asset) return row;
            const asset = await this.ledger.readMeta(`photo:${row.asset}`);
            const blob = asset?.blob || (asset?.data ? dataImageBlob(asset.data) : null);
            return { ...row, url: validImageBlob(blob) ? this.display(row.asset, blob) : '' };
        }));
    }
    async save(scope, input) {
        let rows = await this.list(scope);
        const replaced = input.generated && input.replaceSource && input.sourceId ? rows.filter(row => row.sourceId === input.sourceId && row.index === Number(input.index || 0) && row.inAlbum === false) : [];
        if (replaced.length) rows = rows.filter(row => !replaced.includes(row));
        const existing = rows.find(row => (input.id && row.id === input.id || input.sourceId && row.sourceId === input.sourceId && row.index === Number(input.index || 0) && !input.generated) && row.ownerId === (input.ownerId || PLAYER));
        if (existing) {
            if (existing.inAlbum === false && input.inAlbum !== false) {
                const promoted = { ...existing, inAlbum: true };
                await this.ledger.saveMeta(`photos:${scope}`, rows.map(row => row.id === existing.id ? promoted : row));
                return (await this.resolve([promoted]))[0];
            }
            return (await this.resolve([existing]))[0];
        }
        if (rows.length >= 200) throw new Error('当前相册已达 200 张，请先移除不需要的图片。');
        let url = photoSource(input.url); let blob = input.blob;
        const original = input.id && rows.find(row => row.id === input.id);
        let asset = original?.asset;
        if (!asset && url.startsWith('data:')) blob = dataImageBlob(url);
        if (!asset && url.startsWith('blob:') && !blob) {
            blob = [...this.objects.values()].find(item => item.url === url)?.blob;
            if (!blob && this.host.fetch) blob = await (await this.host.fetch(url)).blob();
        }
        if (!asset && !blob && url && input.persistent !== true && input.skipCache !== true && !url.startsWith('/')) {
            try { const response = await this.host.fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' }); if (response.ok) blob = await response.blob(); } catch {}
        }
        if (blob && !validImageBlob(blob)) throw new Error('图片格式不支持或超过 20 MiB。');
        if (!asset && !blob && (!url || url.startsWith('blob:'))) throw new Error('图片内容不可读取，未保存临时地址。');
        const id = newId(); if (blob) asset = id;
        const row = { id, ownerId: input.ownerId || PLAYER, title: clip(input.title || '保存的图片', 100), description: clip(input.description), prompt: clip(input.prompt, 6000), stamp: Date.now(), generated: input.generated === true, inAlbum: input.inAlbum !== false, sourceId: clip(input.sourceId, 120), index: Number(input.index || 0), ...(asset ? { asset } : { url }), ...(input.warning ? { warning: clip(input.warning, 250) } : {}) };
        const deleted = [...new Set([...(await this.ledger.readMeta(`${scope}:deletedPhotos`) || []), ...replaced.map(row => row.id)])];
        await this.ledger.write([], [{ key: `photos:${scope}`, value: [row, ...rows] }, ...(blob ? [{ key: `photo:${id}`, value: { blob } }] : []), ...(replaced.length ? [{ key: `${scope}:deletedPhotos`, value: deleted }] : [])]);
        for (const previous of replaced) {
            if (!previous.asset || [row, ...rows].some(item => item.asset === previous.asset)) continue;
            const cached = this.objects.get(previous.asset);
            if (cached) this.host.URL.revokeObjectURL(cached.url);
            this.objects.delete(previous.asset); await this.ledger.saveMeta(`photo:${previous.asset}`, null);
        }
        return (await this.resolve([row]))[0];
    }
    async remove(scope, id) {
        const rows = await this.list(scope); const row = rows.find(row => row.id === id);
        const next = rows.filter(row => row.id !== id);
        await this.ledger.write([], [{ key: `${scope}:deletedPhotos`, value: Array.from(new Set([...(await this.ledger.readMeta(`${scope}:deletedPhotos`) || []), id])) }, { key: `photos:${scope}`, value: next }]);
        if (row?.asset && !next.some(item => item.asset === row.asset)) {
            const cached = this.objects.get(row.asset); if (cached) this.host.URL.revokeObjectURL(cached.url); this.objects.delete(row.asset);
            await this.ledger.saveMeta(`photo:${row.asset}`, null);
        }
    }
    close() { for (const { url } of this.objects.values()) this.host.URL.revokeObjectURL(url); this.objects.clear(); }
}
module.exports = { Photos, photoSource, photoSources, dataImageBlob, validImageBlob };
