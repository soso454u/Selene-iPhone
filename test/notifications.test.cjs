const { test } = require('node:test');
const assert = require('node:assert/strict');
const { notificationRows } = require('../src/media.cjs');
const { PLAYER } = require('../src/domain.cjs');

test('clearing notifications hides existing alerts, retains source rows, and allows later arrivals', () => {
    const rows = [
        { id: 'old', speakerId: 'author', thread: 'forum', stamp: 10 },
        { id: 'muted', speakerId: 'author', thread: 'chat', stamp: 11 },
        { id: 'own', speakerId: PLAYER, thread: 'forum', stamp: 12 },
        { id: 'recent', speakerId: 'visitor', thread: 'forum', stamp: 13 },
    ];
    const original = structuredClone(rows);
    assert.deepEqual(notificationRows(rows, { muted: ['chat'] }, PLAYER).map(row => row.id), ['old', 'recent']);
    assert.deepEqual(notificationRows(rows, { muted: ['chat'], notificationsClearedThrough: 13 }, PLAYER), []);
    const later = { id: 'later', speakerId: 'visitor', thread: 'forum', stamp: 14 };
    assert.deepEqual(notificationRows([later, ...rows], { notificationsClearedThrough: 13 }, PLAYER).map(row => row.id), ['later']);
    assert.deepEqual(rows, original);
    assert.equal(notificationRows(rows, {}, PLAYER).length, 3);
});
