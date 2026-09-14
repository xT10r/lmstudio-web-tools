const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const { withDiagnostics } = require('../.lmstudio/diagnostics.cjs');

function setup(t, overrides = {}) {
 const directory = mkdtempSync(join(tmpdir(), 'web-diagnostics-test-'));
 t.after(() => rmSync(directory, { recursive: true, force: true }));
 const warnings = [];
 const controller = new AbortController();
 return {
  directory, warnings, controller,
  options: () => ({ enabled: true, directory, includeResults: false, secrets: ['private-key'], ...overrides }),
  context: { signal: controller.signal, status() {}, warn(message) { warnings.push(message); } },
  events: () => readFileSync(join(directory, readdirSync(directory)[0]), 'utf8').trim().split('\n').map(JSON.parse),
 };
}

test('disabled logging creates no files and preserves the result', async t => {
 const s = setup(t, { enabled: false, includeResults: true });
 const result = { content: 'article' };
 assert.equal(await withDiagnostics('visit', s.options, async (_, c) => { c.diagnostic('test'); return result; })({}, s.context), result);
 assert.deepEqual(readdirSync(s.directory), []);
});

test('events correlate calls, capture fallback and redact credentials without changing output', async t => {
 const s = setup(t, { includeResults: true });
 const address = new URL('https://example.org/page?token=hidden#secret');
 address.username = randomUUID();
 // Generated only for this redaction test; no stored credential.
 address.password = randomUUID(); // pragma: allowlist secret; nosemgrep: codex-hardcoded-sensitive-assignment
 const result = { content: 'private-key', url: address.href };
 const run = withDiagnostics('visit', s.options, async (_, c) => {
  c.status('Trying direct'); c.diagnostic('Direct: Connection reset (ECONNRESET)');
  c.status('Trying Jina'); return result;
 });
 assert.equal(await run({ url: result.url }, s.context), result);
 await run({}, s.context);
 const events = s.events();
 assert.deepEqual(events.slice(0, 5).map(e => e.event), ['start', 'status', 'diagnostic', 'status', 'return']);
 assert.equal(new Set(events.slice(0, 5).map(e => e.id)).size, 1);
 assert.notEqual(events[0].id, events[5].id);
 assert.ok(events.every(e => Number.isFinite(Date.parse(e.timestamp)) && e.elapsedMs >= 0));
 assert.doesNotMatch(JSON.stringify(events), /private-key|user:pass|hidden|#secret/);
 assert.ok(!JSON.stringify(events).includes(address.username));
 assert.ok(!JSON.stringify(events).includes(address.password));
});

test('normal debug omits article text and records cancellation', async t => {
 const s = setup(t);
 await withDiagnostics('visit', s.options, async () => ({ content: 'private article' }))({}, s.context);
 assert.doesNotMatch(JSON.stringify(s.events()), /private article/);
 s.controller.abort();
 await withDiagnostics('visit', s.options, async () => 'Website visit was cancelled.')({}, s.context);
 assert.equal(s.events().at(-1).event, 'cancelled');
});

test('unwritable log destination warns once and retrieval continues', async t => {
 const s = setup(t);
 const destination = join(s.directory, 'file');
 writeFileSync(destination, 'occupied');
 const options = () => ({ ...s.options(), directory: destination });
 assert.equal(await withDiagnostics('search', options, async (_, c) => { c.status('Searching'); return 'result'; })({}, s.context), 'result');
 assert.equal(s.warnings.length, 1);
 assert.equal(readFileSync(destination, 'utf8'), 'occupied');
});

test('unexpected errors are logged and rethrown unchanged', async t => {
 const s = setup(t);
 const error = Object.assign(new Error('private-key'), { code: 'ECONNRESET' });
 await assert.rejects(withDiagnostics('visit', s.options, async () => { throw error; })({}, s.context), e => e === error);
 assert.equal(s.events().at(-1).event, 'error');
 assert.match(s.events().at(-1).data, /ECONNRESET/);
});
