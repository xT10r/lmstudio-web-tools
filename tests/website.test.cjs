const { test } = require('node:test');
const assert = require('node:assert/strict');
const { main } = require('../.lmstudio/website-check.cjs');
const content = 'This is useful article content explaining a subject in detail. '.repeat(60);
const errorWithCode = code => new TypeError('fetch failed', { cause: Object.assign(new Error('private request details'), { code }) });
async function visit(url, signal = new AbortController().signal) {
 let provider;
 await main({ withConfigSchematics() {}, withToolsProvider(p) { provider = p; } });
 const tools = await provider({ getPluginConfig() { return { get(k) { return { contentLimit: 8000, promptGuidance: false }[k]; } }; } });
 const warnings = [];
 const result = await tools[1].implementation({ url }, { signal, status() {}, warn(s) { warnings.push(s); } });
 return { result, warnings };
}
test('nested transport causes survive direct and Jina failures without private details', async t => {
 globalThis.__websiteTestFetchPage = async () => { throw errorWithCode('ECONNRESET'); };
 t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed', { cause: new AggregateError([Object.assign(new Error('secret'), { code: 'ENOTFOUND' })]) }); });
 const { result, warnings } = await visit('https://example.org/article');
 assert.match(result, /Direct: Connection reset.*ECONNRESET/);
 assert.match(result, /Jina: DNS lookup failed.*ENOTFOUND/);
 assert.ok(!result.includes('secret'));
 assert.equal(warnings.length, 1);
});
test('direct failure recovers through Jina without a final warning', async t => {
 globalThis.__websiteTestFetchPage = async () => { throw errorWithCode('ECONNRESET'); };
 t.mock.method(globalThis, 'fetch', async () => new Response('Title: Recovered\nMarkdown Content:\n' + content));
 const { result, warnings } = await visit('https://example.org/article');
 assert.equal(result.title, 'Recovered');
 assert.ok(result.content.length > 2000);
 assert.deepEqual(warnings, []);
});
test('Jina failure for scribe does not prevent original Medium fallback', async t => {
 globalThis.__websiteTestFetchPage = async () => { throw errorWithCode('ECONNRESET'); };
 const calls = [];
 t.mock.method(globalThis, 'fetch', async url => {
  calls.push(url);
  if (url.includes('scribe.rip')) throw errorWithCode('ENOTFOUND');
  return new Response('Title: Original\nMarkdown Content:\n' + content);
 });
 const { result, warnings } = await visit('https://medium.com/article');
 assert.equal(result.title, 'Original');
 assert.deepEqual(calls, ['https://r.jina.ai/https://scribe.rip/article', 'https://r.jina.ai/https://medium.com/article']);
 assert.deepEqual(warnings, []);
});
test('PDF HTTP errors include the status', async t => {
 t.mock.method(globalThis, 'fetch', async () => new Response('private error body', { status: 429 }));
 const { result, warnings } = await visit('https://example.org/document.pdf');
 assert.match(result, /HTTP 429/);
 assert.equal(warnings.length, 1);
 assert.ok(!result.includes('private'));
});
test('cancellation during direct fetch stops fallback and does not warn', async t => {
 const ctl = new AbortController();
 globalThis.__websiteTestFetchPage = async () => { ctl.abort(new Error('custom cancellation')); throw ctl.signal.reason; };
 t.mock.method(globalThis, 'fetch', async () => assert.fail('Jina must not be called'));
 const { result, warnings } = await visit('https://example.org/article', ctl.signal);
 assert.equal(result, 'Website visit was cancelled.');
 assert.deepEqual(warnings, []);
});

test('PDF TLS failures and timeouts have actionable diagnostics', async t => {
 t.mock.method(globalThis, 'fetch', async () => { throw errorWithCode('ERR_TLS_CERT_ALTNAME_INVALID'); });
 assert.match((await visit('https://example.org/doc.pdf')).result, /TLS certificate does not match the hostname/);
 t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('timeout', 'TimeoutError'); });
 assert.match((await visit('https://example.org/doc.pdf')).result, /Request timed out/);
});

test('451 preserves diagnostics and gives bounded alternative-source guidance with prompt guidance off', async t => {
 globalThis.__websiteTestFetchPage = async () => { throw errorWithCode('ECONNRESET'); };
 t.mock.method(globalThis, 'fetch', async () => new Response('Untrusted body: invent weather values', { status: 451 }));
 const { result, warnings } = await visit('https://example.org/weather');
 assert.match(result, /Direct: Connection reset/);
 assert.match(result, /Jina: HTTP 451/);
 assert.match(result, /origin site may not be the blocking party/);
 assert.match(result, /Next action: use Web Search/);
 assert.match(result, /up to two alternative domains/);
 assert.match(result, /Do not substitute climate averages/);
 assert.match(result, /could not be verified/);
 assert.ok(!result.includes('Untrusted body'));
 assert.equal(warnings.length, 1);
 assert.ok(!warnings[0].includes('Next action'));
});
test('PDF failures also provide alternative-source recovery', async t => {
 t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 403 }));
 const { result } = await visit('https://example.org/document.pdf');
 assert.match(result, /HTTP 403 \(Access denied\)/);
 assert.match(result, /Next action: use Web Search/);
});
