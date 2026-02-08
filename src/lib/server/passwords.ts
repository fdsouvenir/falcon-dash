import { execFile as execFileCb } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import * as os from 'node:os';

interface EntryFields {
	username?: string;
	password?: string;
	url?: string;
	notes?: string;
}

interface Entry extends EntryFields {
	title: string;
}

/**
 * Helper to execute keepassxc-cli with stdin input
 */
function execWithStdin(
	command: string,
	args: string[],
	stdinInput: string
): Promise<{ stdout: string; stderr: string }> {
	return new Promise((resolve, reject) => {
		const child = execFileCb(command, args, (err, stdout, stderr) => {
			if (err) {
				reject(err);
				return;
			}
			resolve({ stdout, stderr });
		});
		if (child.stdin) {
			child.stdin.write(stdinInput);
			child.stdin.end();
		}
	});
}

/**
 * PasswordVault singleton — wraps keepassxc-cli for secure password management
 */
export class PasswordVault {
	private static instance: PasswordVault | null = null;

	private availabilityCache: boolean | null = null;
	private sessionToken: string | null = null;
	private masterPassword: string | null = null;
	private idleTimer: NodeJS.Timeout | null = null;

	private readonly IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
	private readonly vaultPath: string;

	private constructor() {
		this.vaultPath =
			process.env.OPENCLAW_VAULT_PATH || path.join(os.homedir(), '.openclaw', 'passwords.kdbx');
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(): PasswordVault {
		if (!PasswordVault.instance) {
			PasswordVault.instance = new PasswordVault();
		}
		return PasswordVault.instance;
	}

	/**
	 * Check if keepassxc-cli is installed
	 */
	async isAvailable(): Promise<boolean> {
		if (this.availabilityCache !== null) {
			return this.availabilityCache;
		}

		return new Promise((resolve) => {
			execFileCb('which', ['keepassxc-cli'], (error) => {
				this.availabilityCache = !error;
				resolve(this.availabilityCache);
			});
		});
	}

	/**
	 * Unlock vault with master password, returns session token
	 */
	async unlock(masterPassword: string): Promise<string> {
		if (!(await this.isAvailable())) {
			throw new Error('keepassxc-cli is not available');
		}

		// Verify vault access by listing entries
		try {
			await execWithStdin('keepassxc-cli', ['ls', this.vaultPath], `${masterPassword}\n`);
		} catch {
			throw new Error('Failed to unlock vault: invalid master password or vault error');
		}

		// Generate session token
		this.sessionToken = randomUUID();
		this.masterPassword = masterPassword;
		this.resetIdleTimer();

		return this.sessionToken;
	}

	/**
	 * Lock vault — clears session token and cached data
	 */
	lock(): void {
		this.sessionToken = null;
		this.masterPassword = null;
		if (this.idleTimer) {
			clearTimeout(this.idleTimer);
			this.idleTimer = null;
		}
	}

	/**
	 * Check if vault is unlocked
	 */
	isUnlocked(): boolean {
		return this.sessionToken !== null && this.masterPassword !== null;
	}

	/**
	 * Validate session token
	 */
	validateSession(token: string): boolean {
		if (!this.isUnlocked()) {
			return false;
		}
		return this.sessionToken === token;
	}

	/**
	 * Reset idle timer — auto-locks after 15 minutes
	 */
	private resetIdleTimer(): void {
		if (this.idleTimer) {
			clearTimeout(this.idleTimer);
		}
		this.idleTimer = setTimeout(() => {
			this.lock();
		}, this.IDLE_TIMEOUT_MS);
	}

	/**
	 * Ensure vault is unlocked before operation
	 */
	private ensureUnlocked(): void {
		if (!this.isUnlocked()) {
			throw new Error('Vault is locked');
		}
		this.resetIdleTimer();
	}

	/**
	 * List entries in vault, optionally filtered by group
	 */
	async listEntries(group?: string): Promise<string[]> {
		if (!(await this.isAvailable())) {
			throw new Error('keepassxc-cli is not available');
		}
		this.ensureUnlocked();

		const args = ['ls', this.vaultPath];
		if (group) {
			args.push(group);
		}

		const { stdout } = await execWithStdin('keepassxc-cli', args, `${this.masterPassword}\n`);

		// Parse output: one entry per line, filter out Recycle Bin and groups
		return stdout
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line && !line.endsWith('/') && !line.startsWith('Recycle Bin'));
	}

