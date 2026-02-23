import { mkdir, readFile, writeFile, access } from 'fs/promises';
import { exec } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';

export async function createWorkspace(
	workspacePath: string,
	mainWorkspacePath: string
): Promise<void> {
	await mkdir(workspacePath, { recursive: true });

	const bootstrapSrc = join(mainWorkspacePath, 'BOOTSTRAP.md');
	const bootstrapDest = join(workspacePath, 'BOOTSTRAP.md');

	try {
		const content = await readFile(bootstrapSrc, 'utf-8');
		if (content.includes('<!-- PEERS:START -->')) {
			await writeFile(bootstrapDest, content, 'utf-8');
		}
	} catch {
		// BOOTSTRAP.md doesn't exist in main workspace — skip silently
	}
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
