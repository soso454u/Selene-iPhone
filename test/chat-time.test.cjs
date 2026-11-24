const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chatTimeline, historicalTime } = require('../src/chat-time.cjs');
const labels = (times, current, extra = {}) => chatTimeline(times.map(rpTime => ({ rpTime, ...extra })), current).map(item => item.text);
test('both chat views use RP dates for today, yesterday, weekdays, older dates and years', () => {
    assert.deepEqual(labels(['2025年11月23日 13:53','2025年11月22日 16:54','2025年11月21日 12:06','2025年11月16日 02:20','2023年11月16日 02:20'], '2025年11月23日 22:17'), ['13:53','昨天 16:54','星期五 12:06','11月16日 02:20','2023年11月16日 02:20']);
    assert.deepEqual(labels(['2025-12-31 10:00'], '2026-01-02'), ['2025年12月31日 10:00']);
});
test('historical relative dates freeze against snapshot RP time and unknown years remain honest', () => {
    assert.equal(historicalTime('三天前13:53', '2025年11月23日 22:17'), '2025年11月20日 13:53');
    assert.equal(historicalTime('半个月前 02:20', '2025-11-23'), '2025年11月8日 02:20');
    assert.equal(historicalTime('两周前', '2025-11-23'), '2025年11月9日');
    assert.equal(historicalTime('几年前', '2025-11-23'), '几年前');
    assert.equal(historicalTime('三天前 13:53', ''), '三天前 13:53');
    assert.deepEqual(labels(['三天前 13:53'], '2025-12-20', {timeBase:'2025-11-23'}), ['11月20日 13:53']);
    assert.deepEqual(labels(['2025-02-30 13:53','几年前','昨天 13:53',''], ''), ['2025-02-30 13:53','几年前','昨天 13:53','']);
});
test('centered separators group nearby messages and inherit only unambiguous source dates', () => {
    assert.deepEqual(labels(['2025-11-22 23:58','23:59','2025-11-23 00:01','00:07'], '2025-11-23'), ['昨天 23:58','','00:01','00:07']);
    const rows = ['13:53','13:54','14:00'].map(rpTime => ({rpTime, origin:'tavern', floor:0}));
    assert.deepEqual(chatTimeline(rows, '2025-11-23', [{mes:'<date>2025年11月22日</date>'}]).map(x=>x.text), ['昨天 13:53','','昨天 14:00']);
    assert.equal(chatTimeline(rows, '2025-11-23', [{mes:'<date>2025-11-21</date><date>2025-11-22</date>'}])[0].text, '13:53');
});
