const { digest } = require('./domain.cjs');
const { worldbook, regexes, socialRegexes } = require('./bundled.cjs');
const { loadModule } = require('./host.cjs');

const fingerprint = value => {
    const sort = item => Array.isArray(item) ? item.map(sort) : item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key, sort(item[key])])) : item;
    return digest(JSON.stringify(sort(value)));
};
const same = (value, expected) => Object.entries(expected).every(([key, field]) => ['uid', 'displayIndex'].includes(key) || fingerprint(value[key] ?? null) === fingerprint(field ?? null));
const HIDE_EVENTS = { id: '229c638b-ef9f-48eb-a50c-85edca477518', scriptName: 'Selene手机｜隐藏剧情交接（仅显示）', findRegex: '/<phone_events\\b[^>]*>[\\s\\S]*?<\\/phone_events>/gi', replaceString: '', trimStrings: [], placement: [1, 2], disabled: false, markdownOnly: true, promptOnly: false, runOnEdit: true, substituteRegex: 0, minDepth: null, maxDepth: null };

function planResources(current, originals, records, mode, regex = false) {
    const name = regex ? 'scriptName' : 'comment';
    const id = regex ? 'id' : 'uid';
    const next = current.map(entry => structuredClone(entry));
    const statuses = [];
    const protectedNames = [];
    const owned = { ...records };
    for (const original of originals) {
        const matches = next.filter(entry => entry[name] === original[name] || (regex && entry.id === original.id));
        const entry = matches[0];
        const exact = entry && same(entry, original);
        const status = matches.length > 1 ? '存在冲突' : !entry ? '未安装' : exact ? '已安装' : '已修改';
        statuses.push({ name: original[name], status });
        if (mode === 'check') continue;
        if (matches.length > 1) throw new Error(`${original[name]} 存在重复冲突，请先在酒馆检查。`);
        if (entry && !exact && mode === 'install') continue;
        if (entry && (mode === 'delete' || (mode === 'update' && !exact)) && records[entry[id]] !== fingerprint(entry)) protectedNames.push(original[name]);
        if (mode === 'delete') {
            if (entry) { next.splice(next.indexOf(entry), 1); delete owned[entry[id]]; }
        } else if (!entry) {
            const value = structuredClone(original);
            if (!regex) { value.uid = 0; while (next.some(item => item.uid === value.uid)) value.uid++; }
            const later = regex ? originals.slice(originals.indexOf(original) + 1) : [];
            const following = later.map(item => next.findIndex(entry => entry.id === item.id || entry.scriptName === item.scriptName)).find(index => index >= 0);
            if (following != null) next.splice(following, 0, value); else next.push(value);
            owned[value[id]] = fingerprint(value);
        } else if (!exact && mode === 'update') {
            const value = { ...structuredClone(original), [id]: entry[id] };
            next[next.indexOf(entry)] = value; owned[value[id]] = fingerprint(value);
        }
    }
    return { next, statuses, protectedNames, owned };
}

