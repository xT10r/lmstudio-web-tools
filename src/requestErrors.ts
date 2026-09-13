function describeHttpStatus(status: number): string {
	const meanings: Record<number, string> = {
		401: 'Authentication required', 403: 'Access denied', 404: 'Resource not found',
		429: 'Rate limit exceeded',
		451: 'Unavailable For Legal Reasons reported by the responding service; the origin site may not be the blocking party',
		500: 'Server error', 502: 'Gateway error', 503: 'Service unavailable', 504: 'Gateway timed out',
	};
	return `HTTP ${status}${meanings[status] ? ` (${meanings[status]})` : ''}`;
}

/** Preserve the string error contract and keep recovery independent of optional research reminders. */
export function websiteFailureResult(reason: string): string {
	return `Error: ${reason}\n` +
		'No verified page content was retrieved by this visit. This failure applies to this source or access route, not to the whole web.\n' +
		'Next action: use Web Search for the same information, then Visit Website on a different relevant domain. ' +
		'Preserve the requested location and date; prefer an official or primary source. ' +
		'Try up to two alternative domains if needed; do not repeatedly request the same blocked URL.\n' +
		'For current weather or other time-sensitive facts, check the observation or forecast timestamp, location, and units. ' +
		'Do not substitute climate averages, historical summaries, model memory, or guesses for current verified data. ' +
		'If alternatives fail, explicitly state which requested values could not be verified; do not invent them.';
}

/** Describe known transport failures without exposing URLs, credentials, or response bodies. */
export function describeRequestError(error: unknown): string {
	const details = new Set<string>();
	const visited = new Set<object>();
	const inspect = (value: unknown, depth: number): void => {
		if (!value || typeof value !== 'object' || depth > 5 || visited.has(value)) return;
		visited.add(value);
		const item = value as { code?: unknown; name?: unknown; message?: unknown; cause?: unknown; errors?: unknown; response?: { statusCode?: unknown } };
		const descriptions: Record<string, string> = {
			ENOTFOUND: 'DNS lookup failed', EAI_AGAIN: 'DNS lookup temporarily failed',
			ECONNREFUSED: 'Connection refused', ECONNRESET: 'Connection reset',
			ENETUNREACH: 'Network unreachable', EHOSTUNREACH: 'Host unreachable',
			EACCES: 'Network access denied', EPERM: 'Network access denied',
			ETIMEDOUT: 'Request timed out', UND_ERR_CONNECT_TIMEOUT: 'Connection timed out',
			UND_ERR_HEADERS_TIMEOUT: 'Response headers timed out', UND_ERR_BODY_TIMEOUT: 'Response body timed out',
			UND_ERR_SOCKET: 'Connection closed unexpectedly',
			ERR_TLS_CERT_ALTNAME_INVALID: 'TLS certificate does not match the hostname',
			CERT_HAS_EXPIRED: 'TLS certificate expired', DEPTH_ZERO_SELF_SIGNED_CERT: 'Untrusted self-signed TLS certificate',
			SELF_SIGNED_CERT_IN_CHAIN: 'Untrusted TLS certificate chain', UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'Unable to verify TLS certificate',
			UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'TLS certificate issuer is not trusted',
		};
		if (typeof item.code === 'string' && descriptions[item.code]) details.add(`${descriptions[item.code]} (${item.code})`);
		if (item.name === 'TimeoutError') details.add('Request timed out');
		const http = typeof item.message === 'string' ? /^HTTP ([1-5][0-9]{2})$/.exec(item.message) : null;
		const status = item.response?.statusCode;
		if (http) details.add(describeHttpStatus(Number(http[1])));
		else if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599) details.add(describeHttpStatus(status));
		inspect(item.cause, depth + 1);
		if (Array.isArray(item.errors)) item.errors.slice(0, 8).forEach(child => inspect(child, depth + 1));
	};
	inspect(error, 0);
	return [...details].join(', ') || 'Request or content processing failed (no transport details available)';
}
