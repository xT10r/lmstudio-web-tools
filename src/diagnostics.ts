import { appendFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { describeRequestError } from './requestErrors';

type Context = { signal: AbortSignal; status: (message: string) => void; warn: (message: string) => void };
type Options = { enabled: boolean; directory: string; includeResults: boolean; secrets: string[] };

export function withDiagnostics<P, R>(
	operation: string, options: () => Options,
	run: (params: P, context: Context & { diagnostic: (message: string) => void }) => Promise<R>,
): (params: P, context: Context) => Promise<R> {
	return async (params, context) => {
		const settings = options();
		if (!settings.enabled) return run(params, { ...context, diagnostic() {} });
		const id = randomUUID();
		const started = Date.now();
		let failed = false;
		const sanitize = (value: unknown): unknown => {
			if (typeof value === 'string') {
				let text = value;
				for (const secret of settings.secrets.filter(Boolean)) {
					text = text.split(secret).join('[REDACTED]').split(encodeURIComponent(secret)).join('[REDACTED]');
				}
				return text.replace(/https?:\/\/[^\s<>"']+/gi, address => {
					try {
						const url = new URL(address);
						url.username = ''; url.password = ''; url.search = ''; url.hash = '';
						return url.href;
					} catch { return '[REDACTED URL]'; }
				}).replace(/\b(authorization|cookie|set-cookie|x-subscription-token|api[_-]?key|token|password)\s*[:=]\s*[^\r\n]+/gi, '$1=[REDACTED]');
			}
			if (Array.isArray(value)) return value.map(sanitize);
			if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) =>
				[key, /secret|token|password|cookie|authorization|api[_-]?key/i.test(key) ? '[REDACTED]' : sanitize(item)]));
			return value;
		};
		const write = (event: string, data: unknown) => {
			if (failed) return;
			try {
				const directory = settings.directory.trim() || join(tmpdir(), 'lmstudio-web-tools');
				if (!isAbsolute(directory)) throw new Error('Expected an absolute log directory');
				mkdirSync(directory, { recursive: true, mode: 0o700 });
				appendFileSync(join(directory, `debug-${new Date(started).toISOString().slice(0, 10)}.jsonl`),
					JSON.stringify({ timestamp: new Date().toISOString(), id, operation, event, elapsedMs: Date.now() - started, data: sanitize(data) }) + '\n', { mode: 0o600 });
			} catch {
				failed = true;
				try { context.warn('Debug log could not be written; logging disabled for this call.'); } catch { /* Logging must not interrupt retrieval. */ }
			}
		};
		write('start', params);
		try {
			const result = await run(params, {
				...context,
				status(message) { write('status', message); context.status(message); },
				warn(message) { write('warning', message); context.warn(message); },
				diagnostic(message) { write('diagnostic', message); },
			});
			write(context.signal.aborted ? 'cancelled' : 'return', settings.includeResults || typeof result === 'string'
				? result : { type: typeof result, characters: JSON.stringify(result)?.length });
			return result;
		} catch (error) {
			write(context.signal.aborted ? 'cancelled' : 'error', describeRequestError(error));
			throw error;
		}
	};
}
