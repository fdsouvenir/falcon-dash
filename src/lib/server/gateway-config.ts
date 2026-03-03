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

/**
 * Resolve the gateway token.
 * Priority: GATEWAY_TOKEN env → OPENCLAW_GATEWAY_TOKEN env → file read.
 */
function resolveToken(): { token: string; source: string } {
	if (env.GATEWAY_TOKEN) {
		return { token: env.GATEWAY_TOKEN, source: 'env:GATEWAY_TOKEN' };
	}
	if (env.OPENCLAW_GATEWAY_TOKEN) {
		return { token: env.OPENCLAW_GATEWAY_TOKEN, source: 'env:OPENCLAW_GATEWAY_TOKEN' };
	}

	const configPath = join(homedir(), '.openclaw', 'openclaw.json');
	const raw = readFileSync(configPath, 'utf-8');
	const config = JSON.parse(raw);
	const token = config?.gateway?.auth?.token;
	if (!token) throw new Error('No gateway token found in env vars or ~/.openclaw/openclaw.json');
	return { token, source: 'file' };
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

/**
 * Read port and bind from ~/.openclaw/openclaw.json.
 * Throws if port is missing (no hardcoded default).
 */
function readConfigFile(): { port: number; bind: string } {
	const configPath = join(homedir(), '.openclaw', 'openclaw.json');
	const raw = readFileSync(configPath, 'utf-8');
	const config = JSON.parse(raw);
	const port = config?.gateway?.port;
	if (!port) throw new Error('No gateway.port in ~/.openclaw/openclaw.json');
	const bind = config?.gateway?.bind ?? 'loopback';
	return { port, bind };
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
		if (gw.port) {
			const bind = gw.bind ?? 'loopback';
			return { url: buildWsUrl(gw.port, bind), source: 'cli' };
		}
	} catch {
		// CLI not available or failed — fall through to file read
	}

	const { port, bind } = readConfigFile();
	return { url: buildWsUrl(port, bind), source: 'file' };
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
	const { port, bind } = readConfigFile();
	return buildHttpUrl(port, bind);
}
