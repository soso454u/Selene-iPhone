const { test } = require('node:test');
const assert = require('node:assert/strict');
const { storyTime, resolveRpTime } = require('../src/story-time.cjs');
const { phoneSettings } = require('../src/context.cjs');
const assistant = mes => ({ mes, is_user: false });

test('reads explicit story fields, HTML status bars and Chinese clocks', () => {
    for (const [text, expected] of [
        ['【时间：2026年11月21日 18:30】\n他走进房间。', '2026年11月21日 18:30'],
        ['<div>日期：2026-11-21</div><div>时间：晚上八点半</div>', '2026年11月21日 20:30'],
        ['时间：下午三点一刻\n日期：11月21日', '11月21日 15:15'],
        ['<time>07:05</time>', '07:05'],
        ['**时间**：18：30', '18:30'],
        ['日期：2026年11月21日\n他看了眼手表，现在是21:10。', '2026年11月21日 21:10'],
        ['此时，墙上的时钟指向晚上十一点四十五分。', '23:45'],
        ['现在是 12:10 AM。', '00:10'],
    ]) assert.equal(storyTime([assistant(text)]), expected, text);
});

test('uses latest current branch text, with no stored clock after edits, swipes or chat changes', () => {
    const chat = [assistant('时间：2026-11-21 18:30'), assistant('时间：19:40')];
    assert.equal(storyTime(chat), '19:40');
    chat[1].mes = '时间：20:15'; chat[1].swipes = ['时间：23:59'];
    assert.equal(storyTime(chat), '20:15');
    chat.pop(); assert.equal(storyTime(chat), '2026年11月21日 18:30');
    assert.equal(storyTime([]), '');
    assert.equal(storyTime([assistant('次日，时间：07:30')]), '07:30');
});

test('ignores thinking, code, phone records, user requests and hypothetical or quoted times', () => {
    const chat = [assistant('时间：18:30'), { mes: '请把时间改成23:00', is_user: true }, { mes: '时间：22:00', is_system: true }, assistant([
        '<think>时间：23:01</think>', '<phone_events>时间：23:02</phone_events>',
        '<线上消息>时间：23:03</线上消息>', '<社交动态>时间：23:04</社交动态>',
        '<custom_log>时间：23:05</custom_log>', '```html\n时间：23:06\n```',
        '他计划明天 23:07 出门。', '回忆里是2025年1月1日 23:08。',
        '他说：“现在是23:09。”', '> 时间：23:10', '<thinking>时间：23:11',
    ].join('\n'))];
    assert.equal(storyTime(chat, { jsonTag: 'custom_log' }), '18:30');
});

test('does not invent dates, accept invalid clocks or interpret ordinary ratios as dates', () => {
    for (const text of ['没有明确时间。', '时间：25:30', '时间：23:90', '时间：下午二十五点', '日期：2025-02-29', '比例是3/4，歌曲长度3:46。']) {
        assert.equal(storyTime([assistant(text)]), '', text);
    }
    assert.equal(storyTime([assistant('日期：2024-02-29')]), '2024年2月29日');
    assert.equal(storyTime([assistant('日期：11月21日')]), '11月21日');
});

test('automatic clock is enabled on upgrade and manual fallback remains separate from saved settings', () => {
    const settings = phoneSettings({ clockMode: 'rp', rpTime: '手动 08:00' });
    assert.equal(settings.rpTimeAuto, true);
    assert.equal(resolveRpTime([assistant('时间：18:30')], settings), '18:30');
    assert.equal(settings.rpTime, '手动 08:00');
    assert.equal(resolveRpTime([], settings), '手动 08:00');
    assert.equal(resolveRpTime([assistant('时间：18:30')], { ...settings, rpTimeAuto: false }), '手动 08:00');
    assert.equal(resolveRpTime([], phoneSettings()), '');
});
