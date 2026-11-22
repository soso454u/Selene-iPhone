const { phoneSettings } = require('./context.cjs');
const { fingerprint } = require('./resources.cjs');

const STYLE_FIELD = 'tavern_pocket_style';
const STYLE_KEYS = ['theme', 'wallpaper', 'wallpaperImage', 'wallpaperShade', 'pageBackgrounds', 'customStickers', 'preset', 'presetEnabled', 'socialCommonPrompt', 'platformPrompts'];
const styleValues = input => {
    const normalized = phoneSettings(input);
    return Object.fromEntries(STYLE_KEYS.map(key => [key, normalized[key]]));
};
const boundStyle = card => {
    const payload = card?.data?.extensions?.[STYLE_FIELD];
    return payload?.format === 'tavern-pocket-style' && payload.version === 1 && payload.settings && typeof payload.settings === 'object' ? styleValues(payload.settings) : null;
};

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
        for (const config of Object.values(result.pageBackgrounds)) {
            if (!config.image?.startsWith('asset:')) continue;
            const asset = await this.ledger.readMeta(`background:${config.image.slice(6)}`);
            if (!asset?.data) throw new Error('绑定背景图片不存在，请重新上传后再绑定。');
            config.image = asset.data;
        }
        if (JSON.stringify(result).length > 10 * 1024 * 1024) throw new Error('角色外观配置超过 10 MiB，请减少背景图片体积。');
        return { format: 'tavern-pocket-style', version: 1, settings: result };
    }
    async bind(resources, card, values) {
        const payload = await this.portable(values);
        const target = card.avatar;
        const valid = () => !resources.context.groupId && resources.context.characters?.[resources.context.characterId]?.avatar === target;
        if (!valid()) throw new Error('请打开要绑定的单个角色卡。');
        const before = await resources.request('characters/get', { avatar_url: target });
        if (!before?.data || !valid()) throw new Error('角色已变化或服务器角色数据不可读，未保存。');
        await resources.request('characters/merge-attributes', { avatar: target, data: { extensions: { [STYLE_FIELD]: payload } } });
        const saved = await resources.request('characters/get', { avatar_url: target });
        if (fingerprint(saved?.data?.extensions?.[STYLE_FIELD]) !== fingerprint(payload)) throw new Error('绑定内容回读不一致，请重新检查；未报告绑定成功。');
        card.data ??= {}; card.data.extensions ??= {}; card.data.extensions[STYLE_FIELD] = payload;
        if (card.json_data) {
            const json = JSON.parse(card.json_data); json.data ??= {}; json.data.extensions ??= {}; json.data.extensions[STYLE_FIELD] = payload;
            card.json_data = JSON.stringify(json);
        }
        const editor = resources.host.document.querySelector?.('#character_json_data');
        if (editor && valid()) editor.value = card.json_data || JSON.stringify(card);
        await this.saveLocal(card, payload.settings);
        return payload;
    }
}
module.exports = { CardStyles, STYLE_FIELD, STYLE_KEYS, styleValues, boundStyle };