class Resources {
    constructor(host, helper, context, loadNative = path => loadModule(host, path)) { Object.assign(this, { host, helper, context, loadNative }); }
    async request(path, body) {
        const response = await this.host.fetch(new URL(`api/${path}`, this.host.document.baseURI), { method: 'POST', headers: this.context.getRequestHeaders(), body: JSON.stringify(body) });
        if (!response.ok) throw new Error(`联动资源保存失败 HTTP ${response.status}；未标记成功。`);
        const text = await response.text();
        try { return JSON.parse(text); } catch { return null; }
    }
    async inspect(book) {
        const card = this.context.characters?.[this.context.characterId];
        if (!card?.avatar || this.context.groupId) throw new Error('请打开单个角色卡后管理局部资源。');
        const bindings = this.helper?.getCharWorldbookNames?.(card.avatar);
        const books = [...new Set([bindings?.primary || card.data?.extensions?.world, ...(bindings?.additional ?? [])].filter(Boolean))];
        return { avatar: card.avatar, cardName: card.name, books, book: book || books[0] || '', allBooks: this.helper?.getWorldbookNames?.() ?? books };
    }
    async run(target, kind, mode, confirmed = false, preview = false) {
        if (this.busy) throw new Error('资源操作尚未完成。');
        this.busy = true;
        try {
            const card = this.context.characters?.[this.context.characterId];
            if (card?.avatar !== target.avatar) throw new Error('角色已切换，请重新检查目标。');
            const regex = ['regex', 'social', 'hide'].includes(kind);
            const native = mode === 'check' || preview ? null : await this.loadNative(regex ? 'scripts/extensions/regex/engine.js' : 'scripts/world-info.js');
            if (!regex && !target.book) throw new Error('当前角色未绑定世界书；请选择已有世界书或先在酒馆绑定。');
            const key = `tavern-pocket:resources:${regex ? target.avatar : target.book}`;
            const records = JSON.parse(this.context.accountStorage.getItem(key) || '{}');
            const read = async () => regex ? (await this.request('characters/get', { avatar_url: target.avatar })) : this.request('worldinfo/get', { name: target.book });
            const data = await read();
            if (!data || (!regex && !data.entries)) throw new Error('目标资源不存在或无法读取，未新建或覆盖。');
            const entries = regex ? data?.data?.extensions?.regex_scripts ?? [] : Object.values(data?.entries ?? {});
            const originals = kind === 'hide' ? [HIDE_EVENTS] : kind === 'social' ? socialRegexes : regex ? regexes : Object.values(worldbook.entries);
            const plan = planResources(entries, originals, records, mode, regex);
            if (preview) return plan;
            if (plan.protectedNames.length && !confirmed) return { ...plan, confirm: true };
            const changed = mode !== 'check' && fingerprint(plan.next) !== fingerprint(entries);
            if (changed) {
                if (card?.avatar !== this.context.characters?.[this.context.characterId]?.avatar) throw new Error('角色已切换，未保存。');
                if (regex) await this.request('characters/merge-attributes', { avatar: target.avatar, data: { extensions: { regex_scripts: plan.next } } });
                else await this.request('worldinfo/edit', { name: target.book, data: { ...data, entries: Object.fromEntries(plan.next.map(entry => [entry.uid, entry])) } });
                const saved = await read();
                const verified = regex ? saved?.data?.extensions?.regex_scripts ?? [] : Object.values(saved?.entries ?? {});
                const comparable = values => regex ? values : [...values].sort((first, second) => first.uid - second.uid);
                if (fingerprint(comparable(verified)) !== fingerprint(comparable(plan.next))) throw new Error('服务器回读与保存内容不一致，请重新检查安装状态。');
                this.context.accountStorage.setItem(key, JSON.stringify(plan.owned));
                if (regex) {
                    card.data ??= {}; card.data.extensions ??= {}; card.data.extensions.regex_scripts = verified;
                    if (card.json_data) { const json = JSON.parse(card.json_data); json.data ??= {}; json.data.extensions ??= {}; json.data.extensions.regex_scripts = verified; card.json_data = JSON.stringify(json); }
                    const editor = this.host.document.querySelector?.('#character_json_data');
                    if (editor && this.context.characters?.[this.context.characterId]?.avatar === target.avatar) editor.value = card.json_data || JSON.stringify(card);
                    native.RegexProvider?.instance?.clear();
                }
                if (!regex) native.worldInfoCache?.set(target.book, saved);
                else if (typeof this.context.reloadCurrentChat === 'function' && this.context.characters?.[this.context.characterId]?.avatar === target.avatar) await this.context.reloadCurrentChat();
            }
            if (regex && ['install', 'update'].includes(mode)) native.allowScopedScripts?.(card);
            return { ...planResources(plan.next, originals, plan.owned, 'check', regex), saved: changed };
        } finally { this.busy = false; }
    }
}

module.exports = { Resources, planResources, fingerprint, HIDE_EVENTS };
