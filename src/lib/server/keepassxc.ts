import { spawn } from 'child_process';
import { access, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { VAULT_PATH } from './passwords-config.js';

export interface PasswordEntry {
	title: string;
	username: string;
	url: string;
	path: string;
	group?: string;
}

export interface PasswordDetail extends PasswordEntry {
	password: string;
	notes: string;
}

function runKeepassxc(args: string[], input?: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = spawn('keepassxc-cli', args, { timeout: 10000 });
		let stdout = '';
		let stderr = '';

		proc.stdout.on('data', (data) => {
			stdout += data.toString();
		});
		proc.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		proc.on('close', (code) => {
			if (code === 0) resolve(stdout.trim());
			else {
				const msg = stderr
					.trim()
					.replace(/^(Enter password.*?:\s*|Repeat password.*?:\s*)*/g, '')
					.trim();
				reject(new Error(msg || `Process exited with code ${code}`));
			}
		});

		proc.on('error', reject);

		if (input) {
			proc.stdin.write(input + '\n');
			proc.stdin.end();
		}
	});
}

export async function vaultExists(): Promise<boolean> {
	try {
		await access(VAULT_PATH);
		return true;
	} catch {
		return false;
	}
}

export async function initVault(password: string): Promise<void> {
	// Create directory if needed
	const dir = dirname(VAULT_PATH);
	await mkdir(dir, { recursive: true });
	// keepassxc-cli db-create --set-password prompts for password twice (enter + confirm)
	await runKeepassxc(['db-create', VAULT_PATH, '--set-password'], password + '\n' + password);
}

export async function listEntries(password: string): Promise<PasswordEntry[]> {
	const output = await runKeepassxc(['ls', '-R', '-f', VAULT_PATH], password);
	const lines = output.split('\n').filter(Boolean);
	const entries: PasswordEntry[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.endsWith('/')) continue; // Skip groups/folders
		entries.push({
			title: trimmed.split('/').pop() ?? trimmed,
			username: '',
			url: '',
			path: trimmed
		});
	}

	// Get details for each entry (title, username, url — no password)
	const detailed = await Promise.all(
		entries.map(async (entry) => {
			try {
				const info = await runKeepassxc(['show', '-s', VAULT_PATH, entry.path], password);
				const parsed = parseEntryOutput(info);
				return {
					...entry,
					title: parsed.title || entry.title,
					username: parsed.username || '',
					url: parsed.url || '',
					group: entry.path.includes('/')
						? entry.path.substring(0, entry.path.lastIndexOf('/'))
						: undefined
				};
			} catch {
				return entry;
			}
		})
	);

	return detailed;
}

export async function getEntry(password: string, path: string): Promise<PasswordDetail> {
	const output = await runKeepassxc(['show', VAULT_PATH, path], password);
	const parsed = parseEntryOutput(output);
	return {
		title: parsed.title || path.split('/').pop() || path,
		username: parsed.username || '',
		password: parsed.password || '',
		url: parsed.url || '',
		notes: parsed.notes || '',
		path,
		group: path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : undefined
	};
}

export async function addEntry(
	password: string,
	path: string,
	fields: { username?: string; password?: string; url?: string; notes?: string }
): Promise<void> {
	const args = ['add', VAULT_PATH, path];
	if (fields.username) args.push('-u', fields.username);
	if (fields.password) args.push('-p');
	if (fields.url) args.push('--url', fields.url);

	const input = fields.password ? `${password}\n${fields.password}` : password;
	await runKeepassxc(args, input);

	if (fields.notes) {
		await runKeepassxc(['edit', VAULT_PATH, path, '-n', fields.notes], password);
	}
}

export async function editEntry(
	password: string,
	path: string,
	fields: {
		username?: string;
		password?: string;
		url?: string;
		notes?: string;
		title?: string;
	}
): Promise<void> {
	const args = ['edit', VAULT_PATH, path];
	if (fields.username) args.push('-u', fields.username);
	if (fields.password) args.push('-p');
	if (fields.url) args.push('--url', fields.url);
	if (fields.title) args.push('-t', fields.title);

	const input = fields.password ? `${password}\n${fields.password}` : password;
	await runKeepassxc(args, input);

	if (fields.notes) {
		await runKeepassxc(['edit', VAULT_PATH, path, '-n', fields.notes], password);
	}
}

export async function deleteEntry(password: string, path: string): Promise<void> {
	await runKeepassxc(['rm', VAULT_PATH, path], password);
}

function parseEntryOutput(output: string): Record<string, string> {
	const result: Record<string, string> = {};
	const lines = output.split('\n');
	for (const line of lines) {
		const colonIdx = line.indexOf(':');
		if (colonIdx === -1) continue;
		const key = line.substring(0, colonIdx).trim().toLowerCase();
		const value = line.substring(colonIdx + 1).trim();
		if (key === 'title') result.title = value;
		else if (key === 'username' || key === 'user name') result.username = value;
		else if (key === 'password') result.password = value;
		else if (key === 'url') result.url = value;
		else if (key === 'notes') result.notes = value;
	}
	return result;
}
