const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cleanBackground, selectBackground, backgroundStyle } = require('../src/backgrounds.cjs');
const { phoneSettings } = require('../src/context.cjs');

test('page and conversation backgrounds stay independent and invalid image schemes cannot become CSS', () => {
    const settings = phoneSettings({ pageBackgrounds: { chat: { preset: 'mist' }, redbook: { preset: 'blush' }, invalid: { preset: 'dusk' } } });
    const prefs = { chatBackgrounds: { one: { preset: 'sage' }, two: { preset: 'default' } } };
    assert.equal(selectBackground(settings, prefs, 'chat', 'one').preset, 'sage');
    assert.equal(selectBackground(settings, prefs, 'chat', 'two').preset, 'mist');
    assert.equal(selectBackground(settings, prefs, 'redbook', 'one').preset, 'blush');
    assert.equal(settings.pageBackgrounds.invalid, undefined);
    assert.throws(() => cleanBackground({ preset: 'image', image: 'javascript:alert(1)' }), /有效图片/);
    assert.equal(backgroundStyle({ preset: 'image', image: 'asset:local-image' }), null);
    assert.match(backgroundStyle({ preset: 'image', image: 'asset:local-image', shade: 60 }, 'https://example.test/wall.png').css, /wall\.png/);
    assert.equal(backgroundStyle({ preset: 'default' }), null);
});
