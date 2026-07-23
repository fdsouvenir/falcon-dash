import type { CommandSuccess } from '../lib/work3-shared/types.js';
import type { Work3ErrorShape } from '../lib/work3-shared/errors.js';
import { CliError, cliErrorFromShape } from './errors.js';
import { resolveConfig } from './config.js';

/** HTTP transport: JSON only (doc 04); TOON rendering happens CLI-side. */

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
	const config = resolveConfig();
	let response: Response;
	try {
		response = await fetch(config.baseUrl + path, {
			...init,
			headers: {
				Authorization: `Bearer ${config.token}`,
				'Content-Type': 'application/json',
				...init.headers
			}
		});
	} catch (error) {
		throw new CliError(
			'network',
			`Cannot reach Falcon Dash at ${config.baseUrl}: ${error instanceof Error ? error.message : String(error)}`,
			{
				suggestions: ['Set FALCON_DASH_URL if the server runs elsewhere']
			}
		);
	}
	let body: unknown;
	try {
		body = await response.json();
	} catch {
		throw new CliError(
			'network',
			`Falcon Dash returned a non-JSON response (HTTP ${response.status})`
		);
	}
	if (!response.ok) {
		if (response.status === 401) {
			throw new CliError(
				'unauthorized',
				(body as { message?: string }).message ?? 'Invalid or missing token'
			);
		}
		throw cliErrorFromShape(body as Work3ErrorShape);
	}
	return body;
}

export async function apiGet(path: string): Promise<Record<string, unknown>> {
	return (await request(path)) as Record<string, unknown>;
}

export async function apiPost(path: string, body: unknown): Promise<Record<string, unknown>> {
	return (await request(path, { method: 'POST', body: JSON.stringify(body) })) as Record<
		string,
		unknown
	>;
}

export async function apiCommand<TResult = Record<string, unknown>>(params: {
	command: string;
	target?: string;
	expectedVersion?: number;
	idempotencyKey?: string;
	payload?: Record<string, unknown>;
}): Promise<CommandSuccess<TResult>> {
	return (await request(`/api/v3/commands/${params.command}`, {
		method: 'POST',
		body: JSON.stringify({
			target: params.target,
			expected_version: params.expectedVersion,
			idempotency_key: params.idempotencyKey,
			payload: params.payload ?? {}
		})
	})) as CommandSuccess<TResult>;
}

/** Fetch the current envelope version for a target (verbs auto-pin it). */
export async function currentVersion(type: string, id: string): Promise<number> {
	const detail = await apiGet(`/api/v3/objects/${type}/${id}?view=detail`);
	const item = detail.item as Record<string, unknown>;
	return item.version as number;
}
