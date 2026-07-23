#!/usr/bin/env node
/**
 * AXI token-benchmark harness (#336; formal runs happen at cutover, #342).
 *
 * Compares representative agent reads across surfaces:
 *   - v3 falcon CLI TOON (default agent surface)
 *   - v3 falcon CLI JSON (--json escape hatch)
 *   - v2 /api/work JSON (the interface being replaced)
 *
 * Token counts are estimated at ~4 chars/token (order-of-magnitude comparison;
 * the cutover benchmark can swap in a real tokenizer).
 *
 * Usage: node scripts/axi-benchmark.mjs [--url http://localhost:3000]
 * Requires FALCON_DASH_TOKEN or a token file (same discovery as the CLI).
 */

import { execFileSync } from 'node:child_process';

const urlFlag = process.argv.indexOf('--url');
const baseUrl = urlFlag !== -1 ? process.argv[urlFlag + 1] : 'http://127.0.0.1:3000';

function estimateTokens(text) {
	return Math.round(text.length / 4);
}

function falcon(args) {
	return execFileSync('node', ['bin/falcon.js', ...args], {
		env: { ...process.env, FALCON_DASH_URL: baseUrl },
		encoding: 'utf-8'
	});
}

async function v2(path) {
	const response = await fetch(baseUrl + path);
	return await response.text();
}

const rows = [];

function record(name, text) {
	rows.push({ surface: name, chars: text.length, est_tokens: estimateTokens(text) });
}

record('v3 CLI TOON: task list', falcon(['task', 'list', '--active', 'true']));
record('v3 CLI JSON: task list', falcon(['task', 'list', '--active', 'true', '--json']));
record('v2 API JSON: work items', await v2('/api/work/items'));

const first = falcon(['task', 'list', '--active', 'true', '--fields', 'id,title,status']);
record('v3 CLI TOON: list --fields id,title,status', first);

console.table(rows);
console.log('\nLower is better. v3 TOON list should beat v2 JSON while keeping enough to act (doc 04).');
