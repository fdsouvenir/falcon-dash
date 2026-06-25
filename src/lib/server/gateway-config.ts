import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { env } from '$env/dynamic/private';

export interface GatewayConfig {
	url: string;
	token: string;
	source: string;
}

interface OpenClawGatewayConfig {
	mode?: string;
	port?: number;
	bind?: string;
	auth?: {
		token?: string;
	};
	remote?: {
		url?: string;
		token?: string;
	};
}

function readGatewayFromFile(): OpenClawGatewayConfig {
	const configPath = join(homedir(), '.openclaw', 'openclaw.json');
	const raw = readFileSync(configPath, 'utf-8');
	const config = JSON.parse(raw);
	return config?.gateway ?? {};
}

/**
 * Resolve the gateway token.
 * Priority: GATEWAY_TOKEN env → OPENCLAW_GATEWAY_TOKEN env → file read.
 */
export function resolveTokenSync(): string {
	return resolveToken().token;
}

function resolveToken(): { token: string; source: string } {
	if (env.GATEWAY_TOKEN) {
		return { token: env.GATEWAY_TOKEN, source: 'env:GATEWAY_TOKEN' };
	}
	if (env.OPENCLAW_GATEWAY_TOKEN) {
		return { token: env.OPENCLAW_GATEWAY_TOKEN, source: 'env:OPENCLAW_GATEWAY_TOKEN' };
	}

	const gateway = readGatewayFromFile();
	const isRemoteMode = gateway?.mode === 'remote';
	const token = isRemoteMode
		? (gateway?.remote?.token ?? gateway?.auth?.token)
		: gateway?.auth?.token;
	if (!token) throw new Error('No gateway token found in env vars or ~/.openclaw/openclaw.json');
	return { token, source: isRemoteMode ? 'file:gateway.remote.token' : 'file:gateway.auth.token' };
}

/**
 * Run a CLI command and return stdout.
 */
function execCli(cmd: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(cmd, args, { timeout: 5000 }, (err, stdout) => {
			if (err) reject(err);
			else resolve(stdout.trim());
		});
	});
}

/**
 * Build a WebSocket URL from port and bind values.
 */
function buildWsUrl(port: number, bind: string): string {
	const host = bind === 'loopback' ? '127.0.0.1' : bind === 'lan' ? '0.0.0.0' : bind;
	return `ws://${host}:${port}`;
}

/**
 * Build an HTTP URL from port and bind values.
 */
function buildHttpUrl(port: number, bind: string): string {
	const host = bind === 'loopback' ? '127.0.0.1' : bind === 'lan' ? '0.0.0.0' : bind;
	return `http://${host}:${port}`;
}

function resolveGatewayUrl(
	gateway: OpenClawGatewayConfig,
	source: string
): { url: string; source: string } {
	if (gateway.mode === 'remote' && gateway.remote?.url) {
		return { url: gateway.remote.url, source: `${source}:gateway.remote.url` };
	}
	if (gateway.port) {
		const bind = gateway.bind ?? 'loopback';
		return { url: buildWsUrl(gateway.port, bind), source };
	}
	throw new Error('No gateway remote URL or port found');
}

/**
 * Read port and bind from ~/.openclaw/openclaw.json.
 * Throws if port is missing (no hardcoded default).
 */
function readConfigFile(): { url: string; source: string } {
	try {
		return resolveGatewayUrl(readGatewayFromFile(), 'file');
	} catch {
		throw new Error('No gateway.remote.url or gateway.port in ~/.openclaw/openclaw.json');
	}
}

/**
 * Resolve the gateway WebSocket URL.
 * Priority: GATEWAY_URL env → openclaw CLI → file read.
 */
async function resolveUrl(): Promise<{ url: string; source: string }> {
	if (env.GATEWAY_URL) {
		return { url: env.GATEWAY_URL, source: 'env:GATEWAY_URL' };
	}

	// Try CLI: openclaw config get gateway --json
	try {
		const cliResult = await execCli('openclaw', ['config', 'get', 'gateway', '--json']);
		const gw = JSON.parse(cliResult);
		return resolveGatewayUrl(gw, 'cli');
	} catch {
		// CLI not available or failed — fall through to file read
	}

	return readConfigFile();
}

/**
 * Read full gateway config (URL + token) using the priority chain.
 * Async because CLI exec is async.
 *
 * Token: GATEWAY_TOKEN env → OPENCLAW_GATEWAY_TOKEN env → file
 * URL: GATEWAY_URL env → openclaw CLI → file
 */
export async function readGatewayConfig(): Promise<GatewayConfig> {
	const tokenResult = resolveToken();
	const urlResult = await resolveUrl();
	const source = `url:${urlResult.source},token:${tokenResult.source}`;
	return { url: urlResult.url, token: tokenResult.token, source };
}

/**
 * Synchronous HTTP URL resolution for the control-url endpoint.
 * Skips CLI (sync context). Uses env → file.
 */
export function readGatewayUrlSync(): string {
	if (env.GATEWAY_URL) {
		return env.GATEWAY_URL.replace(/^ws(s?)/, 'http$1');
	}
	const gateway = readGatewayFromFile();
	if (gateway.mode === 'remote' && gateway.remote?.url) {
		return gateway.remote.url.replace(/^ws(s?)/, 'http$1');
	}
	if (!gateway.port)
		throw new Error('No gateway.remote.url or gateway.port in ~/.openclaw/openclaw.json');
	return buildHttpUrl(gateway.port, gateway.bind ?? 'loopback');
}
