const { phoneSettings } = require('./context.cjs');
const { fingerprint } = require('./resources.cjs');

const STYLE_FIELD = 'tavern_pocket_style';
const STYLE_KEYS = ['theme', 'wallpaper', 'wallpaperImage', 'wallpaperLibrary', 'wallpaperShade', 'pageBackgrounds', 'customStickers', 'preset', 'presetEnabled', 'socialCommonPrompt', 'platformPrompts'];
const styleValues = input => {
    const normalized = phoneSettings(input);
    return Object.fromEntries(STYLE_KEYS.map(key => [key, normalized[key]]));
};
const boundStyle = card => {
    const payload = card?.data?.extensions?.[STYLE_FIELD];
    return payload?.format === 'tavern-pocket-style' && payload.version === 1 && payload.settings && typeof payload.settings === 'object' ? styleValues(payload.settings) : null;
};

const record = value => value && typeof value === 'object' && !Array.isArray(value);

function cardJson(text) {
    if (typeof text !== 'string') return null;
    try {
        const card = JSON.parse(text);
        return record(card) ? card : null;
    } catch { return null; }
}

class CardStyles {
    constructor(ledger, account) { Object.assign(this, { ledger, account, cache: new Map() }); }
    key(card) { return `card-style:${this.account}:${card.avatar}`; }
    async load(card) {
        if (!card?.avatar) return;
        const source = card.data?.extensions?.[STYLE_FIELD];
        if (this.cache.get(card.avatar)?.source === source && this.cache.has(card.avatar)) return;
        const base = boundStyle(card);
        const stamp = fingerprint(base);
        const saved = await this.ledger.readMeta(this.key(card));
        const previousStamp = base && source?.settings ? fingerprint(source.settings) : null;
        this.cache.set(card.avatar, { source, stamp, local: saved && (saved.stamp === stamp || saved.stamp === previousStamp) ? styleValues(saved.values) : null });
    }
    values(card) { return card?.avatar ? this.cache.get(card.avatar)?.local || boundStyle(card) : null; }
    scoped(card) { return !!this.values(card); }
    async saveLocal(card, values) {
        const normalized = styleValues(values);
        const stamp = fingerprint(boundStyle(card));
        await this.ledger.saveMeta(this.key(card), { stamp, values: normalized });
        this.cache.set(card.avatar, { source: card.data?.extensions?.[STYLE_FIELD], stamp, local: normalized });
    }
    async portable(values) {
        const result = structuredClone(styleValues(values));
        const active = { image: result.wallpaperImage };
        for (const config of [...Object.values(result.pageBackgrounds), ...result.wallpaperLibrary, active]) {
            if (!config.image?.startsWith('asset:')) continue;
            const asset = await this.ledger.readMeta(`background:${config.image.slice(6)}`);
            if (!asset?.data) throw new Error('绑定背景图片不存在，请重新上传后再绑定。');
            config.image = asset.data;
        }
        result.wallpaperImage = active.image;
        if (JSON.stringify(result).length > 10 * 1024 * 1024) throw new Error('角色外观配置超过 10 MiB，请减少背景图片体积。');
        return { format: 'tavern-pocket-style', version: 1, settings: result };
    }
    async bind(resources, card, values, getContext = () => resources.context) {
        if (this.binding) throw new Error('角色绑定正在保存，请稍候。');
        const target = card.avatar;
        const currentCard = () => {
            const context = getContext();
            return !context?.groupId ? context?.characters?.[context.characterId] : null;
        };
        const assertTarget = () => {
            if (!target || currentCard()?.avatar !== target) throw new Error('当前角色已切换，请重新打开要绑定的单个角色聊天。');
        };
        let exportCard = false;
        const read = async () => {
            if (exportCard) return resources.request('characters/export', { avatar_url: target, format: 'json' });
            let result;
            try { result = await resources.request('characters/get', { avatar_url: target }); }
            catch (error) { if (error.code !== 'TAVERN_ROUTE') throw error; }
            if (result?.avatar && result.avatar !== target) throw new Error('酒馆返回了不同的角色卡，请刷新页面后重试。');
            if (record(result?.data)) return result;
            const raw = cardJson(result?.json_data);
            if (record(raw?.data)) return raw;
            exportCard = true;
            return resources.request('characters/export', { avatar_url: target, format: 'json' });
        };
        this.binding = true;
        try {
            assertTarget();
            const payload = await this.portable(values);
            const before = await read();
            if (!record(before?.data)) throw new Error('酒馆未返回当前角色卡数据，无法保存绑定。');
            assertTarget();
            await resources.request('characters/merge-attributes', { avatar: target, data: { extensions: { [STYLE_FIELD]: payload } } });
            const saved = await read();
            if (fingerprint(saved?.data?.extensions?.[STYLE_FIELD] ?? null) !== fingerprint(payload)) throw new Error('绑定内容回读不一致，请重新检查角色卡。');
            const active = currentCard();
            const updated = active?.avatar === target ? active : card;
            if (!record(updated.data)) updated.data = {};
            if (!record(updated.data.extensions)) updated.data.extensions = {};
            updated.data.extensions[STYLE_FIELD] = payload;
            const json = cardJson(updated.json_data) || cardJson(saved.json_data) || (updated.json_data ? { ...saved, json_data: undefined } : null);
            if (json) {
                if (!record(json.data)) json.data = {};
                if (!record(json.data.extensions)) json.data.extensions = {};
                json.data.extensions[STYLE_FIELD] = payload;
                updated.json_data = JSON.stringify(json);
            }
            const editor = resources.host.document.querySelector?.('#character_json_data');
            if (editor && active === updated) editor.value = updated.json_data || JSON.stringify(updated);
            await this.saveLocal(updated, payload.settings);
            return payload;
        } finally {
            this.binding = false;
        }
    }
}
module.exports = { CardStyles, STYLE_FIELD, STYLE_KEYS, styleValues, boundStyle };
