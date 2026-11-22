const { safeUrl } = require('./media.cjs');

const PAGES = { home: '主屏幕', lock: '锁屏', messages: '信息列表', chat: '默认聊天背景', contacts: '通讯录', moments: '朋友圈', redbook: '小红书', douyin: '抖音', weibo: '微博', forum: '论坛', x: 'X', album: '相册', music: '音乐', imagegen: '生图', notifications: '通知', settings: '设置', debug: '调试', characterPhone: '角色手机' };
const WALLPAPERS = {
    dusk: { name: '暮紫' }, ocean: { name: '蓝绿海岸' }, peach: { name: '珊瑚日落' },
    'photo-1': { name: '精选壁纸 1', image: 'https://iili.io/oFQgbj9.md.png' },
    'photo-2': { name: '精选壁纸 2', image: 'https://iili.io/oFQrLPa.md.png' },
    'photo-3': { name: '精选壁纸 3', image: 'https://iili.io/oFQipgs.md.png' },
    'photo-4': { name: '精选壁纸 4', image: 'https://iili.io/oFQsH7f.md.png' },
};
const BACKGROUNDS = { default: '应用默认', pearl: '珍珠白', mist: '雾蓝', blush: '浅杏粉', sage: '鼠尾草', dusk: '暮色', image: '自定义图片' };
const GRADIENTS = { pearl: 'linear-gradient(145deg,#fffdfa,#f0eeea)', mist: 'linear-gradient(155deg,#e6eef7,#f3f7fa 54%,#dce9ef)', blush: 'linear-gradient(150deg,#f7e8e5,#faf5f1 60%,#eee4ee)', sage: 'linear-gradient(160deg,#dfe9e2,#f3f4ed 55%,#d5e3db)', dusk: 'linear-gradient(145deg,#182538,#242333 65%,#152d39)' };

function imageSource(value) {
    const source = String(value || '').trim();
    return safeUrl(source) || (/^asset:[\w-]{1,80}$/.test(source) || /^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(source) ? source : '');
}

function cleanBackground(input) {
    const preset = Object.hasOwn(BACKGROUNDS, input?.preset) ? input.preset : 'default';
    const image = imageSource(input?.image);
    if (preset === 'image' && !image) throw new Error('请输入有效图片地址或选择本地图片。');
    return { preset, image: preset === 'image' ? image : '', shade: Math.min(90, Math.max(0, Number(input?.shade) || 0)), tone: input?.tone === 'dark' || preset === 'dusk' ? 'dark' : 'light' };
}

function cleanBackgroundMap(input, pagesOnly = false) {
    const result = {};
    for (const [key, value] of Object.entries(input || {})) {
        if (key.length > 500 || ['__proto__', 'constructor', 'prototype'].includes(key) || (pagesOnly && !Object.hasOwn(PAGES, key))) continue;
        try { result[key] = cleanBackground(value); } catch {}
    }
    return result;
}

function selectBackground(settings, prefs, view, thread) {
    const local = view === 'chat' && prefs?.chatBackgrounds?.[thread];
    return local && local.preset !== 'default' ? local : settings.pageBackgrounds?.[view] || { preset: 'default' };
}

function backgroundStyle(config, resolved = '') {
    const value = cleanBackground(config);
    if (value.preset === 'default') return null;
    if (value.preset !== 'image') return { css: GRADIENTS[value.preset], tone: value.tone };
    const image = imageSource(resolved || value.image);
    if (!image || image.startsWith('asset:')) return null;
    const color = value.tone === 'dark' ? '0 0 0' : '255 255 255';
    const overlay = `rgb(${color} / ${value.shade / 100})`;
    return { css: `linear-gradient(${overlay},${overlay}),url(${JSON.stringify(image)})`, tone: value.tone };
}

module.exports = { PAGES, WALLPAPERS, BACKGROUNDS, imageSource, cleanBackground, cleanBackgroundMap, selectBackground, backgroundStyle };
