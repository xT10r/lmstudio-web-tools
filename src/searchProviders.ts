import { z } from "zod";

export type SearchResult = { title: string; url: string; snippet: string };
export type SearchSettings = {
	searxngEnabled: boolean;
	searxngUrl: string;
	braveEnabled: boolean;
	braveApiKey: string;
};

const itemSchema = z.object({
	title: z.string(),
	url: z.string().url(),
	content: z.string().optional(),
	description: z.string().optional(),
});
const searxngSchema = z.object({ results: z.array(z.unknown()) });
const braveSchema = z.object({
	web: z.object({ results: z.array(z.unknown()) }).optional(),
});

function normalizeResults(items: unknown[], limit: number): SearchResult[] {
	const results: SearchResult[] = [];
	const seen = new Set<string>();
	for (const item of items) {
		const parsed = itemSchema.safeParse(item);
		if (!parsed.success) continue;
		const { title, url, content, description } = parsed.data;
		const address = new URL(url);
		if (!['http:', 'https:'].includes(address.protocol) || !title.trim()) continue;
		address.hash = '';
		if (seen.has(address.href)) continue;
		seen.add(address.href);
		results.push({ title: title.trim(), url, snippet: content ?? description ?? '' });
		if (results.length >= limit) break;
	}
	return results;
}

async function getJson(url: URL, signal: AbortSignal, headers: Record<string, string> = {}): Promise<unknown> {
	const response = await fetch(url, {
		headers: { Accept: 'application/json', ...headers },
		signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
		// Do not forward API credentials to redirected endpoints.
		redirect: 'error',
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return response.json();
}

/** Enabled API providers are tried in order; an empty result allows the DDG fallback. */
export async function searchApiProviders(
	settings: SearchSettings, query: string, limit: number, signal: AbortSignal,
	status: (message: string) => void, warn: (message: string) => void,
): Promise<SearchResult[]> {
	const providers: { name: string; search: () => Promise<SearchResult[]> }[] = [];
	if (settings.searxngEnabled) {
		providers.push({ name: 'SearXNG', search: async () => {
			let url: URL;
			try {
				url = new URL(settings.searxngUrl.trim());
				if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
			} catch {
				throw new Error('Set a valid HTTP(S) SearXNG URL without embedded credentials');
			}
			url.pathname = url.pathname.replace(/\/+$/, '');
			if (!url.pathname.endsWith('/search')) url.pathname += '/search';
			url.hash = '';
			url.searchParams.set('q', query);
			url.searchParams.set('format', 'json');
			const data = searxngSchema.parse(await getJson(url, signal));
			return normalizeResults(data.results, limit);
		} });
	}
	if (settings.braveEnabled) {
		providers.push({ name: 'Brave', search: async () => {
			const key = settings.braveApiKey.trim();
			if (!key) throw new Error('Set a Brave Search API key');
			const url = new URL('https://api.search.brave.com/res/v1/web/search');
			url.searchParams.set('q', query);
			url.searchParams.set('count', String(limit));
			const data = braveSchema.parse(await getJson(url, signal, { 'X-Subscription-Token': key }));
			return normalizeResults(data.web?.results ?? [], limit);
		} });
	}
	for (const provider of providers) {
		signal.throwIfAborted();
		status(`Searching ${provider.name}...`);
		try {
			const results = await provider.search();
			signal.throwIfAborted();
			if (results.length) return results;
			warn(`${provider.name} returned no usable results; trying the next provider.`);
		} catch (error) {
			signal.throwIfAborted();
			// Never expose response bodies, request headers, keys, or instance URLs.
			const message = error instanceof Error &&
				(/^(HTTP \d{3}|Set a valid HTTP\(S\) SearXNG URL without embedded credentials|Set a Brave Search API key)$/.test(error.message))
				? error.message : 'Request failed, timed out, or returned invalid JSON';
			warn(`${provider.name}: ${message}; trying the next provider.`);
		}
	}
	return [];
}
