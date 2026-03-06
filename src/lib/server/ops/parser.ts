/**
 * OpenClaw JSONL session file parser.
 *
 * JSONL format (one JSON object per line):
 * - Wrapper: { type: "message", id, parentId, timestamp, message: { role, content, ... } }
 * - Tool calls: message.role="assistant", message.content=[{type:"toolCall", id, name, arguments}]
 * - Tool results: message.role="toolResult", message.toolCallId, message.toolName, message.content=[{text}], message.details
 *
 * Correlation: toolCall.id === toolResult.toolCallId
 */

import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import os from 'node:os';

export const SESSIONS_DIR = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions');

export function sessionPath(sessionId: string): string {
	return path.join(SESSIONS_DIR, `${sessionId}.jsonl`);
}

export interface OpsEntry {
	id: string;
	toolName: string;
	arguments: Record<string, unknown>;
	result?: {
		text: string;
		exitCode?: number;
		durationMs?: number;
		cwd?: string;
	};
	timestamp: number;
	status: 'running' | 'success' | 'error';
	sessionId: string;
}

interface RawToolCall {
	type: 'toolCall';
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

interface RawInnerMessage {
	role?: string;
	content?: unknown;
	toolCallId?: string;
	toolName?: string;
	details?: Record<string, unknown>;
	timestamp?: number;
}

interface RawWrapper {
	type: string;
	timestamp?: number;
	createdAt?: string | number;
	message?: RawInnerMessage;
	// Legacy flat format (fallback)
	role?: string;
	content?: unknown;
	toolCallId?: string;
	toolName?: string;
	details?: Record<string, unknown>;
}

/**
 * Extract the inner message from a JSONL line.
 * Handles both wrapped format { type, message: { role, ... } }
 * and flat format { type, role, ... }.
 */
function unwrap(raw: RawWrapper): RawInnerMessage | null {
	if (raw.type !== 'message') return null;
	// Wrapped format (standard OpenClaw)
	if (raw.message && typeof raw.message === 'object') {
		return raw.message;
	}
	// Flat format (fallback)
	if (raw.role) {
		return raw as unknown as RawInnerMessage;
	}
	return null;
}

function extractTimestamp(raw: RawWrapper, inner: RawInnerMessage, lineIndex: number): number {
	// Prefer wrapper timestamp
	if (typeof raw.timestamp === 'number' && raw.timestamp > 0) return raw.timestamp;
	// Then inner message timestamp
	if (typeof inner.timestamp === 'number' && inner.timestamp > 0) return inner.timestamp;
	if (raw.createdAt) {
		const t = new Date(raw.createdAt as string).getTime();
		if (!isNaN(t)) return t;
	}
	return lineIndex;
}

/**
 * Parse a JSONL session file and return correlated OpsEntry[].
 */
export async function parseSession(
	sessionId: string,
	opts: { types?: 'exec' | 'all'; limit?: number; offset?: number } = {}
): Promise<OpsEntry[]> {
	const filepath = sessionPath(sessionId);
	if (!fs.existsSync(filepath)) return [];

	const { types = 'all', limit = 50, offset = 0 } = opts;

	const toolCalls = new Map<string, { call: RawToolCall; timestamp: number }>();
	const toolResults = new Map<string, RawInnerMessage>();

	const rl = readline.createInterface({
		input: fs.createReadStream(filepath, { encoding: 'utf8' }),
		crlfDelay: Infinity
	});

	let lineIndex = 0;

	for await (const line of rl) {
		if (!line.trim()) {
			lineIndex++;
			continue;
		}

		let raw: RawWrapper;
		try {
			raw = JSON.parse(line);
		} catch {
			lineIndex++;
			continue;
		}

		const inner = unwrap(raw);
		if (!inner) {
			lineIndex++;
			continue;
		}

		const ts = extractTimestamp(raw, inner, lineIndex);

		if (inner.role === 'assistant' && Array.isArray(inner.content)) {
			for (const item of inner.content as RawToolCall[]) {
				if (item.type === 'toolCall' && item.id) {
					toolCalls.set(item.id, { call: item, timestamp: ts });
				}
			}
		} else if (inner.role === 'toolResult' && inner.toolCallId) {
			toolResults.set(inner.toolCallId, inner);
		}

		lineIndex++;
	}

	// Correlate calls with results
	const entries: OpsEntry[] = [];

	for (const [id, { call, timestamp }] of toolCalls) {
		const toolName = call.name;
		if (types === 'exec' && toolName !== 'exec') continue;

		const result = toolResults.get(id);
		let status: OpsEntry['status'] = 'running';
		let entryResult: OpsEntry['result'] | undefined;

		if (result) {
			const details = result.details ?? {};
			const exitCode = (details.exitCode as number | null) ?? null;
			const content = Array.isArray(result.content) ? result.content : [];
			const text = content
				.map((c: { text?: string }) => c.text ?? '')
				.join('')
				.trim();

			entryResult = {
				text,
				exitCode: exitCode !== null ? exitCode : undefined,
				durationMs: details.durationMs as number | undefined,
				cwd: details.cwd as string | undefined
			};

			if (exitCode === null || exitCode === undefined) {
				status = 'success';
			} else {
				status = exitCode === 0 ? 'success' : 'error';
			}
		}

		entries.push({
			id,
			toolName,
			arguments: call.arguments ?? {},
			result: entryResult,
			timestamp,
			status,
			sessionId
		});
	}

	entries.sort((a, b) => b.timestamp - a.timestamp);
	return entries.slice(offset, offset + limit);
}

/**
 * Parse ALL recent sessions and return merged entries.
 * Reads the most recent `maxSessions` files by mtime.
 */
export async function parseAllSessions(
	opts: { types?: 'exec' | 'all'; limit?: number; maxSessions?: number } = {}
): Promise<OpsEntry[]> {
	const { types = 'all', limit = 100, maxSessions = 10 } = opts;

	let files: fs.Dirent[];
	try {
		files = fs.readdirSync(SESSIONS_DIR, { withFileTypes: true });
	} catch {
		return [];
	}

	const jsonlFiles = files
		.filter((f) => f.isFile() && f.name.endsWith('.jsonl') && !f.name.endsWith('.lock'))
		.map((f) => {
			const filepath = path.join(SESSIONS_DIR, f.name);
			const stat = fs.statSync(filepath);
			return { name: f.name, sessionId: f.name.replace(/\.jsonl$/, ''), mtime: stat.mtimeMs };
		})
		.sort((a, b) => b.mtime - a.mtime)
		.slice(0, maxSessions);

	const allEntries: OpsEntry[] = [];

	for (const file of jsonlFiles) {
		// Parse each session with a generous limit, we'll sort and trim after
		const entries = await parseSession(file.sessionId, { types, limit: 500 });
		allEntries.push(...entries);
	}

	// Sort all entries by timestamp descending, return limited
	allEntries.sort((a, b) => b.timestamp - a.timestamp);
	return allEntries.slice(0, limit);
}

/**
 * Read new lines from a JSONL file starting at a given byte offset.
 * Returns new correlated entries and the new byte offset.
 */
export function readNewLines(
	sessionId: string,
	fromByte: number
): { entries: OpsEntry[]; newOffset: number } {
	const filepath = sessionPath(sessionId);
	if (!fs.existsSync(filepath)) return { entries: [], newOffset: fromByte };

	const stat = fs.statSync(filepath);
	if (stat.size <= fromByte) return { entries: [], newOffset: fromByte };

	const fd = fs.openSync(filepath, 'r');
	const buffer = Buffer.alloc(stat.size - fromByte);
	fs.readSync(fd, buffer, 0, buffer.length, fromByte);
	fs.closeSync(fd);

	const text = buffer.toString('utf8');
	const lines = text.split('\n');

	const toolCalls = new Map<string, { call: RawToolCall; timestamp: number }>();
	const toolResults = new Map<string, RawInnerMessage>();
	let lineIndex = 0;

	for (const line of lines) {
		if (!line.trim()) {
			lineIndex++;
			continue;
		}

		let raw: RawWrapper;
		try {
			raw = JSON.parse(line);
		} catch {
			lineIndex++;
			continue;
		}

		const inner = unwrap(raw);
		if (!inner) {
			lineIndex++;
			continue;
		}

		const ts = typeof raw.timestamp === 'number' ? raw.timestamp : (typeof inner.timestamp === 'number' ? inner.timestamp : lineIndex);

		if (inner.role === 'assistant' && Array.isArray(inner.content)) {
			for (const item of inner.content as RawToolCall[]) {
				if (item.type === 'toolCall' && item.id) {
					toolCalls.set(item.id, { call: item, timestamp: ts });
				}
			}
		} else if (inner.role === 'toolResult' && inner.toolCallId) {
			toolResults.set(inner.toolCallId, inner);
		}

		lineIndex++;
	}

	const entries: OpsEntry[] = [];

	for (const [id, { call, timestamp }] of toolCalls) {
		const result = toolResults.get(id);
		let status: OpsEntry['status'] = 'running';
		let entryResult: OpsEntry['result'] | undefined;

		if (result) {
			const details = result.details ?? {};
			const exitCode = (details.exitCode as number | null) ?? null;
			const content = Array.isArray(result.content) ? result.content : [];
			const text = content.map((c: { text?: string }) => c.text ?? '').join('').trim();
			entryResult = {
				text,
				exitCode: exitCode !== null ? exitCode : undefined,
				durationMs: details.durationMs as number | undefined,
				cwd: details.cwd as string | undefined
			};
			status = exitCode === null || exitCode === undefined ? 'success' : exitCode === 0 ? 'success' : 'error';
		}

		entries.push({ id, toolName: call.name, arguments: call.arguments ?? {}, result: entryResult, timestamp, status, sessionId });
	}

	return { entries, newOffset: stat.size };
}
