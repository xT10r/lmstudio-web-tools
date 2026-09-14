/** Bound the complete async operation, including body reads, and abort its transport. */
export async function withRequestTimeout<T>(parent: AbortSignal, milliseconds: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
	parent.throwIfAborted();
	const controller = new AbortController();
	let rejectAbort: (reason: unknown) => void = () => {};
	const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
	const abort = (reason: unknown) => { controller.abort(reason); rejectAbort(reason); };
	const onAbort = () => abort(parent.reason);
	parent.addEventListener('abort', onAbort, { once: true });
	const timer = setTimeout(() => abort(new DOMException('Request timed out', 'TimeoutError')), milliseconds);
	try {
		return await Promise.race([Promise.resolve().then(() => {
			controller.signal.throwIfAborted();
			return run(controller.signal);
		}), aborted]);
	} finally {
		clearTimeout(timer);
		parent.removeEventListener('abort', onAbort);
	}
}

export async function fetchText(url: string, signal: AbortSignal): Promise<string> {
	return withRequestTimeout(signal, 30000, async requestSignal => {
		const response = await fetch(url, { signal: requestSignal });
		if (!response.ok) {
			void response.body?.cancel().catch(() => {});
			throw new Error(`HTTP ${response.status}`);
		}
		return response.text();
	});
}
