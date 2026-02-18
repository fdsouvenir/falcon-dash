// HTTP fetch helpers for PM REST API

interface PMErrorResponse {
	error: string;
	code?: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const body = (await res.json().catch(() => ({ error: res.statusText }))) as PMErrorResponse;
		throw new Error(body.error || res.statusText);
	}
	return res.json() as Promise<T>;
}

export async function pmGet<T>(
	path: string,
	params?: Record<string, string | number | undefined>
): Promise<T> {
	const url = new URL(path, window.location.origin);
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			if (v !== undefined) url.searchParams.set(k, String(v));
		}
	}
	const res = await fetch(url.toString());
	return handleResponse<T>(res);
}

export async function pmPost<T>(path: string, body: unknown): Promise<T> {
	const res = await fetch(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	return handleResponse<T>(res);
}

export async function pmPatch<T>(path: string, body: unknown): Promise<T> {
	const res = await fetch(path, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	return handleResponse<T>(res);
}

export async function pmDelete(path: string, body?: unknown): Promise<void> {
	const opts: RequestInit = { method: 'DELETE' };
	if (body !== undefined) {
		opts.headers = { 'Content-Type': 'application/json' };
		opts.body = JSON.stringify(body);
	}
	const res = await fetch(path, opts);
	if (!res.ok) {
		const err = (await res.json().catch(() => ({
			error: res.statusText
		}))) as PMErrorResponse;
		throw new Error(err.error || res.statusText);
	}
}
