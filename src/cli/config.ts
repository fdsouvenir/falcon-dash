import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CliError } from './errors.js';

/**
 * CLI configuration (doc 06): `FALCON_DASH_URL` (default localhost) + token
 * discovery: env → config file → token file under the data dir. On fredbot
 * hosts the token file is dropped at mint time, so the CLI is zero-config.
 */

export interface CliConfig {
	baseUrl: string;
	token: string;
	tokenSource: string;
}

interface FileConfig {
	url?: string;
	token?: string;
	agent_id?: string;
}

function readFileConfig(): FileConfig {
	const path = join(homedir(), '.config', 'falcon-dash', 'cli.json');
	if (!existsSync(path)) return {};
	try {
		return JSON.parse(readFileSync(path, 'utf-8')) as FileConfig;
	} catch {
		throw new CliError('usage', `Config file is not valid JSON: ${path}`);
	}
}

function tokenDir(): string {
	const dataDir =
		process.env.FALCON_DASH_DATA_DIR ?? join(homedir(), '.openclaw', 'data', 'falcon-dash');
	return join(dataDir, 'tokens');
}

function discoverTokenFile(fileConfig: FileConfig): { token: string; source: string } | null {
	const dir = tokenDir();
	if (!existsSync(dir)) return null;
	const agentId = process.env.FALCON_AGENT_ID ?? fileConfig.agent_id;
	if (agentId) {
		const path = join(dir, `${agentId}.token`);
		if (!existsSync(path)) return null;
		return { token: readFileSync(path, 'utf-8').trim(), source: path };
	}
	const candidates = readdirSync(dir).filter((name) => name.endsWith('.token'));
	if (candidates.length === 1) {
		const path = join(dir, candidates[0]);
		return { token: readFileSync(path, 'utf-8').trim(), source: path };
	}
	if (candidates.length > 1) {
		throw new CliError(
			'usage',
			`Multiple agent token files found in ${dir}; set FALCON_AGENT_ID to choose one`,
			{ details: { candidates } }
		);
	}
	return null;
}

export function resolveConfig(): CliConfig {
	const fileConfig = readFileConfig();
	const baseUrl = (
		process.env.FALCON_DASH_URL ??
		fileConfig.url ??
		'http://127.0.0.1:3000'
	).replace(/\/$/, '');

	if (process.env.FALCON_DASH_TOKEN) {
		return { baseUrl, token: process.env.FALCON_DASH_TOKEN, tokenSource: 'env:FALCON_DASH_TOKEN' };
	}
	if (fileConfig.token) {
		return { baseUrl, token: fileConfig.token, tokenSource: 'config-file' };
	}
	const discovered = discoverTokenFile(fileConfig);
	if (discovered) {
		return { baseUrl, token: discovered.token, tokenSource: discovered.source };
	}
	throw new CliError(
		'unauthorized',
		'No agent token found. Set FALCON_DASH_TOKEN, or mint a token in Falcon Dash Settings → Agent Tokens (drops a token file for this host).',
		{ details: { token_dir: tokenDir() } }
	);
}
