const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withRequestTimeout, fetchText } = require('../.lmstudio/requestTimeout.cjs');

test('deadline aborts a stalled operation even if it ignores the signal', async () => {
 let transportSignal;
 const result = withRequestTimeout(new AbortController().signal, 10, signal => {
  transportSignal = signal;
  return new Promise(() => {});
 });
 await assert.rejects(result, { name: 'TimeoutError' });
 assert.equal(transportSignal.aborted, true);
});

test('Jina deadline covers a body that never completes', async t => {
 t.mock.timers.enable({ apis: ['setTimeout'] });
 let transportSignal;
 t.mock.method(globalThis, 'fetch', async (_, { signal }) => {
  transportSignal = signal;
  return { ok: true, text: () => new Promise(() => {}) };
 });
 const result = fetchText('https://example.org/', new AbortController().signal);
 const rejected = assert.rejects(result, { name: 'TimeoutError' });
 await Promise.resolve(); await Promise.resolve();
 t.mock.timers.tick(30000);
 await rejected;
 assert.equal(transportSignal.aborted, true);
});

test('cancellation preserves reason and pre-cancelled calls never start', async () => {
 const controller = new AbortController();
 const reason = new Error('cancelled by caller');
 const result = withRequestTimeout(controller.signal, 1000, () => new Promise(() => {}));
 controller.abort(reason);
 await assert.rejects(result, e => e === reason);
 await assert.rejects(withRequestTimeout(controller.signal, 1000, () => assert.fail('must not start')), e => e === reason);
});

test('completed requests clear deadline and detach parent abort listener', async t => {
 t.mock.timers.enable({ apis: ['setTimeout'] });
 const controller = new AbortController();
 let transportSignal;
 assert.equal(await withRequestTimeout(controller.signal, 20, async signal => { transportSignal = signal; return 'done'; }), 'done');
 t.mock.timers.tick(20);
 controller.abort();
 assert.equal(transportSignal.aborted, false);
});
