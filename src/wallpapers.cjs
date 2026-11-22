const { safeUrl } = require('./media.cjs');

const WALLPAPERS = {
    dusk: { name: '暮紫' }, ocean: { name: '蓝绿海岸' }, peach: { name: '珊瑚日落' },
    'photo-1': { name: '精选壁纸 1', image: 'https://iili.io/oFQgbj9.md.png' },
    'photo-2': { name: '精选壁纸 2', image: 'https://iili.io/oFQrLPa.md.png' },
    'photo-3': { name: '精选壁纸 3', image: 'https://iili.io/oFQipgs.md.png' },
    'photo-4': { name: '精选壁纸 4', image: 'https://iili.io/oFQsH7f.md.png' },
};
const DATA_IMAGE = /^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/;
function wallpaperImage(value) {
    const source = typeof value === 'string' ? value.trim() : '';
    return safeUrl(source) || (/^asset:[\w-]{1,80}$/.test(source) || source.length < 3 * 1024 * 1024 && DATA_IMAGE.test(source) ? source : '');
}
function cleanWallpaperLibrary(value) {
    const ids = new Set();
    return (Array.isArray(value) ? value : []).filter(item => {
        if (!item || typeof item.id !== 'string' || !/^[\w-]{1,80}$/.test(item.id) || ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || !wallpaperImage(item.image)) return false;
        ids.add(item.id); return true;
    }).slice(0, 30).map(item => ({ id: item.id, name: item.name.trim().slice(0, 60), image: wallpaperImage(item.image) }));
}
function wallpaperSource(settings = {}) {
    const custom = wallpaperImage(settings.wallpaperImage);
    const saved = settings.wallpaper?.startsWith('saved:') && settings.wallpaperLibrary?.find(item => `saved:${item.id}` === settings.wallpaper);
    return custom || wallpaperImage(saved?.image) || WALLPAPERS[settings.wallpaper]?.image || '';
}
function appearanceImages(settings = {}) {
    settings ||= {};
    return [{ image: settings.wallpaperImage || '' }, ...(settings.wallpaperLibrary || []), ...Object.values(settings.pageBackgrounds || {})];
}
function wallpaperCandidates(value) {
    const source = wallpaperImage(value);
    if (!source) throw new Error('请输入有效的图片链接，或上传本地图片。');
    const url = safeUrl(source) && new URL(source);
    if (url && /^(?:www\.)?freeimage\.host$/i.test(url.hostname)) {
        const id = url.pathname.match(/^\/i\/(?:[^/]*\.)?([a-zA-Z0-9]{5,20})\/?$/)?.[1];
        if (id) return ['jpg', 'png', 'webp', 'gif'].map(type => `https://iili.io/${id}.${type}`);
    }
    return [source];
}

class Wallpapers {
    constructor(host, ledger) { this.host = host; this.ledger = ledger; this.cache = new Map(); this.jobs = new Set(); }
    resolve(source) {
        source = wallpaperImage(source);
        if (!source) return Promise.reject(new Error('壁纸图片地址无效。'));
        if (this.closed) return Promise.reject(new Error('壁纸读取已停止。'));
        if (this.cache.has(source)) return this.cache.get(source);
        const task = this.load(source).catch(error => { this.cache.delete(source); throw error; });
        this.cache.set(source, task); return task;
    }
    async load(source) {
        if (source.startsWith('asset:')) {
            const asset = await this.ledger.readMeta(`background:${source.slice(6)}`);
            if (!asset?.data || !DATA_IMAGE.test(asset.data)) throw new Error('这张本地壁纸的图片内容不存在，请重新上传。');
            if (this.closed) throw new Error('壁纸读取已停止。');
            await this.resolve(asset.data); return asset.data;
        }
        for (const candidate of wallpaperCandidates(source)) {
            try { await this.probe(candidate); return candidate; }
            catch (error) { if (this.closed) throw error; }
        }
        throw new Error('壁纸图片加载失败。请检查图片链接；普通网页不能作为壁纸，也可以改为上传本地图片。');
    }
    probe(source) {
        return new Promise((resolve, reject) => {
            const image = new this.host.Image(); let done = false; let timer;
            const finish = error => {
                if (done) return;
                done = true; this.host.clearTimeout(timer); this.jobs.delete(cancel);
                image.onload = image.onerror = null;
                if (error) { image.src = ''; reject(error); } else resolve(source);
            };
            const cancel = () => finish(new Error('壁纸读取已停止。'));
            this.jobs.add(cancel);
            image.onload = () => finish(image.naturalWidth > 0 ? null : new Error('图片内容无效。'));
            image.onerror = () => finish(new Error('图片无法显示。'));
            timer = this.host.setTimeout(() => finish(new Error('图片加载超时。')), 7000);
            image.src = source;
        });
    }
    close() { this.closed = true; for (const cancel of [...this.jobs]) cancel(); this.cache.clear(); }
}

module.exports = { WALLPAPERS, DATA_IMAGE, wallpaperImage, cleanWallpaperLibrary, wallpaperSource, appearanceImages, wallpaperCandidates, Wallpapers };
