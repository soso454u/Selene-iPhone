const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Wallpapers, wallpaperCandidates, wallpaperSource, cleanWallpaperLibrary } = require('../src/wallpapers.cjs');
const { phoneSettings } = require('../src/context.cjs');
const { Ledger } = require('../src/storage.cjs');
const { CardStyles, STYLE_FIELD, boundStyle } = require('../src/card-style.cjs');
const { lineage } = require('../src/domain.cjs');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/t9sAAAAASUVORK5CYII=';
function hostFixture(accept) {
    const requests = [];
    class Image {
        set src(value) { if (!value) return; requests.push(value); queueMicrotask(() => { this.naturalWidth = accept(value) ? 1 : 0; (this.naturalWidth ? this.onload : this.onerror)?.(); }); }
    }
    return { host: { Image, setTimeout, clearTimeout }, requests };
}
function storeFixture() {
    const values = new Map(), store = new Ledger({});
    store.readMeta = async key => values.get(key);
    store.query = async () => ({ rows: [], next: null });
    store.write = async (_, entries) => entries.forEach(({ key, value }) => values.set(key, value));
    return { store, values };
}

test('freeimage share pages become image candidates, while direct links stay unchanged', () => {
    assert.deepEqual(wallpaperCandidates('https://freeimage.host/i/oK7tvF2'), ['jpg', 'png', 'webp', 'gif'].map(type => `https://iili.io/oK7tvF2.${type}`));
    assert.equal(wallpaperCandidates('https://www.freeimage.host/i/a-title.oK7tvF2')[0], 'https://iili.io/oK7tvF2.jpg');
    assert.deepEqual(wallpaperCandidates('https://example.test/image.png?size=large'), ['https://example.test/image.png?size=large']);
    assert.throws(() => wallpaperCandidates('javascript:alert(1)'), /有效/);
    assert.throws(() => wallpaperCandidates('https://user:password@example.test/image.jpg'), /有效/);
});

test('image resolution tries the real format, shares concurrent checks and reports broken pages', async () => {
    const { host, requests } = hostFixture(value => value.endsWith('.png'));
    const service = new Wallpapers(host, { readMeta: async () => undefined });
    const first = service.resolve('https://freeimage.host/i/oK7tvF2');
    assert.equal(service.resolve('https://freeimage.host/i/oK7tvF2'), first);
    assert.equal(await first, 'https://iili.io/oK7tvF2.png');
    assert.equal(await service.resolve('https://freeimage.host/i/oK7tvF2'), 'https://iili.io/oK7tvF2.png');
    assert.equal(requests.length, 2);
    await assert.rejects(service.resolve('https://example.test/not-an-image'), /图片加载失败/);
    assert.equal(service.jobs.size, 0);
    service.close(); await assert.rejects(service.resolve('https://example.test/new.png'), /停止/);
});

test('named wallpapers survive settings normalization and do not override an explicit custom image', () => {
    const wallpaperLibrary = [{ id: 'mine', name: '我的海边', image: 'asset:upload' }, { id: 'bad', name: 'invalid', image: 'javascript:alert(1)' }, { id: 'mine', name: '重复', image: PNG }];
    const settings = phoneSettings({ wallpaperLibrary, wallpaper: 'saved:mine', wallpaperShade: 99 });
    assert.deepEqual(settings.wallpaperLibrary, [wallpaperLibrary[0]]);
    assert.equal(settings.wallpaperShade, 85);
    assert.equal(wallpaperSource(settings), 'asset:upload');
    assert.equal(wallpaperSource({ ...settings, wallpaperImage: 'https://example.test/new.jpg' }), 'https://example.test/new.jpg');
    assert.equal(phoneSettings({ ...settings, wallpaperLibrary: [] }).wallpaper, 'dusk');
    assert.equal(cleanWallpaperLibrary(Array.from({ length: 40 }, (_, i) => ({ id: `i${i}`, name: `壁纸${i}`, image: PNG }))).length, 30);
    assert.equal(phoneSettings({ wallpaperImage: PNG }).wallpaperImage, PNG);
});

test('uploaded wallpaper assets travel through complete backups and character-card sharing', async () => {
    const { store, values } = storeFixture(); values.set('background:upload', { data: PNG });
    const settings = phoneSettings({ wallpaper: 'saved:mine', wallpaperLibrary: [{ id: 'mine', name: '自己取的名字', image: 'asset:upload' }], wallpaperImage: 'asset:upload' });
    const scope = JSON.stringify(['account', 'card:a.png', 'chat']);
    const backup = await store.backup(scope, lineage([]), [], [], { settings });
    assert.equal(backup.backgroundAssets.upload.data, PNG);
    assert.equal(backup.phone.settings.wallpaperLibrary[0].name, '自己取的名字');
    const target = storeFixture(); await target.store.restore(JSON.parse(JSON.stringify(backup)), scope, [], []);
    assert.equal(target.values.get('background:upload').data, PNG);
    const { host, requests } = hostFixture(value => value === PNG);
    const service = new Wallpapers(host, target.store);
    assert.equal(await service.resolve(wallpaperSource(backup.phone.settings)), PNG);
    assert.ok(requests.every(value => value.startsWith('data:')));
    const styles = new CardStyles(store, 'account');
    const packed = await styles.portable(settings);
    assert.equal(packed.settings.wallpaperLibrary[0].image, PNG);
    assert.equal(packed.settings.wallpaperImage, PNG);
    const bound = boundStyle({ data: { extensions: { [STYLE_FIELD]: packed } } });
    assert.equal(bound.wallpaperLibrary[0].name, '自己取的名字');
    assert.equal(bound.wallpaper, 'saved:mine');
    await assert.rejects(new CardStyles(target.store, 'account').portable({ ...settings, wallpaperLibrary: [{ id: 'missing', name: '丢失图片', image: 'asset:missing' }] }), /不存在/);
    service.close();
});
