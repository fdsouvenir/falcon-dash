import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SESSIONS_DIR = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions');

export interface SessionInfo {
	filename: string;
	sessionId: string;
	mtime: number;
	size: number;
}

export const GET: RequestHandler = async () => {
	try {
		let files: fs.Dirent[];
		try {
			files = fs.readdirSync(SESSIONS_DIR, { withFileTypes: true });
		} catch {
			// Directory doesn't exist yet
			return json({ sessions: [] });
		}

		const sessions: SessionInfo[] = files
			.filter((f) => f.isFile() && f.name.endsWith('.jsonl') && !f.name.endsWith('.lock'))
			.map((f) => {
				const filepath = path.join(SESSIONS_DIR, f.name);
				const stat = fs.statSync(filepath);
				return {
					filename: f.name,
					sessionId: f.name.replace(/\.jsonl$/, ''),
					mtime: stat.mtimeMs,
					size: stat.size
				};
			})
			.sort((a, b) => b.mtime - a.mtime);

		return json({ sessions });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ error: msg }, { status: 500 });
	}
};