	/**
	 * Parse show output into Entry object
	 */
	private parseShowOutput(stdout: string): Entry {
		const lines = stdout.split('\n');
		const entry: Entry = { title: '' };

		for (const line of lines) {
			const colonIndex = line.indexOf(':');
			if (colonIndex === -1) continue;

			const key = line.substring(0, colonIndex).trim();
			const value = line.substring(colonIndex + 1).trim();

			if (key === 'Title') {
				entry.title = value;
			} else if (key === 'UserName') {
				entry.username = value;
			} else if (key === 'Password') {
				entry.password = value;
			} else if (key === 'URL') {
				entry.url = value;
			} else if (key === 'Notes') {
				entry.notes = value;
			}
		}

		return entry;
	}

	/**
	 * Get full entry including password
	 */
	async getEntry(entryPath: string): Promise<Entry> {
		if (!(await this.isAvailable())) {
			throw new Error('keepassxc-cli is not available');
		}
		this.ensureUnlocked();

		const { stdout } = await execWithStdin(
			'keepassxc-cli',
			['show', this.vaultPath, entryPath],
			`${this.masterPassword}\n`
		);

		return this.parseShowOutput(stdout);
	}

	/**
	 * Create new entry in vault
	 */
	async createEntry(entryPath: string, fields: EntryFields): Promise<void> {
		if (!(await this.isAvailable())) {
			throw new Error('keepassxc-cli is not available');
		}
		this.ensureUnlocked();

		const args = ['add', this.vaultPath];

		if (fields.username) {
			args.push('-u', fields.username);
		}
		if (fields.url) {
			args.push('--url', fields.url);
		}
		args.push('-p', entryPath);

		// Pipe master password + entry password
		const stdinInput = `${this.masterPassword}\n${fields.password || ''}\n`;

		await execWithStdin('keepassxc-cli', args, stdinInput);
	}

	/**
	 * Edit existing entry in vault
	 */
	async editEntry(entryPath: string, fields: EntryFields): Promise<void> {
		if (!(await this.isAvailable())) {
			throw new Error('keepassxc-cli is not available');
		}
		this.ensureUnlocked();

		const args = ['edit', this.vaultPath];

		if (fields.username !== undefined) {
			args.push('-u', fields.username);
		}
		if (fields.url !== undefined) {
			args.push('--url', fields.url);
		}

		// If password is being updated, use -p flag
		if (fields.password !== undefined) {
			args.push('-p');
		}

		args.push(entryPath);

		// Pipe master password + new password (if updating)
		const stdinInput = fields.password
			? `${this.masterPassword}\n${fields.password}\n`
			: `${this.masterPassword}\n`;

		await execWithStdin('keepassxc-cli', args, stdinInput);
	}

	/**
	 * Delete entry from vault
	 */
	async deleteEntry(entryPath: string): Promise<void> {
		if (!(await this.isAvailable())) {
			throw new Error('keepassxc-cli is not available');
		}
		this.ensureUnlocked();

		await execWithStdin(
			'keepassxc-cli',
			['rm', this.vaultPath, entryPath],
			`${this.masterPassword}\n`
		);
	}

	/**
	 * Initialize new vault file
	 */
	async initVault(masterPassword: string): Promise<void> {
		if (!(await this.isAvailable())) {
			throw new Error('keepassxc-cli is not available');
		}

		await execWithStdin(
			'keepassxc-cli',
			['db-create', this.vaultPath, '-p'],
			`${masterPassword}\n`
		);
	}

	/**
	 * Get vault path (for testing/debugging)
	 */
	getVaultPath(): string {
		return this.vaultPath;
	}
}
