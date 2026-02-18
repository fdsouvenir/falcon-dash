import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { env } from '$env/dynamic/private';

/** GET: Read gateway token and URL from env vars or ~/.openclaw/openclaw.json */
export const GET: RequestHandler = async () => {
	// Dev override: use GATEWAY_URL and GATEWAY_TOKEN env vars if both are set
	const envUrl = env.GATEWAY_URL;
	const envToken = env.GATEWAY_TOKEN;
	if (envUrl && envToken) {
		return json({ token: envToken, url: envUrl });
	}

	try {
		const configPath = join(homedir(), '.openclaw', 'openclaw.json');
		const raw = readFileSync(configPath, 'utf-8');
		const config = JSON.parse(raw);

		const token = config?.gateway?.auth?.token;
		if (!token || typeof token !== 'string') {
			return json({ error: 'No gateway token found in config' }, { status: 404 });
		}

		// When ORIGIN is set (production behind reverse proxy), derive WSS URL
		// so the browser connects through the tunnel instead of localhost
		const origin = process.env.ORIGIN;
		let url: string;
		if (origin && origin.startsWith('https://')) {
			const host = new URL(origin).host;
			url = `wss://${host}/ws`;
		} else {
			const port = config?.gateway?.port ?? 18789;
			const bind = config?.gateway?.bind ?? 'loopback';
			const host = bind === 'loopback' ? '127.0.0.1' : bind;
			url = `ws://${host}:${port}`;
		}

		return json({ token, url });
	} catch {
		return json({ error: 'Could not read gateway config' }, { status: 404 });
	}
};
