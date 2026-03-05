/**
 * KeePassXC CLI wrapper for Falcon Dash vault operations.
 *
 * Vault:    ~/.openclaw/passwords.kdbx
 * Keyfile:  ~/.openclaw/vault.key
 * Auth:     --no-password --key-file
 *
 * All paths are relative to the root group (e.g. "Group/Entry Title").
 * The keepassxc-cli binary must be available on PATH.
 */

import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { homedir } from 'os';
import { join } from 'path';

const execFileAsync = promisify(execFile);

const KDBX = join(homedir(), '.openclaw', 'passwords.kdbx');
const KEY_FILE = join(homedir(), '.openclaw', 'vault.key');
const CLI = 'keepassxc-cli';

/** Common args prepended to every keepassxc-cli invocation. */
const BASE_ARGS = ['--no-password', '--key-file', KEY_FILE] as const;

export interface VaultEntry {
	title: string;
	username: string;
	password: string;
	url: string;
	notes: string;
	path: string;
}

export interface VaultEntryStub {
	title: string;
	path: string;
}

export interface VaultListResult {
	entries: VaultEntryStub[];
	groups: string[];
}

export interface VaultStatus {
	available: boolean;
	error?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Run keepassxc-cli with stdin piped if provided. Returns stdout. */
async function run(command: string, args: string[], stdin?: string): Promise<string> {
	const fullArgs = [command, ...BASE_ARGS, KDBX, ...args];

	const opts: Parameters<typeof execFileAsync>[2] = {
		timeout: 10000,
		maxBuffer: 1024 * 1024
	};

	if (stdin !== undefined) {
		// execFile doesn't natively support stdin; use spawn-based helper
		return runWithStdin(command, fullArgs, stdin);
	}

	const { stdout, stderr } = await execFileAsync(CLI, fullArgs, opts);
	// keepassxc-cli writes some informational messages to stderr (e.g. "Inserting entry...")
	// Those are not errors — only throw if exit code was non-zero (handled by execFile rejecting).
	void stderr;
	return stdout.toString();
}

/** Spawn keepassxc-cli, write stdin, collect stdout/stderr, resolve on exit 0. */
function runWithStdin(command: string, fullArgs: string[], stdin: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn(CLI, fullArgs, { timeout: 10000 });

		let stdout = '';
		let stderr = '';

		child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
		child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));

		child.on('close', (code: number | null) => {
			if (code === 0) {
				resolve(stdout);
			} else {
				reject(new Error(stderr.trim() || `keepassxc-cli ${command} exited with code ${code}`));
			}
		});

		child.on('error', reject);

		child.stdin.write(stdin + '\n');
		child.stdin.end();
	});
}

/**
 * Parse `keepassxc-cli show -s` output into a VaultEntry.
 *
 * Output format (one attribute per line):
 *   Title: Entry Name
 *   UserName: user@example.com
 *   Password: secret
 *   URL: https://example.com
 *   Notes: some notes
 *   Uuid: ...
 */
function parseShowOutput(output: string, path: string): VaultEntry {
	const lines = output.split('\n');
	const get = (key: string) => {
		const line = lines.find((l) => l.startsWith(`${key}: `));
		return line ? line.slice(key.length + 2).trim() : '';
	};
	return {
		title: get('Title'),
		username: get('UserName'),
		password: get('Password'),
		url: get('URL'),
		notes: get('Notes'),
		path
	};
}

/**
 * Parse `keepassxc-cli ls` output.
 *
 * keepassxc-cli ls prints one item per line.
 * Groups are suffixed with `/`.  Entries are bare names.
 * When listing a non-root group, the output contains only immediate children
 * (names relative to that group).
 */
function parseLsOutput(output: string, parentPath: string): VaultListResult {
	const lines = output
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean);

	const entries: VaultEntryStub[] = [];
	const groups: string[] = [];
	const prefix = parentPath ? `${parentPath}/` : '';

	for (const line of lines) {
		if (line.endsWith('/')) {
			const name = line.slice(0, -1);
			groups.push(`${prefix}${name}`);
		} else {
			entries.push({ title: line, path: `${prefix}${line}` });
		}
	}

	return { entries, groups };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Check whether the vault is accessible. */
export async function getStatus(): Promise<VaultStatus> {
	try {
		await run('ls', []);
		return { available: true };
	} catch (err) {
		return { available: false, error: (err as Error).message };
	}
}

/**
 * List entries and sub-groups in a group.
 * @param group Full path of the group, e.g. "Work/APIs". Omit for root.
 */
export async function listEntries(group?: string): Promise<VaultListResult> {
	const args = group ? [group] : [];
	const output = await run('ls', args);
	return parseLsOutput(output, group ?? '');
}

/**
 * List all groups recursively by walking the tree.
 * Returns an array of full group paths (e.g. ["Work", "Work/APIs", "Personal"]).
 */
export async function listGroups(): Promise<string[]> {
	const allGroups: string[] = [];

	async function walk(path: string) {
		const result = await listEntries(path || undefined);
		for (const g of result.groups) {
			allGroups.push(g);
			await walk(g);
		}
	}

	await walk('');
	return allGroups;
}

/**
 * Show full details of an entry (including password).
 * @param path Full path of the entry, e.g. "Work/APIs/GitHub".
 */
export async function getEntry(path: string): Promise<VaultEntry> {
	const output = await run('show', ['--show-protected', path]);
	return parseShowOutput(output, path);
}

/**
 * Get a single attribute of an entry.
 * @param path  Entry path
 * @param field Attribute name: Password | UserName | URL | Notes | Title
 */
export async function getEntryAttribute(path: string, field: string): Promise<string> {
	const output = await run('show', ['--show-protected', '--attributes', field, path]);
	return output.trim();
}

export interface CreateEntryOptions {
	username?: string;
	/** Provide a password, or omit to auto-generate one. */
	password?: string;
	url?: string;
	notes?: string;
}

/**
 * Create a new entry.
 * If no password is provided, one is auto-generated.
 */
export async function createEntry(path: string, opts: CreateEntryOptions): Promise<void> {
	const args: string[] = [];
	if (opts.username) args.push('--username', opts.username);
	if (opts.url) args.push('--url', opts.url);
	if (opts.notes) args.push('--notes', opts.notes);

	if (opts.password !== undefined) {
		args.push('--password-prompt');
		args.push(path);
		await run('add', args, opts.password);
	} else {
		args.push('--generate');
		args.push(path);
		await run('add', args);
	}
}

export interface EditEntryOptions {
	title?: string;
	username?: string;
	password?: string;
	url?: string;
	notes?: string;
}

/** Edit an existing entry. Only provided fields are updated. */
export async function editEntry(path: string, opts: EditEntryOptions): Promise<void> {
	const args: string[] = [];
	if (opts.title) args.push('--title', opts.title);
	if (opts.username !== undefined) args.push('--username', opts.username);
	if (opts.url !== undefined) args.push('--url', opts.url);
	if (opts.notes !== undefined) args.push('--notes', opts.notes);

	if (opts.password !== undefined) {
		args.push('--password-prompt');
		args.push(path);
		await run('edit', args, opts.password);
	} else {
		args.push(path);
		await run('edit', args);
	}
}

/** Delete an entry. */
export async function deleteEntry(path: string): Promise<void> {
	await run('rm', [path]);
}

/** Create a group (mkdir). */
export async function createGroup(path: string): Promise<void> {
	await run('mkdir', [path]);
}

/** Delete a group (rmdir). Only works on empty groups. */
export async function deleteGroup(path: string): Promise<void> {
	await run('rmdir', [path]);
}
