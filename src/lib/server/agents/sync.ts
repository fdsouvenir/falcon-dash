import { mkdir, access } from 'fs/promises';
import { exec } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';

export async function createWorkspace(workspacePath: string): Promise<void> {
	await mkdir(workspacePath, { recursive: true });
}

export async function triggerSyncPeers(): Promise<boolean> {
	const candidates = [
		join(homedir(), '.openclaw', 'sync-peers.sh'),
		'/root/.openclaw/sync-peers.sh'
	];

	for (const scriptPath of candidates) {
		try {
			await access(scriptPath);
			return new Promise((resolve) => {
				exec(`bash "${scriptPath}"`, { timeout: 30_000 }, (err) => {
					resolve(!err);
				});
			});
		} catch {
			continue;
		}
	}

	return false;
}
