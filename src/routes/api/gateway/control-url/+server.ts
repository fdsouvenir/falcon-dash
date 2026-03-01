import { json } from '@sveltejs/kit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { env } from '$env/dynamic/private';

/**
 * Returns the gateway's HTTP control UI URL.
 * Reads from env vars or ~/.openclaw/openclaw.json — does NOT depend on
 * an active gateway connection.
 */
export function GET() {
	try {
		const envUrl = env.GATEWAY_URL;
		if (envUrl) {
			const httpUrl = envUrl.replace(/^ws(s?)/, 'http$1');
			return json({ url: new URL(httpUrl).origin });
		}

		const configPath = join(homedir(), '.openclaw', 'openclaw.json');
		const raw = readFileSync(configPath, 'utf-8');
		const config = JSON.parse(raw);
		const port = config?.gateway?.port ?? 18789;
		const bind = config?.gateway?.bind ?? 'loopback';
		const host = bind === 'loopback' ? '127.0.0.1' : bind;
		return json({ url: `http://${host}:${port}` });
	} catch {
		return json({ error: 'Could not read gateway configuration.' }, { status: 500 });
	}
}
