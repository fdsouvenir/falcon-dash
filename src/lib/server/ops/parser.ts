/**
 * OpenClaw JSONL session file parser.
 *
 * JSONL format (one JSON object per line):
 * - Tool calls: type="message", role="assistant", content=[{type:"toolCall", id, name, arguments}]
 * - Tool results: type="message", role="toolResult", toolCallId, toolName, content=[{text}], details={exitCode,durationMs,cwd}
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
}

interface RawToolCall {
	type: 'toolCall';
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

interface RawToolResult {
	toolCallId: string;
	toolName: string;
	content: Array<{ type?: string; text?: string }>;
	details?: {
		exitCode?: number | null;
		durationMs?: number;
		cwd?: string;
	};
}

interface RawMessage {
	type: string;
	role?: string;
	content?: unknown;
	toolCallId?: string;
	toolName?: string;
	details?: Record<string, unknown>;
	timestamp?: number;
	createdAt?: string | number;
}

function extractTimestamp(raw: RawMessage, lineIndex: number): number {
	if (typeof raw.timestamp === 'number' && raw.timestamp > 0) return raw.timestamp;
	if (raw.createdAt) {
		const t = new Date(raw.createdAt as string).getTime();
		if (!isNaN(t)) return t;
	}
	// Fall back to line order — use a synthetic timestamp based on position
	return lineIndex;
}

/**
 * Parse a JSONL session file and return correlated OpsEntry[].
 * Reading is done line-by-line for memory efficiency.
 */
export async function parseSession(
	sessionId: string,
	opts: { types?: 'exec' | 'all'; limit?: number; offset?: number } = {}
): Promise<OpsEntry[]> {
	const filepath = sessionPath(sessionId);
	if (!fs.existsSync(filepath)) return [];

	const { types = 'all', limit = 50, offset = 0 } = opts;

	const toolCalls = new Map<string, { call: RawToolCall; timestamp: number; lineIndex: number }>();
	const toolResults = new Map<string, RawToolResult>();

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

		let raw: RawMessage;
		try {
			raw = JSON.parse(line);
		} catch {
			// Skip malformed lines
			lineIndex++;
			continue;
		}

		if (raw.type !== 'message') {
			lineIndex++;
			continue;
		}

		const ts = extractTimestamp(raw, lineIndex);

		if (raw.role === 'assistant' && Array.isArray(raw.content)) {
			// Tool calls are embedded in assistant messages
			for (const item of raw.content as RawToolCall[]) {
				if (item.type === 'toolCall' && item.id) {
					toolCalls.set(item.id, { call: item, timestamp: ts, lineIndex });
				}
			}
		} else if (raw.role === 'toolResult') {
			// Tool result message
			const result = raw as unknown as RawToolResult;
			if (result.toolCallId) {
				toolResults.set(result.toolCallId, result);
			}
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
			const exitCode = result.details?.exitCode ?? null;
			const text = result.content
				.map((c) => c.text ?? '')
				.join('')
				.trim();

			entryResult = {
				text,
				exitCode: exitCode !== null ? exitCode : undefined,
				durationMs: result.details?.durationMs,
				cwd: result.details?.cwd
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
			status
		});
	}

	// Sort most recent first (by timestamp desc)
	entries.sort((a, b) => b.timestamp - a.timestamp);

	return entries.slice(offset, offset + limit);
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
	const toolResults = new Map<string, RawToolResult>();
	let lineIndex = 0;

	for (const line of lines) {
		if (!line.trim()) {
			lineIndex++;
			continue;
		}

		let raw: RawMessage;
		try {
			raw = JSON.parse(line);
		} catch {
			lineIndex++;
			continue;
		}

		if (raw.type !== 'message') {
			lineIndex++;
			continue;
		}

		const ts = extractTimestamp(raw, lineIndex);

		if (raw.role === 'assistant' && Array.isArray(raw.content)) {
			for (const item of raw.content as RawToolCall[]) {
				if (item.type === 'toolCall' && item.id) {
					toolCalls.set(item.id, { call: item, timestamp: ts });
				}
			}
		} else if (raw.role === 'toolResult') {
			const result = raw as unknown as RawToolResult;
			if (result.toolCallId) {
				toolResults.set(result.toolCallId, result);
			}
		}

		lineIndex++;
	}

	const entries: OpsEntry[] = [];

	for (const [id, { call, timestamp }] of toolCalls) {
		const result = toolResults.get(id);
		let status: OpsEntry['status'] = 'running';
		let entryResult: OpsEntry['result'] | undefined;

		if (result) {
			const exitCode = result.details?.exitCode ?? null;
			const text = result.content
				.map((c) => c.text ?? '')
				.join('')
				.trim();
			entryResult = {
				text,
				exitCode: exitCode !== null ? exitCode : undefined,
				durationMs: result.details?.durationMs,
				cwd: result.details?.cwd
			};
			status = exitCode === null || exitCode === undefined ? 'success' : exitCode === 0 ? 'success' : 'error';
		}

		entries.push({ id, toolName: call.name, arguments: call.arguments ?? {}, result: entryResult, timestamp, status });
	}

	return { entries, newOffset: stat.size };
}
