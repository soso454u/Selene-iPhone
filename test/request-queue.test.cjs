const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RequestQueue } = require('../src/request-queue.cjs');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('requests run in order, keep their destination and continue after a failed request', async () => {
    const gate = deferred(); const seen = []; const counts = [];
    const queue = new RequestQueue(count => counts.push(count));
    const first = queue.enqueue(async () => { seen.push('image:A'); await gate.promise; throw new Error('failed image'); });
    const handled = assert.rejects(first, /failed image/);
    const target = 'chat:B';
    const second = queue.enqueue(async () => { seen.push(target); return 'reply'; });
    const third = queue.enqueue(async () => { seen.push('post:C'); return 'post'; });
    assert.deepEqual(seen, ['image:A']); assert.equal(queue.pending.length, 2);
    gate.resolve();
    await handled; assert.equal(await second, 'reply'); assert.equal(await third, 'post');
    assert.deepEqual(seen, ['image:A', 'chat:B', 'post:C']); assert.ok(counts.includes(2)); assert.equal(queue.busy, false);
});

test('clearing the queue leaves the running request alone and never calls pending services', async () => {
    const gate = deferred(); const queue = new RequestQueue(); let pendingCalls = 0;
    const first = queue.enqueue(() => gate.promise);
    const second = queue.enqueue(() => { pendingCalls++; });
    const cancelled = assert.rejects(second, error => error.queueCancelled === true);
    queue.clear(); gate.resolve('done');
    assert.equal(await first, 'done'); await cancelled; assert.equal(pendingCalls, 0);
});

test('stale context is skipped before sending, and repeated image task ids share one request', async () => {
    const gate = deferred(); const queue = new RequestQueue(); let valid = true; let calls = 0;
    const first = queue.enqueue(() => gate.promise, { key: 'image:1' });
    assert.equal(queue.enqueue(() => { calls++; }, { key: 'image:1' }), first);
    const second = queue.enqueue(() => { calls++; }, { valid: () => valid });
    const skipped = assert.rejects(second, error => error.queueCancelled === true);
    valid = false; gate.resolve(); await first; await skipped; assert.equal(calls, 0);
});
