const { test } = require('node:test');
const assert = require('node:assert/strict');
const { searchApiProviders } = require('../.lmstudio/searchProviders.cjs');
const { main } = require('../.lmstudio/check.cjs');

const defaults = { searxngEnabled: false, searxngUrl: '', braveEnabled: false, braveApiKey: '' };
const row = (url = 'https://example.org/article') => ({ title: 'Article', url, content: 'Summary' });
const json = (data) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
async function run(settings = {}, signal = new AbortController().signal) {
	const warnings = [];
	const results = await searchApiProviders({ ...defaults, ...settings }, 'test & query', 3, signal,
		() => {}, message => warnings.push(message));
	return { results, warnings };
}

test('disabled providers make no requests even with populated credentials', async t => {
	t.mock.method(globalThis, 'fetch', async () => assert.fail('Unexpected request'));
	assert.deepEqual((await run({ searxngUrl: 'https://search.example.org', braveApiKey: 'example-key' })).results, []); // pragma: allowlist secret -- Dummy API key for mocked requests.
});

test('SearXNG preserves subpaths, requests JSON, skips invalid results and deduplicates', async t => {
	t.mock.method(globalThis, 'fetch', async (url, options) => {
		assert.equal(url.pathname, '/instance/search');
		assert.equal(url.searchParams.get('q'), 'test & query');
		assert.equal(url.searchParams.get('format'), 'json');
		assert.equal(options.headers['X-Subscription-Token'], undefined);
		return json({ results: [null, row('javascript:alert(1)'), row(), row('https://example.org/article#fragment')] });
	});
	const { results } = await run({ searxngEnabled: true, searxngUrl: 'https://search.example.org/instance/' });
	assert.deepEqual(results, [{ title: 'Article', url: 'https://example.org/article', snippet: 'Summary' }]);
});

test('Brave uses the token header and maps descriptions', async t => {
	t.mock.method(globalThis, 'fetch', async (url, options) => {
		assert.equal(url.origin, 'https://api.search.brave.com');
		assert.equal(url.searchParams.get('count'), '3');
		assert.equal(options.headers['X-Subscription-Token'], 'example-key');
		assert.equal(options.redirect, 'error');
		assert.ok(!url.href.includes('example-key'));
		return json({ web: { results: [{ title: 'Brave result', url: 'https://example.org', description: 'Description' }] } });
	});
	assert.equal((await run({ braveEnabled: true, braveApiKey: ' example-key ' })).results[0].snippet, 'Description'); // pragma: allowlist secret -- Dummy API key for mocked requests.
});

test('SearXNG errors fall back to Brave; successful SearXNG skips Brave', async t => {
	let requests = 0;
	const settings = { searxngEnabled: true, searxngUrl: 'https://search.example.org/search', braveEnabled: true, braveApiKey: 'example-key' }; // pragma: allowlist secret -- Dummy API key for mocked requests.
	t.mock.method(globalThis, 'fetch', async () => ++requests === 1
		? new Response('Forbidden', { status: 403 }) : json({ web: { results: [row()] } }));
	const result = await run(settings);
	assert.equal(requests, 2);
	assert.equal(result.results.length, 1);
	assert.match(result.warnings[0], /SearXNG: HTTP 403/);
	t.mock.method(globalThis, 'fetch', async () => { requests++; return json({ results: [row()] }); });
	requests = 0;
	assert.equal((await run(settings)).results.length, 1);
	assert.equal(requests, 1);
});

test('missing configuration and malformed responses allow DuckDuckGo fallback without leaking secrets', async t => {
	t.mock.method(globalThis, 'fetch', async () => assert.fail('Unexpected request'));
	const missing = await run({ searxngEnabled: true, searxngUrl: 'ftp://example.org/search', braveEnabled: true });
	assert.equal(missing.results.length, 0);
	assert.equal(missing.warnings.length, 2);
	t.mock.method(globalThis, 'fetch', async () => json({ results: 'bad response' }));
	assert.equal((await run({ searxngEnabled: true, searxngUrl: 'https://search.example.org' })).results.length, 0);
	t.mock.method(globalThis, 'fetch', async () => { throw new Error('example-key'); });
	const failed = await run({ braveEnabled: true, braveApiKey: 'example-key' }); // pragma: allowlist secret -- Dummy API key for mocked requests.
	assert.equal(failed.results.length, 0);
	assert.ok(!failed.warnings.join('').includes('example-key'));
});

test('cancellation never starts the next provider', async t => {
	const controller = new AbortController();
	let requests = 0;
	t.mock.method(globalThis, 'fetch', async () => {
		requests++;
		controller.abort();
		throw controller.signal.reason;
	});
	await assert.rejects(run({ searxngEnabled: true, searxngUrl: 'https://search.example.org', braveEnabled: true, braveApiKey: 'example-key' }, controller.signal), { name: 'AbortError' }); // pragma: allowlist secret -- Dummy API key for mocked requests.
	assert.equal(requests, 1);
});

test('tool integration caches results and invalidates cache when provider settings change', async t => {
	let provider;
	const settings = { ...defaults, searxngEnabled: true, searxngUrl: 'https://search.example.org', pageSize: 3, promptGuidance: false };
	await main({ withConfigSchematics() {}, withToolsProvider(value) { provider = value; } });
	const tools = await provider({ getPluginConfig() { return { get: key => settings[key] }; } });
	let requests = 0;
	t.mock.method(globalThis, 'fetch', async () => { requests++; return json({ results: [row()] }); });
	const call = () => tools[0].implementation({ query: 'same query' }, { status() {}, warn() {}, signal: new AbortController().signal });
	assert.equal((await call()).count, 1);
	assert.equal((await call()).cached, true);
	assert.equal(requests, 1);
	settings.searxngUrl = 'https://other.example.org';
	assert.equal((await call()).count, 1);
	assert.equal(requests, 2);
});
